const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

beforeAll(async () => {
  // clean up test users before running
  await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('registers a new patient', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jane Test',
      email: 'jane@test.com',
      password: 'securepass123',
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe('PATIENT');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jane Again',
      email: 'jane@test.com',
      password: 'securepass123',
    });

    expect(res.status).toBe(409);
  });

  it('rejects short password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Bad User',
      email: 'bad@test.com',
      password: 'short',
    });

    expect(res.status).toBe(400);
  });

  it('rejects invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Bad User',
      email: 'notanemail',
      password: 'securepass123',
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'jane@test.com',
      password: 'securepass123',
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'jane@test.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
  });

  it('rejects non-existent email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@test.com',
      password: 'somepassword',
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'jane@test.com',
      password: 'securepass123',
    });
    token = res.body.accessToken;
  });

  it('returns the current user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('jane@test.com');
  });

  it('rejects missing token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects tampered token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer tampered.token.here');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  let refreshToken;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'jane@test.com',
      password: 'securepass123',
    });
    refreshToken = res.body.refreshToken;
  });

  it('issues new tokens with valid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid.token' });

    expect(res.status).toBe(401);
  });
});
