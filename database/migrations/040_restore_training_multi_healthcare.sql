-- Migration: Restore multiple healthcare centres per training
-- Replaces the single-healthcare unique key with a per-pair unique key.
USE lms_db;

SET SQL_SAFE_UPDATES = 0;

ALTER TABLE training_healthcare
  ADD UNIQUE KEY unique_training_healthcare (training_id, healthcare_id);

ALTER TABLE training_healthcare
  DROP INDEX unique_training_healthcare_training;

SET SQL_SAFE_UPDATES = 1;
