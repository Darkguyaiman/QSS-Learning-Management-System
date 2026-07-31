require('dotenv').config();

const { pool } = require('../config/database');
const {
  notifyCertificateReleased,
  verifySmtpConnection
} = require('../utils/certificateEmailNotifications');

const SHOULD_SEND = process.argv.includes('--send');
const batchSizeArgument = process.argv.find(argument => argument.startsWith('--batch-size='));
const parsedBatchSize = batchSizeArgument
  ? Number.parseInt(batchSizeArgument.split('=')[1], 10)
  : 10;
const BATCH_SIZE = Number.isInteger(parsedBatchSize) && parsedBatchSize > 0
  ? parsedBatchSize
  : 10;

async function getReleasedEnrollmentIds(db) {
  const [rows] = await db.query(
    `SELECT e.id
     FROM enrollments e
     JOIN trainees tr ON tr.id = e.trainee_id
     WHERE e.can_download_results = TRUE
       AND tr.email IS NOT NULL
       AND TRIM(tr.email) <> ''
     ORDER BY e.id`
  );

  return rows.map(row => row.id);
}

async function main() {
  const connection = await pool.getConnection();

  try {
    const enrollmentIds = await getReleasedEnrollmentIds(connection);
    console.log(`Found ${enrollmentIds.length} released enrollment(s) with a trainee email.`);

    if (!SHOULD_SEND) {
      console.log('Dry run only; no email was sent.');
      console.log('Re-run with --send to resend all certificate release notifications.');
      return;
    }

    if (enrollmentIds.length === 0) {
      console.log('Nothing to send.');
      return;
    }

    console.log('Verifying SMTP connection...');
    await verifySmtpConnection();
    console.log('SMTP connection verified.');

    let sent = 0;
    let failed = 0;
    let eligible = 0;

    for (let offset = 0; offset < enrollmentIds.length; offset += BATCH_SIZE) {
      const batch = enrollmentIds.slice(offset, offset + BATCH_SIZE);
      const result = await notifyCertificateReleased(connection, batch);

      sent += result.sent;
      failed += result.failed;
      eligible += result.eligible;

      const processed = Math.min(offset + batch.length, enrollmentIds.length);
      console.log(
        `Processed ${processed}/${enrollmentIds.length}: ` +
        `${result.sent} sent, ${result.failed} failed in this batch.`
      );
    }

    const ineligible = enrollmentIds.length - eligible;
    console.log('');
    console.log(
      `Finished. ${sent} sent, ${failed} failed, ` +
      `${ineligible} skipped because current certificate eligibility checks did not pass.`
    );

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('Certificate notification resend failed:', error.message || error);
  process.exitCode = 1;
});
