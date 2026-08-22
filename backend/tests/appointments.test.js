const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

let patientToken;
let patient2Token;
let doctorToken;
let patientId;
let doctorId;
let appointmentId;

const FUTURE_SLOT = '2030-03-10T09:00:00.000Z'; // Monday
const FUTURE_SLOT_2 = '2030-03-10T09:30:00.000Z';

const workingHours = {
  mon: { start: '09:00', end: '17:00' },
  tue: { start: '09:00', end: '17:00' },
  wed: { start: '09:00', end: '17:00' },
  thu: { start: '09:00', end: '17:00' },
  fri: { start: '09:00', end: '17:00' },
  sat: null,
  sun: null,
};

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@appttest.com' } } });

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const config = require('../src/config');

  // patient 1
  const p1Res = await request(app).post('/api/auth/register').send({
    name: 'Patient One',
    email: 'patient1@appttest.com',
    password: 'patientpass123',
  });
  patientToken = p1Res.body.accessToken;
  patientId = p1Res.body.user.patient.id;

  // patient 2 (to test isolation)
  const p2Res = await request(app).post('/api/auth/register').send({
    name: 'Patient Two',
    email: 'patient2@appttest.com',
    password: 'patientpass123',
  });
  patient2Token = p2Res.body.accessToken;

  // create doctor via admin
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@appttest.com',
      passwordHash: await bcrypt.hash('adminpass', 10),
      role: 'ADMIN',
    },
  });
  const adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, config.jwt.secret, { expiresIn: '1h' });

  const drRes = await request(app)
    .post('/api/admin/doctors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Dr. Appt',
      email: 'drappt@appttest.com',
      password: 'drpassword123',
      specialisation: 'General',
      slotDuration: 30,
      workingHours,
    });

  doctorId = drRes.body.doctor.id;

  // doctor token for testing doctor-side access
  const drLoginRes = await request(app).post('/api/auth/login').send({
    email: 'drappt@appttest.com',
    password: 'drpassword123',
  });
  doctorToken = drLoginRes.body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@appttest.com' } } });
  await prisma.$disconnect();
});

describe('POST /api/appointments (booking)', () => {
  it('books an appointment successfully', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: FUTURE_SLOT, symptoms: 'Headache and fever' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.doctorId).toBe(doctorId);
    appointmentId = res.body.id;
  });

  it('rejects double booking of the same slot', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patient2Token}`)
      .send({ doctorId, scheduledAt: FUTURE_SLOT });

    expect(res.status).toBe(409);
  });

  it('rejects booking a past slot', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: '2020-01-01T09:00:00.000Z' });

    expect(res.status).toBe(400);
  });

  it('rejects booking on a doctor leave day', async () => {
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const config = require('../src/config');

    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@appttest.com' } });
    const adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, config.jwt.secret, { expiresIn: '1h' });

    // mark 2030-03-11 (Tuesday) as leave
    await request(app)
      .post(`/api/admin/doctors/${doctorId}/leaves`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2030-03-11', reason: 'Conference' });

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId, scheduledAt: '2030-03-11T09:00:00.000Z' });

    expect(res.status).toBe(409);
  });

  it('rejects doctor trying to book', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ doctorId, scheduledAt: FUTURE_SLOT_2 });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/appointments', () => {
  it('patient sees only their own appointments', async () => {
    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.every((a) => a.patientId === patientId)).toBe(true);
  });

  it('doctor sees appointments for their profile', async () => {
    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.every((a) => a.doctorId === doctorId)).toBe(true);
  });
});

describe('GET /api/appointments/:id', () => {
  it('patient can view their own appointment', async () => {
    const res = await request(app)
      .get(`/api/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(appointmentId);
  });

  it('another patient cannot view the appointment', async () => {
    const res = await request(app)
      .get(`/api/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${patient2Token}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/appointments/:id/reschedule', () => {
  it('patient can reschedule to an available slot', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ scheduledAt: FUTURE_SLOT_2 });

    expect(res.status).toBe(200);
    expect(new Date(res.body.scheduledAt).toISOString()).toBe(FUTURE_SLOT_2);
  });

  it('cannot reschedule to an already-taken slot', async () => {
    // book FUTURE_SLOT_2 with patient2 first
    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patient2Token}`)
      .send({ doctorId, scheduledAt: FUTURE_SLOT });

    // try to reschedule patient1's appointment to the same slot
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ scheduledAt: FUTURE_SLOT });

    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/appointments/:id/cancel', () => {
  it('patient can cancel their appointment', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('cannot cancel an already-cancelled appointment', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(400);
  });

  it('cancelled slot can be rebooked', async () => {
    // The original FUTURE_SLOT_2 appointment (patient1) was cancelled above.
    // patient2 should be able to book it now.
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patient2Token}`)
      .send({ doctorId, scheduledAt: FUTURE_SLOT_2 });

    expect(res.status).toBe(201);
  });
});

describe('Concurrent booking (simulated)', () => {
  const CONCURRENT_SLOT = '2030-04-07T10:00:00.000Z'; // Monday

  it('only one of two simultaneous requests succeeds', async () => {
    // fire both requests at the same time
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ doctorId, scheduledAt: CONCURRENT_SLOT }),
      request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patient2Token}`)
        .send({ doctorId, scheduledAt: CONCURRENT_SLOT }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // exactly one 201 and one 409
    expect(statuses).toEqual([201, 409]);
  });
});
