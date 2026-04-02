-- Migration: Enforce one healthcare per training
-- Keep only one healthcare mapping per training before adding the unique key.

DELETE th1
FROM training_healthcare th1
JOIN training_healthcare th2
  ON th1.training_id = th2.training_id
 AND th1.id > th2.id;

ALTER TABLE training_healthcare
  DROP INDEX unique_training_healthcare;

ALTER TABLE training_healthcare
  ADD UNIQUE KEY unique_training_healthcare_training (training_id);
