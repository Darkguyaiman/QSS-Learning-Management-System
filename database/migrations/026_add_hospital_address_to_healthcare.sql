-- Migration: Add hospital_address to healthcare settings

ALTER TABLE healthcare
  ADD COLUMN IF NOT EXISTS hospital_address TEXT AFTER name;
