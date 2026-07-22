const nodemailer = require('nodemailer');
const {
  canDownloadCertificate,
  getBestCertAttempt
} = require('./certificateEligibility');
const {
  buildCertificateHtml,
  htmlToPdfBuffer,
  normalizeCompany,
  sanitizeFileName,
  warmBrandAssetCaches
} = require('../routes/package-generator');

let cachedTransporter = null;
let certificateIssueHealthcareSnapshotColumnPromise = null;

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  if (!host) return null;

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secureValue = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = secureValue
    ? ['true', '1', 'yes'].includes(secureValue)
    : port === 465;

  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASSWORD || '').trim();
  const rejectUnauthorizedValue = String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || '').trim().toLowerCase();
  const rejectUnauthorized = rejectUnauthorizedValue
    ? !['false', '0', 'no'].includes(rejectUnauthorizedValue)
    : true;

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    tls: {
      rejectUnauthorized
    },
    auth: user || pass ? { user, pass } : undefined
  };
}

function getTransporter() {
  const config = getSmtpConfig();
  if (!config) return null;

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport(config);
  }

  return cachedTransporter;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildCertificateUrl(trainingId, enrollmentId) {
  const baseUrl = String(process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!baseUrl) return null;
  return `${baseUrl}/training/${trainingId}/certificate/${enrollmentId}`;
}

function extractEmailAddress(value) {
  const text = String(value || '').trim();
  const match = text.match(/<([^>]+)>/);
  return (match ? match[1] : text).trim().toLowerCase();
}

function isPlaceholderAddress(value) {
  const address = extractEmailAddress(value);
  return !address || address.endsWith('@example.com') || address.endsWith('@localhost');
}

function getFromAddress() {
  const smtpFrom = String(process.env.SMTP_FROM || '').trim();
  if (smtpFrom && !isPlaceholderAddress(smtpFrom)) return smtpFrom;

  const smtpUser = String(process.env.SMTP_USER || '').trim();
  if (smtpUser && !isPlaceholderAddress(smtpUser)) return smtpUser;

  return null;
}

function formatDate(value) {
  const d = value ? new Date(value) : null;
  if (d && !isNaN(d.valueOf())) {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function hasCertificateIssueHealthcareSnapshotColumn(db) {
  if (!certificateIssueHealthcareSnapshotColumnPromise) {
    certificateIssueHealthcareSnapshotColumnPromise = db.query(
      `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'certificate_issues'
         AND COLUMN_NAME = 'healthcare_id_at_issue'
       LIMIT 1`
    )
      .then(([rows]) => rows.length > 0)
      .catch((error) => {
        certificateIssueHealthcareSnapshotColumnPromise = null;
        throw error;
      });
  }

  return certificateIssueHealthcareSnapshotColumnPromise;
}

async function getOrCreateCertificateIssue(db, row, testAttempts) {
  const hasHealthcareSnapshotColumn = await hasCertificateIssueHealthcareSnapshotColumn(db);
  const [certificateRows] = await db.query(
    'SELECT * FROM certificate_issues WHERE enrollment_id = ?',
    [row.enrollment_id]
  );

  const participantName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  const courseName = row.training_title;
  const location = row.healthcare_at_enrollment || row.healthcare || 'N/A';
  const dateDisplay = formatDate(row.end_datetime || row.start_datetime || row.enrolled_at);
  const certAttempt = getBestCertAttempt(testAttempts);
  const validityStart = certAttempt?.completed_at || row.end_datetime || row.start_datetime || row.enrolled_at || new Date();
  const validityEnd = new Date(validityStart);
  if (!isNaN(validityEnd.valueOf())) {
    validityEnd.setFullYear(validityEnd.getFullYear() + 2);
  }

  if (certificateRows.length > 0) {
    const issued = certificateRows[0];
    if (hasHealthcareSnapshotColumn) {
      await db.query(
        `UPDATE certificate_issues
         SET healthcare_id_at_issue = COALESCE(healthcare_id_at_issue, ?),
             location = ?
         WHERE id = ?`,
        [row.healthcare_id_at_enrollment || null, location, issued.id]
      );
    } else {
      await db.query(
        'UPDATE certificate_issues SET location = ? WHERE id = ?',
        [location, issued.id]
      );
    }

    return {
      ...issued,
      location,
      participant_name: issued.participant_name || participantName,
      course_name: issued.course_name || courseName,
      date_display: issued.date_display || dateDisplay
    };
  }

  const certificateNumber = `1000-${row.training_id}-${row.enrollment_id}`;
  const insertColumns = [
    'enrollment_id',
    'training_id',
    'trainee_id',
    'certificate_number',
    'validity_start',
    'validity_end',
    'participant_name',
    'course_name',
    'location',
    'date_display'
  ];
  const insertValues = [
    row.enrollment_id,
    row.training_id,
    row.trainee_id,
    certificateNumber,
    new Date(validityStart),
    new Date(validityEnd),
    participantName,
    courseName,
    location,
    dateDisplay
  ];

  if (hasHealthcareSnapshotColumn) {
    insertColumns.splice(3, 0, 'healthcare_id_at_issue');
    insertValues.splice(3, 0, row.healthcare_id_at_enrollment || null);
  }

  await db.query(
    `INSERT INTO certificate_issues
     (${insertColumns.join(', ')})
     VALUES (${insertColumns.map(() => '?').join(', ')})`,
    insertValues
  );

  return {
    enrollment_id: row.enrollment_id,
    certificate_number: certificateNumber,
    participant_name: participantName,
    course_name: courseName,
    location,
    date_display: dateDisplay
  };
}

async function buildCertificateAttachment(db, row, testAttempts) {
  try {
    await warmBrandAssetCaches();
    const certificate = await getOrCreateCertificateIssue(db, row, testAttempts);
    const company = normalizeCompany(row.affiliated_company);
    const html = buildCertificateHtml({ certificate, company });
    const content = await htmlToPdfBuffer(html, 'landscape');
    const certNo = sanitizeFileName(certificate.certificate_number || 'CERT');
    const traineeName = sanitizeFileName(certificate.participant_name || 'Trainee');

    return {
      filename: `${certNo}_${traineeName}.pdf`,
      content,
      contentType: 'application/pdf'
    };
  } catch (error) {
    console.error('Certificate email attachment generation failed:', error);
    return null;
  }
}

async function buildMessage(db, row, testAttempts) {
  const traineeName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Trainee';
  const courseName = row.training_title || 'your training';
  const certificateUrl = buildCertificateUrl(row.training_id, row.enrollment_id);
  const from = getFromAddress();
  if (!from) return null;
  const attachment = await buildCertificateAttachment(db, row, testAttempts);

  const lines = [
    `Hi ${traineeName},`,
    '',
    `Your certificate for ${courseName} has been released and is ready to download.`,
    certificateUrl ? `Download it here: ${certificateUrl}` : 'Please sign in to the LMS to download it.',
    '',
    'Regards,',
    'Quick Stop Solution'
  ];

  const htmlLines = [
    `<p>Hi ${escapeHtml(traineeName)},</p>`,
    `<p>Your certificate for <strong>${escapeHtml(courseName)}</strong> has been released and is ready to download.</p>`,
    certificateUrl
      ? `<p><a href="${escapeHtml(certificateUrl)}">Download certificate</a></p>`
      : '<p>Please sign in to the LMS to download it.</p>',
    '<p>Regards,<br>Quick Stop Solution</p>'
  ];

  return {
    from,
    to: row.email,
    subject: `Certificate released: ${courseName}`,
    text: lines.join('\n'),
    html: htmlLines.join('\n'),
    attachments: attachment ? [attachment] : []
  };
}

async function getCertificateReleaseRows(db, enrollmentIds) {
  const ids = Array.from(new Set((enrollmentIds || []).map(id => String(id).trim()).filter(Boolean)));
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT
       e.id AS enrollment_id,
       e.training_id,
       e.trainee_id,
       e.can_download_results,
       e.enrolled_at,
       e.healthcare_id_at_enrollment,
       t.title AS training_title,
       t.type AS training_type,
       t.affiliated_company,
       t.start_datetime,
       t.end_datetime,
       tr.email,
       tr.first_name,
       tr.last_name,
       snapshot_h.name as healthcare_at_enrollment,
       h.name as healthcare
     FROM enrollments e
     JOIN trainings t ON t.id = e.training_id
     JOIN trainees tr ON tr.id = e.trainee_id
     LEFT JOIN healthcare snapshot_h ON snapshot_h.id = e.healthcare_id_at_enrollment
     LEFT JOIN healthcare h ON h.id = tr.healthcare_id
     WHERE e.id IN (${placeholders})`,
    ids
  );

  return rows || [];
}

async function getAttemptsByEnrollment(db, enrollmentIds) {
  if (enrollmentIds.length === 0) return new Map();

  const placeholders = enrollmentIds.map(() => '?').join(',');
  const [attemptRows] = await db.query(
    `SELECT *
     FROM test_attempts
     WHERE enrollment_id IN (${placeholders})
       AND status = "completed"
     ORDER BY enrollment_id, test_type`,
    enrollmentIds
  );

  return (attemptRows || []).reduce((map, row) => {
    const key = String(row.enrollment_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());
}

async function getHandsOnScoresByEnrollment(db, enrollmentIds) {
  if (enrollmentIds.length === 0) return new Map();

  const placeholders = enrollmentIds.map(() => '?').join(',');
  const [scoreRows] = await db.query(
    `SELECT hs.*, ha.max_score
     FROM practical_learning_outcome_scores hs
     JOIN practical_learning_outcomes ha ON hs.aspect_id = ha.id
     WHERE hs.enrollment_id IN (${placeholders})`,
    enrollmentIds
  );

  return (scoreRows || []).reduce((map, row) => {
    const key = String(row.enrollment_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());
}

async function getReleaseOverridesByEnrollment(db, enrollmentIds) {
  if (enrollmentIds.length === 0) return new Map();

  const placeholders = enrollmentIds.map(() => '?').join(',');
  const [overrideRows] = await db.query(
    `SELECT *
     FROM certificate_release_overrides
     WHERE enrollment_id IN (${placeholders})`,
    enrollmentIds
  );

  return (overrideRows || []).reduce((map, row) => {
    map.set(String(row.enrollment_id), row);
    return map;
  }, new Map());
}

async function notifyCertificateReleased(db, enrollmentIds) {
  const transporter = getTransporter();
  if (!transporter) {
    console.info('SMTP_HOST is not configured; skipping certificate release email notification.');
    return { sent: 0, skipped: true };
  }

  if (!getFromAddress()) {
    console.warn('SMTP_FROM/SMTP_USER is missing or uses a placeholder domain; skipping certificate release email notification.');
    return { sent: 0, skipped: true };
  }

  const rows = await getCertificateReleaseRows(db, enrollmentIds);
  const candidateRows = rows.filter(row => row.email);
  const candidateIds = candidateRows.map(row => String(row.enrollment_id));

  const [attemptsByEnrollment, handsOnByEnrollment, overridesByEnrollment] = await Promise.all([
    getAttemptsByEnrollment(db, candidateIds),
    getHandsOnScoresByEnrollment(db, candidateIds),
    getReleaseOverridesByEnrollment(db, candidateIds)
  ]);

  const messages = [];
  for (const row of candidateRows) {
    const testAttempts = attemptsByEnrollment.get(String(row.enrollment_id)) || [];
    const handsOnScores = handsOnByEnrollment.get(String(row.enrollment_id)) || [];
    const canDownload = canDownloadCertificate({
      testAttempts,
      handsOnScores,
      trainingType: row.training_type,
      releaseOverride: overridesByEnrollment.get(String(row.enrollment_id)) || null
    });

    if (!canDownload) continue;

    const message = await buildMessage(db, row, testAttempts);
    if (message) messages.push(message);
  }

  let sent = 0;
  for (const message of messages) {
    try {
      await transporter.sendMail(message);
      sent += 1;
    } catch (error) {
      console.error('Certificate release email failed:', error);
    }
  }

  return { sent, skipped: false };
}

module.exports = {
  notifyCertificateReleased
};
