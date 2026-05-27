const { getPassingScore } = require('./testScores');

const NOTIFICATION_EVENT = 'mark-release-notification';
const DISMISS_EVENT = 'mark-release-notification-dismissed';

function formatNotificationRow(row) {
  return {
    id: row.id,
    trainingId: row.training_id,
    trainingTitle: row.training_title,
    trainingType: row.training_type,
    enrollmentId: row.enrollment_id,
    traineeId: row.trainee_id,
    traineeName: row.trainee_name,
    certificateScore: parseFloat(row.certificate_score) || 0,
    testAttemptId: row.test_attempt_id,
    createdAt: row.created_at
  };
}

async function getPendingNotifications(db, { trainingIds, userId, userRole }) {
  let query = `
    SELECT n.*,
      t.title AS training_title,
      t.type AS training_type,
      CONCAT(tr.first_name, ' ', tr.last_name) AS trainee_name
    FROM trainer_mark_release_notifications n
    JOIN trainings t ON t.id = n.training_id
    JOIN trainees tr ON tr.id = n.trainee_id
    JOIN enrollments e ON e.id = n.enrollment_id
    WHERE n.is_dismissed = FALSE
      AND e.can_download_results = FALSE
  `;
  const params = [];

  if (userRole === 'trainer') {
    query += `
      AND EXISTS (
        SELECT 1 FROM training_trainers tt
        WHERE tt.training_id = n.training_id AND tt.trainer_id = ?
      )
    `;
    params.push(userId);
  }

  if (Array.isArray(trainingIds) && trainingIds.length > 0) {
    const placeholders = trainingIds.map(() => '?').join(',');
    query += ` AND n.training_id IN (${placeholders})`;
    params.push(...trainingIds);
  }

  query += ' ORDER BY n.created_at DESC';

  const [rows] = await db.query(query, params);
  return rows.map(formatNotificationRow);
}

async function getPendingCountsByTraining(db, { userId, userRole }) {
  let query = `
    SELECT n.training_id, COUNT(*) AS pending_count
    FROM trainer_mark_release_notifications n
    JOIN enrollments e ON e.id = n.enrollment_id
    WHERE n.is_dismissed = FALSE
      AND e.can_download_results = FALSE
  `;
  const params = [];

  if (userRole === 'trainer') {
    query += `
      AND EXISTS (
        SELECT 1 FROM training_trainers tt
        WHERE tt.training_id = n.training_id AND tt.trainer_id = ?
      )
    `;
    params.push(userId);
  }

  query += ' GROUP BY n.training_id';

  const [rows] = await db.query(query, params);
  return rows.reduce((acc, row) => {
    acc[row.training_id] = Number(row.pending_count) || 0;
    return acc;
  }, {});
}

async function upsertMarkReleaseNotification(db, {
  enrollmentId,
  trainingId,
  traineeId,
  testAttemptId,
  certificateScore
}) {
  const [enrollments] = await db.query(
    'SELECT can_download_results FROM enrollments WHERE id = ?',
    [enrollmentId]
  );
  if (enrollments.length === 0 || enrollments[0].can_download_results) {
    return null;
  }

  await db.query(
    `INSERT INTO trainer_mark_release_notifications
       (training_id, enrollment_id, trainee_id, test_attempt_id, certificate_score, is_dismissed, dismissed_at)
     VALUES (?, ?, ?, ?, ?, FALSE, NULL)
     ON DUPLICATE KEY UPDATE
       test_attempt_id = VALUES(test_attempt_id),
       certificate_score = VALUES(certificate_score),
       is_dismissed = FALSE,
       dismissed_at = NULL,
       created_at = CURRENT_TIMESTAMP`,
    [trainingId, enrollmentId, traineeId, testAttemptId, certificateScore]
  );

  const [rows] = await db.query(
    `SELECT n.*,
        t.title AS training_title,
        t.type AS training_type,
        CONCAT(tr.first_name, ' ', tr.last_name) AS trainee_name
     FROM trainer_mark_release_notifications n
     JOIN trainings t ON t.id = n.training_id
     JOIN trainees tr ON tr.id = n.trainee_id
     WHERE n.enrollment_id = ? AND n.is_dismissed = FALSE`,
    [enrollmentId]
  );

  return rows.length > 0 ? formatNotificationRow(rows[0]) : null;
}

async function dismissNotificationsForEnrollments(db, enrollmentIds) {
  if (!Array.isArray(enrollmentIds) || enrollmentIds.length === 0) return [];

  const placeholders = enrollmentIds.map(() => '?').join(',');
  const [existing] = await db.query(
    `SELECT id, training_id, enrollment_id
     FROM trainer_mark_release_notifications
     WHERE enrollment_id IN (${placeholders}) AND is_dismissed = FALSE`,
    enrollmentIds
  );

  if (existing.length === 0) return [];

  await db.query(
    `UPDATE trainer_mark_release_notifications
     SET is_dismissed = TRUE, dismissed_at = NOW()
     WHERE enrollment_id IN (${placeholders}) AND is_dismissed = FALSE`,
    enrollmentIds
  );

  return existing;
}

async function dismissNotificationById(db, notificationId, { userId, userRole }) {
  let query = `
    SELECT n.id, n.training_id, n.enrollment_id
    FROM trainer_mark_release_notifications n
    WHERE n.id = ? AND n.is_dismissed = FALSE
  `;
  const params = [notificationId];

  if (userRole === 'trainer') {
    query += `
      AND EXISTS (
        SELECT 1 FROM training_trainers tt
        WHERE tt.training_id = n.training_id AND tt.trainer_id = ?
      )
    `;
    params.push(userId);
  }

  const [rows] = await db.query(query, params);
  if (rows.length === 0) return null;

  await db.query(
    'UPDATE trainer_mark_release_notifications SET is_dismissed = TRUE, dismissed_at = NOW() WHERE id = ?',
    [notificationId]
  );

  return rows[0];
}

function emitMarkReleaseNotification(io, notification) {
  if (!io || !notification) return;
  io.to(`training:${notification.trainingId}`).emit(NOTIFICATION_EVENT, notification);
}

function emitMarkReleaseDismissed(io, payload) {
  if (!io || !payload) return;
  io.to(`training:${payload.trainingId}`).emit(DISMISS_EVENT, payload);
}

async function handleCertificateTestCompleted(db, io, {
  enrollmentId,
  trainingId,
  traineeId,
  testAttemptId,
  certificateScore
}) {
  const notification = await upsertMarkReleaseNotification(db, {
    enrollmentId,
    trainingId,
    traineeId,
    testAttemptId,
    certificateScore
  });

  if (notification) {
    emitMarkReleaseNotification(io, notification);
  }

  return notification;
}

function scoreLabel(score) {
  const passing = getPassingScore('certificate_enrolment');
  return score >= passing ? 'Passed' : 'Not Passed';
}

async function dismissAndEmitMarkReleaseNotifications(db, io, enrollmentIds) {
  const dismissed = await dismissNotificationsForEnrollments(db, enrollmentIds);
  dismissed.forEach((row) => {
    emitMarkReleaseDismissed(io, {
      notificationId: row.id,
      trainingId: row.training_id,
      enrollmentId: row.enrollment_id
    });
  });
  return dismissed;
}

module.exports = {
  NOTIFICATION_EVENT,
  DISMISS_EVENT,
  getPendingNotifications,
  getPendingCountsByTraining,
  upsertMarkReleaseNotification,
  dismissNotificationsForEnrollments,
  dismissNotificationById,
  dismissAndEmitMarkReleaseNotifications,
  emitMarkReleaseNotification,
  emitMarkReleaseDismissed,
  handleCertificateTestCompleted,
  scoreLabel
};
