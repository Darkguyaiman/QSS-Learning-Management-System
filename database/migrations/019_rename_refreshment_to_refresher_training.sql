-- Rename refreshment to refresher_training across training and test enums

ALTER TABLE trainings
  MODIFY COLUMN type ENUM('main', 'refreshment', 'refresher_training') NOT NULL;

UPDATE trainings
  SET type = 'refresher_training'
  WHERE type = 'refreshment';

ALTER TABLE trainings
  MODIFY COLUMN type ENUM('main', 'refresher_training') NOT NULL;

ALTER TABLE questions
  MODIFY COLUMN test_type ENUM('pre_test', 'post_test', 'refreshment', 'refresher_training', 'certificate_enrolment') NOT NULL;

UPDATE questions
  SET test_type = 'refresher_training'
  WHERE test_type = 'refreshment';

ALTER TABLE questions
  MODIFY COLUMN test_type ENUM('pre_test', 'post_test', 'refresher_training', 'certificate_enrolment') NOT NULL;

ALTER TABLE test_attempts
  MODIFY COLUMN test_type ENUM('pre_test', 'post_test', 'refreshment', 'refresher_training', 'certificate_enrolment') NOT NULL;

UPDATE test_attempts
  SET test_type = 'refresher_training'
  WHERE test_type = 'refreshment';

ALTER TABLE test_attempts
  MODIFY COLUMN test_type ENUM('pre_test', 'post_test', 'refresher_training', 'certificate_enrolment') NOT NULL;
