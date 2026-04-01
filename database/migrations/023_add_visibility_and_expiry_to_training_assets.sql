-- Migration: Add visibility and expiry policy to training materials and training media

ALTER TABLE training_materials
  ADD COLUMN IF NOT EXISTS visibility ENUM('public', 'private') NOT NULL DEFAULT 'private' AFTER uploaded_by;

ALTER TABLE training_materials
  ADD COLUMN IF NOT EXISTS access_expires_at DATETIME NULL AFTER visibility;

ALTER TABLE training_media
  ADD COLUMN IF NOT EXISTS visibility ENUM('public', 'private') NOT NULL DEFAULT 'public' AFTER uploaded_by;

ALTER TABLE training_media
  ADD COLUMN IF NOT EXISTS access_expires_at DATETIME NULL AFTER visibility;

-- Public media defaults to 2 years from posting if no expiry was set
UPDATE training_media
SET access_expires_at = COALESCE(access_expires_at, DATE_ADD(created_at, INTERVAL 2 YEAR))
WHERE COALESCE(visibility, 'public') = 'public';

