-- Migration: Update trainings.status enum to in_progress, completed, canceled, rescheduled
-- Schema now includes this. Migrate existing data before changing enum.

USE lms_db;

-- UPDATE trainings SET status = 'in_progress' WHERE status IN ('active', 'draft');
-- UPDATE trainings SET status = 'completed' WHERE status = 'archived';
ALTER TABLE trainings MODIFY COLUMN status ENUM('in_progress', 'completed', 'canceled', 'rescheduled') DEFAULT 'in_progress';
