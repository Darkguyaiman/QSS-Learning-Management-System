CREATE TABLE IF NOT EXISTS modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO modules (name, description)
SELECT dm.model_name, dm.description
FROM device_models dm
LEFT JOIN modules m ON m.name = dm.model_name
WHERE m.id IS NULL;

ALTER TABLE questions
  ADD COLUMN module_id INT NULL AFTER test_type;

UPDATE questions q
JOIN device_models dm ON dm.id = q.device_model_id
JOIN modules m ON m.name = dm.model_name
SET q.module_id = m.id
WHERE q.module_id IS NULL;

ALTER TABLE trainings
  ADD COLUMN module_id INT NULL AFTER type;

UPDATE trainings t
JOIN device_models dm ON dm.id = t.device_model_id
JOIN modules m ON m.name = dm.model_name
SET t.module_id = m.id
WHERE t.module_id IS NULL;

ALTER TABLE questions
  MODIFY COLUMN module_id INT NOT NULL,
  ADD CONSTRAINT fk_questions_module
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE RESTRICT,
  ADD INDEX idx_questions_module (module_id);

ALTER TABLE trainings
  MODIFY COLUMN module_id INT NOT NULL,
  ADD CONSTRAINT fk_trainings_module
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE RESTRICT,
  ADD INDEX idx_trainings_module (module_id);
