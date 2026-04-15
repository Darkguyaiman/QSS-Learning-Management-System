-- Migration: use CRM client id as healthcare.id and allow duplicate names

ALTER TABLE healthcare
  DROP INDEX name;
