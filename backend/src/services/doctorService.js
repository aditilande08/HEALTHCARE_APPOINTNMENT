const prisma = require('../config/db');

async function searchDoctors(specialisation) {
  const where = specialisation
    ? { specialisation: { contains: specialisation, mode: 'insensitive' } }
    : {};

  const doctors = await prisma.doctor.findMany({
    where,
    select: {
      id: true,
      specialisation: true,
      bio: true,
      slotDuration: true,
      workingHours: true,
      user: {
        select: { id: true, name: true, email: true, phone: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
  });

  return doctors;
}

async function getDoctorProfile(doctorId) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      specialisation: true,
      bio: true,
      slotDuration: true,
      workingHours: true,
      user: {
        select: { id: true, name: true, email: true, phone: true },
      },
      leaves: {
        select: { date: true, reason: true },
        orderBy: { date: 'asc' },
      },
    },
  });

  if (!doctor) {
    const err = new Error('Doctor not found');
    err.status = 404;
    throw err;
  }

  return doctor;
}

async function getAvailableSlots(doctorId, dateStr) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { slotDuration: true, workingHours: true },
  });

  if (!doctor) {
    const err = new Error('Doctor not found');
    err.status = 404;
    throw err;
  }

  // parse the requested date as a UTC midnight date
  const requestedDate = new Date(`${dateStr}T00:00:00.000Z`);

  if (isNaN(requestedDate.getTime())) {
    const err = new Error('Invalid date format. Use YYYY-MM-DD');
    err.status = 400;
    throw err;
  }

  // don't show slots for dates in the past
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (requestedDate < today) {
    return { date: dateStr, onLeave: false, slots: [] };
  }

  // check if doctor is on leave that day
  const leaveRecord = await prisma.doctorLeave.findUnique({
    where: { doctorId_date: { doctorId, date: requestedDate } },
  });

  if (leaveRecord) {
    return { date: dateStr, onLeave: true, slots: [] };
  }

  // generate all possible slots from working hours
  const allSlots = generateSlots(requestedDate, doctor.workingHours, doctor.slotDuration);

  if (allSlots.length === 0) {
    return { date: dateStr, onLeave: false, slots: [] };
  }

  // fetch booked slots for this doctor on this date
  const dayEnd = new Date(requestedDate);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const booked = await prisma.appointment.findMany({
    where: {
      doctorId,
      scheduledAt: { gte: requestedDate, lte: dayEnd },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: { scheduledAt: true },
  });

  const bookedTimes = new Set(booked.map((a) => a.scheduledAt.toISOString()));

  const now = new Date();
  const slots = allSlots
    .filter((slot) => !bookedTimes.has(slot.toISOString()))
    .filter((slot) => slot > now) // remove slots that have already passed today
    .map((slot) => ({
      scheduledAt: slot.toISOString(),
      time: `${String(slot.getUTCHours()).padStart(2, '0')}:${String(slot.getUTCMinutes()).padStart(2, '0')}`,
    }));

  return { date: dateStr, onLeave: false, slots };
}

// generates all slot start times for a given date based on workingHours JSON
// workingHours format: { mon: { start: "09:00", end: "17:00" }, tue: null, ... }
function generateSlots(date, workingHours, slotDuration) {
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayKey = dayKeys[date.getUTCDay()];
  const hours = workingHours[dayKey];

  if (!hours || !hours.start || !hours.end) return [];

  const [startH, startM] = hours.start.split(':').map(Number);
  const [endH, endM] = hours.end.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const slots = [];
  let current = startMinutes;

  while (current + slotDuration <= endMinutes) {
    const slotDate = new Date(date);
    slotDate.setUTCHours(Math.floor(current / 60), current % 60, 0, 0);
    slots.push(slotDate);
    current += slotDuration;
  }

  return slots;
}

module.exports = { searchDoctors, getDoctorProfile, getAvailableSlots, generateSlots };
