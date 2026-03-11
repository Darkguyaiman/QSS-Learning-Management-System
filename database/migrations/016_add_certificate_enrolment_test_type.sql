-- Migration: Add 'certificate_enrolment' test type; make option_c and option_d nullable
-- Schema now includes this.

USE lms_db;

ALTER TABLE questions MODIFY COLUMN test_type ENUM('pre_test', 'post_test', 'refreshment', 'certificate_enrolment') NOT NULL;
ALTER TABLE test_attempts MODIFY COLUMN test_type ENUM('pre_test', 'post_test', 'refreshment', 'certificate_enrolment') NOT NULL;
ALTER TABLE questions MODIFY COLUMN option_c VARCHAR(500) NULL;
ALTER TABLE questions MODIFY COLUMN option_d VARCHAR(500) NULL;
