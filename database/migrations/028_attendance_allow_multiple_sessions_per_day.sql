-- Allow multiple attendance sessions per day as long as the start time differs
ALTER TABLE attendance
  DROP INDEX unique_attendance,
  ADD UNIQUE KEY unique_attendance_session (enrollment_id, date, time);
