-- Migration: Create training_healthcare junction table
-- Schema now includes this.

USE lms_db;

CREATE TABLE IF NOT EXISTS training_healthcare (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  healthcare_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (healthcare_id) REFERENCES healthcare(id) ON DELETE CASCADE,
  UNIQUE KEY unique_training_healthcare (training_id, healthcare_id)
);
