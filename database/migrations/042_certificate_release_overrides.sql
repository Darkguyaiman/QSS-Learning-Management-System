-- Manual certificate release for enrolments below the certificate test pass mark (70%),
-- with required justification and audit fields.

CREATE TABLE certificate_release_overrides (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  training_id INT NOT NULL,
  trainee_id INT NOT NULL,
  certificate_enrolment_score DECIMAL(5,2) NOT NULL,
  justification TEXT NOT NULL,
  released_by INT NOT NULL,
  released_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_certificate_release_override_enrollment (enrollment_id),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE,
  FOREIGN KEY (released_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_certificate_release_override_training (training_id),
  INDEX idx_certificate_release_override_released_at (released_at)
);
