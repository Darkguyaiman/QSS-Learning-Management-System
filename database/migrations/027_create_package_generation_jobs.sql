CREATE TABLE IF NOT EXISTS package_generation_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  created_by INT NOT NULL,
  status ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued',
  form_data_json LONGTEXT NOT NULL,
  generated_by_name VARCHAR(255) NOT NULL DEFAULT '',
  generated_by_position VARCHAR(255) NOT NULL DEFAULT '',
  output_path VARCHAR(1024) NULL,
  output_filename VARCHAR(255) NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  INDEX idx_package_generation_jobs_status (status, created_at),
  INDEX idx_package_generation_jobs_lookup (created_by, training_id, status, created_at),
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
