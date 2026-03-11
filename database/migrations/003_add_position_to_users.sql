-- Migration: Add position column to users table (admin/trainer)
-- Schema now includes this.

USE lms_db;

ALTER TABLE users ADD COLUMN position VARCHAR(255) NOT NULL DEFAULT '' AFTER last_name;
