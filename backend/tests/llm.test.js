const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');
const llmService = require('../src/services/llmService');

// mock LLM so tests don't need an API key
jest.mock('../src/services/llmService');

let patientToken;
let patientId;
let doctorId;
let appointmentId;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@llmtest.com' } } });

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const config = require('../src/config');

  const pRes = await request(app).post('/api/auth/register').send({
    name: 'LLM Patient',
    email: 'patient@llmtest.com',
    password: 'patientpass123',
  });
  patientToken = pRes.body.accessToken;
  patientId = pRes.body.user.patient.id;

  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@llmtest.com',
      passwordHash: await bcrypt.hash('adminpass', 10),
      role: 'ADMIN',
    },
  });
  const adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, config.jwt.secret, { expiresIn: '1h' });

  const drRes = await request(app)
    .post('/api/admin/doctors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Dr. LLM',
      email: 'drllm@llmtest.com',
      password: 'drpassword123',
      specialisation: 'Neurology',
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
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@llmtest.com' } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LLM pre-visit summary', () => {
  it('stores summary when LLM succeeds', async () => {
    const mockSummary = {
      urgency: 'Medium',
      chiefComplaint: 'Patient reports persistent headache for 3 days',
      suggestedQuestions: [
        'When did the headache start?',
        'Have you taken any pain medication?',
        'Is there any vision disturbance?',
      ],
    };
    llmService.generatePreVisitSummary.mockResolvedValue(mockSummary);

    // book with symptoms
    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId,
        scheduledAt: '2030-06-02T09:00:00.000Z',
        symptoms: 'Persistent headache for 3 days, worse in the morning',
      });

    expect(bookRes.status).toBe(201);
    appointmentId = bookRes.body.id;

    // give the background LLM a moment to resolve
    await new Promise((r) => setTimeout(r, 100));

    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    expect(appt.preVisitLlmStatus).toBe('DONE');
    expect(appt.preVisitSummary).toMatchObject({ urgency: 'Medium' });
  });

  it('marks status FAILED when LLM returns null', async () => {
    llmService.generatePreVisitSummary.mockResolvedValue(null);

    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId,
        scheduledAt: '2030-06-02T09:30:00.000Z',
        symptoms: 'Chest pain and shortness of breath',
      });

    expect(bookRes.status).toBe(201);
    await new Promise((r) => setTimeout(r, 100));

    const appt = await prisma.appointment.findUnique({ where: { id: bookRes.body.id } });
    expect(appt.preVisitLlmStatus).toBe('FAILED');
    expect(appt.preVisitSummary).toBeNull();
  });

  it('booking succeeds even when LLM throws', async () => {
    llmService.generatePreVisitSummary.mockRejectedValue(new Error('OpenAI timeout'));

    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId,
        scheduledAt: '2030-06-02T10:00:00.000Z',
        symptoms: 'Stomach pain',
      });

    // booking itself must succeed regardless of LLM failure
    expect(bookRes.status).toBe(201);
  });

  it('sets status SKIPPED when no symptoms provided at booking', async () => {
    llmService.generatePreVisitSummary.mockResolvedValue(null);

    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId,
        scheduledAt: '2030-06-02T10:30:00.000Z',
      });

    expect(bookRes.status).toBe(201);
    expect(bookRes.body.preVisitLlmStatus).toBe('SKIPPED');
    expect(llmService.generatePreVisitSummary).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/appointments/:id/symptoms', () => {
  it('patient can submit symptoms and trigger LLM', async () => {
    const mockSummary = {
      urgency: 'Low',
      chiefComplaint: 'Mild back pain',
      suggestedQuestions: ['Q1', 'Q2', 'Q3'],
    };
    llmService.generatePreVisitSummary.mockResolvedValue(mockSummary);

    // book without symptoms first
    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: '2030-06-03T09:00:00.000Z' });

    const id = bookRes.body.id;

    const sympRes = await request(app)
      .patch(`/api/appointments/${id}/symptoms`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ symptoms: 'Lower back pain after lifting, no radiation' });

    expect(sympRes.status).toBe(200);
    expect(sympRes.body.message).toContain('Symptoms submitted');

    await new Promise((r) => setTimeout(r, 100));

    const appt = await prisma.appointment.findUnique({ where: { id } });
    expect(appt.symptoms).toBe('Lower back pain after lifting, no radiation');
    expect(appt.preVisitLlmStatus).toBe('DONE');
  });

  it('rejects empty symptoms', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/symptoms`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ symptoms: '' });

    expect(res.status).toBe(400);
  });
});
