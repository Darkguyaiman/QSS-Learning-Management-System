-- Migration: remove unused healthcare description column

ALTER TABLE healthcare
  DROP COLUMN description;
