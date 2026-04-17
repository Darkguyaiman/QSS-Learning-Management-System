-- Migration: add healthcare training reminder interval and due date

ALTER TABLE healthcare
  ADD COLUMN training_reminder_interval ENUM('6_months', '1_year', '2_years', '3_years') NULL AFTER hospital_address,
  ADD COLUMN training_reminder_due_date DATE NULL AFTER training_reminder_interval;
