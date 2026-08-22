const { google } = require('googleapis');
const config = require('../config');
const prisma = require('../config/db');

function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

function getOAuthUrl(doctorId) {
  if (!config.google.clientId) return null;

  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: doctorId,
    // prompt: consent forces a new refresh_token every time — needed if reconnecting
    prompt: 'consent',
  });
}

async function handleCallback(code, doctorId) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  await prisma.doctor.update({
    where: { id: doctorId },
    data: { calendarTokens: tokens },
  });

  return tokens;
}

async function getAuthenticatedClient(doctorId) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { calendarTokens: true },
  });

  if (!doctor?.calendarTokens) return null;

  const client = createOAuth2Client();
  client.setCredentials(doctor.calendarTokens);

  // when Google silently refreshes the access token, persist the new one
  client.on('tokens', async (newTokens) => {
    const merged = { ...doctor.calendarTokens, ...newTokens };
    await prisma.doctor.update({
      where: { id: doctorId },
      data: { calendarTokens: merged },
    }).catch((err) => {
      console.error('[calendar] Failed to persist refreshed tokens:', err.message);
    });
  });

  return client;
}

async function createEvent(doctorId, appointment) {
  if (!config.google.clientId) {
    console.warn('[calendar] Google credentials not configured');
    return null;
  }

  const client = await getAuthenticatedClient(doctorId);
  if (!client) {
    console.warn('[calendar] Doctor', doctorId, 'has not connected Google Calendar');
    return null;
  }

  const calendar = google.calendar({ version: 'v3', auth: client });

  const startTime = new Date(appointment.scheduledAt);
  const endTime = new Date(startTime.getTime() + appointment.doctor.slotDuration * 60 * 1000);

  const event = {
    summary: `Appointment: ${appointment.patient.user.name}`,
    description: [
      `Patient: ${appointment.patient.user.name}`,
      `Doctor: Dr. ${appointment.doctor.user.name}`,
      appointment.symptoms ? `Symptoms: ${appointment.symptoms}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    start: { dateTime: startTime.toISOString(), timeZone: 'UTC' },
    end: { dateTime: endTime.toISOString(), timeZone: 'UTC' },
    attendees: [
      { email: appointment.doctor.user.email },
      { email: appointment.patient.user.email },
    ],
    reminders: {
      useDefault: false,
      overrides: [{ method: 'email', minutes: 60 }],
    },
  };

  try {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all',
    });
    return res.data.id;
  } catch (err) {
    console.error('[calendar] createEvent failed:', err.message);
    return null;
  }
}

async function updateEvent(doctorId, eventId, appointment) {
  if (!config.google.clientId || !eventId) return false;

  const client = await getAuthenticatedClient(doctorId);
  if (!client) return false;

  const calendar = google.calendar({ version: 'v3', auth: client });
  const startTime = new Date(appointment.scheduledAt);
  const endTime = new Date(startTime.getTime() + appointment.doctor.slotDuration * 60 * 1000);

  try {
    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      resource: {
        start: { dateTime: startTime.toISOString(), timeZone: 'UTC' },
        end: { dateTime: endTime.toISOString(), timeZone: 'UTC' },
      },
      sendUpdates: 'all',
    });
    return true;
  } catch (err) {
    console.error('[calendar] updateEvent failed:', err.message);
    return false;
  }
}

async function deleteEvent(doctorId, eventId) {
  if (!config.google.clientId || !eventId) return false;

  const client = await getAuthenticatedClient(doctorId);
  if (!client) return false;

  const calendar = google.calendar({ version: 'v3', auth: client });

  try {
    // Cancel rather than delete — keeps the event in attendees' calendars
    // marked as cancelled, which is better UX than silently removing it.
    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      resource: { status: 'cancelled' },
      sendUpdates: 'all',
    });
    return true;
  } catch (err) {
    // If the event is already deleted or not found, that's fine
    if (err.code === 410 || err.code === 404) return true;
    console.error('[calendar] deleteEvent failed:', err.message);
    return false;
  }
}

async function isConnected(doctorId) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { calendarTokens: true },
  });
  return !!doctor?.calendarTokens;
}

module.exports = { getOAuthUrl, handleCallback, createEvent, updateEvent, deleteEvent, isConnected };
