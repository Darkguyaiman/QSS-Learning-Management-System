-- Migration: Add affiliated company for each training

ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS affiliated_company ENUM('QSS', 'PMS') NOT NULL DEFAULT 'QSS' AFTER created_by;

