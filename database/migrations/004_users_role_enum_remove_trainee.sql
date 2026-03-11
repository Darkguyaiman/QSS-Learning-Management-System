-- Migration: Ensure users.role enum is only 'admin','trainer' (remove legacy 'trainee')
-- Run only on databases that had role='trainee'. Convert existing trainee users to trainer first.

USE lms_db;

-- UPDATE users SET role = 'trainer' WHERE role = 'trainee';
ALTER TABLE users MODIFY COLUMN role ENUM('admin','trainer') NOT NULL;
