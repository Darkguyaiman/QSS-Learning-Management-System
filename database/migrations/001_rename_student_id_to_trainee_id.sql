-- Migration: Rename student_id to trainee_id in enrollments table
-- Applied to schema.sql; run this only on databases created before the rename.

USE lms_db;

ALTER TABLE enrollments CHANGE COLUMN student_id trainee_id INT NOT NULL;

-- Recreate foreign key and unique constraint if needed (names may vary)
-- ALTER TABLE enrollments DROP FOREIGN KEY enrollments_ibfk_1;
-- ALTER TABLE enrollments ADD CONSTRAINT enrollments_ibfk_1 FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE;
-- ALTER TABLE enrollments DROP INDEX unique_enrollment;
-- ALTER TABLE enrollments ADD UNIQUE KEY unique_enrollment (trainee_id, training_id);
-- CREATE INDEX idx_enrollment_trainee ON enrollments(trainee_id);
