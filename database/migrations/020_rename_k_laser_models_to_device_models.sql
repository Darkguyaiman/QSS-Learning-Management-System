-- Rename K-Laser models to device models
RENAME TABLE k_laser_models TO device_models;

-- Update device_serial_numbers to reference device_models
ALTER TABLE device_serial_numbers
  DROP FOREIGN KEY device_serial_numbers_ibfk_1;

ALTER TABLE device_serial_numbers
  CHANGE COLUMN k_laser_model_id device_model_id INT NOT NULL;

ALTER TABLE device_serial_numbers
  ADD CONSTRAINT fk_device_serial_numbers_device_model
    FOREIGN KEY (device_model_id) REFERENCES device_models(id) ON DELETE RESTRICT;

ALTER TABLE device_serial_numbers
  DROP INDEX idx_device_model;

ALTER TABLE device_serial_numbers
  ADD INDEX idx_device_model (device_model_id);

-- Add device_model_id to trainings (nullable to allow backfill)
ALTER TABLE trainings
  ADD COLUMN device_model_id INT NULL AFTER type;

ALTER TABLE trainings
  ADD CONSTRAINT fk_trainings_device_model
    FOREIGN KEY (device_model_id) REFERENCES device_models(id) ON DELETE RESTRICT;

ALTER TABLE trainings
  ADD INDEX idx_trainings_device_model (device_model_id);

-- Add device_model_id to questions (nullable to allow backfill)
ALTER TABLE questions
  ADD COLUMN device_model_id INT NULL AFTER test_type;

ALTER TABLE questions
  ADD CONSTRAINT fk_questions_device_model
    FOREIGN KEY (device_model_id) REFERENCES device_models(id) ON DELETE RESTRICT;

ALTER TABLE questions
  ADD INDEX idx_questions_device_model (device_model_id);
