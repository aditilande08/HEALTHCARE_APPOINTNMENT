const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');
const llmService = require('../src/services/llmService');

jest.mock('../src/services/llmService');

let patientToken;
let doctorToken;
let doctorId;
let appointmentId;

const SLOT = '2030-09-01T09:00:00.000Z'; // Monday

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@notestest.com' } } });

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const config = require('../src/config');

  const pRes = await request(app).post('/api/auth/register').send({
    name: 'Notes Patient',
    email: 'patient@notestest.com',
    password: 'patientpass123',
  });
  patientToken = pRes.body.accessToken;

  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@notestest.com',
      passwordHash: await bcrypt.hash('adminpass', 10),
      role: 'ADMIN',
    },
  });
  const adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, config.jwt.secret, { expiresIn: '1h' });

  const drRes = await request(app)
    .post('/api/admin/doctors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Dr. Notes',
      email: 'drnotes@notestest.com',
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

  const drLoginRes = await request(app).post('/api/auth/login').send({
    email: 'drnotes@notestest.com',
    password: 'drpassword123',
  });
  doctorToken = drLoginRes.body.accessToken;

  // book an appointment
  llmService.generatePreVisitSummary.mockResolvedValue(null);
  const bookRes = await request(app)
    .post('/api/appointments')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({ doctorId, scheduledAt: SLOT, symptoms: 'Knee pain after running' });
  appointmentId = bookRes.body.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@notestest.com' } } });
  await prisma.$disconnect();
});

beforeEach(() => jest.clearAllMocks());

describe('PATCH /api/appointments/:id/notes', () => {
  it('doctor submits notes and prescription, appointment marked COMPLETED', async () => {
    llmService.generatePostVisitSummary.mockResolvedValue(
      'Your visit went well. You have mild tendinitis in your knee. Take Ibuprofen 400mg twice a day with food for 5 days. Rest and apply ice for 15 minutes twice daily. Follow up in 2 weeks if pain persists.'
    );

    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/notes`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        postVisitNotes: 'Patient has mild patellar tendinitis. No structural damage on examination.',
        prescriptions: [
          { medication: 'Ibuprofen', dose: '400mg', frequency: 'twice daily', days: 5 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Notes saved');

    // give background LLM time to settle
    await new Promise((r) => setTimeout(r, 100));

    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    expect(appt.status).toBe('COMPLETED');
    expect(appt.postVisitNotes).toContain('tendinitis');
    expect(appt.prescriptions).toHaveLength(1);
    expect(appt.postVisitLlmStatus).toBe('DONE');
    expect(appt.postVisitSummary).toContain('Ibuprofen');
  });

  it('stores FAILED status when LLM returns null', async () => {
    // book a second appointment
    llmService.generatePreVisitSummary.mockResolvedValue(null);
    llmService.generatePostVisitSummary.mockResolvedValue(null);

    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: '2030-09-01T09:30:00.000Z' });

    const res = await request(app)
      .patch(`/api/appointments/${bookRes.body.id}/notes`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ postVisitNotes: 'Patient is in good health.' });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));

    const appt = await prisma.appointment.findUnique({ where: { id: bookRes.body.id } });
    expect(appt.postVisitLlmStatus).toBe('FAILED');
    expect(appt.postVisitSummary).toBeNull();
    expect(appt.status).toBe('COMPLETED');
  });

  it('rejects patient trying to submit notes', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/notes`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ postVisitNotes: 'Patient self-reporting' });

    expect(res.status).toBe(403);
  });

  it('rejects empty postVisitNotes', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/notes`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ postVisitNotes: '' });

    expect(res.status).toBe(400);
  });

  it('rejects prescription with missing fields', async () => {
    // book a fresh appointment for this test
    llmService.generatePreVisitSummary.mockResolvedValue(null);
    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: '2030-09-01T10:00:00.000Z' });

    const res = await request(app)
      .patch(`/api/appointments/${bookRes.body.id}/notes`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        postVisitNotes: 'All good.',
        prescriptions: [{ medication: 'Aspirin' }], // missing dose, frequency, days
      });

    expect(res.status).toBe(400);
  });
});
