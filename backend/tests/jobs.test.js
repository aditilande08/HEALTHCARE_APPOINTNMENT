const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');
const llmService = require('../src/services/llmService');
const emailService = require('../src/services/emailService');
const { sendAppointmentReminders, sendMedicationReminders } = require('../src/jobs/reminderJob');
const { retryFailedEmails } = require('../src/jobs/emailRetryJob');

jest.mock('../src/services/llmService');
jest.mock('../src/services/emailService');

let patientToken;
let doctorToken;
let doctorId;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@jobstest.com' } } });

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const config = require('../src/config');

  llmService.generatePreVisitSummary.mockResolvedValue(null);
  llmService.generatePostVisitSummary.mockResolvedValue('Summary text');
  emailService.processNotification.mockResolvedValue();
  emailService.processPendingEmails.mockResolvedValue(2);

  const pRes = await request(app).post('/api/auth/register').send({
    name: 'Jobs Patient',
    email: 'patient@jobstest.com',
    password: 'patientpass123',
  });
  patientToken = pRes.body.accessToken;

  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@jobstest.com',
      passwordHash: await bcrypt.hash('adminpass', 10),
      role: 'ADMIN',
    },
  });
  const adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, config.jwt.secret, { expiresIn: '1h' });

  const drRes = await request(app)
    .post('/api/admin/doctors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Dr. Jobs',
      email: 'drjobs@jobstest.com',
      password: 'drpassword123',
      specialisation: 'General',
      slotDuration: 30,
      workingHours: {
        mon: { start: '09:00', end: '17:00' },
        tue: { start: '09:00', end: '17:00' },
        wed: { start: '09:00', end: '17:00' },
        thu: { start: '09:00', end: '17:00' },
        fri: { start: '09:00', end: '17:00' },
        sat: null,
        sun: null,
      },
    });
  doctorId = drRes.body.doctor.id;

  const drLogin = await request(app).post('/api/auth/login').send({
    email: 'drjobs@jobstest.com',
    password: 'drpassword123',
  });
  doctorToken = drLogin.body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@jobstest.com' } } });
  await prisma.$disconnect();
});

beforeEach(() => jest.clearAllMocks());

describe('Appointment reminder job', () => {
  it('sends reminder for appointment within next 24 hours', async () => {
    emailService.processNotification.mockResolvedValue();

    // create an appointment that is ~12 hours from now
    const soon = new Date(Date.now() + 12 * 60 * 60 * 1000);

    // insert directly to bypass slot validation (it's in a test context)
    const patient = await prisma.patient.findFirst({
      where: { user: { email: 'patient@jobstest.com' } },
    });
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });

    const appt = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        scheduledAt: soon,
        status: 'CONFIRMED',
      },
    });

    const count = await sendAppointmentReminders();
    expect(count).toBeGreaterThan(0);
    expect(emailService.processNotification).toHaveBeenCalled();

    // verify reminderSentAt was set
    const updated = await prisma.appointment.findUnique({ where: { id: appt.id } });
    expect(updated.reminderSentAt).not.toBeNull();
  });

  it('does not send duplicate reminders', async () => {
    emailService.processNotification.mockResolvedValue();

    // run again — the appointment already has reminderSentAt set
    const countBefore = emailService.processNotification.mock.calls.length;
    await sendAppointmentReminders();
    const countAfter = emailService.processNotification.mock.calls.length;

    // no new calls for the already-reminded appointment
    expect(countAfter).toBe(countBefore);
  });
});

describe('Medication reminder job', () => {
  it('sends medication reminder for active prescription', async () => {
    emailService.processNotification.mockResolvedValue();

    const patient = await prisma.patient.findFirst({
      where: { user: { email: 'patient@jobstest.com' } },
    });
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });

    // create a COMPLETED appointment from yesterday with a 7-day prescription
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const appt = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        scheduledAt: yesterday,
        status: 'COMPLETED',
        prescriptions: [
          { medication: 'Amoxicillin', dose: '500mg', frequency: '3x daily', days: 7 },
        ],
      },
    });

    const count = await sendMedicationReminders();
    expect(count).toBeGreaterThan(0);
    expect(emailService.processNotification).toHaveBeenCalled();

    // clean up
    await prisma.appointment.delete({ where: { id: appt.id } });
  });

  it('skips expired prescriptions', async () => {
    emailService.processNotification.mockResolvedValue();

    const patient = await prisma.patient.findFirst({
      where: { user: { email: 'patient@jobstest.com' } },
    });
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });

    // appointment from 10 days ago with a 5-day prescription (already expired)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const appt = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        scheduledAt: tenDaysAgo,
        status: 'COMPLETED',
        prescriptions: [
          { medication: 'Aspirin', dose: '100mg', frequency: 'once daily', days: 5 },
        ],
      },
    });

    const callsBefore = emailService.processNotification.mock.calls.length;
    await sendMedicationReminders();
    const callsAfter = emailService.processNotification.mock.calls.length;

    // no new calls — prescription is expired
    expect(callsAfter).toBe(callsBefore);

    await prisma.appointment.delete({ where: { id: appt.id } });
  });
});

describe('Email retry job', () => {
  it('calls processPendingEmails and returns count', async () => {
    emailService.processPendingEmails.mockResolvedValue(3);
    const count = await retryFailedEmails();
    expect(count).toBe(3);
    expect(emailService.processPendingEmails).toHaveBeenCalled();
  });
});
