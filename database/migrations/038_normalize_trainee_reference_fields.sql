USE lms_db;

SET SQL_SAFE_UPDATES = 0;

-- Create designations table
CREATE TABLE IF NOT EXISTS designations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add FK columns safely
SET @col1 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trainees' AND COLUMN_NAME = 'healthcare_id'
);
SET @sql1 := IF(@col1 = 0,
  'ALTER TABLE trainees ADD COLUMN healthcare_id INT NULL AFTER handphone_number',
  'SELECT 1'
);
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @col2 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trainees' AND COLUMN_NAME = 'designation_id'
);
SET @sql2 := IF(@col2 = 0,
  'ALTER TABLE trainees ADD COLUMN designation_id INT NULL AFTER healthcare_id',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SET @col3 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trainees' AND COLUMN_NAME = 'device_serial_number_id'
);
SET @sql3 := IF(@col3 = 0,
  'ALTER TABLE trainees ADD COLUMN device_serial_number_id INT NULL AFTER designation_id',
  'SELECT 1'
);
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

-- Pivot table
CREATE TABLE IF NOT EXISTS trainee_area_of_specializations (
  trainee_id INT NOT NULL,
  area_of_specialization_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trainee_id, area_of_specialization_id),
  CONSTRAINT fk_taos_trainee FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE,
  CONSTRAINT fk_taos_area FOREIGN KEY (area_of_specialization_id) REFERENCES areas_of_specialization(id) ON DELETE CASCADE
);

-- Insert designations
INSERT INTO designations (name)
SELECT DISTINCT TRIM(designation)
FROM trainees
WHERE designation IS NOT NULL AND TRIM(designation) <> ''
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Map foreign keys
UPDATE trainees t
LEFT JOIN healthcare h ON h.name = t.healthcare
SET t.healthcare_id = h.id
WHERE t.healthcare_id IS NULL;

UPDATE trainees t
LEFT JOIN designations d ON d.name = t.designation
SET t.designation_id = d.id
WHERE t.designation_id IS NULL;

UPDATE trainees t
LEFT JOIN device_serial_numbers dsn ON dsn.serial_number = t.serial_number
SET t.device_serial_number_id = dsn.id
WHERE t.device_serial_number_id IS NULL;

-- JSON → pivot
INSERT IGNORE INTO trainee_area_of_specializations (trainee_id, area_of_specialization_id)
SELECT
  t.id,
  aos.id
FROM trainees t
JOIN JSON_TABLE(
  CASE
    WHEN t.area_of_specialization IS NULL THEN JSON_ARRAY()
    WHEN JSON_VALID(t.area_of_specialization) THEN CAST(t.area_of_specialization AS JSON)
    WHEN TRIM(CAST(t.area_of_specialization AS CHAR(1000))) = '' THEN JSON_ARRAY()
    ELSE CAST(
      CONCAT(
        '["',
        REPLACE(
          REPLACE(
            REPLACE(TRIM(CAST(t.area_of_specialization AS CHAR(1000))), '\\', '\\\\'),
            '"',
            '\\"'
          ),
          ',',
          '","'
        ),
        '"]'
      ) AS JSON
    )
  END,
  '$[*]' COLUMNS (
    area_name VARCHAR(255) PATH '$'
  )
) jt ON TRUE
JOIN areas_of_specialization aos ON aos.name = jt.area_name;

-- Add foreign keys safely
SET @fk1 := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trainees'
    AND CONSTRAINT_NAME = 'fk_trainees_healthcare'
);
SET @sql_fk1 := IF(@fk1 = 0,
  'ALTER TABLE trainees ADD CONSTRAINT fk_trainees_healthcare FOREIGN KEY (healthcare_id) REFERENCES healthcare(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk1 FROM @sql_fk1; EXECUTE stmt_fk1; DEALLOCATE PREPARE stmt_fk1;

SET @fk2 := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trainees'
    AND CONSTRAINT_NAME = 'fk_trainees_designation'
);
SET @sql_fk2 := IF(@fk2 = 0,
  'ALTER TABLE trainees ADD CONSTRAINT fk_trainees_designation FOREIGN KEY (designation_id) REFERENCES designations(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk2 FROM @sql_fk2; EXECUTE stmt_fk2; DEALLOCATE PREPARE stmt_fk2;

SET @fk3 := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'trainees'
    AND CONSTRAINT_NAME = 'fk_trainees_device_serial_number'
);
SET @sql_fk3 := IF(@fk3 = 0,
  'ALTER TABLE trainees ADD CONSTRAINT fk_trainees_device_serial_number FOREIGN KEY (device_serial_number_id) REFERENCES device_serial_numbers(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk3 FROM @sql_fk3; EXECUTE stmt_fk3; DEALLOCATE PREPARE stmt_fk3;

-- Indexes (safe enough to rerun in most cases)
CREATE INDEX idx_trainees_healthcare ON trainees(healthcare_id);
CREATE INDEX idx_trainees_designation ON trainees(designation_id);
CREATE INDEX idx_trainees_device_serial_number ON trainees(device_serial_number_id);
CREATE INDEX idx_taos_area ON trainee_area_of_specializations(area_of_specialization_id);

-- Drop old columns safely
SET @drop1 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trainees' AND COLUMN_NAME = 'healthcare'
);
SET @sql_d1 := IF(@drop1 > 0,
  'ALTER TABLE trainees DROP COLUMN healthcare',
  'SELECT 1'
);
PREPARE stmt_d1 FROM @sql_d1; EXECUTE stmt_d1; DEALLOCATE PREPARE stmt_d1;

SET @drop2 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trainees' AND COLUMN_NAME = 'designation'
);
SET @sql_d2 := IF(@drop2 > 0,
  'ALTER TABLE trainees DROP COLUMN designation',
  'SELECT 1'
);
PREPARE stmt_d2 FROM @sql_d2; EXECUTE stmt_d2; DEALLOCATE PREPARE stmt_d2;

SET @drop3 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trainees' AND COLUMN_NAME = 'area_of_specialization'
);
SET @sql_d3 := IF(@drop3 > 0,
  'ALTER TABLE trainees DROP COLUMN area_of_specialization',
  'SELECT 1'
);
PREPARE stmt_d3 FROM @sql_d3; EXECUTE stmt_d3; DEALLOCATE PREPARE stmt_d3;

SET @drop4 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trainees' AND COLUMN_NAME = 'serial_number'
);
SET @sql_d4 := IF(@drop4 > 0,
  'ALTER TABLE trainees DROP COLUMN serial_number',
  'SELECT 1'
);
PREPARE stmt_d4 FROM @sql_d4; EXECUTE stmt_d4; DEALLOCATE PREPARE stmt_d4;

SET SQL_SAFE_UPDATES = 1;