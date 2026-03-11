-- Migration: Create training_trainers junction table
-- Schema now includes this.

USE lms_db;

CREATE TABLE IF NOT EXISTS training_trainers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  trainer_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_training_trainer (training_id, trainer_id)
);
