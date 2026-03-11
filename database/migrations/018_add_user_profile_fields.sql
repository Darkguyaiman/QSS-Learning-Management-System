ALTER TABLE users
  ADD COLUMN phone_number VARCHAR(20) NULL AFTER position,
  ADD COLUMN area_of_specialization VARCHAR(255) NULL AFTER phone_number,
  ADD COLUMN certificate_file VARCHAR(255) NULL AFTER area_of_specialization;
