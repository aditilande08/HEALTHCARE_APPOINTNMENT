const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');
const { generateSlots } = require('../src/services/doctorService');

let patientToken;
let doctorId;

const workingHours = {
  mon: { start: '09:00', end: '12:00' },
  tue: { start: '09:00', end: '12:00' },
  wed: null,
  thu: { start: '09:00', end: '12:00' },
  fri: { start: '09:00', end: '12:00' },
  sat: null,
  sun: null,
};

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@doctest.com' } } });

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const config = require('../src/config');

  // create a patient token
  const patientRes = await request(app).post('/api/auth/register').send({
    name: 'Test Patient',
    email: 'patient@doctest.com',
    password: 'patientpass123',
  });
  patientToken = patientRes.body.accessToken;

  // create a doctor via admin
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@doctest.com',
      passwordHash: await bcrypt.hash('adminpass123', 10),
      role: 'ADMIN',
    },
  });
  const adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, config.jwt.secret, { expiresIn: '1h' });

  const drRes = await request(app)
    .post('/api/admin/doctors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Dr. Jones',
      email: 'drjones@doctest.com',
      password: 'drpassword123',
      specialisation: 'Dermatology',
      slotDuration: 30,
      workingHours,
    });

  doctorId = drRes.body.doctor.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@doctest.com' } } });
  await prisma.$disconnect();
});

// ─── Unit tests for slot generation ──────────────────────────────────────────

describe('generateSlots (unit)', () => {
  it('generates correct slots for a working day', () => {
    // a Monday in the future
    const monday = new Date('2030-01-07T00:00:00.000Z');
    const slots = generateSlots(monday, workingHours, 30);

    // 09:00 to 12:00 with 30-min slots = 6 slots
    expect(slots).toHaveLength(6);
    expect(slots[0].getUTCHours()).toBe(9);
    expect(slots[0].getUTCMinutes()).toBe(0);
    expect(slots[5].getUTCHours()).toBe(11);
    expect(slots[5].getUTCMinutes()).toBe(30);
  });

  it('returns empty for a day the doctor does not work', () => {
    // a Wednesday
    const wednesday = new Date('2030-01-09T00:00:00.000Z');
    const slots = generateSlots(wednesday, workingHours, 30);
    expect(slots).toHaveLength(0);
  });

  it('handles 60-minute slots correctly', () => {
    const monday = new Date('2030-01-07T00:00:00.000Z');
    const slots = generateSlots(monday, workingHours, 60);
    // 09:00 to 12:00 with 60-min slots = 3 slots
    expect(slots).toHaveLength(3);
  });
});

// ─── API tests ────────────────────────────────────────────────────────────────

describe('GET /api/doctors', () => {
  it('returns all doctors for authenticated user', async () => {
    const res = await request(app)
      .get('/api/doctors')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((d) => d.specialisation === 'Dermatology')).toBe(true);
  });

  it('filters by specialisation', async () => {
    const res = await request(app)
      .get('/api/doctors?specialisation=Dermatology')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.every((d) => d.specialisation.toLowerCase().includes('dermatology'))).toBe(true);
  });

  it('returns empty array for unknown specialisation', async () => {
    const res = await request(app)
      .get('/api/doctors?specialisation=Wizardry')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/doctors');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/doctors/:doctorId', () => {
  it('returns the doctor profile', async () => {
    const res = await request(app)
      .get(`/api/doctors/${doctorId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(doctorId);
    expect(res.body.specialisation).toBe('Dermatology');
  });

  it('returns 404 for non-existent doctor', async () => {
    const res = await request(app)
      .get('/api/doctors/nonexistent-id')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/doctors/:doctorId/slots', () => {
  it('returns available slots for a working day', async () => {
    // Monday far in the future
    const res = await request(app)
      .get(`/api/doctors/${doctorId}/slots?date=2030-01-07`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.onLeave).toBe(false);
    expect(res.body.slots.length).toBeGreaterThan(0);
    expect(res.body.slots[0].time).toBe('09:00');
  });

  it('returns empty slots for a day the doctor does not work (Wednesday)', async () => {
    const res = await request(app)
      .get(`/api/doctors/${doctorId}/slots?date=2030-01-09`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(0);
  });

  it('returns empty slots for a past date', async () => {
    const res = await request(app)
      .get(`/api/doctors/${doctorId}/slots?date=2020-01-01`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(0);
  });

  it('returns onLeave true when doctor is on leave', async () => {
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const config = require('../src/config');

    // add leave via admin
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@doctest.com' } });
    const adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, config.jwt.secret, { expiresIn: '1h' });

    await request(app)
      .post(`/api/admin/doctors/${doctorId}/leaves`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2030-01-07', reason: 'Conference' });

    const res = await request(app)
      .get(`/api/doctors/${doctorId}/slots?date=2030-01-07`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.onLeave).toBe(true);
    expect(res.body.slots).toHaveLength(0);
  });

  it('rejects missing date param', async () => {
    const res = await request(app)
      .get(`/api/doctors/${doctorId}/slots`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(400);
  });
});
