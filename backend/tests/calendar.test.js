const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');
const { google } = require('googleapis');

jest.mock('googleapis');

let doctorToken;
let patientToken;
let doctorId;

const mockGenerateAuthUrl = jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?test=true');
const mockGetToken = jest.fn().mockResolvedValue({
  tokens: {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    token_type: 'Bearer',
    expiry_date: Date.now() + 3600000,
  },
});
const mockSetCredentials = jest.fn();
const mockOn = jest.fn();

const mockInsert = jest.fn().mockResolvedValue({ data: { id: 'mock-event-id-123' } });
const mockPatch = jest.fn().mockResolvedValue({ data: { id: 'mock-event-id-123', status: 'cancelled' } });

google.auth = {
  OAuth2: jest.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
    setCredentials: mockSetCredentials,
    on: mockOn,
  })),
};

google.calendar = jest.fn().mockReturnValue({
  events: {
    insert: mockInsert,
    patch: mockPatch,
  },
});

process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/calendar/callback';

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@caltest.com' } } });

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const config = require('../src/config');

  // create patient
  const pRes = await request(app).post('/api/auth/register').send({
    name: 'Cal Patient',
    email: 'patient@caltest.com',
    password: 'patientpass123',
  });
  patientToken = pRes.body.accessToken;

  // create doctor via admin
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@caltest.com',
      passwordHash: await bcrypt.hash('adminpass', 10),
      role: 'ADMIN',
    },
  });
  const adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, config.jwt.secret, { expiresIn: '1h' });

  const drRes = await request(app)
    .post('/api/admin/doctors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Dr. Cal',
      email: 'drcal@caltest.com',
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
    email: 'drcal@caltest.com',
    password: 'drpassword123',
  });
  doctorToken = drLogin.body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@caltest.com' } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/calendar/connect', () => {
  it('doctor receives Google OAuth consent URL', async () => {
    const res = await request(app)
      .get('/api/calendar/connect')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('https://accounts.google.com');
  });

  it('rejects patient from connecting calendar', async () => {
    const res = await request(app)
      .get('/api/calendar/connect')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/calendar/callback', () => {
  it('exchanges code for tokens and redirects to frontend with success', async () => {
    const res = await request(app)
      .get(`/api/calendar/callback?code=valid-auth-code&state=${doctorId}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/doctor/settings?calendar=connected');

    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    expect(doctor.calendarTokens).toBeTruthy();
    expect(doctor.calendarTokens.access_token).toBe('mock-access-token');
  });

  it('handles user denying permission', async () => {
    const res = await request(app)
      .get(`/api/calendar/callback?error=access_denied&state=${doctorId}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/doctor/settings?calendar=denied');
  });
});

describe('GET /api/calendar/status', () => {
  it('returns connected true after tokens stored', async () => {
    const res = await request(app)
      .get('/api/calendar/status')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
  });
});

describe('DELETE /api/calendar/disconnect', () => {
  it('clears stored calendar tokens', async () => {
    const res = await request(app)
      .delete('/api/calendar/disconnect')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('disconnected');

    const statusRes = await request(app)
      .get('/api/calendar/status')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(statusRes.body.connected).toBe(false);
  });
});
