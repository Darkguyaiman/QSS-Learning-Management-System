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
  name VARCHAR(255) NOT NULL UNIQUE,
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

-- K-Laser Models table
CREATE TABLE k_laser_models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Device Serial Numbers table (linked to K-Laser Models)
CREATE TABLE device_serial_numbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  serial_number VARCHAR(255) NOT NULL UNIQUE,
  k_laser_model_id INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (k_laser_model_id) REFERENCES k_laser_models(id) ON DELETE RESTRICT
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
  created_by INT,
  status ENUM('in_progress', 'completed', 'canceled', 'rescheduled') DEFAULT 'in_progress',
  start_datetime DATETIME,
  end_datetime DATETIME,
  header_image VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
  test_type ENUM('pre_test', 'post_test', 'refresher_training', 'certificate_enrolment') NOT NULL,
  objective_id INT,
  training_id INT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
  UNIQUE KEY unique_attendance (enrollment_id, date)
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

-- Training Healthcare (many-to-many relationship)
CREATE TABLE training_healthcare (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_id INT NOT NULL,
  healthcare_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
  FOREIGN KEY (healthcare_id) REFERENCES healthcare(id) ON DELETE CASCADE,
  UNIQUE KEY unique_training_healthcare (training_id, healthcare_id)
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

-- Indexes for better performance
CREATE INDEX idx_user_role ON users(role);
CREATE INDEX idx_training_type ON trainings(type);
CREATE INDEX idx_enrollment_trainee ON enrollments(trainee_id);
CREATE INDEX idx_enrollment_training ON enrollments(training_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_test_attempts_enrollment ON test_attempts(enrollment_id);
CREATE INDEX idx_questions_training ON questions(training_id);
CREATE INDEX idx_device_model ON device_serial_numbers(k_laser_model_id);
