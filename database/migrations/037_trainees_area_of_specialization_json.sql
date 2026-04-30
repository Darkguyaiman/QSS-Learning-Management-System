-- Migration: convert trainees.area_of_specialization from VARCHAR to JSON
-- Superseded by 038_normalize_trainee_reference_fields.sql for full trainee field normalization.
-- Do not run this after 038, because 038 removes the old direct trainee text columns.
USE lms_db;

ALTER TABLE trainees
  ADD COLUMN IF NOT EXISTS healthcare VARCHAR(255) NULL AFTER handphone_number,
  ADD COLUMN IF NOT EXISTS designation VARCHAR(255) NULL AFTER healthcare,
  ADD COLUMN IF NOT EXISTS area_of_specialization VARCHAR(255) NULL AFTER designation;

ALTER TABLE trainees
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100) NULL AFTER area_of_specialization;

ALTER TABLE trainees
  ADD COLUMN area_of_specialization_json JSON NULL AFTER designation;

UPDATE trainees
SET area_of_specialization_json = CASE
  WHEN area_of_specialization IS NULL OR TRIM(area_of_specialization) = '' THEN NULL
  WHEN JSON_VALID(area_of_specialization) THEN CAST(area_of_specialization AS JSON)
  ELSE CAST(
    CONCAT(
      '["',
      REPLACE(
        REPLACE(
          REPLACE(TRIM(area_of_specialization), '\\', '\\\\'),
          '"',
          '\\"'
        ),
        ',',
        '","'
      ),
      '"]'
    ) AS JSON
  )
END;

ALTER TABLE trainees
  DROP COLUMN area_of_specialization;

ALTER TABLE trainees
  CHANGE COLUMN area_of_specialization_json area_of_specialization JSON NULL;
