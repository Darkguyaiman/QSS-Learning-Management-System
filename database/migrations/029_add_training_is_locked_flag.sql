-- Split workflow status from edit lock state
ALTER TABLE trainings
  ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

-- Preserve current behavior for existing completed trainings
UPDATE trainings
SET is_locked = 1
WHERE status = 'completed';
