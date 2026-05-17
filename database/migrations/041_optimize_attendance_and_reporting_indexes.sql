-- Align runtime with current schema and add indexes for the current query patterns.
-- `grades_released` is not part of the schema; application code should use
-- `can_download_results` consistently.

ALTER TABLE attendance
  ADD INDEX idx_attendance_enrollment_date_time_status (enrollment_id, date, time, status);

ALTER TABLE test_attempts
  ADD INDEX idx_test_attempts_enrollment_status_type_completed_score (enrollment_id, status, test_type, completed_at, score);

ALTER TABLE healthcare
  ADD INDEX idx_healthcare_training_reminder_due_date (training_reminder_due_date);

ALTER TABLE certificate_issues
  ADD INDEX idx_certificate_issues_validity_end (validity_end),
  ADD INDEX idx_certificate_issues_trainee_validity_end (trainee_id, validity_end);
