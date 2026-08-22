const prisma = require('../config/db');
const llmService = require('./llmService');
const calendarService = require('./calendarService');

// Produces a consistent positive bigint from (doctorId, scheduledAt) for use
// as a PostgreSQL advisory lock key. Two concurrent requests for the same slot
// hash to the same key, so the second blocks until the first commits.
function slotLockKey(doctorId, scheduledAt) {
  const str = `${doctorId}:${new Date(scheduledAt).toISOString()}`;
  let hash = 5381n;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5n) + hash + BigInt(str.charCodeAt(i))) & 0x7fffffffffffffffn;
  }
  return hash;
}

async function bookAppointment({ patientId, doctorId, scheduledAt, symptoms }) {
  const slotTime = new Date(scheduledAt);

  if (isNaN(slotTime.getTime())) {
    const err = new Error('Invalid scheduledAt timestamp');
    err.status = 400;
    throw err;
  }

  if (slotTime <= new Date()) {
    const err = new Error('Cannot book a slot in the past');
    err.status = 400;
    throw err;
  }

  // verify patient profile exists
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    const err = new Error('Patient profile not found');
    err.status = 404;
    throw err;
  }

  // verify doctor exists
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) {
    const err = new Error('Doctor not found');
    err.status = 404;
    throw err;
  }

  // check doctor is not on leave that day
  const leaveDate = new Date(slotTime);
  leaveDate.setUTCHours(0, 0, 0, 0);
  const leave = await prisma.doctorLeave.findUnique({
    where: { doctorId_date: { doctorId, date: leaveDate } },
  });
  if (leave) {
    const err = new Error('Doctor is on leave on this date');
    err.status = 409;
    throw err;
  }

  const lockKey = slotLockKey(doctorId, scheduledAt);

  const appointment = await prisma.$transaction(async (tx) => {
    // Acquire a transaction-scoped advisory lock keyed to this exact slot.
    // The second concurrent request for the same slot will block here until
    // the first transaction commits or rolls back.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

    const existing = await tx.appointment.findFirst({
      where: {
        doctorId,
        scheduledAt: slotTime,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    if (existing) {
      const err = new Error('This slot is no longer available');
      err.status = 409;
      throw err;
    }

    const created = await tx.appointment.create({
      data: {
        patientId,
        doctorId,
        scheduledAt: slotTime,
        status: 'CONFIRMED',
        symptoms: symptoms || null,
        preVisitLlmStatus: symptoms ? 'PENDING' : 'SKIPPED',
      },
      include: {
        doctor: { include: { user: { select: { name: true, email: true } } } },
        patient: { include: { user: { select: { name: true, email: true } } } },
      },
    });

    // queue booking confirmation email for both sides
    await tx.notificationLog.createMany({
      data: [
        { appointmentId: created.id, type: 'BOOKING_CONFIRMATION', channel: 'EMAIL', status: 'PENDING' },
        { appointmentId: created.id, type: 'BOOKING_CONFIRMATION', channel: 'CALENDAR', status: 'PENDING' },
      ],
    });

    return created;
  });

  // LLM runs after the transaction commits — slot lock is already released
  if (appointment.symptoms) {
    runPreVisitLlm(appointment.id, appointment.symptoms).catch(() => {});
  }

  // Calendar sync runs fire-and-forget
  syncCalendarBooking(appointment).catch(() => {});

  return appointment;
}

async function getAppointments(userId, role) {
  let where = {};

  if (role === 'PATIENT') {
    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient) return [];
    where = { patientId: patient.id };
  } else if (role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) return [];
    where = { doctorId: doctor.id };
  }
  // ADMIN gets all

  return prisma.appointment.findMany({
    where,
    include: {
      doctor: { include: { user: { select: { name: true, email: true } } } },
      patient: { include: { user: { select: { name: true, email: true, phone: true } } } },
    },
    orderBy: { scheduledAt: 'desc' },
  });
}

async function getAppointment(appointmentId, userId, role) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: { include: { user: { select: { name: true, email: true } } } },
      patient: { include: { user: { select: { name: true, email: true, phone: true } } } },
    },
  });

  if (!appointment) {
    const err = new Error('Appointment not found');
    err.status = 404;
    throw err;
  }

  if (role === 'PATIENT') {
    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient || appointment.patientId !== patient.id) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  } else if (role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId } });
    if (!doctor || appointment.doctorId !== doctor.id) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  }

  return appointment;
}

async function cancelAppointment(appointmentId, userId, role) {
  const appointment = await getAppointment(appointmentId, userId, role);

  if (appointment.status === 'CANCELLED') {
    const err = new Error('Appointment is already cancelled');
    err.status = 400;
    throw err;
  }

  if (appointment.status === 'COMPLETED') {
    const err = new Error('Cannot cancel a completed appointment');
    err.status = 400;
    throw err;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    });

    await tx.notificationLog.createMany({
      data: [
        { appointmentId, type: 'CANCELLATION', channel: 'EMAIL', status: 'PENDING' },
        { appointmentId, type: 'CANCELLATION', channel: 'CALENDAR', status: 'PENDING' },
      ],
    });

    return result;
  });

  syncCalendarCancel(appointment).catch(() => {});

  return updated;
}

async function rescheduleAppointment(appointmentId, newScheduledAt, userId, role) {
  const appointment = await getAppointment(appointmentId, userId, role);

  if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
    const err = new Error(`Cannot reschedule a ${appointment.status.toLowerCase()} appointment`);
    err.status = 400;
    throw err;
  }

  const newSlot = new Date(newScheduledAt);
  if (isNaN(newSlot.getTime()) || newSlot <= new Date()) {
    const err = new Error('New slot must be a valid future timestamp');
    err.status = 400;
    throw err;
  }

  // check leave on new date
  const newLeaveDate = new Date(newSlot);
  newLeaveDate.setUTCHours(0, 0, 0, 0);
  const leave = await prisma.doctorLeave.findUnique({
    where: { doctorId_date: { doctorId: appointment.doctorId, date: newLeaveDate } },
  });
  if (leave) {
    const err = new Error('Doctor is on leave on the requested date');
    err.status = 409;
    throw err;
  }

  const lockKey = slotLockKey(appointment.doctorId, newScheduledAt);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

    const conflict = await tx.appointment.findFirst({
      where: {
        doctorId: appointment.doctorId,
        scheduledAt: newSlot,
        status: { in: ['PENDING', 'CONFIRMED'] },
        id: { not: appointmentId },
      },
    });

    if (conflict) {
      const err = new Error('The requested slot is not available');
      err.status = 409;
      throw err;
    }

    const result = await tx.appointment.update({
      where: { id: appointmentId },
      data: { scheduledAt: newSlot },
    });

    await tx.notificationLog.createMany({
      data: [
        { appointmentId, type: 'BOOKING_CONFIRMATION', channel: 'EMAIL', status: 'PENDING' },
        { appointmentId, type: 'BOOKING_CONFIRMATION', channel: 'CALENDAR', status: 'PENDING' },
      ],
    });

    return result;
  });

  syncCalendarReschedule({ ...appointment, scheduledAt: newSlot }).catch(() => {});

  return updated;
}

async function syncCalendarBooking(appointment) {
  try {
    const eventId = await calendarService.createEvent(appointment.doctorId, appointment);
    if (eventId) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { googleCalendarEventId: eventId },
      });
      await prisma.notificationLog.updateMany({
        where: { appointmentId: appointment.id, channel: 'CALENDAR', type: 'BOOKING_CONFIRMATION' },
        data: { status: 'SENT', lastAttemptAt: new Date() },
      });
    }
  } catch (err) {
    console.error('[calendar] sync booking failed:', err.message);
  }
}

async function syncCalendarCancel(appointment) {
  try {
    if (appointment.googleCalendarEventId) {
      await calendarService.deleteEvent(appointment.doctorId, appointment.googleCalendarEventId);
      await prisma.notificationLog.updateMany({
        where: { appointmentId: appointment.id, channel: 'CALENDAR', type: 'CANCELLATION' },
        data: { status: 'SENT', lastAttemptAt: new Date() },
      });
    }
  } catch (err) {
    console.error('[calendar] sync cancel failed:', err.message);
  }
}

async function syncCalendarReschedule(appointment) {
  try {
    if (appointment.googleCalendarEventId) {
      await calendarService.updateEvent(appointment.doctorId, appointment.googleCalendarEventId, appointment);
      await prisma.notificationLog.updateMany({
        where: { appointmentId: appointment.id, channel: 'CALENDAR', type: 'BOOKING_CONFIRMATION' },
        data: { status: 'SENT', lastAttemptAt: new Date() },
      });
    }
  } catch (err) {
    console.error('[calendar] sync reschedule failed:', err.message);
  }
}

// Called after the booking transaction commits — runs LLM outside the transaction
// so a slow/failing LLM never holds the advisory lock or blocks the response.
async function runPreVisitLlm(appointmentId, symptoms) {
  const summary = await llmService.generatePreVisitSummary(symptoms);

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      preVisitSummary: summary || undefined,
      preVisitLlmStatus: summary ? 'DONE' : 'FAILED',
    },
  });
}

async function submitSymptoms(appointmentId, symptoms, userId, role) {
  const appointment = await getAppointment(appointmentId, userId, role);

  if (role !== 'PATIENT') {
    const err = new Error('Only patients can submit symptoms');
    err.status = 403;
    throw err;
  }

  if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
    const err = new Error('Cannot update symptoms on a cancelled or completed appointment');
    err.status = 400;
    throw err;
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { symptoms, preVisitLlmStatus: 'PENDING' },
  });

  // run LLM in the background — don't await so the response is fast
  runPreVisitLlm(appointmentId, symptoms).catch((err) => {
    console.error('[appointments] background LLM failed for', appointmentId, err.message);
  });

  return { message: 'Symptoms submitted. Summary will be generated shortly.' };
}

async function submitPostVisitNotes(appointmentId, { postVisitNotes, prescriptions }, userId, role) {
  if (role !== 'DOCTOR') {
    const err = new Error('Only doctors can submit post-visit notes');
    err.status = 403;
    throw err;
  }

  const appointment = await getAppointment(appointmentId, userId, role);

  if (appointment.status === 'CANCELLED') {
    const err = new Error('Cannot add notes to a cancelled appointment');
    err.status = 400;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        postVisitNotes,
        prescriptions: prescriptions || [],
        status: 'COMPLETED',
        postVisitLlmStatus: 'PENDING',
      },
    });

    // notify patient their summary is being prepared
    await tx.notificationLog.create({
      data: {
        appointmentId,
        type: 'POST_VISIT_SUMMARY',
        channel: 'EMAIL',
        status: 'PENDING',
      },
    });
  });

  // generate patient-friendly post-visit summary outside the transaction
  runPostVisitLlm(appointmentId, postVisitNotes, prescriptions).catch(() => {});

  return { message: 'Notes saved. Patient summary will be generated shortly.' };
}

async function runPostVisitLlm(appointmentId, notes, prescriptions) {
  const summary = await llmService.generatePostVisitSummary(notes, prescriptions);

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      postVisitSummary: summary || undefined,
      postVisitLlmStatus: summary ? 'DONE' : 'FAILED',
    },
  });
}

module.exports = {
  bookAppointment,
  getAppointments,
  getAppointment,
  cancelAppointment,
  rescheduleAppointment,
  submitSymptoms,
  submitPostVisitNotes,
  runPreVisitLlm,
  runPostVisitLlm,
};
