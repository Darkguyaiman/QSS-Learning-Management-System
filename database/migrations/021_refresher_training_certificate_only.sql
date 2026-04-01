-- Refresher training now uses certificate_enrolment test only
-- 1) Remove refresher question type from question bank data and enum
UPDATE questions
SET test_type = 'certificate_enrolment'
WHERE test_type = 'refresher_training';

ALTER TABLE questions
  MODIFY COLUMN test_type ENUM('pre_test', 'post_test', 'certificate_enrolment') NOT NULL;

-- 2) Keep only certificate test definition for refresher trainings
--    (training_test_questions rows are removed automatically via FK cascade)
DELETE tt
FROM training_tests tt
JOIN trainings t ON t.id = tt.training_id
WHERE t.type = 'refresher_training'
  AND tt.test_type = 'refresher_training';

-- 3) Normalize refresher certificate test question count
UPDATE training_tests tt
JOIN trainings t ON t.id = tt.training_id
SET tt.total_questions = 40
WHERE t.type = 'refresher_training'
  AND tt.test_type = 'certificate_enrolment';
