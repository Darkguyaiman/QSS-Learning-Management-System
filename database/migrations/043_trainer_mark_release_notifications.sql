-- Pending trainer notifications when a trainee completes the certificate enrolment test
-- and marks have not yet been released.

CREATE TABLE trainer_mark_release_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  enrollment_id INT NOT NULL,
  trainee_id INT NOT NULL,
  test_attempt_id INT NOT NULL,
  certificate_score DECIMAL(5,2) NOT NULL,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  dismissed_at TIMESTAMP NULL,
  UNIQUE KEY unique_mark_release_notification_enrollment (enrollment_id),
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE,
  FOREIGN KEY (test_attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  INDEX idx_mark_release_notification_training (training_id, is_dismissed),
  INDEX idx_mark_release_notification_created_at (created_at)
);
