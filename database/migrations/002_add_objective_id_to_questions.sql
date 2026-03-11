-- Migration: Add objective_id to questions table
-- Schema now includes this; run only on older databases.

USE lms_db;

ALTER TABLE questions ADD COLUMN objective_id INT NULL AFTER test_type;
ALTER TABLE questions ADD CONSTRAINT questions_ibfk_objective FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE SET NULL;
