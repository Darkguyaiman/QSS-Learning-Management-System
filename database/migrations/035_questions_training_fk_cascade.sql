USE lms_db;

SET SQL_SAFE_UPDATES = 0;

ALTER TABLE questions 
DROP FOREIGN KEY questions_ibfk_training;

ALTER TABLE questions 
ADD CONSTRAINT questions_ibfk_training 
FOREIGN KEY (training_id) 
REFERENCES trainings(id) 
ON DELETE CASCADE;

SET SQL_SAFE_UPDATES = 1;