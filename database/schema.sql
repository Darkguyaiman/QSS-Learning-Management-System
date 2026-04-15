-- Create database
CREATE DATABASE IF NOT EXISTS lms_db;
USE lms_db;

-- Sessions table (express-mysql-session)
CREATE TABLE sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT
);

-- Users table (Admin, Trainer only)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  position VARCHAR(255) NOT NULL DEFAULT '',
  phone_number VARCHAR(20),
  area_of_specialization VARCHAR(255),
  certificate_file VARCHAR(255),
  role ENUM('admin', 'trainer') NOT NULL,
  profile_picture VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Trainees table (separate from users with additional fields)
CREATE TABLE trainees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trainee_id VARCHAR(10) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  ic_passport VARCHAR(50) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  handphone_number VARCHAR(20),
  healthcare VARCHAR(255),
  designation VARCHAR(255),
  area_of_specialization VARCHAR(255),
  serial_number VARCHAR(100),
  first_training DATE,
  latest_training DATE,
  recertification_date DATE,
  number_of_completed_trainings INT DEFAULT 0,
  trainee_status ENUM('active', 'inactive', 'suspended', 'registered') DEFAULT 'registered',
  profile_picture VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Settings tables (must exist before trainings/questions that reference them)
-- Objectives table
CREATE TABLE objectives (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Healthcare table
CREATE TABLE healthcare (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  hospital_address TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Areas of Specialization table
CREATE TABLE areas_of_specialization (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Modules table
CREATE TABLE modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Training Titles table
CREATE TABLE training_titles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Device Models table
CREATE TABLE device_models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Device Serial Numbers table (linked to Device Models)
CREATE TABLE device_serial_numbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  serial_number VARCHAR(255) NOT NULL UNIQUE,
  device_model_id INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (device_model_id) REFERENCES device_models(id) ON DELETE RESTRICT
);

-- Practical Learning Outcomes Settings table (templates for outcomes)
CREATE TABLE practical_learning_outcomes_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  aspect_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  max_score INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Training types
CREATE TABLE trainings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type ENUM('main', 'refresher_training') NOT NULL,
  module_id INT NOT NULL,
  device_model_id INT NOT NULL,
  created_by INT,
  affiliated_company ENUM('QSS', 'PMS') NOT NULL DEFAULT 'QSS',
  status ENUM('in_progress', 'completed', 'canceled', 'rescheduled') DEFAULT 'in_progress',
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  start_datetime DATETIME,
  end_datetime DATETIME,
  header_image VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE RESTRICT,
  FOREIGN KEY (device_model_id) REFERENCES device_models(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Training sections for organizing materials
CREATE TABLE training_sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  section_order INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
);

-- Training materials (videos, documents, photos)
CREATE TABLE training_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  type ENUM('video', 'document', 'image', 'link') NOT NULL,
  file_path VARCHAR(500),
  url VARCHAR(500),
  material_order INT NOT NULL,
  uploaded_by INT,
  visibility ENUM('public', 'private') NOT NULL DEFAULT 'private',
  access_expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES training_sections(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Training media (image gallery for a training, stored as WebP)
CREATE TABLE training_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  original_name VARCHAR(255),
  uploaded_by INT,
  visibility ENUM('public', 'private') NOT NULL DEFAULT 'public',
  access_expires_at DATETIME NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_training_media_training (training_id)
);

-- Question bank for all tests
CREATE TABLE questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_text TEXT NOT NULL,
  option_a VARCHAR(500) NOT NULL,
  option_b VARCHAR(500) NOT NULL,
  option_c VARCHAR(500) NULL,
  option_d VARCHAR(500) NULL,
  correct_answer ENUM('A', 'B', 'C', 'D') NOT NULL,
  test_type ENUM('pre_test', 'post_test', 'certificate_enrolment') NOT NULL,
  module_id INT NOT NULL,
  objective_id INT,
  training_id INT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE RESTRICT,
  FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE SET NULL,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Practical learning outcomes for main training
CREATE TABLE practical_learning_outcomes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  aspect_name VARCHAR(255) NOT NULL,
  description TEXT,
  max_score INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
);

-- Trainee enrollment in trainings
CREATE TABLE enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trainee_id INT NOT NULL,
  training_id INT NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active', 'completed', 'dropped') DEFAULT 'active',
  can_download_results BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  UNIQUE KEY unique_enrollment (trainee_id, training_id)
);

-- Material access tracking (per trainee enrollment)
CREATE TABLE training_material_access (
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

-- Attendance records
CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  date DATE NOT NULL,
  time TIME NULL COMMENT 'Time of attendance',
  duration DECIMAL(4,2) NULL COMMENT 'Duration in hours',
  status ENUM('present', 'absent', 'late') NOT NULL,
  marked_by INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_attendance_session (enrollment_id, date, time)
);

-- Test attempts
CREATE TABLE test_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  test_type ENUM('pre_test', 'post_test', 'refresher_training', 'certificate_enrolment') NOT NULL,
  score DECIMAL(5,2),
  total_questions INT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  status ENUM('in_progress', 'completed') DEFAULT 'in_progress',
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
);

-- Individual question answers
CREATE TABLE test_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT NOT NULL,
  question_id INT NOT NULL,
  selected_answer ENUM('A', 'B', 'C', 'D'),
  is_correct BOOLEAN,
  answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Objective understanding scores for tests
CREATE TABLE objective_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  objective_id INT NOT NULL,
  test_type ENUM('post_test', 'refresher_training', 'certificate_enrolment') NOT NULL,
  questions_answered INT NOT NULL DEFAULT 0,
  questions_correct INT NOT NULL DEFAULT 0,
  understanding_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE,
  UNIQUE KEY unique_objective_score (enrollment_id, objective_id, test_type)
);

-- Training tests (main: pre/post/certificate, refresher: certificate only)
CREATE TABLE training_tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  test_type ENUM('pre_test', 'post_test', 'refresher_training', 'certificate_enrolment') NOT NULL,
  total_questions INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
);

-- Questions assigned to each training test
CREATE TABLE training_test_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_test_id INT NOT NULL,
  question_id INT NOT NULL,
  question_order INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_test_id) REFERENCES training_tests(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Practical learning outcome scores for main training
CREATE TABLE practical_learning_outcome_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  aspect_id INT NOT NULL,
  score DECIMAL(5,2),
  evaluated_by INT,
  comments TEXT,
  evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (aspect_id) REFERENCES practical_learning_outcomes(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluated_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_hands_on_score (enrollment_id, aspect_id)
);

-- Final grades summary per enrollment
CREATE TABLE final_grades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  training_grade DECIMAL(5,2) NULL,
  endorsement_grade DECIMAL(5,2) NULL,
  objective_understanding_percentage DECIMAL(5,2) NULL,
  hands_on_grade DECIMAL(5,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  UNIQUE KEY unique_final_grades (enrollment_id)
);

-- Certificate issuance records (static certificate details per enrollment)
CREATE TABLE certificate_issues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  training_id INT NOT NULL,
  trainee_id INT NOT NULL,
  certificate_number VARCHAR(64) NOT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validity_start DATE NULL,
  validity_end DATE NULL,
  participant_name VARCHAR(255) NOT NULL,
  course_name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  date_display VARCHAR(64) NOT NULL,
  UNIQUE KEY unique_certificate_enrollment (enrollment_id),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE
);

-- Training Healthcare (one healthcare per training)
CREATE TABLE training_healthcare (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  healthcare_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (healthcare_id) REFERENCES healthcare(id) ON DELETE CASCADE,
  UNIQUE KEY unique_training_healthcare_training (training_id)
);

-- Training Devices (many-to-many relationship)
CREATE TABLE training_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  device_serial_number_id INT NULL,
  custom_serial_number VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (device_serial_number_id) REFERENCES device_serial_numbers(id) ON DELETE CASCADE,
  CHECK (device_serial_number_id IS NOT NULL OR custom_serial_number IS NOT NULL)
);

-- Training Trainees (initial enrollment when creating training)
CREATE TABLE training_trainees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  trainee_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE,
  UNIQUE KEY unique_training_trainee (training_id, trainee_id)
);

-- Training Trainers (many-to-many relationship)
CREATE TABLE training_trainers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  trainer_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_training_trainer (training_id, trainer_id)
);

-- Background package generation jobs
CREATE TABLE package_generation_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  created_by INT NOT NULL,
  status ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued',
  form_data_json LONGTEXT NOT NULL,
  generated_by_name VARCHAR(255) NOT NULL DEFAULT '',
  generated_by_position VARCHAR(255) NOT NULL DEFAULT '',
  output_path VARCHAR(1024) NULL,
  output_filename VARCHAR(255) NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX idx_user_role ON users(role);
CREATE INDEX idx_training_type ON trainings(type);
CREATE INDEX idx_enrollment_trainee ON enrollments(trainee_id);
CREATE INDEX idx_enrollment_training ON enrollments(training_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_test_attempts_enrollment ON test_attempts(enrollment_id);
CREATE INDEX idx_questions_training ON questions(training_id);
CREATE INDEX idx_device_model ON device_serial_numbers(device_model_id);
CREATE INDEX idx_questions_module ON questions(module_id);
CREATE INDEX idx_trainings_module ON trainings(module_id);
CREATE INDEX idx_trainings_device_model ON trainings(device_model_id);
CREATE INDEX idx_package_generation_jobs_status ON package_generation_jobs(status, created_at);
CREATE INDEX idx_package_generation_jobs_lookup ON package_generation_jobs(created_by, training_id, status, created_at);
