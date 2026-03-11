-- Migration: Create training_media table
-- Schema now includes this.

USE lms_db;

CREATE TABLE IF NOT EXISTS training_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  original_name VARCHAR(255),
  uploaded_by INT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_training_media_training (training_id)
);
