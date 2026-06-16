SET SQL_SAFE_UPDATES = 0;

ALTER TABLE certificate_issues
  ADD COLUMN healthcare_id_at_issue INT NULL AFTER trainee_id,
  ADD INDEX idx_certificate_issues_healthcare_at_issue (healthcare_id_at_issue),
  ADD CONSTRAINT fk_certificate_issues_healthcare_at_issue
    FOREIGN KEY (healthcare_id_at_issue) REFERENCES healthcare(id) ON DELETE SET NULL;

UPDATE certificate_issues ci
JOIN enrollments e ON e.id = ci.enrollment_id
JOIN healthcare h ON h.id = e.healthcare_id_at_enrollment
SET ci.healthcare_id_at_issue = e.healthcare_id_at_enrollment,
    ci.location = h.name
WHERE e.healthcare_id_at_enrollment IS NOT NULL;

SET SQL_SAFE_UPDATES = 1;
