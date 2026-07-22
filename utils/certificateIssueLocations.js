async function columnExists(db, tableName, columnName) {
  const [rows] = await db.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function updateCertificateIssueLocationsForHealthcare(db, healthcareId, healthcareName) {
  const hasCertificateHealthcareSnapshot = await columnExists(db, 'certificate_issues', 'healthcare_id_at_issue');

  if (hasCertificateHealthcareSnapshot) {
    await db.query(
      'UPDATE certificate_issues SET location = ? WHERE healthcare_id_at_issue = ?',
      [healthcareName, healthcareId]
    );
    return;
  }

  const hasEnrollmentHealthcareSnapshot = await columnExists(db, 'enrollments', 'healthcare_id_at_enrollment');

  if (hasEnrollmentHealthcareSnapshot) {
    await db.query(
      `UPDATE certificate_issues ci
       JOIN enrollments e ON ci.enrollment_id = e.id
       SET ci.location = ?
       WHERE e.healthcare_id_at_enrollment = ?`,
      [healthcareName, healthcareId]
    );
    return;
  }

  await db.query(
    `UPDATE certificate_issues ci
     JOIN trainees t ON ci.trainee_id = t.id
     SET ci.location = ?
     WHERE t.healthcare_id = ?`,
    [healthcareName, healthcareId]
  );
}

module.exports = {
  columnExists,
  updateCertificateIssueLocationsForHealthcare
};
