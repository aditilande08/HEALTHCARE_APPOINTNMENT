const nodemailer = require('nodemailer');
const config = require('../config');
const prisma = require('../config/db');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!config.email.host || !config.email.user || !config.email.pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.pass },
  });

  return transporter;
}

async function sendEmail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.warn('[email] SMTP not configured — skipping email to', to);
    return false;
  }

  await t.sendMail({ from: config.email.from, to, subject, html });
  return true;
}

// ─── Templates ───────────────────────────────────────────────────────────────

function formatDate(date) {
  return new Date(date).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function wrap(content) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 24px;">
        <span style="font-size: 18px; font-weight: bold; color: #2563eb;">HealthCare Clinic</span>
      </div>
      ${content}
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
        This is an automated message. Please do not reply to this email.
      </div>
    </div>
  `;
}

function bookingConfirmationPatient(appointment) {
  const doctorName = appointment.doctor.user.name;
  const patientName = appointment.patient.user.name;
  const date = formatDate(appointment.scheduledAt);

  return {
    to: appointment.patient.user.email,
    subject: 'Appointment Confirmed',
    html: wrap(`
      <h2 style="margin: 0 0 16px;">Appointment Confirmed</h2>
      <p>Hi ${patientName},</p>
      <p>Your appointment has been confirmed. Here are the details:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; color: #6b7280; width: 40%;">Doctor</td><td style="padding: 8px; font-weight: bold;">Dr. ${doctorName}</td></tr>
        <tr style="background: #f9fafb;"><td style="padding: 8px; color: #6b7280;">Date & Time</td><td style="padding: 8px; font-weight: bold;">${date}</td></tr>
      </table>
      <p style="color: #6b7280; font-size: 14px;">If you haven't already, please fill in your symptom information before your appointment so the doctor can prepare in advance.</p>
    `),
  };
}

function bookingConfirmationDoctor(appointment) {
  const doctorName = appointment.doctor.user.name;
  const patientName = appointment.patient.user.name;
  const date = formatDate(appointment.scheduledAt);

  return {
    to: appointment.doctor.user.email,
    subject: 'New Appointment Scheduled',
    html: wrap(`
      <h2 style="margin: 0 0 16px;">New Appointment</h2>
      <p>Hi Dr. ${doctorName},</p>
      <p>A new appointment has been booked:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; color: #6b7280; width: 40%;">Patient</td><td style="padding: 8px; font-weight: bold;">${patientName}</td></tr>
        <tr style="background: #f9fafb;"><td style="padding: 8px; color: #6b7280;">Date & Time</td><td style="padding: 8px; font-weight: bold;">${date}</td></tr>
      </table>
    `),
  };
}

function cancellationEmail(appointment, recipientRole) {
  const doctorName = appointment.doctor.user.name;
  const patientName = appointment.patient.user.name;
  const date = formatDate(appointment.scheduledAt);
  const isPatient = recipientRole === 'patient';

  return {
    to: isPatient ? appointment.patient.user.email : appointment.doctor.user.email,
    subject: 'Appointment Cancelled',
    html: wrap(`
      <h2 style="margin: 0 0 16px;">Appointment Cancelled</h2>
      <p>Hi ${isPatient ? patientName : `Dr. ${doctorName}`},</p>
      <p>The following appointment has been cancelled:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; color: #6b7280; width: 40%;">${isPatient ? 'Doctor' : 'Patient'}</td>
            <td style="padding: 8px; font-weight: bold;">${isPatient ? `Dr. ${doctorName}` : patientName}</td></tr>
        <tr style="background: #f9fafb;"><td style="padding: 8px; color: #6b7280;">Original Date</td><td style="padding: 8px;">${date}</td></tr>
      </table>
      ${isPatient ? '<p>You can book a new appointment at your convenience.</p>' : ''}
    `),
  };
}

function reminderEmail(appointment) {
  const doctorName = appointment.doctor.user.name;
  const patientName = appointment.patient.user.name;
  const date = formatDate(appointment.scheduledAt);

  return {
    to: appointment.patient.user.email,
    subject: 'Appointment Reminder',
    html: wrap(`
      <h2 style="margin: 0 0 16px;">Appointment Reminder</h2>
      <p>Hi ${patientName},</p>
      <p>This is a reminder that you have an appointment coming up:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; color: #6b7280; width: 40%;">Doctor</td><td style="padding: 8px; font-weight: bold;">Dr. ${doctorName}</td></tr>
        <tr style="background: #f9fafb;"><td style="padding: 8px; color: #6b7280;">Date & Time</td><td style="padding: 8px; font-weight: bold;">${date}</td></tr>
      </table>
    `),
  };
}

function postVisitSummaryEmail(appointment) {
  const patientName = appointment.patient.user.name;
  const doctorName = appointment.doctor.user.name;
  const summary = appointment.postVisitSummary;

  const summaryHtml = summary
    ? `<div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; white-space: pre-line;">${summary}</p>
       </div>`
    : `<p style="color: #6b7280;">Your visit summary is being prepared. Please contact the clinic if you have any questions.</p>`;

  return {
    to: appointment.patient.user.email,
    subject: 'Your Visit Summary',
    html: wrap(`
      <h2 style="margin: 0 0 16px;">Your Visit Summary</h2>
      <p>Hi ${patientName},</p>
      <p>Here is a summary of your recent visit with <strong>Dr. ${doctorName}</strong>:</p>
      ${summaryHtml}
    `),
  };
}

function medicationReminderEmail(patientEmail, patientName, prescription) {
  return {
    to: patientEmail,
    subject: `Medication Reminder: ${prescription.medication}`,
    html: wrap(`
      <h2 style="margin: 0 0 16px;">Medication Reminder</h2>
      <p>Hi ${patientName},</p>
      <p>This is a reminder to take your medication:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; color: #6b7280; width: 40%;">Medication</td><td style="padding: 8px; font-weight: bold;">${prescription.medication}</td></tr>
        <tr style="background: #f9fafb;"><td style="padding: 8px; color: #6b7280;">Dose</td><td style="padding: 8px;">${prescription.dose}</td></tr>
        <tr><td style="padding: 8px; color: #6b7280;">Frequency</td><td style="padding: 8px;">${prescription.frequency}</td></tr>
      </table>
    `),
  };
}

// ─── Notification processor ───────────────────────────────────────────────────

// Fetches a pending notification, sends the right email, updates the log.
// Called by the background job and can be called directly for immediate sends.
async function processNotification(notificationId) {
  const notification = await prisma.notificationLog.findUnique({
    where: { id: notificationId },
    include: {
      appointment: {
        include: {
          doctor: { include: { user: true } },
          patient: { include: { user: true } },
        },
      },
    },
  });

  if (!notification || notification.channel !== 'EMAIL') return;

  const appt = notification.appointment;
  let emailData;

  switch (notification.type) {
    case 'BOOKING_CONFIRMATION':
      // send to both patient and doctor — two separate notifications are created at booking time,
      // but if we only have one record here we figure out which side from context
      await sendAndLog(notificationId, bookingConfirmationPatient(appt));
      await sendAndLog(null, bookingConfirmationDoctor(appt)); // inline send, no log entry
      return;

    case 'CANCELLATION':
      emailData = cancellationEmail(appt, 'patient');
      break;

    case 'APPOINTMENT_REMINDER':
      emailData = reminderEmail(appt);
      break;

    case 'POST_VISIT_SUMMARY':
      emailData = postVisitSummaryEmail(appt);
      break;

    case 'MEDICATION_REMINDER': {
      const patientUser = appt.patient.user;
      // send one email covering all still-active prescriptions
      const prescriptions = appt.prescriptions || [];
      if (prescriptions.length === 0) return;
      // use the first prescription for the subject line; body lists all
      emailData = medicationReminderEmail(patientUser.email, patientUser.name, prescriptions[0]);
      // override with a combined version if multiple prescriptions
      if (prescriptions.length > 1) {
        emailData = {
          to: patientUser.email,
          subject: 'Medication Reminder',
          html: wrap(`
            <h2 style="margin: 0 0 16px;">Medication Reminder</h2>
            <p>Hi ${patientUser.name},</p>
            <p>Here are your medications for today:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              ${prescriptions.map((p, i) => `
                <tr style="${i % 2 === 1 ? 'background: #f9fafb;' : ''}">
                  <td style="padding: 8px; font-weight: bold;">${p.medication} ${p.dose}</td>
                  <td style="padding: 8px; color: #6b7280;">${p.frequency}</td>
                </tr>
              `).join('')}
            </table>
          `),
        };
      }
      break;
    }

    default:
      console.warn('[email] Unknown notification type:', notification.type);
      return;
  }

  await sendAndLog(notificationId, emailData);
}

async function sendAndLog(notificationId, emailData) {
  try {
    await sendEmail(emailData);

    if (notificationId) {
      await prisma.notificationLog.update({
        where: { id: notificationId },
        data: { status: 'SENT', lastAttemptAt: new Date() },
      });
    }
  } catch (err) {
    console.error('[email] Send failed:', err.message);

    if (notificationId) {
      const current = await prisma.notificationLog.findUnique({ where: { id: notificationId } });
      await prisma.notificationLog.update({
        where: { id: notificationId },
        data: {
          status: 'FAILED',
          attempt: (current?.attempt || 0) + 1,
          lastAttemptAt: new Date(),
          error: err.message,
        },
      });
    }
  }
}

// Processes all pending EMAIL notifications. Called by the background job.
async function processPendingEmails() {
  const pending = await prisma.notificationLog.findMany({
    where: {
      channel: 'EMAIL',
      status: { in: ['PENDING', 'FAILED'] },
      attempt: { lt: 3 }, // max 3 attempts
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  for (const notification of pending) {
    await processNotification(notification.id);
  }

  return pending.length;
}

module.exports = {
  sendEmail,
  processNotification,
  processPendingEmails,
  medicationReminderEmail,
  sendAndLog,
};
