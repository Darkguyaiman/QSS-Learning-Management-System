-- Migration: Remove datetime from attendance; add time and duration columns
-- Schema now includes time and duration; no datetime column.

USE lms_db;

-- Optional: drop legacy datetime column and index if they exist
-- ALTER TABLE attendance DROP INDEX IF EXISTS unique_attendance_datetime;
-- ALTER TABLE attendance DROP COLUMN IF EXISTS datetime;

ALTER TABLE attendance ADD COLUMN time TIME NULL AFTER date;
ALTER TABLE attendance ADD COLUMN duration DECIMAL(4,2) NULL COMMENT 'Duration in hours' AFTER time;
