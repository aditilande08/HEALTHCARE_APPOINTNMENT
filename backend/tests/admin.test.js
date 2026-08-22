const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

let adminToken;
let patientToken;
let createdDoctorId;

beforeAll(async () => {
  // clean up
  await prisma.user.deleteMany({ where: { email: { contains: '@admintest.com' } } });

  // create admin directly in DB (no public endpoint for this)
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const config = require('../src/config');

  await prisma.user.create({
    data: {
      name: 'Test Admin',
      email: 'admin@admintest.com',
      passwordHash: await bcrypt.hash('adminpass123', 10),
      role: 'ADMIN',
    },
  });

  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@admintest.com' } });
  adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, config.jwt.secret, { expiresIn: '1h' });

  // register a patient to test role protection
  const res = await request(app).post('/api/auth/register').send({
    name: 'Patient User',
    email: 'patient@admintest.com',
    password: 'patientpass123',
  });
  patientToken = res.body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@admintest.com' } } });
  await prisma.$disconnect();
});

describe('Role protection', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/admin/doctors');
    expect(res.status).toBe(401);
  });

  it('rejects patient accessing admin routes', async () => {
    const res = await request(app)
      .get('/api/admin/doctors')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Doctor CRUD', () => {
  it('creates a doctor', async () => {
    const res = await request(app)
      .post('/api/admin/doctors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dr. Smith',
        email: 'drsmith@admintest.com',
        password: 'drpassword123',
        specialisation: 'Cardiology',
        slotDuration: 30,
        workingHours: {
          mon: { start: '09:00', end: '17:00' },
          tue: { start: '09:00', end: '17:00' },
          wed: null,
          thu: { start: '09:00', end: '17:00' },
          fri: { start: '09:00', end: '13:00' },
          sat: null,
          sun: null,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.doctor.specialisation).toBe('Cardiology');
    expect(res.body.passwordHash).toBeUndefined();
    createdDoctorId = res.body.doctor.id;
  });

  it('rejects duplicate doctor email', async () => {
    const res = await request(app)
      .post('/api/admin/doctors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dr. Smith 2',
        email: 'drsmith@admintest.com',
        password: 'drpassword123',
        specialisation: 'Neurology',
      });

    expect(res.status).toBe(409);
  });

  it('gets all doctors', async () => {
    const res = await request(app)
      .get('/api/admin/doctors')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('gets a single doctor', async () => {
    const res = await request(app)
      .get(`/api/admin/doctors/${createdDoctorId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdDoctorId);
  });

  it('updates a doctor', async () => {
    const res = await request(app)
      .patch(`/api/admin/doctors/${createdDoctorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ bio: 'Specialist in cardiac care', slotDuration: 45 });

    expect(res.status).toBe(200);
    expect(res.body.slotDuration).toBe(45);
  });
});

describe('Leave management', () => {
  const leaveDate = '2025-12-25';

  it('adds a leave day', async () => {
    const res = await request(app)
      .post(`/api/admin/doctors/${createdDoctorId}/leaves`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: leaveDate, reason: 'Holiday' });

    expect(res.status).toBe(201);
    expect(res.body.leave).toBeDefined();
    expect(res.body.affectedCount).toBeDefined();
  });

  it('rejects duplicate leave on same date', async () => {
    const res = await request(app)
      .post(`/api/admin/doctors/${createdDoctorId}/leaves`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: leaveDate });

    expect(res.status).toBe(409);
  });

  it('lists leave days', async () => {
    const res = await request(app)
      .get(`/api/admin/doctors/${createdDoctorId}/leaves`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('removes a leave day', async () => {
    const res = await request(app)
      .delete(`/api/admin/doctors/${createdDoctorId}/leaves/${leaveDate}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });
});

describe('Doctor deletion', () => {
  it('deletes a doctor', async () => {
    const res = await request(app)
      .delete(`/api/admin/doctors/${createdDoctorId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 for deleted doctor', async () => {
    const res = await request(app)
      .get(`/api/admin/doctors/${createdDoctorId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
