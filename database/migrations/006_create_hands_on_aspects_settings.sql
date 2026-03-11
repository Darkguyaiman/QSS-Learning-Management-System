-- Migration: Create hands_on_aspects_settings table
-- Schema now includes this.

USE lms_db;

CREATE TABLE IF NOT EXISTS hands_on_aspects_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  aspect_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  max_score INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
