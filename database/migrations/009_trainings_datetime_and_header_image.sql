-- Migration: Add start_datetime, end_datetime, header_image to trainings
-- Schema now includes this.

USE lms_db;

ALTER TABLE trainings ADD COLUMN start_datetime DATETIME NULL AFTER status;
ALTER TABLE trainings ADD COLUMN end_datetime DATETIME NULL AFTER start_datetime;
ALTER TABLE trainings ADD COLUMN header_image VARCHAR(255) NULL AFTER end_datetime;
