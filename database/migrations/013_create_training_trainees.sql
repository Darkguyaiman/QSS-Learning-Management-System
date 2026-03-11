-- Migration: Create training_trainees junction table
-- Schema now includes this.

USE lms_db;

CREATE TABLE IF NOT EXISTS training_trainees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  trainee_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE,
  UNIQUE KEY unique_training_trainee (training_id, trainee_id)
);
