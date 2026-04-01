CREATE TABLE IF NOT EXISTS training_material_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  enrollment_id INT NOT NULL,
  first_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  access_count INT NOT NULL DEFAULT 1,
  FOREIGN KEY (material_id) REFERENCES training_materials(id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  UNIQUE KEY uq_material_enrollment (material_id, enrollment_id),
  INDEX idx_material_access_material (material_id),
  INDEX idx_material_access_enrollment (enrollment_id)
);
