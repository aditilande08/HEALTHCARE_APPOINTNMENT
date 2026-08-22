const express = require('express');
const calendarService = require('../services/calendarService');
const prisma = require('../config/db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const config = require('../config');

const router = express.Router();

// initiate OAuth — doctor clicks "Connect Google Calendar"
router.get('/connect', authenticate, authorize('DOCTOR'), async (req, res) => {
  const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' });

  const url = calendarService.getOAuthUrl(doctor.id);
  if (!url) {
    return res.status(503).json({ error: 'Google Calendar is not configured on this server' });
  }

  res.json({ url });
});

// OAuth callback — Google redirects here after user grants permission
// state param carries the doctorId we set in getOAuthUrl
router.get('/callback', async (req, res) => {
  const { code, state: doctorId, error } = req.query;

  if (error) {
    console.warn('[calendar] OAuth denied:', error);
    return res.redirect(`${config.frontendUrl}/doctor/settings?calendar=denied`);
  }

  if (!code || !doctorId) {
    return res.redirect(`${config.frontendUrl}/doctor/settings?calendar=error`);
  }

  try {
    await calendarService.handleCallback(code, doctorId);
    res.redirect(`${config.frontendUrl}/doctor/settings?calendar=connected`);
  } catch (err) {
    console.error('[calendar] Callback error:', err.message);
    res.redirect(`${config.frontendUrl}/doctor/settings?calendar=error`);
  }
});

// check whether the authenticated doctor has connected their calendar
router.get('/status', authenticate, authorize('DOCTOR'), async (req, res) => {
  const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' });

  const connected = await calendarService.isConnected(doctor.id);
  res.json({ connected });
});

// disconnect — clear stored tokens
router.delete('/disconnect', authenticate, authorize('DOCTOR'), async (req, res, next) => {
  try {
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
    if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' });

    await prisma.doctor.update({
      where: { id: doctor.id },
      data: { calendarTokens: null },
    });

    res.json({ message: 'Google Calendar disconnected' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
