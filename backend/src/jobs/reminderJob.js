const prisma = require('../config/db');
const emailService = require('../services/emailService');

// Finds CONFIRMED appointments scheduled in the next 24 hours that haven't
// had a reminder sent yet, creates notification log entries, and sends them.
async function sendAppointmentReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcoming = await prisma.appointment.findMany({
    where: {
      status: 'CONFIRMED',
      scheduledAt: { gte: now, lte: in24h },
      reminderSentAt: null,
    },
    select: { id: true },
  });

  if (upcoming.length === 0) return 0;

  for (const appt of upcoming) {
    const notification = await prisma.notificationLog.create({
      data: {
        appointmentId: appt.id,
        type: 'APPOINTMENT_REMINDER',
        channel: 'EMAIL',
        status: 'PENDING',
      },
    });

    await emailService.processNotification(notification.id);

    await prisma.appointment.update({
      where: { id: appt.id },
      data: { reminderSentAt: new Date() },
    });
  }

  console.log(`[reminderJob] Sent ${upcoming.length} appointment reminder(s)`);
  return upcoming.length;
}

// Finds COMPLETED appointments with active prescriptions and queues one
// medication reminder per day for the prescription duration.
async function sendMedicationReminders() {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: 'COMPLETED',
      scheduledAt: { gte: thirtyDaysAgo },
      prescriptions: { not: null },
    },
    include: {
      patient: { include: { user: { select: { email: true, name: true } } } },
    },
  });

  let sent = 0;

  for (const appt of appointments) {
    const prescriptions = appt.prescriptions;
    if (!prescriptions || prescriptions.length === 0) continue;

    // check if we already sent a medication reminder for this appointment today
    const alreadySentToday = await prisma.notificationLog.findFirst({
      where: {
        appointmentId: appt.id,
        type: 'MEDICATION_REMINDER',
        createdAt: { gte: todayStart },
      },
    });

    if (alreadySentToday) continue;

    // check if at least one prescription is still active
    const apptDate = new Date(appt.scheduledAt);
    const hasActivePrescription = prescriptions.some((p) => {
      const endDate = new Date(apptDate);
      endDate.setUTCDate(endDate.getUTCDate() + p.days);
      return endDate >= todayStart;
    });

    if (!hasActivePrescription) continue;

    const notification = await prisma.notificationLog.create({
      data: {
        appointmentId: appt.id,
        type: 'MEDICATION_REMINDER',
        channel: 'EMAIL',
        status: 'PENDING',
      },
    });

    await emailService.processNotification(notification.id);
    sent++;
  }

  if (sent > 0) {
    console.log(`[reminderJob] Sent ${sent} medication reminder(s)`);
  }

  return sent;
}

module.exports = { sendAppointmentReminders, sendMedicationReminders };
