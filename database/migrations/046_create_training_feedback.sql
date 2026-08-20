CREATE TABLE training_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  overall_rating TINYINT UNSIGNED NOT NULL,
  content_relevance_rating TINYINT UNSIGNED NOT NULL,
  trainer_effectiveness_rating TINYINT UNSIGNED NOT NULL,
  practical_confidence_rating TINYINT UNSIGNED NOT NULL,
  pace ENUM('too_slow', 'about_right', 'too_fast') NOT NULL,
  most_valuable TEXT NULL,
  improvement_suggestions TEXT NULL,
  additional_comments TEXT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_training_feedback_enrollment (enrollment_id),
  INDEX idx_training_feedback_submitted_at (submitted_at),
  CONSTRAINT fk_training_feedback_enrollment
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  CONSTRAINT chk_training_feedback_overall_rating CHECK (overall_rating BETWEEN 1 AND 5),
  CONSTRAINT chk_training_feedback_content_rating CHECK (content_relevance_rating BETWEEN 1 AND 5),
  CONSTRAINT chk_training_feedback_trainer_rating CHECK (trainer_effectiveness_rating BETWEEN 1 AND 5),
  CONSTRAINT chk_training_feedback_confidence_rating CHECK (practical_confidence_rating BETWEEN 1 AND 5)
);
