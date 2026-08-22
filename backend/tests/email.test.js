const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');
const nodemailer = require('nodemailer');
const llmService = require('../src/services/llmService');

jest.mock('../src/services/llmService');
jest.mock('nodemailer');

// mock transporter
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
nodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail });

// make sure SMTP env is set so transporter initialises
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'testpass';
process.env.EMAIL_FROM = 'test@test.com';

const emailService = require('../src/services/emailService');

let patientToken;
let doctorToken;
let doctorId;
let appointmentId;
let notificationId;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@emailtest.com' } } });

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const config = require('../src/config');

  llmService.generatePreVisitSummary.mockResolvedValue(null);
  llmService.generatePostVisitSummary.mockResolvedValue('Patient is healthy. No medication needed.');

  const pRes = await request(app).post('/api/auth/register').send({
    name: 'Email Patient',
    email: 'patient@emailtest.com',
    password: 'patientpass123',
  });
  patientToken = pRes.body.accessToken;

  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@emailtest.com',
      passwordHash: await bcrypt.hash('adminpass', 10),
      role: 'ADMIN',
    },
  });
  const adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, config.jwt.secret, { expiresIn: '1h' });

  const drRes = await request(app)
    .post('/api/admin/doctors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Dr. Email',
      email: 'dremail@emailtest.com',
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
    email: 'dremail@emailtest.com',
    password: 'drpassword123',
  });
  doctorToken = drLoginRes.body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@emailtest.com' } } });
  await prisma.$disconnect();
});

beforeEach(() => mockSendMail.mockClear());

describe('Email notifications', () => {
  it('booking creates PENDING email notifications', async () => {
    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: '2030-10-06T09:00:00.000Z' });

    expect(bookRes.status).toBe(201);
    appointmentId = bookRes.body.id;

    const notifications = await prisma.notificationLog.findMany({
      where: { appointmentId, type: 'BOOKING_CONFIRMATION', channel: 'EMAIL' },
    });

    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0].status).toBe('PENDING');
    notificationId = notifications[0].id;
  });

  it('processNotification sends email and marks SENT', async () => {
    await emailService.processNotification(notificationId);

    expect(mockSendMail).toHaveBeenCalled();

    const updated = await prisma.notificationLog.findUnique({ where: { id: notificationId } });
    expect(updated.status).toBe('SENT');
  });

  it('processPendingEmails processes the queue', async () => {
    // book another to add new pending notifications
    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: '2030-10-06T09:30:00.000Z' });

    const count = await emailService.processPendingEmails();
    expect(count).toBeGreaterThan(0);
    expect(mockSendMail).toHaveBeenCalled();
  });

  it('marks notification FAILED when sendMail throws, increments attempt', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));

    // book a fresh appointment to get a fresh PENDING notification
    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: '2030-10-06T10:00:00.000Z' });

    const notifications = await prisma.notificationLog.findMany({
      where: { appointmentId: bookRes.body.id, type: 'BOOKING_CONFIRMATION', channel: 'EMAIL' },
    });
    const id = notifications[0].id;

    await emailService.processNotification(id);

    const updated = await prisma.notificationLog.findUnique({ where: { id } });
    expect(updated.status).toBe('FAILED');
    expect(updated.attempt).toBe(1);
    expect(updated.error).toContain('SMTP');
  });

  it('stops retrying after 3 failed attempts', async () => {
    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: '2030-10-06T10:30:00.000Z' });

    const notifications = await prisma.notificationLog.findMany({
      where: { appointmentId: bookRes.body.id, type: 'BOOKING_CONFIRMATION', channel: 'EMAIL' },
    });
    const id = notifications[0].id;

    // force 3 attempts to fail
    await prisma.notificationLog.update({ where: { id }, data: { attempt: 3, status: 'FAILED' } });

    // processPendingEmails should NOT pick this one up (attempt >= 3)
    mockSendMail.mockClear();
    await emailService.processPendingEmails();

    const updated = await prisma.notificationLog.findUnique({ where: { id } });
    // should still be 3, not incremented
    expect(updated.attempt).toBe(3);
  });

  it('cancellation creates a PENDING cancellation notification', async () => {
    await request(app)
      .patch(`/api/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`);

    const notification = await prisma.notificationLog.findFirst({
      where: { appointmentId, type: 'CANCELLATION', channel: 'EMAIL' },
    });
    expect(notification).toBeTruthy();
    expect(notification.status).toBe('PENDING');
  });
});
