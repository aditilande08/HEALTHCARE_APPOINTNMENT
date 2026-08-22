const cron = require('node-cron');
const { sendAppointmentReminders, sendMedicationReminders } = require('./reminderJob');
const { retryFailedEmails } = require('./emailRetryJob');

function safeRun(name, fn) {
  return async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[jobs] ${name} failed:`, err.message);
    }
  };
}

function startJobs() {
  // retry pending/failed emails every 5 minutes
  cron.schedule('*/5 * * * *', safeRun('emailRetry', retryFailedEmails));

  // appointment reminders — check every hour
  cron.schedule('0 * * * *', safeRun('appointmentReminders', sendAppointmentReminders));

  // medication reminders — once per day at 8am UTC
  cron.schedule('0 8 * * *', safeRun('medicationReminders', sendMedicationReminders));

  console.log('[jobs] Background jobs started');
}

module.exports = { startJobs };
