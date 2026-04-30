USE lms_db;

SET SQL_SAFE_UPDATES = 0;

-- Check if foreign key exists
SET @fk_exist := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'questions'
    AND CONSTRAINT_NAME = 'questions_ibfk_1'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

-- Drop FK if exists
SET @sql_fk := IF(
  @fk_exist > 0,
  'ALTER TABLE questions DROP FOREIGN KEY questions_ibfk_1',
  'SELECT 1'
);

PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- Now check if column exists
SET @col_exist := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'questions'
    AND COLUMN_NAME = 'device_model_id'
);

-- Drop column if exists
SET @sql_col := IF(
  @col_exist > 0,
  'ALTER TABLE questions DROP COLUMN device_model_id',
  'SELECT 1'
);

PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

SET SQL_SAFE_UPDATES = 1;