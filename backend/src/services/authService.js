const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const config = require('../config');

function signAccessToken(userId, role) {
  return jwt.sign({ userId, role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

function signRefreshToken(userId, role) {
  return jwt.sign({ userId, role }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}

async function register({ name, email, password, phone }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('Email already in use');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // patients self-register; doctor accounts are created by admin
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      phone,
      role: 'PATIENT',
      patient: { create: {} },
    },
    include: { patient: true },
  });

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id, user.role);

  return { accessToken, refreshToken, user: sanitize(user) };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { patient: true, doctor: true },
  });

  if (!user) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id, user.role);

  return { accessToken, refreshToken, user: sanitize(user) };
}

async function refreshTokens(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.refreshSecret);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.status = 401;
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    const err = new Error('User not found');
    err.status = 401;
    throw err;
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id, user.role);

  return { accessToken, refreshToken };
}

async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { patient: true, doctor: true },
  });

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  return sanitize(user);
}

function sanitize(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

module.exports = { register, login, refreshTokens, getProfile };
