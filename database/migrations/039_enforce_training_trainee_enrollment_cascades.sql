USE lms_db;

SET SQL_SAFE_UPDATES = 0;

-- Ensure legacy databases match schema.sql for trainee/training/enrollment delete cascades.

-- training_sections.training_id -> trainings.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'training_sections'
    AND kcu.COLUMN_NAME = 'training_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainings'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE training_sections ADD CONSTRAINT fk_training_sections_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'training_sections'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE training_sections DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_training_sections_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_materials.section_id -> training_sections.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'training_materials'
    AND kcu.COLUMN_NAME = 'section_id'
    AND kcu.REFERENCED_TABLE_NAME = 'training_sections'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE training_materials ADD CONSTRAINT fk_training_materials_section FOREIGN KEY (section_id) REFERENCES training_sections(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'training_materials'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE training_materials DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_training_materials_section FOREIGN KEY (section_id) REFERENCES training_sections(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_media.training_id -> trainings.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'training_media'
    AND kcu.COLUMN_NAME = 'training_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainings'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE training_media ADD CONSTRAINT fk_training_media_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'training_media'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE training_media DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_training_media_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- questions.training_id -> trainings.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'questions'
    AND kcu.COLUMN_NAME = 'training_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainings'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE questions ADD CONSTRAINT fk_questions_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'questions'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE questions DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_questions_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- practical_learning_outcomes.training_id -> trainings.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'practical_learning_outcomes'
    AND kcu.COLUMN_NAME = 'training_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainings'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE practical_learning_outcomes ADD CONSTRAINT fk_plo_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'practical_learning_outcomes'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE practical_learning_outcomes DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_plo_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- enrollments.trainee_id -> trainees.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'enrollments'
    AND kcu.COLUMN_NAME = 'trainee_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainees'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE enrollments ADD CONSTRAINT fk_enrollments_trainee FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'enrollments'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE enrollments DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_enrollments_trainee FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- enrollments.training_id -> trainings.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'enrollments'
    AND kcu.COLUMN_NAME = 'training_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainings'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE enrollments ADD CONSTRAINT fk_enrollments_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'enrollments'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE enrollments DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_enrollments_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_material_access.enrollment_id -> enrollments.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'training_material_access'
    AND kcu.COLUMN_NAME = 'enrollment_id'
    AND kcu.REFERENCED_TABLE_NAME = 'enrollments'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE training_material_access ADD CONSTRAINT fk_training_material_access_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'training_material_access'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE training_material_access DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_training_material_access_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_material_access.material_id -> training_materials.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'training_material_access'
    AND kcu.COLUMN_NAME = 'material_id'
    AND kcu.REFERENCED_TABLE_NAME = 'training_materials'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE training_material_access ADD CONSTRAINT fk_training_material_access_material FOREIGN KEY (material_id) REFERENCES training_materials(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'training_material_access'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE training_material_access DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_training_material_access_material FOREIGN KEY (material_id) REFERENCES training_materials(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- attendance.enrollment_id -> enrollments.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'attendance'
    AND kcu.COLUMN_NAME = 'enrollment_id'
    AND kcu.REFERENCED_TABLE_NAME = 'enrollments'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE attendance ADD CONSTRAINT fk_attendance_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'attendance'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE attendance DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_attendance_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- test_attempts.enrollment_id -> enrollments.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'test_attempts'
    AND kcu.COLUMN_NAME = 'enrollment_id'
    AND kcu.REFERENCED_TABLE_NAME = 'enrollments'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE test_attempts ADD CONSTRAINT fk_test_attempts_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'test_attempts'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE test_attempts DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_test_attempts_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- test_answers.attempt_id -> test_attempts.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'test_answers'
    AND kcu.COLUMN_NAME = 'attempt_id'
    AND kcu.REFERENCED_TABLE_NAME = 'test_attempts'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE test_answers ADD CONSTRAINT fk_test_answers_attempt FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'test_answers'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE test_answers DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_test_answers_attempt FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- objective_scores.enrollment_id -> enrollments.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'objective_scores'
    AND kcu.COLUMN_NAME = 'enrollment_id'
    AND kcu.REFERENCED_TABLE_NAME = 'enrollments'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE objective_scores ADD CONSTRAINT fk_objective_scores_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'objective_scores'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE objective_scores DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_objective_scores_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_tests.training_id -> trainings.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'training_tests'
    AND kcu.COLUMN_NAME = 'training_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainings'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE training_tests ADD CONSTRAINT fk_training_tests_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'training_tests'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE training_tests DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_training_tests_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_test_questions.training_test_id -> training_tests.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'training_test_questions'
    AND kcu.COLUMN_NAME = 'training_test_id'
    AND kcu.REFERENCED_TABLE_NAME = 'training_tests'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE training_test_questions ADD CONSTRAINT fk_training_test_questions_test FOREIGN KEY (training_test_id) REFERENCES training_tests(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'training_test_questions'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE training_test_questions DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_training_test_questions_test FOREIGN KEY (training_test_id) REFERENCES training_tests(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- practical_learning_outcome_scores.enrollment_id -> enrollments.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'practical_learning_outcome_scores'
    AND kcu.COLUMN_NAME = 'enrollment_id'
    AND kcu.REFERENCED_TABLE_NAME = 'enrollments'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE practical_learning_outcome_scores ADD CONSTRAINT fk_plo_scores_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'practical_learning_outcome_scores'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE practical_learning_outcome_scores DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_plo_scores_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- practical_learning_outcome_scores.aspect_id -> practical_learning_outcomes.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'practical_learning_outcome_scores'
    AND kcu.COLUMN_NAME = 'aspect_id'
    AND kcu.REFERENCED_TABLE_NAME = 'practical_learning_outcomes'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE practical_learning_outcome_scores ADD CONSTRAINT fk_plo_scores_aspect FOREIGN KEY (aspect_id) REFERENCES practical_learning_outcomes(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'practical_learning_outcome_scores'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE practical_learning_outcome_scores DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_plo_scores_aspect FOREIGN KEY (aspect_id) REFERENCES practical_learning_outcomes(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- final_grades.enrollment_id -> enrollments.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'final_grades'
    AND kcu.COLUMN_NAME = 'enrollment_id'
    AND kcu.REFERENCED_TABLE_NAME = 'enrollments'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE final_grades ADD CONSTRAINT fk_final_grades_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'final_grades'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE final_grades DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_final_grades_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- certificate_issues.enrollment_id -> enrollments.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'certificate_issues'
    AND kcu.COLUMN_NAME = 'enrollment_id'
    AND kcu.REFERENCED_TABLE_NAME = 'enrollments'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE certificate_issues ADD CONSTRAINT fk_certificate_issues_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'certificate_issues'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE certificate_issues DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_certificate_issues_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- certificate_issues.training_id -> trainings.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'certificate_issues'
    AND kcu.COLUMN_NAME = 'training_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainings'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE certificate_issues ADD CONSTRAINT fk_certificate_issues_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'certificate_issues'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE certificate_issues DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_certificate_issues_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- certificate_issues.trainee_id -> trainees.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'certificate_issues'
    AND kcu.COLUMN_NAME = 'trainee_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainees'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE certificate_issues ADD CONSTRAINT fk_certificate_issues_trainee FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'certificate_issues'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE certificate_issues DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_certificate_issues_trainee FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_healthcare.training_id -> trainings.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'training_healthcare'
    AND kcu.COLUMN_NAME = 'training_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainings'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE training_healthcare ADD CONSTRAINT fk_training_healthcare_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'training_healthcare'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE training_healthcare DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_training_healthcare_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_devices.training_id -> trainings.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'training_devices'
    AND kcu.COLUMN_NAME = 'training_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainings'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE training_devices ADD CONSTRAINT fk_training_devices_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'training_devices'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE training_devices DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_training_devices_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_trainees.training_id -> trainings.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'training_trainees'
    AND kcu.COLUMN_NAME = 'training_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainings'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE training_trainees ADD CONSTRAINT fk_training_trainees_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'training_trainees'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE training_trainees DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_training_trainees_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_trainees.trainee_id -> trainees.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'training_trainees'
    AND kcu.COLUMN_NAME = 'trainee_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainees'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE training_trainees ADD CONSTRAINT fk_training_trainees_trainee FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'training_trainees'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE training_trainees DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_training_trainees_trainee FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- package_generation_jobs.training_id -> trainings.id
SET @fk_name := (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.TABLE_NAME = 'package_generation_jobs'
    AND kcu.COLUMN_NAME = 'training_id'
    AND kcu.REFERENCED_TABLE_NAME = 'trainings'
  LIMIT 1
);
SET @sql := IF(
  @fk_name IS NULL,
  'ALTER TABLE package_generation_jobs ADD CONSTRAINT fk_package_generation_jobs_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE',
  IF(
    EXISTS(
      SELECT 1
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = @fk_name
        AND TABLE_NAME = 'package_generation_jobs'
        AND DELETE_RULE <> 'CASCADE'
    ),
    CONCAT('ALTER TABLE package_generation_jobs DROP FOREIGN KEY ', @fk_name, ', ADD CONSTRAINT fk_package_generation_jobs_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET SQL_SAFE_UPDATES = 1;
