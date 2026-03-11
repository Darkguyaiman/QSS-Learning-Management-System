-- Migration: Update questions.training_id FK to ON DELETE SET NULL
-- Schema now includes this.

USE lms_db;

ALTER TABLE questions DROP FOREIGN KEY questions_ibfk_1;
ALTER TABLE questions ADD CONSTRAINT questions_ibfk_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE SET NULL;
