-- Migration: Create training_devices junction table
-- Schema now includes this.

USE lms_db;

CREATE TABLE IF NOT EXISTS training_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  device_serial_number_id INT NULL,
  custom_serial_number VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (device_serial_number_id) REFERENCES device_serial_numbers(id) ON DELETE CASCADE,
  CHECK (device_serial_number_id IS NOT NULL OR custom_serial_number IS NOT NULL)
);
