-- Migration: Add 'registered' to trainees.trainee_status enum
-- Schema now includes this.

USE lms_db;

ALTER TABLE trainees MODIFY COLUMN trainee_status ENUM('active', 'inactive', 'suspended', 'registered') DEFAULT 'registered';
