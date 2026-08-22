const emailService = require('../services/emailService');

async function retryFailedEmails() {
  const count = await emailService.processPendingEmails();
  if (count > 0) {
    console.log(`[emailRetryJob] Processed ${count} pending/failed email(s)`);
  }
  return count;
}

module.exports = { retryFailedEmails };
