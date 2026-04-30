-- MySQL dump 10.13  Distrib 9.4.0, for Win64 (x86_64)
--
-- Host: localhost    Database: lms_db
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `lms_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `lms_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `lms_db`;

--
-- Table structure for table `areas_of_specialization`
--

DROP TABLE IF EXISTS `areas_of_specialization`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `areas_of_specialization` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `areas_of_specialization`
--

LOCK TABLES `areas_of_specialization` WRITE;
/*!40000 ALTER TABLE `areas_of_specialization` DISABLE KEYS */;
INSERT INTO `areas_of_specialization` VALUES (1,'Pain management',NULL,'2026-04-03 01:57:05','2026-04-03 01:57:05'),(2,'Diabetic foot ulcer',NULL,'2026-04-03 01:57:13','2026-04-03 01:57:13'),(3,'Idiopathic pulmonary fibrosis',NULL,'2026-04-03 01:57:20','2026-04-03 01:57:20'),(4,'Erectile dysfunction',NULL,'2026-04-03 01:57:27','2026-04-03 01:57:27'),(5,'Chronic kidney disease',NULL,'2026-04-03 01:57:35','2026-04-03 01:57:40');
/*!40000 ALTER TABLE `areas_of_specialization` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `enrollment_id` int NOT NULL,
  `date` date NOT NULL,
  `time` time DEFAULT NULL COMMENT 'Time of attendance',
  `duration` decimal(4,2) DEFAULT NULL COMMENT 'Duration in hours',
  `status` enum('present','absent','late') NOT NULL,
  `marked_by` int DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_attendance_session` (`enrollment_id`,`date`,`time`),
  KEY `marked_by` (`marked_by`),
  KEY `idx_attendance_date` (`date`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`marked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
INSERT INTO `attendance` VALUES (1,1,'2026-04-03','14:00:00',1.00,'present',1,'','2026-04-03 05:08:46'),(7,1,'2026-04-02','12:00:00',2.00,'present',1,'','2026-04-03 05:10:33'),(13,1,'2026-04-03','12:00:00',3.00,'present',1,'','2026-04-03 05:16:10');
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `certificate_issues`
--

DROP TABLE IF EXISTS `certificate_issues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `certificate_issues` (
  `id` int NOT NULL AUTO_INCREMENT,
  `enrollment_id` int NOT NULL,
  `training_id` int NOT NULL,
  `trainee_id` int NOT NULL,
  `certificate_number` varchar(64) NOT NULL,
  `issued_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `validity_start` date DEFAULT NULL,
  `validity_end` date DEFAULT NULL,
  `participant_name` varchar(255) NOT NULL,
  `course_name` varchar(255) NOT NULL,
  `location` varchar(255) NOT NULL,
  `date_display` varchar(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_certificate_enrollment` (`enrollment_id`),
  KEY `training_id` (`training_id`),
  KEY `trainee_id` (`trainee_id`),
  CONSTRAINT `certificate_issues_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `certificate_issues_ibfk_2` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `certificate_issues_ibfk_3` FOREIGN KEY (`trainee_id`) REFERENCES `trainees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `certificate_issues`
--

LOCK TABLES `certificate_issues` WRITE;
/*!40000 ALTER TABLE `certificate_issues` DISABLE KEYS */;
INSERT INTO `certificate_issues` VALUES (1,1,1,1,'1000-1-1','2026-04-03 05:57:16','2026-04-03','2028-04-03','Mohamed Aiman','K-laser Training: Laser Awareness','KPJ Ampang Puteri Specialist Hospital','April 3, 2026');
/*!40000 ALTER TABLE `certificate_issues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_models`
--

DROP TABLE IF EXISTS `device_models`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `device_models` (
  `id` int NOT NULL AUTO_INCREMENT,
  `model_name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `model_name` (`model_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_models`
--

LOCK TABLES `device_models` WRITE;
/*!40000 ALTER TABLE `device_models` DISABLE KEYS */;
INSERT INTO `device_models` VALUES (1,'K-Laser Cube 4',NULL,'2026-04-03 01:54:33','2026-04-03 01:54:38'),(2,'K-Laser Cube 3',NULL,'2026-04-03 01:54:45','2026-04-03 01:54:45');
/*!40000 ALTER TABLE `device_models` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_serial_numbers`
--

DROP TABLE IF EXISTS `device_serial_numbers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `device_serial_numbers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `serial_number` varchar(255) NOT NULL,
  `device_model_id` int NOT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `serial_number` (`serial_number`),
  KEY `idx_device_model` (`device_model_id`),
  CONSTRAINT `device_serial_numbers_ibfk_1` FOREIGN KEY (`device_model_id`) REFERENCES `device_models` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_serial_numbers`
--

LOCK TABLES `device_serial_numbers` WRITE;
/*!40000 ALTER TABLE `device_serial_numbers` DISABLE KEYS */;
INSERT INTO `device_serial_numbers` VALUES (1,'SN123456',1,NULL,'2026-04-03 01:56:32','2026-04-03 01:56:32'),(2,'SN03655',2,NULL,'2026-04-03 01:56:38','2026-04-03 01:56:38');
/*!40000 ALTER TABLE `device_serial_numbers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `enrollments`
--

DROP TABLE IF EXISTS `enrollments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `enrollments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trainee_id` int NOT NULL,
  `training_id` int NOT NULL,
  `enrolled_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','completed','dropped') DEFAULT 'active',
  `can_download_results` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_enrollment` (`trainee_id`,`training_id`),
  KEY `idx_enrollment_trainee` (`trainee_id`),
  KEY `idx_enrollment_training` (`training_id`),
  CONSTRAINT `enrollments_ibfk_1` FOREIGN KEY (`trainee_id`) REFERENCES `trainees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `enrollments_ibfk_2` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `enrollments`
--

LOCK TABLES `enrollments` WRITE;
/*!40000 ALTER TABLE `enrollments` DISABLE KEYS */;
INSERT INTO `enrollments` VALUES (1,1,1,'2026-04-03 03:27:42','active',1);
/*!40000 ALTER TABLE `enrollments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `final_grades`
--

DROP TABLE IF EXISTS `final_grades`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `final_grades` (
  `id` int NOT NULL AUTO_INCREMENT,
  `enrollment_id` int NOT NULL,
  `training_grade` decimal(5,2) DEFAULT NULL,
  `endorsement_grade` decimal(5,2) DEFAULT NULL,
  `objective_understanding_percentage` decimal(5,2) DEFAULT NULL,
  `hands_on_grade` decimal(5,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_final_grades` (`enrollment_id`),
  CONSTRAINT `final_grades_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `final_grades`
--

LOCK TABLES `final_grades` WRITE;
/*!40000 ALTER TABLE `final_grades` DISABLE KEYS */;
INSERT INTO `final_grades` VALUES (1,1,NULL,90.00,86.95,NULL,'2026-04-03 04:57:42','2026-04-03 05:08:08');
/*!40000 ALTER TABLE `final_grades` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `healthcare`
--

DROP TABLE IF EXISTS `healthcare`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `healthcare` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `hospital_address` text,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `healthcare`
--

LOCK TABLES `healthcare` WRITE;
/*!40000 ALTER TABLE `healthcare` DISABLE KEYS */;
INSERT INTO `healthcare` VALUES (1,'KPJ Ampang Puteri Specialist Hospital','1, Jln Memanda 9, Taman Dato Ahmad Razali, 68000 Ampang, Selangor',NULL,'2026-04-03 01:57:58','2026-04-03 02:01:53'),(2,'KPJ Ipoh Specialist Hospital','26, Jalan Raja Dihilir, 30350 Ipoh, Perak',NULL,'2026-04-03 02:02:24','2026-04-03 02:02:24');
/*!40000 ALTER TABLE `healthcare` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `modules`
--

DROP TABLE IF EXISTS `modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `modules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `modules`
--

LOCK TABLES `modules` WRITE;
/*!40000 ALTER TABLE `modules` DISABLE KEYS */;
INSERT INTO `modules` VALUES (1,'K-Laser Cube',NULL,'2026-04-03 15:57:22','2026-04-04 00:56:12');
/*!40000 ALTER TABLE `modules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `objective_scores`
--

DROP TABLE IF EXISTS `objective_scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `objective_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `enrollment_id` int NOT NULL,
  `objective_id` int NOT NULL,
  `test_type` enum('post_test','refresher_training','certificate_enrolment') NOT NULL,
  `questions_answered` int NOT NULL DEFAULT '0',
  `questions_correct` int NOT NULL DEFAULT '0',
  `understanding_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `calculated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_objective_score` (`enrollment_id`,`objective_id`,`test_type`),
  KEY `objective_id` (`objective_id`),
  CONSTRAINT `objective_scores_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `objective_scores_ibfk_2` FOREIGN KEY (`objective_id`) REFERENCES `objectives` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `objective_scores`
--

LOCK TABLES `objective_scores` WRITE;
/*!40000 ALTER TABLE `objective_scores` DISABLE KEYS */;
INSERT INTO `objective_scores` VALUES (1,1,1,'post_test',2,2,100.00,'2026-04-03 05:02:39'),(2,1,2,'post_test',2,1,50.00,'2026-04-03 05:02:39'),(3,1,3,'post_test',2,2,100.00,'2026-04-03 05:02:39'),(4,1,4,'post_test',2,2,100.00,'2026-04-03 05:02:39'),(5,1,5,'post_test',2,2,100.00,'2026-04-03 05:02:39'),(6,1,1,'certificate_enrolment',11,11,100.00,'2026-04-03 05:08:08'),(7,1,2,'certificate_enrolment',2,1,50.00,'2026-04-03 05:08:08'),(8,1,3,'certificate_enrolment',6,6,100.00,'2026-04-03 05:08:08'),(9,1,4,'certificate_enrolment',12,11,91.67,'2026-04-03 05:08:08'),(10,1,5,'certificate_enrolment',9,7,77.78,'2026-04-03 05:08:08');
/*!40000 ALTER TABLE `objective_scores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `objectives`
--

DROP TABLE IF EXISTS `objectives`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `objectives` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `objectives`
--

LOCK TABLES `objectives` WRITE;
/*!40000 ALTER TABLE `objectives` DISABLE KEYS */;
INSERT INTO `objectives` VALUES (1,'Mechanism of Photobiomodulation',NULL,'2026-04-03 02:02:37','2026-04-03 02:02:37'),(2,'Laser Parameters',NULL,'2026-04-03 02:02:44','2026-04-03 02:02:44'),(3,'Laser Safety',NULL,'2026-04-03 02:02:51','2026-04-03 02:02:51'),(4,'Product Knowledge',NULL,'2026-04-03 02:02:59','2026-04-03 02:02:59'),(5,'Treatment Techniques',NULL,'2026-04-03 02:03:07','2026-04-03 02:03:07');
/*!40000 ALTER TABLE `objectives` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `package_generation_jobs`
--

DROP TABLE IF EXISTS `package_generation_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `package_generation_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `training_id` int NOT NULL,
  `created_by` int NOT NULL,
  `status` enum('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
  `form_data_json` longtext NOT NULL,
  `generated_by_name` varchar(255) NOT NULL DEFAULT '',
  `generated_by_position` varchar(255) NOT NULL DEFAULT '',
  `output_path` varchar(1024) DEFAULT NULL,
  `output_filename` varchar(255) DEFAULT NULL,
  `error_message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `training_id` (`training_id`),
  KEY `idx_package_generation_jobs_status` (`status`,`created_at`),
  KEY `idx_package_generation_jobs_lookup` (`created_by`,`training_id`,`status`,`created_at`),
  CONSTRAINT `package_generation_jobs_ibfk_1` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `package_generation_jobs_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `package_generation_jobs`
--

LOCK TABLES `package_generation_jobs` WRITE;
/*!40000 ALTER TABLE `package_generation_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `package_generation_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `practical_learning_outcome_scores`
--

DROP TABLE IF EXISTS `practical_learning_outcome_scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `practical_learning_outcome_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `enrollment_id` int NOT NULL,
  `aspect_id` int NOT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `evaluated_by` int DEFAULT NULL,
  `comments` text,
  `evaluated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_hands_on_score` (`enrollment_id`,`aspect_id`),
  KEY `aspect_id` (`aspect_id`),
  KEY `evaluated_by` (`evaluated_by`),
  CONSTRAINT `practical_learning_outcome_scores_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `practical_learning_outcome_scores_ibfk_2` FOREIGN KEY (`aspect_id`) REFERENCES `practical_learning_outcomes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `practical_learning_outcome_scores_ibfk_3` FOREIGN KEY (`evaluated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=111 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `practical_learning_outcome_scores`
--

LOCK TABLES `practical_learning_outcome_scores` WRITE;
/*!40000 ALTER TABLE `practical_learning_outcome_scores` DISABLE KEYS */;
INSERT INTO `practical_learning_outcome_scores` VALUES (1,1,1,8.00,1,'not well','2026-04-03 05:28:54'),(2,1,2,8.00,1,'not well','2026-04-03 05:28:54'),(3,1,3,8.00,1,'not well','2026-04-03 05:28:54'),(4,1,4,8.00,1,'not well','2026-04-03 05:28:54'),(5,1,5,8.00,1,'not well','2026-04-03 05:28:54'),(6,1,6,8.00,1,'not well','2026-04-03 05:28:54'),(7,1,7,8.00,1,'not well','2026-04-03 05:28:54'),(8,1,8,8.00,1,'not well','2026-04-03 05:28:54'),(9,1,9,8.00,1,'not well','2026-04-03 05:28:54'),(10,1,10,8.00,1,'not well','2026-04-03 05:28:54');
/*!40000 ALTER TABLE `practical_learning_outcome_scores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `practical_learning_outcomes`
--

DROP TABLE IF EXISTS `practical_learning_outcomes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `practical_learning_outcomes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `training_id` int NOT NULL,
  `aspect_name` varchar(255) NOT NULL,
  `description` text,
  `max_score` int DEFAULT '100',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `training_id` (`training_id`),
  CONSTRAINT `practical_learning_outcomes_ibfk_1` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `practical_learning_outcomes`
--

LOCK TABLES `practical_learning_outcomes` WRITE;
/*!40000 ALTER TABLE `practical_learning_outcomes` DISABLE KEYS */;
INSERT INTO `practical_learning_outcomes` VALUES (1,1,'Able to understand and explain mechanism of laser',NULL,10,'2026-04-03 03:27:42'),(2,1,'Able to understand and describe the risk of laser hazard',NULL,10,'2026-04-03 03:27:42'),(3,1,'Comply to applicable regulations and administrative control to minimize laser hazards',NULL,10,'2026-04-03 03:27:42'),(4,1,'Demonstrate appropriate safety precautions before and during performing laser therapy',NULL,10,'2026-04-03 03:27:42'),(5,1,'Exhibit professional, legal and ethical practice of laser therapy',NULL,10,'2026-04-03 03:27:42'),(6,1,'Demonstrate the ability to prevent risk and danger',NULL,10,'2026-04-03 03:27:42'),(7,1,'Able to choose accurate protocol of laser treatment',NULL,10,'2026-04-03 03:27:42'),(8,1,'Able to maintain safety handling care of equipment',NULL,10,'2026-04-03 03:27:42'),(9,1,'Able to apply laser correctly using the right treatment technique',NULL,10,'2026-04-03 03:27:42'),(10,1,'Able to supervise and analyse patient’s response and treatment outcome',NULL,10,'2026-04-03 03:27:42');
/*!40000 ALTER TABLE `practical_learning_outcomes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `practical_learning_outcomes_settings`
--

DROP TABLE IF EXISTS `practical_learning_outcomes_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `practical_learning_outcomes_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `aspect_name` varchar(255) NOT NULL,
  `description` text,
  `max_score` int DEFAULT '100',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aspect_name` (`aspect_name`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `practical_learning_outcomes_settings`
--

LOCK TABLES `practical_learning_outcomes_settings` WRITE;
/*!40000 ALTER TABLE `practical_learning_outcomes_settings` DISABLE KEYS */;
INSERT INTO `practical_learning_outcomes_settings` VALUES (1,'Able to understand and explain mechanism of laser',NULL,10,'2026-04-03 01:50:37','2026-04-03 01:50:48'),(2,'Able to understand and describe the risk of laser hazard',NULL,10,'2026-04-03 01:50:59','2026-04-03 01:50:59'),(3,'Comply to applicable regulations and administrative control to minimize laser hazards',NULL,10,'2026-04-03 01:51:11','2026-04-03 01:51:11'),(4,'Demonstrate appropriate safety precautions before and during performing laser therapy',NULL,10,'2026-04-03 01:51:21','2026-04-03 01:51:21'),(5,'Exhibit professional, legal and ethical practice of laser therapy',NULL,10,'2026-04-03 01:51:32','2026-04-03 01:51:32'),(6,'Demonstrate the ability to prevent risk and danger',NULL,10,'2026-04-03 01:51:43','2026-04-03 01:51:43'),(7,'Able to choose accurate protocol of laser treatment',NULL,10,'2026-04-03 01:51:59','2026-04-03 01:51:59'),(8,'Able to maintain safety handling care of equipment',NULL,10,'2026-04-03 01:52:26','2026-04-03 01:53:24'),(9,'Able to apply laser correctly using the right treatment technique',NULL,10,'2026-04-03 01:52:37','2026-04-03 01:53:27'),(11,'Able to supervise and analyse patient’s response and treatment outcome',NULL,10,'2026-04-03 01:53:10','2026-04-03 01:53:10');
/*!40000 ALTER TABLE `practical_learning_outcomes_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questions`
--

DROP TABLE IF EXISTS `questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question_text` text NOT NULL,
  `option_a` varchar(500) NOT NULL,
  `option_b` varchar(500) NOT NULL,
  `option_c` varchar(500) DEFAULT NULL,
  `option_d` varchar(500) DEFAULT NULL,
  `correct_answer` enum('A','B','C','D') NOT NULL,
  `test_type` enum('pre_test','post_test','certificate_enrolment') NOT NULL,
  `module_id` int NOT NULL,
  `objective_id` int DEFAULT NULL,
  `training_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `objective_id` (`objective_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_questions_training` (`training_id`),
  KEY `idx_questions_module` (`module_id`),
  CONSTRAINT `fk_questions_module` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `questions_ibfk_2` FOREIGN KEY (`objective_id`) REFERENCES `objectives` (`id`) ON DELETE SET NULL,
  CONSTRAINT `questions_ibfk_3` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE SET NULL,
  CONSTRAINT `questions_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questions`
--

LOCK TABLES `questions` WRITE;
/*!40000 ALTER TABLE `questions` DISABLE KEYS */;
INSERT INTO `questions` VALUES (1,'What is the purpose of using K Laser in pain management?','*A non-invasive laser using both LLLT & HILT to accelerate tissue healing and body function','A surgical procedure to remove damaged tissues and relieve pain','A pharmaceutical intervention to manage pain symptoms','A physical therapy technique to improve joint mobility and flexibility','A','post_test',1,1,1,NULL,1,'2026-04-03 02:13:53'),(2,'What is the biological effects of Photobiomodulation?','It stimulates the release of endorphins and other natural painkillers in the body','*It increase NO production, reduce inflammation, promotes tissue healing and gives semi analgesic in the affected area','It blocks pain signals from reaching the brain and spinal cord','It numbs the affected area and provides temporary pain relief','B','post_test',1,1,1,NULL,1,'2026-04-03 02:13:53'),(3,'What are the clinical applications of K Laser in pain management and related?','*Musculoskeletal pain, diabetic wound, neuropathy, sport injuries, Erectile dysfunction, Idiopathic pulmonary fibrosis','Migraine headaches, urinary incontinence and back pain','Cancer pain, post-operative pain and dental pain','Sports injuries, muscle strains, eye injuries and sprains','A','post_test',1,1,1,NULL,1,'2026-04-03 02:13:53'),(4,'What are the potential risks associated with non invasive laser therapy?','Skin thinning','*Hyperpigmentation, burn and eye damage','Allergic reactions, infections, and bleeding','Treating at the uterus areas of a pregnant women','B','post_test',1,1,3,NULL,1,'2026-04-03 02:13:53'),(5,'What are the potential benefits of non invasive laser therapy compared to other pain management strategies?','*It is non-invasive, has minimal side effects, and provides long-lasting pain relief','It is cost-effective, readily available, and can be self-administered at home','It is more effective than other pain management options and has no contraindications','It is not covered by most insurance plans and does not require a prescription','A','post_test',1,1,4,NULL,1,'2026-04-03 02:13:53'),(6,'What are the factors that influence the depth of laser absorption in the tissue?','Temperature of treatment room','Colors of practitioners\' shirt during laser treatment','Number and frequency of laser treatment','*Wavelength, skin pigment and duration of beam exposure','D','post_test',1,1,1,NULL,1,'2026-04-03 02:13:53'),(7,'What are the responsibilities of a certified laser practitioners and operators in ensuring laser safety and laser quality?','Comply with applicable regulations, policies, and procedures','Perform daily inspection for damage on goggle, optic fibre, handpiece and power cable','Implement laser standard operation procedure to minimize laser hazards','*All of the above','D','post_test',1,1,4,NULL,1,'2026-04-03 02:13:53'),(8,'What are the main contraindications of K Laser treatment?','*Eyes, cancer patient, on the uterus of pregnant women','Tattoo','Patient with skin problem such as eczema/psoriasis','Plate, wire, screw and titanium in the body','A','post_test',1,1,3,NULL,1,'2026-04-03 02:13:53'),(9,'How should certified laser practitioner maintains a good condition of optic fiber?','Hang the fiber optic without place it in the cradle','Slam and impinge the fiber optic while doing treatment','*Do not over bend the optic fiber and gently roll it back in place without forcing','Give excessive tension by pulling the fiber optic','C','post_test',1,1,4,NULL,1,'2026-04-03 02:13:53'),(10,'How to improve K Laser treatment result?','Treat nerve roots and start from proximal to distal','Proper diagnosis and choose accurate protocol','Add active Range of Motion (ROM) during laser treatment','*All of the above.','D','post_test',1,1,2,NULL,1,'2026-04-03 02:13:53'),(11,'What are the Standard Operation Procedure for Class 4 laser?','Conduct treatment in a closed area and wear specific safety eyewear','Restrict treatment area only to authorized personnel','Display warning sign at the entrance of treatment area','*All of the above.','D','post_test',1,1,4,NULL,1,'2026-04-03 02:13:53'),(12,'What are the gliding method in K Laser treatment?','Place the handpiece on the pain area without moving the handpiece until treatment time is completed','Use only scanning method on the pain area, do not use fixed method on patient during laser treatment','*Glide handpiece in a scanning and fixed method on the pain area throughout the laser treatment','Use only fixed method during laser treatment, do not glide the handpiece in scanning method','C','post_test',1,1,5,NULL,1,'2026-04-03 02:13:53'),(13,'What are the FOUR chromophores that absorb photons during K Laser treatment?','*Melanin, water, cytochrome c oxidase and haemoglobin','Melanin and haemoglobin','Cytochrome c oxidase and melanin','Haemoglobin and water','A','post_test',1,1,1,NULL,1,'2026-04-03 02:13:53'),(14,'How to hold laser handpiece correctly before and during K Laser treatment?','Hold the upper part of handpiece and wave the handpiece like a wand','Hold handpiece like a pencil and keep pressing the switch button until treatment completed','*Hold handpiece like a pencil and always point the handpiece toward the ground for safety reason','Point the laser towards the ceiling while preparing laser and do not cover the laser beam while doing laser treatment','C','post_test',1,1,3,NULL,1,'2026-04-03 02:13:53'),(15,'How to enhance laser absorption during laser treatment?','*Remove bandage/clothes, clean the treatment surface from gel/oil/water and hold handpiece perpendicular to the skin','Hold the handpiece 3cm-5cm above the skin to let the laser scattered for more absorption','Apply gel/massage oil over the skin for a better gliding','Glide the handpiece as slow as possible even on dark skin/low heat tolerance patient','A','post_test',1,1,5,NULL,1,'2026-04-03 02:13:53'),(16,'What zoom number should be used by default if unsure?','1','3','*5','4','C','post_test',1,1,4,NULL,1,'2026-04-03 02:13:53'),(17,'When treating from a distance, what is the purpose of using zoom?','To increase the joules','*To decrease the size of the beam','To stabilize the device','To enhance safety','B','post_test',1,1,4,NULL,1,'2026-04-03 02:13:53'),(18,'What happens when the full dose is delivered?','The device emits a sound','*The laser stops automatically','The light turns off','The screen displays a message','B','post_test',1,1,4,NULL,1,'2026-04-03 02:13:53'),(19,'When treating joints, what should the patient be encouraged to do?','Distance handpiece from intended area','*Move the joint slightly (active ROM)','Avoid any movement','Apply ice','B','post_test',1,1,5,NULL,1,'2026-04-03 02:13:53'),(20,'When treating a lower limb, which direction should the treatment proceed?','*Proximal to distal or follow the muscle fiber','Distal to proximal','In circles','Randomly','A','post_test',1,1,5,NULL,1,'2026-04-03 02:13:53'),(21,'How should the scanning speed be adapted during treatment?','By using the same speed for every patient','Randomly','Always glide at slower speed','*Based on the warmth felt by the patient','D','post_test',1,1,5,NULL,1,'2026-04-03 02:13:53'),(22,'Which condition should be checked before initiating treatment?','Previous injuries','Contraindications','Recent surgeries','*All of the above','D','post_test',1,1,5,NULL,1,'2026-04-03 02:13:53'),(23,'What is the primary goal of laser therapy for wounds?','*To accelerate healing process','To increase pain','To numb the area','To close the wound','A','post_test',1,1,1,NULL,1,'2026-04-03 02:13:53'),(24,'What should be done before treating a wound with laser therapy?','Ice the area','Cover the wound','*Clean the wound and surrounding skin','Apply ointment','C','post_test',1,1,5,NULL,1,'2026-04-03 02:13:53'),(25,'What unit is used to measure laser wavelengths?','Micrometers (µm)','*Nanometers (nm)','Millimeters (mm)','Centimeters (cm)','B','post_test',1,1,1,NULL,1,'2026-04-03 02:13:53'),(26,'What does the yellow tag on the optic fibre indicate?','It marks the fiber beginning','It shows the maximum length','It helps control the beam','*It signals to stop unwinding','D','post_test',1,1,4,NULL,1,'2026-04-03 02:13:53'),(27,'How should the hand-piece be held for safety?','*Like a pencil with the head toward the ground','Pointing upward','Horizontally','Between the index and thumb','A','post_test',1,1,4,NULL,1,'2026-04-03 02:13:53'),(28,'What is an appropriate technique for using contact mode on muscles?','Stay on a fixed point','*Use the tip to apply pressure and massage','Keep the laser motionless','Treat from a distance','C','post_test',1,1,5,NULL,1,'2026-04-03 02:13:53'),(29,'After a corticosteroid injection, how long should you wait before using laser therapy over the\r\njoint?','1 day','*3 days','7 days','10 days','C','post_test',1,1,4,NULL,1,'2026-04-03 02:13:53'),(30,'Why should laser therapy be used with caution over joints with recent corticosteroid injections?','Risk of infection','*Risk of crystallization causing temporary pain','It increases blood pressure','It decreases the effectiveness of the injection','C','post_test',1,1,2,NULL,1,'2026-04-03 02:13:53'),(31,'What is an appropriate technique for using contact mode on muscles?','Stay on a fixed point','*Use the tip to apply pressure and massage','Keep the laser motionless','Treat from a distance','C','post_test',1,1,5,NULL,1,'2026-04-03 02:13:53'),(32,'What is the purpose of using K Laser in pain management?','*A non-invasive laser using both LLLT & HILT to accelerate tissue healing and body function','A surgical procedure to remove damaged tissues and relieve pain','A pharmaceutical intervention to manage pain symptoms','A physical therapy technique to improve joint mobility and flexibility','A','pre_test',1,1,1,NULL,1,'2026-04-03 02:14:08'),(33,'What is the biological effects of Photobiomodulation?','It stimulates the release of endorphins and other natural painkillers in the body','*It increase NO production, reduce inflammation, promotes tissue healing and gives semi analgesic in the affected area','It blocks pain signals from reaching the brain and spinal cord','It numbs the affected area and provides temporary pain relief','B','pre_test',1,1,1,NULL,1,'2026-04-03 02:14:08'),(34,'What are the clinical applications of K Laser in pain management and related?','*Musculoskeletal pain, diabetic wound, neuropathy, sport injuries, Erectile dysfunction, Idiopathic pulmonary fibrosis','Migraine headaches, urinary incontinence and back pain','Cancer pain, post-operative pain and dental pain','Sports injuries, muscle strains, eye injuries and sprains','A','pre_test',1,1,1,NULL,1,'2026-04-03 02:14:08'),(35,'What are the potential risks associated with non invasive laser therapy?','Skin thinning','*Hyperpigmentation, burn and eye damage','Allergic reactions, infections, and bleeding','Treating at the uterus areas of a pregnant women','B','pre_test',1,1,3,NULL,1,'2026-04-03 02:14:08'),(36,'What are the potential benefits of non invasive laser therapy compared to other pain management strategies?','*It is non-invasive, has minimal side effects, and provides long-lasting pain relief','It is cost-effective, readily available, and can be self-administered at home','It is more effective than other pain management options and has no contraindications','It is not covered by most insurance plans and does not require a prescription','A','pre_test',1,1,4,NULL,1,'2026-04-03 02:14:08'),(37,'What are the factors that influence the depth of laser absorption in the tissue?','Temperature of treatment room','Colors of practitioners\' shirt during laser treatment','Number and frequency of laser treatment','*Wavelength, skin pigment and duration of beam exposure','D','pre_test',1,1,1,NULL,1,'2026-04-03 02:14:08'),(38,'What are the responsibilities of a certified laser practitioners and operators in ensuring laser safety and laser quality?','Comply with applicable regulations, policies, and procedures','Perform daily inspection for damage on goggle, optic fibre, handpiece and power cable','Implement laser standard operation procedure to minimize laser hazards','*All of the above','D','pre_test',1,1,4,NULL,1,'2026-04-03 02:14:08'),(39,'What are the main contraindications of K Laser treatment?','*Eyes, cancer patient, on the uterus of pregnant women','Tattoo','Patient with skin problem such as eczema/psoriasis','Plate, wire, screw and titanium in the body','A','pre_test',1,1,3,NULL,1,'2026-04-03 02:14:08'),(40,'How should certified laser practitioner maintains a good condition of optic fiber?','Hang the fiber optic without place it in the cradle','Slam and impinge the fiber optic while doing treatment','*Do not over bend the optic fiber and gently roll it back in place without forcing','Give excessive tension by pulling the fiber optic','C','pre_test',1,1,4,NULL,1,'2026-04-03 02:14:08'),(41,'How to improve K Laser treatment result?','Treat nerve roots and start from proximal to distal','Proper diagnosis and choose accurate protocol','Add active Range of Motion (ROM) during laser treatment','*All of the above.','D','pre_test',1,1,2,NULL,1,'2026-04-03 02:14:08'),(42,'What are the Standard Operation Procedure for Class 4 laser?','Conduct treatment in a closed area and wear specific safety eyewear','Restrict treatment area only to authorized personnel','Display warning sign at the entrance of treatment area','*All of the above.','D','pre_test',1,1,4,NULL,1,'2026-04-03 02:14:08'),(43,'What are the gliding method in K Laser treatment?','Place the handpiece on the pain area without moving the handpiece until treatment time is completed','Use only scanning method on the pain area, do not use fixed method on patient during laser treatment','*Glide handpiece in a scanning and fixed method on the pain area throughout the laser treatment','Use only fixed method during laser treatment, do not glide the handpiece in scanning method','C','pre_test',1,1,5,NULL,1,'2026-04-03 02:14:08'),(44,'What are the FOUR chromophores that absorb photons during K Laser treatment?','*Melanin, water, cytochrome c oxidase and haemoglobin','Melanin and haemoglobin','Cytochrome c oxidase and melanin','Haemoglobin and water','A','pre_test',1,1,1,NULL,1,'2026-04-03 02:14:08'),(45,'How to hold laser handpiece correctly before and during K Laser treatment?','Hold the upper part of handpiece and wave the handpiece like a wand','Hold handpiece like a pencil and keep pressing the switch button until treatment completed','*Hold handpiece like a pencil and always point the handpiece toward the ground for safety reason','Point the laser towards the ceiling while preparing laser and do not cover the laser beam while doing laser treatment','C','pre_test',1,1,3,NULL,1,'2026-04-03 02:14:08'),(46,'How to enhance laser absorption during laser treatment?','*Remove bandage/clothes, clean the treatment surface from gel/oil/water and hold handpiece perpendicular to the skin','Hold the handpiece 3cm-5cm above the skin to let the laser scattered for more absorption','Apply gel/massage oil over the skin for a better gliding','Glide the handpiece as slow as possible even on dark skin/low heat tolerance patient','A','pre_test',1,1,5,NULL,1,'2026-04-03 02:14:08'),(47,'What zoom number should be used by default if unsure?','1','3','*5','4','C','pre_test',1,1,4,NULL,1,'2026-04-03 02:14:08'),(48,'When treating from a distance, what is the purpose of using zoom?','To increase the joules','*To decrease the size of the beam','To stabilize the device','To enhance safety','B','pre_test',1,1,4,NULL,1,'2026-04-03 02:14:08'),(49,'What happens when the full dose is delivered?','The device emits a sound','*The laser stops automatically','The light turns off','The screen displays a message','B','pre_test',1,1,4,NULL,1,'2026-04-03 02:14:08'),(50,'When treating joints, what should the patient be encouraged to do?','Distance handpiece from intended area','*Move the joint slightly (active ROM)','Avoid any movement','Apply ice','B','pre_test',1,1,5,NULL,1,'2026-04-03 02:14:08'),(51,'When treating a lower limb, which direction should the treatment proceed?','*Proximal to distal or follow the muscle fiber','Distal to proximal','In circles','Randomly','A','pre_test',1,1,5,NULL,1,'2026-04-03 02:14:08'),(52,'How should the scanning speed be adapted during treatment?','By using the same speed for every patient','Randomly','Always glide at slower speed','*Based on the warmth felt by the patient','D','pre_test',1,1,5,NULL,1,'2026-04-03 02:14:08'),(53,'Which condition should be checked before initiating treatment?','Previous injuries','Contraindications','Recent surgeries','*All of the above','D','pre_test',1,1,5,NULL,1,'2026-04-03 02:14:08'),(54,'What is the primary goal of laser therapy for wounds?','*To accelerate healing process','To increase pain','To numb the area','To close the wound','A','pre_test',1,1,1,NULL,1,'2026-04-03 02:14:08'),(55,'What should be done before treating a wound with laser therapy?','Ice the area','Cover the wound','*Clean the wound and surrounding skin','Apply ointment','C','pre_test',1,1,5,NULL,1,'2026-04-03 02:14:08'),(56,'What unit is used to measure laser wavelengths?','Micrometers (µm)','*Nanometers (nm)','Millimeters (mm)','Centimeters (cm)','B','pre_test',1,1,1,NULL,1,'2026-04-03 02:14:08'),(57,'What does the yellow tag on the optic fibre indicate?','It marks the fiber beginning','It shows the maximum length','It helps control the beam','*It signals to stop unwinding','D','pre_test',1,1,4,NULL,1,'2026-04-03 02:14:08'),(58,'How should the hand-piece be held for safety?','*Like a pencil with the head toward the ground','Pointing upward','Horizontally','Between the index and thumb','A','pre_test',1,1,4,NULL,1,'2026-04-03 02:14:08'),(59,'What is an appropriate technique for using contact mode on muscles?','Stay on a fixed point','*Use the tip to apply pressure and massage','Keep the laser motionless','Treat from a distance','C','pre_test',1,1,5,NULL,1,'2026-04-03 02:14:08'),(60,'After a corticosteroid injection, how long should you wait before using laser therapy over the\r\njoint?','1 day','*3 days','7 days','10 days','C','pre_test',1,1,4,NULL,1,'2026-04-03 02:14:08'),(61,'Why should laser therapy be used with caution over joints with recent corticosteroid injections?','Risk of infection','*Risk of crystallization causing temporary pain','It increases blood pressure','It decreases the effectiveness of the injection','C','pre_test',1,1,2,NULL,1,'2026-04-03 02:14:08'),(62,'What is an appropriate technique for using contact mode on muscles?','Stay on a fixed point','*Use the tip to apply pressure and massage','Keep the laser motionless','Treat from a distance','C','pre_test',1,1,5,NULL,1,'2026-04-03 02:14:08'),(63,'What is the purpose of using K Laser in pain management?','*A non-invasive laser using both LLLT & HILT to accelerate tissue healing and body function','A surgical procedure to remove damaged tissues and relieve pain','A pharmaceutical intervention to manage pain symptoms','A physical therapy technique to improve joint mobility and flexibility','A','certificate_enrolment',1,1,1,NULL,1,'2026-04-03 02:14:22'),(64,'What is the biological effects of Photobiomodulation?','It stimulates the release of endorphins and other natural painkillers in the body','*It increase NO production, reduce inflammation, promotes tissue healing and gives semi analgesic in the affected area','It blocks pain signals from reaching the brain and spinal cord','It numbs the affected area and provides temporary pain relief','B','certificate_enrolment',1,1,1,NULL,1,'2026-04-03 02:14:22'),(65,'What are the clinical applications of K Laser in pain management and related?','*Musculoskeletal pain, diabetic wound, neuropathy, sport injuries, Erectile dysfunction, Idiopathic pulmonary fibrosis','Migraine headaches, urinary incontinence and back pain','Cancer pain, post-operative pain and dental pain','Sports injuries, muscle strains, eye injuries and sprains','A','certificate_enrolment',1,1,1,NULL,1,'2026-04-03 02:14:22'),(66,'What are the potential risks associated with non invasive laser therapy?','Skin thinning','*Hyperpigmentation, burn and eye damage','Allergic reactions, infections, and bleeding','Treating at the uterus areas of a pregnant women','B','certificate_enrolment',1,1,3,NULL,1,'2026-04-03 02:14:22'),(67,'What are the potential benefits of non invasive laser therapy compared to other pain management strategies?','*It is non-invasive, has minimal side effects, and provides long-lasting pain relief','It is cost-effective, readily available, and can be self-administered at home','It is more effective than other pain management options and has no contraindications','It is not covered by most insurance plans and does not require a prescription','A','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:14:22'),(68,'What are the factors that influence the depth of laser absorption in the tissue?','Temperature of treatment room','Colors of practitioners\' shirt during laser treatment','Number and frequency of laser treatment','*Wavelength, skin pigment and duration of beam exposure','D','certificate_enrolment',1,1,1,NULL,1,'2026-04-03 02:14:22'),(69,'What are the responsibilities of a certified laser practitioners and operators in ensuring laser safety and laser quality?','Comply with applicable regulations, policies, and procedures','Perform daily inspection for damage on goggle, optic fibre, handpiece and power cable','Implement laser standard operation procedure to minimize laser hazards','*All of the above','D','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:14:22'),(70,'What are the main contraindications of K Laser treatment?','*Eyes, cancer patient, on the uterus of pregnant women','Tattoo','Patient with skin problem such as eczema/psoriasis','Plate, wire, screw and titanium in the body','A','certificate_enrolment',1,1,3,NULL,1,'2026-04-03 02:14:22'),(71,'How should certified laser practitioner maintains a good condition of optic fiber?','Hang the fiber optic without place it in the cradle','Slam and impinge the fiber optic while doing treatment','*Do not over bend the optic fiber and gently roll it back in place without forcing','Give excessive tension by pulling the fiber optic','C','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:14:22'),(72,'How to improve K Laser treatment result?','Treat nerve roots and start from proximal to distal','Proper diagnosis and choose accurate protocol','Add active Range of Motion (ROM) during laser treatment','*All of the above.','D','certificate_enrolment',1,1,2,NULL,1,'2026-04-03 02:14:22'),(73,'What are the Standard Operation Procedure for Class 4 laser?','Conduct treatment in a closed area and wear specific safety eyewear','Restrict treatment area only to authorized personnel','Display warning sign at the entrance of treatment area','*All of the above.','D','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:14:22'),(74,'What are the gliding method in K Laser treatment?','Place the handpiece on the pain area without moving the handpiece until treatment time is completed','Use only scanning method on the pain area, do not use fixed method on patient during laser treatment','*Glide handpiece in a scanning and fixed method on the pain area throughout the laser treatment','Use only fixed method during laser treatment, do not glide the handpiece in scanning method','C','certificate_enrolment',1,1,5,NULL,1,'2026-04-03 02:14:22'),(75,'What are the FOUR chromophores that absorb photons during K Laser treatment?','*Melanin, water, cytochrome c oxidase and haemoglobin','Melanin and haemoglobin','Cytochrome c oxidase and melanin','Haemoglobin and water','A','certificate_enrolment',1,1,1,NULL,1,'2026-04-03 02:14:22'),(76,'How to hold laser handpiece correctly before and during K Laser treatment?','Hold the upper part of handpiece and wave the handpiece like a wand','Hold handpiece like a pencil and keep pressing the switch button until treatment completed','*Hold handpiece like a pencil and always point the handpiece toward the ground for safety reason','Point the laser towards the ceiling while preparing laser and do not cover the laser beam while doing laser treatment','C','certificate_enrolment',1,1,3,NULL,1,'2026-04-03 02:14:22'),(77,'How to enhance laser absorption during laser treatment?','*Remove bandage/clothes, clean the treatment surface from gel/oil/water and hold handpiece perpendicular to the skin','Hold the handpiece 3cm-5cm above the skin to let the laser scattered for more absorption','Apply gel/massage oil over the skin for a better gliding','Glide the handpiece as slow as possible even on dark skin/low heat tolerance patient','A','certificate_enrolment',1,1,5,NULL,1,'2026-04-03 02:14:22'),(78,'What zoom number should be used by default if unsure?','1','3','*5','4','C','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:14:22'),(79,'When treating from a distance, what is the purpose of using zoom?','To increase the joules','*To decrease the size of the beam','To stabilize the device','To enhance safety','B','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:14:22'),(80,'What happens when the full dose is delivered?','The device emits a sound','*The laser stops automatically','The light turns off','The screen displays a message','B','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:14:22'),(81,'When treating joints, what should the patient be encouraged to do?','Distance handpiece from intended area','*Move the joint slightly (active ROM)','Avoid any movement','Apply ice','B','certificate_enrolment',1,1,5,NULL,1,'2026-04-03 02:14:22'),(82,'When treating a lower limb, which direction should the treatment proceed?','*Proximal to distal or follow the muscle fiber','Distal to proximal','In circles','Randomly','A','certificate_enrolment',1,1,5,NULL,1,'2026-04-03 02:14:22'),(83,'How should the scanning speed be adapted during treatment?','By using the same speed for every patient','Randomly','Always glide at slower speed','*Based on the warmth felt by the patient','D','certificate_enrolment',1,1,5,NULL,1,'2026-04-03 02:14:22'),(84,'Which condition should be checked before initiating treatment?','Previous injuries','Contraindications','Recent surgeries','*All of the above','D','certificate_enrolment',1,1,5,NULL,1,'2026-04-03 02:14:22'),(85,'What is the primary goal of laser therapy for wounds?','*To accelerate healing process','To increase pain','To numb the area','To close the wound','A','certificate_enrolment',1,1,1,NULL,1,'2026-04-03 02:14:22'),(86,'What should be done before treating a wound with laser therapy?','Ice the area','Cover the wound','*Clean the wound and surrounding skin','Apply ointment','C','certificate_enrolment',1,1,5,NULL,1,'2026-04-03 02:14:22'),(87,'What unit is used to measure laser wavelengths?','Micrometers (µm)','*Nanometers (nm)','Millimeters (mm)','Centimeters (cm)','B','certificate_enrolment',1,1,1,NULL,1,'2026-04-03 02:14:22'),(88,'What does the yellow tag on the optic fibre indicate?','It marks the fiber beginning','It shows the maximum length','It helps control the beam','*It signals to stop unwinding','D','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:14:22'),(89,'How should the hand-piece be held for safety?','*Like a pencil with the head toward the ground','Pointing upward','Horizontally','Between the index and thumb','A','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:14:22'),(90,'What is an appropriate technique for using contact mode on muscles?','Stay on a fixed point','*Use the tip to apply pressure and massage','Keep the laser motionless','Treat from a distance','C','certificate_enrolment',1,1,5,NULL,1,'2026-04-03 02:14:22'),(91,'After a corticosteroid injection, how long should you wait before using laser therapy over the\r\njoint?','1 day','*3 days','7 days','10 days','C','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:14:22'),(92,'Why should laser therapy be used with caution over joints with recent corticosteroid injections?','Risk of infection','*Risk of crystallization causing temporary pain','It increases blood pressure','It decreases the effectiveness of the injection','C','certificate_enrolment',1,1,2,NULL,1,'2026-04-03 02:14:22'),(93,'What is an appropriate technique for using contact mode on muscles?','Stay on a fixed point','*Use the tip to apply pressure and massage','Keep the laser motionless','Treat from a distance','C','certificate_enrolment',1,1,5,NULL,1,'2026-04-03 02:14:22'),(94,'How does K-Laser therapy support tissue repair in injured areas?','By increasing cellular metabolism and ATP production','By freezing damaged tissue to stop inflammation','By blocking nerve conduction permanently','By replacing damaged cells with artificial tissue','A','certificate_enrolment',1,1,1,NULL,1,'2026-04-03 02:15:33'),(95,'What role does ATP production play in photobiomodulation therapy?','It slows down cell activity to reduce pain','It enhances cellular energy which supports tissue repair','It destroys damaged cells to prevent inflammation','It blocks blood circulation to the injured area','B','certificate_enrolment',1,1,1,NULL,1,'2026-04-03 02:15:33'),(96,'Which condition can commonly benefit from K-Laser therapy?','Muscle strains and ligament injuries','Appendicitis','Kidney stones','Acute infections requiring antibiotics','A','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:15:33'),(97,'Why is protective eyewear required during laser therapy treatments?','To prevent laser radiation from damaging the eyes','To improve the focus of the laser beam','To enhance treatment effectiveness','To reduce skin temperature during treatment','A','certificate_enrolment',1,1,3,NULL,1,'2026-04-03 02:15:33'),(98,'What effect does photobiomodulation have on inflammation?','It increases swelling to speed recovery','It reduces inflammatory mediators in the tissue','It completely eliminates blood flow','It blocks immune system responses','B','certificate_enrolment',1,1,1,NULL,1,'2026-04-03 02:15:33'),(99,'Which of the following best describes High Intensity Laser Therapy (HILT)?','A low energy light mainly used for diagnostics','A high-power laser used to stimulate deep tissue healing','A surgical laser used to remove organs','A cosmetic laser used for skin resurfacing only','B','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:15:33'),(100,'Which precaution should be taken when treating patients with K-Laser therapy?','Direct exposure of eyes to the beam','Using the laser over malignant tumors','Ensuring protective eyewear for patient and operator','Increasing power beyond recommended limits','C','certificate_enrolment',1,1,3,NULL,1,'2026-04-03 02:15:33'),(101,'How does K-Laser therapy help reduce pain in musculoskeletal conditions?','By stimulating blood circulation and reducing inflammation','By permanently blocking nerve signals','By removing damaged tissue surgically','By replacing muscles with synthetic fibers','A','certificate_enrolment',1,1,1,NULL,1,'2026-04-03 02:15:33'),(102,'What is one advantage of K-Laser therapy compared to traditional pain medications?','It requires hospitalization for every treatment','It provides non‑invasive treatment with minimal side effects','It completely replaces all medical treatments','It only works for cosmetic conditions','B','certificate_enrolment',1,1,4,NULL,1,'2026-04-03 02:15:33'),(103,'Which safety consideration is important when performing laser therapy near sensitive areas?','Increase power to ensure deeper penetration','Avoid treating directly over the eyes','Ignore patient discomfort during treatment','Apply the laser continuously for more than 30 minutes','B','certificate_enrolment',1,1,3,NULL,1,'2026-04-03 02:15:33');
/*!40000 ALTER TABLE `questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `session_id` varchar(128) NOT NULL,
  `expires` int unsigned NOT NULL,
  `data` mediumtext,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES ('-af6ejWE_-1EoVIEb48CD5WNxgMumfGI',1775282921,'{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2026-04-04T02:24:17.198Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"userId\":1,\"userRole\":\"trainee\",\"userName\":\"Mohamed Aiman\",\"userProfile\":null,\"traineeId\":\"T568090\"}'),('D2l8pGoZIUqv93UXxWsXZ9hzS_KCayV9',1775358743,'{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2026-04-04T06:17:24.174Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"userId\":1,\"userRole\":\"admin\",\"userName\":\"Mohamed Aiman\",\"userProfile\":\"/uploads/profiles/1-1775183513302.jpeg\",\"userPosition\":\"Senior Trainer\"}');
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_answers`
--

DROP TABLE IF EXISTS `test_answers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_answers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `attempt_id` int NOT NULL,
  `question_id` int NOT NULL,
  `selected_answer` enum('A','B','C','D') DEFAULT NULL,
  `is_correct` tinyint(1) DEFAULT NULL,
  `answered_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `attempt_id` (`attempt_id`),
  KEY `question_id` (`question_id`),
  CONSTRAINT `test_answers_ibfk_1` FOREIGN KEY (`attempt_id`) REFERENCES `test_attempts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `test_answers_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `test_answers`
--

LOCK TABLES `test_answers` WRITE;
/*!40000 ALTER TABLE `test_answers` DISABLE KEYS */;
INSERT INTO `test_answers` VALUES (1,1,34,'A',1,'2026-04-03 04:57:42'),(2,1,37,'D',1,'2026-04-03 04:57:42'),(3,1,39,'A',1,'2026-04-03 04:57:42'),(4,1,40,'C',1,'2026-04-03 04:57:42'),(5,1,41,'D',1,'2026-04-03 04:57:42'),(6,1,45,'C',1,'2026-04-03 04:57:42'),(7,1,46,'A',1,'2026-04-03 04:57:42'),(8,1,49,'B',1,'2026-04-03 04:57:42'),(9,1,52,'D',1,'2026-04-03 04:57:42'),(10,1,61,'B',0,'2026-04-03 04:57:42'),(11,2,2,'B',1,'2026-04-03 05:02:39'),(12,2,8,'A',1,'2026-04-03 05:02:39'),(13,2,10,'D',1,'2026-04-03 05:02:39'),(14,2,11,'D',1,'2026-04-03 05:02:39'),(15,2,14,'C',1,'2026-04-03 05:02:39'),(16,2,16,'C',1,'2026-04-03 05:02:39'),(17,2,20,'A',1,'2026-04-03 05:02:39'),(18,2,23,'A',1,'2026-04-03 05:02:39'),(19,2,24,'C',1,'2026-04-03 05:02:39'),(20,2,30,'B',0,'2026-04-03 05:02:39'),(21,3,63,'A',1,'2026-04-03 05:04:25'),(22,3,64,'B',1,'2026-04-03 05:04:25'),(23,3,65,'A',1,'2026-04-03 05:04:25'),(24,3,66,'B',1,'2026-04-03 05:04:25'),(25,3,67,'A',1,'2026-04-03 05:04:25'),(26,3,68,'D',1,'2026-04-03 05:04:25'),(27,3,69,'D',1,'2026-04-03 05:04:25'),(28,3,70,'A',1,'2026-04-03 05:04:25'),(29,3,72,'D',1,'2026-04-03 05:04:25'),(30,3,73,'D',1,'2026-04-03 05:04:25'),(31,3,74,'C',1,'2026-04-03 05:04:25'),(32,3,75,'A',1,'2026-04-03 05:04:25'),(33,3,76,'C',1,'2026-04-03 05:04:25'),(34,3,77,'A',1,'2026-04-03 05:04:25'),(35,3,78,'C',1,'2026-04-03 05:04:25'),(36,3,79,'B',1,'2026-04-03 05:04:25'),(37,3,80,'B',1,'2026-04-03 05:04:25'),(38,3,81,'B',1,'2026-04-03 05:04:25'),(39,3,82,'A',1,'2026-04-03 05:04:25'),(40,3,83,'D',1,'2026-04-03 05:04:25'),(41,3,84,'D',1,'2026-04-03 05:04:25'),(42,3,85,'A',1,'2026-04-03 05:04:25'),(43,3,86,'C',1,'2026-04-03 05:04:25'),(44,3,87,'B',1,'2026-04-03 05:04:25'),(45,3,88,'D',1,'2026-04-03 05:04:26'),(46,3,89,'A',1,'2026-04-03 05:04:26'),(47,3,90,'B',0,'2026-04-03 05:04:26'),(48,3,91,'C',1,'2026-04-03 05:04:26'),(49,3,92,'B',0,'2026-04-03 05:04:26'),(50,3,93,'B',0,'2026-04-03 05:04:26'),(51,3,94,'B',0,'2026-04-03 05:04:26'),(52,3,95,'D',0,'2026-04-03 05:04:26'),(53,3,96,'C',0,'2026-04-03 05:04:26'),(54,3,97,'B',0,'2026-04-03 05:04:26'),(55,3,98,'B',1,'2026-04-03 05:04:26'),(56,3,99,'B',1,'2026-04-03 05:04:26'),(57,3,100,'B',0,'2026-04-03 05:04:26'),(58,3,101,'C',0,'2026-04-03 05:04:26'),(59,3,102,'A',0,'2026-04-03 05:04:26'),(60,3,103,'B',1,'2026-04-03 05:04:26'),(61,4,63,'A',1,'2026-04-03 05:08:08'),(62,4,64,'B',1,'2026-04-03 05:08:08'),(63,4,65,'A',1,'2026-04-03 05:08:08'),(64,4,66,'B',1,'2026-04-03 05:08:08'),(65,4,67,'A',1,'2026-04-03 05:08:08'),(66,4,68,'D',1,'2026-04-03 05:08:08'),(67,4,69,'D',1,'2026-04-03 05:08:08'),(68,4,70,'A',1,'2026-04-03 05:08:08'),(69,4,72,'D',1,'2026-04-03 05:08:08'),(70,4,73,'D',1,'2026-04-03 05:08:08'),(71,4,74,'C',1,'2026-04-03 05:08:08'),(72,4,75,'A',1,'2026-04-03 05:08:08'),(73,4,76,'C',1,'2026-04-03 05:08:08'),(74,4,77,'A',1,'2026-04-03 05:08:08'),(75,4,78,'C',1,'2026-04-03 05:08:08'),(76,4,79,'B',1,'2026-04-03 05:08:08'),(77,4,80,'B',1,'2026-04-03 05:08:08'),(78,4,81,'B',1,'2026-04-03 05:08:08'),(79,4,82,'A',1,'2026-04-03 05:08:08'),(80,4,83,'D',1,'2026-04-03 05:08:08'),(81,4,84,'D',1,'2026-04-03 05:08:08'),(82,4,85,'A',1,'2026-04-03 05:08:08'),(83,4,86,'C',1,'2026-04-03 05:08:08'),(84,4,87,'B',1,'2026-04-03 05:08:08'),(85,4,88,'D',1,'2026-04-03 05:08:08'),(86,4,89,'A',1,'2026-04-03 05:08:08'),(87,4,90,'B',0,'2026-04-03 05:08:08'),(88,4,91,'B',0,'2026-04-03 05:08:08'),(89,4,92,'B',0,'2026-04-03 05:08:08'),(90,4,93,'B',0,'2026-04-03 05:08:08'),(91,4,94,'A',1,'2026-04-03 05:08:08'),(92,4,95,'B',1,'2026-04-03 05:08:08'),(93,4,96,'A',1,'2026-04-03 05:08:08'),(94,4,97,'A',1,'2026-04-03 05:08:08'),(95,4,98,'B',1,'2026-04-03 05:08:08'),(96,4,99,'B',1,'2026-04-03 05:08:08'),(97,4,100,'C',1,'2026-04-03 05:08:08'),(98,4,101,'A',1,'2026-04-03 05:08:08'),(99,4,102,'B',1,'2026-04-03 05:08:08'),(100,4,103,'B',1,'2026-04-03 05:08:08');
/*!40000 ALTER TABLE `test_answers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_attempts`
--

DROP TABLE IF EXISTS `test_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `enrollment_id` int NOT NULL,
  `test_type` enum('pre_test','post_test','refresher_training','certificate_enrolment') NOT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `total_questions` int DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `status` enum('in_progress','completed') DEFAULT 'in_progress',
  PRIMARY KEY (`id`),
  KEY `idx_test_attempts_enrollment` (`enrollment_id`),
  CONSTRAINT `test_attempts_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `test_attempts`
--

LOCK TABLES `test_attempts` WRITE;
/*!40000 ALTER TABLE `test_attempts` DISABLE KEYS */;
INSERT INTO `test_attempts` VALUES (1,1,'pre_test',90.00,10,'2026-04-03 04:46:40','2026-04-03 04:57:42','completed'),(2,1,'post_test',90.00,10,'2026-04-03 05:02:16','2026-04-03 05:02:39','completed'),(3,1,'certificate_enrolment',75.00,40,'2026-04-03 05:02:44','2026-04-03 05:04:26','completed'),(4,1,'certificate_enrolment',90.00,40,'2026-04-03 05:04:34','2026-04-03 05:08:08','completed');
/*!40000 ALTER TABLE `test_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trainees`
--

DROP TABLE IF EXISTS `trainees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trainees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trainee_id` varchar(10) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `ic_passport` varchar(50) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `handphone_number` varchar(20) DEFAULT NULL,
  `healthcare` varchar(255) DEFAULT NULL,
  `designation` varchar(255) DEFAULT NULL,
  `area_of_specialization` varchar(255) DEFAULT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `first_training` date DEFAULT NULL,
  `latest_training` date DEFAULT NULL,
  `recertification_date` date DEFAULT NULL,
  `number_of_completed_trainings` int DEFAULT '0',
  `trainee_status` enum('active','inactive','suspended','registered') DEFAULT 'registered',
  `profile_picture` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `trainee_id` (`trainee_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trainees`
--

LOCK TABLES `trainees` WRITE;
/*!40000 ALTER TABLE `trainees` DISABLE KEYS */;
INSERT INTO `trainees` VALUES (1,'T568090','Mohamed','Aiman','A1234567','mohamedaiman103@gmail.com','$2b$10$l7kPjjhQ2XFlRFd7x9A60.RFYrvXe37jylxEI5F9wj8zHJu4vxOXW','+601121194948','KPJ Ampang Puteri Specialist Hospital','Doctor','Chronic kidney disease, Diabetic foot ulcer, Idiopathic pulmonary fibrosis',NULL,NULL,NULL,NULL,0,'active',NULL,'2026-04-03 02:24:08','2026-04-03 03:26:49');
/*!40000 ALTER TABLE `trainees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_devices`
--

DROP TABLE IF EXISTS `training_devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_devices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `training_id` int NOT NULL,
  `device_serial_number_id` int DEFAULT NULL,
  `custom_serial_number` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `training_id` (`training_id`),
  KEY `device_serial_number_id` (`device_serial_number_id`),
  CONSTRAINT `training_devices_ibfk_1` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `training_devices_ibfk_2` FOREIGN KEY (`device_serial_number_id`) REFERENCES `device_serial_numbers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `training_devices_chk_1` CHECK (((`device_serial_number_id` is not null) or (`custom_serial_number` is not null)))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_devices`
--

LOCK TABLES `training_devices` WRITE;
/*!40000 ALTER TABLE `training_devices` DISABLE KEYS */;
INSERT INTO `training_devices` VALUES (3,1,1,NULL,'2026-04-04 01:08:27');
/*!40000 ALTER TABLE `training_devices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_healthcare`
--

DROP TABLE IF EXISTS `training_healthcare`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_healthcare` (
  `id` int NOT NULL AUTO_INCREMENT,
  `training_id` int NOT NULL,
  `healthcare_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_training_healthcare_training` (`training_id`),
  KEY `healthcare_id` (`healthcare_id`),
  CONSTRAINT `training_healthcare_ibfk_1` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `training_healthcare_ibfk_2` FOREIGN KEY (`healthcare_id`) REFERENCES `healthcare` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_healthcare`
--

LOCK TABLES `training_healthcare` WRITE;
/*!40000 ALTER TABLE `training_healthcare` DISABLE KEYS */;
INSERT INTO `training_healthcare` VALUES (3,1,1,'2026-04-04 01:08:27');
/*!40000 ALTER TABLE `training_healthcare` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_material_access`
--

DROP TABLE IF EXISTS `training_material_access`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_material_access` (
  `id` int NOT NULL AUTO_INCREMENT,
  `material_id` int NOT NULL,
  `enrollment_id` int NOT NULL,
  `first_accessed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_accessed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `access_count` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_material_enrollment` (`material_id`,`enrollment_id`),
  KEY `idx_material_access_material` (`material_id`),
  KEY `idx_material_access_enrollment` (`enrollment_id`),
  CONSTRAINT `training_material_access_ibfk_1` FOREIGN KEY (`material_id`) REFERENCES `training_materials` (`id`) ON DELETE CASCADE,
  CONSTRAINT `training_material_access_ibfk_2` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_material_access`
--

LOCK TABLES `training_material_access` WRITE;
/*!40000 ALTER TABLE `training_material_access` DISABLE KEYS */;
INSERT INTO `training_material_access` VALUES (1,1,1,'2026-04-03 03:32:23','2026-04-03 06:02:31',6);
/*!40000 ALTER TABLE `training_material_access` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_materials`
--

DROP TABLE IF EXISTS `training_materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_materials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `section_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `type` enum('video','document','image','link') NOT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `url` varchar(500) DEFAULT NULL,
  `material_order` int NOT NULL,
  `uploaded_by` int DEFAULT NULL,
  `visibility` enum('public','private') NOT NULL DEFAULT 'private',
  `access_expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `section_id` (`section_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `training_materials_ibfk_1` FOREIGN KEY (`section_id`) REFERENCES `training_sections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `training_materials_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_materials`
--

LOCK TABLES `training_materials` WRITE;
/*!40000 ALTER TABLE `training_materials` DISABLE KEYS */;
INSERT INTO `training_materials` VALUES (1,1,'K-laser Handbook','document','/uploads/materials/1775187121960.pdf',NULL,1,1,'public','2026-04-04 11:28:00','2026-04-03 03:30:00');
/*!40000 ALTER TABLE `training_materials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_media`
--

DROP TABLE IF EXISTS `training_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_media` (
  `id` int NOT NULL AUTO_INCREMENT,
  `training_id` int NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `visibility` enum('public','private') NOT NULL DEFAULT 'public',
  `access_expires_at` datetime DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_training_media_training` (`training_id`),
  CONSTRAINT `training_media_ibfk_1` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `training_media_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_media`
--

LOCK TABLES `training_media` WRITE;
/*!40000 ALTER TABLE `training_media` DISABLE KEYS */;
/*!40000 ALTER TABLE `training_media` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_sections`
--

DROP TABLE IF EXISTS `training_sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_sections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `training_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `section_order` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `training_id` (`training_id`),
  CONSTRAINT `training_sections_ibfk_1` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_sections`
--

LOCK TABLES `training_sections` WRITE;
/*!40000 ALTER TABLE `training_sections` DISABLE KEYS */;
INSERT INTO `training_sections` VALUES (1,1,'General Materials',0,'2026-04-03 03:30:00');
/*!40000 ALTER TABLE `training_sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_test_questions`
--

DROP TABLE IF EXISTS `training_test_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_test_questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `training_test_id` int NOT NULL,
  `question_id` int NOT NULL,
  `question_order` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `training_test_id` (`training_test_id`),
  KEY `question_id` (`question_id`),
  CONSTRAINT `training_test_questions_ibfk_1` FOREIGN KEY (`training_test_id`) REFERENCES `training_tests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `training_test_questions_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_test_questions`
--

LOCK TABLES `training_test_questions` WRITE;
/*!40000 ALTER TABLE `training_test_questions` DISABLE KEYS */;
INSERT INTO `training_test_questions` VALUES (1,1,40,1,'2026-04-03 03:27:42'),(2,1,61,2,'2026-04-03 03:27:42'),(3,1,49,3,'2026-04-03 03:27:42'),(4,1,39,4,'2026-04-03 03:27:42'),(5,1,52,5,'2026-04-03 03:27:42'),(6,1,45,6,'2026-04-03 03:27:42'),(7,1,37,7,'2026-04-03 03:27:42'),(8,1,34,8,'2026-04-03 03:27:42'),(9,1,46,9,'2026-04-03 03:27:42'),(10,1,41,10,'2026-04-03 03:27:42'),(11,2,23,1,'2026-04-03 03:27:42'),(12,2,30,2,'2026-04-03 03:27:42'),(13,2,2,3,'2026-04-03 03:27:42'),(14,2,10,4,'2026-04-03 03:27:42'),(15,2,24,5,'2026-04-03 03:27:42'),(16,2,20,6,'2026-04-03 03:27:42'),(17,2,16,7,'2026-04-03 03:27:42'),(18,2,8,8,'2026-04-03 03:27:42'),(19,2,14,9,'2026-04-03 03:27:42'),(20,2,11,10,'2026-04-03 03:27:42'),(21,3,103,1,'2026-04-03 03:27:42'),(22,3,63,2,'2026-04-03 03:27:42'),(23,3,68,3,'2026-04-03 03:27:42'),(24,3,102,4,'2026-04-03 03:27:42'),(25,3,97,5,'2026-04-03 03:27:42'),(26,3,101,6,'2026-04-03 03:27:42'),(27,3,76,7,'2026-04-03 03:27:42'),(28,3,93,8,'2026-04-03 03:27:42'),(29,3,70,9,'2026-04-03 03:27:42'),(30,3,92,10,'2026-04-03 03:27:42'),(31,3,69,11,'2026-04-03 03:27:42'),(32,3,64,12,'2026-04-03 03:27:42'),(33,3,72,13,'2026-04-03 03:27:42'),(34,3,67,14,'2026-04-03 03:27:42'),(35,3,84,15,'2026-04-03 03:27:42'),(36,3,100,16,'2026-04-03 03:27:42'),(37,3,96,17,'2026-04-03 03:27:42'),(38,3,73,18,'2026-04-03 03:27:42'),(39,3,95,19,'2026-04-03 03:27:42'),(40,3,78,20,'2026-04-03 03:27:42'),(41,3,74,21,'2026-04-03 03:27:42'),(42,3,83,22,'2026-04-03 03:27:42'),(43,3,79,23,'2026-04-03 03:27:42'),(44,3,77,24,'2026-04-03 03:27:42'),(45,3,80,25,'2026-04-03 03:27:42'),(46,3,99,26,'2026-04-03 03:27:42'),(47,3,65,27,'2026-04-03 03:27:42'),(48,3,98,28,'2026-04-03 03:27:42'),(49,3,81,29,'2026-04-03 03:27:42'),(50,3,86,30,'2026-04-03 03:27:42'),(51,3,89,31,'2026-04-03 03:27:42'),(52,3,75,32,'2026-04-03 03:27:42'),(53,3,66,33,'2026-04-03 03:27:42'),(54,3,91,34,'2026-04-03 03:27:42'),(55,3,85,35,'2026-04-03 03:27:42'),(56,3,87,36,'2026-04-03 03:27:42'),(57,3,90,37,'2026-04-03 03:27:42'),(58,3,94,38,'2026-04-03 03:27:42'),(59,3,88,39,'2026-04-03 03:27:42'),(60,3,82,40,'2026-04-03 03:27:42');
/*!40000 ALTER TABLE `training_test_questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_tests`
--

DROP TABLE IF EXISTS `training_tests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_tests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `training_id` int NOT NULL,
  `test_type` enum('pre_test','post_test','refresher_training','certificate_enrolment') NOT NULL,
  `total_questions` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `training_id` (`training_id`),
  CONSTRAINT `training_tests_ibfk_1` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_tests`
--

LOCK TABLES `training_tests` WRITE;
/*!40000 ALTER TABLE `training_tests` DISABLE KEYS */;
INSERT INTO `training_tests` VALUES (1,1,'pre_test',10,'2026-04-03 03:27:42'),(2,1,'post_test',10,'2026-04-03 03:27:42'),(3,1,'certificate_enrolment',40,'2026-04-03 03:27:42');
/*!40000 ALTER TABLE `training_tests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_titles`
--

DROP TABLE IF EXISTS `training_titles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_titles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_titles`
--

LOCK TABLES `training_titles` WRITE;
/*!40000 ALTER TABLE `training_titles` DISABLE KEYS */;
INSERT INTO `training_titles` VALUES (1,'K-Laser Safety Awareness Training','This training introduces the fundamentals of K-Laser technology, focusing on how laser therapy works and its practical applications. It also covers key safety principles, including laser classifications, hazard awareness, proper use of protective equipment, and safe operating procedures to ensure both user and patient safety.','2026-04-04 01:02:06','2026-04-04 01:05:21');
/*!40000 ALTER TABLE `training_titles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_trainees`
--

DROP TABLE IF EXISTS `training_trainees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_trainees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `training_id` int NOT NULL,
  `trainee_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_training_trainee` (`training_id`,`trainee_id`),
  KEY `trainee_id` (`trainee_id`),
  CONSTRAINT `training_trainees_ibfk_1` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `training_trainees_ibfk_2` FOREIGN KEY (`trainee_id`) REFERENCES `trainees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_trainees`
--

LOCK TABLES `training_trainees` WRITE;
/*!40000 ALTER TABLE `training_trainees` DISABLE KEYS */;
INSERT INTO `training_trainees` VALUES (1,1,1,'2026-04-03 03:27:42');
/*!40000 ALTER TABLE `training_trainees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_trainers`
--

DROP TABLE IF EXISTS `training_trainers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_trainers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `training_id` int NOT NULL,
  `trainer_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_training_trainer` (`training_id`,`trainer_id`),
  KEY `trainer_id` (`trainer_id`),
  CONSTRAINT `training_trainers_ibfk_1` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `training_trainers_ibfk_2` FOREIGN KEY (`trainer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_trainers`
--

LOCK TABLES `training_trainers` WRITE;
/*!40000 ALTER TABLE `training_trainers` DISABLE KEYS */;
INSERT INTO `training_trainers` VALUES (3,1,1,'2026-04-04 01:08:27');
/*!40000 ALTER TABLE `training_trainers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trainings`
--

DROP TABLE IF EXISTS `trainings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trainings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text,
  `type` enum('main','refresher_training') NOT NULL,
  `module_id` int NOT NULL,
  `device_model_id` int NOT NULL,
  `created_by` int DEFAULT NULL,
  `affiliated_company` enum('QSS','PMS') NOT NULL DEFAULT 'QSS',
  `status` enum('in_progress','completed','canceled','rescheduled') DEFAULT 'in_progress',
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `start_datetime` datetime DEFAULT NULL,
  `end_datetime` datetime DEFAULT NULL,
  `header_image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_training_type` (`type`),
  KEY `idx_trainings_device_model` (`device_model_id`),
  KEY `idx_trainings_module` (`module_id`),
  CONSTRAINT `fk_trainings_module` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `trainings_ibfk_1` FOREIGN KEY (`device_model_id`) REFERENCES `device_models` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `trainings_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trainings`
--

LOCK TABLES `trainings` WRITE;
/*!40000 ALTER TABLE `trainings` DISABLE KEYS */;
INSERT INTO `trainings` VALUES (1,'K-Laser Safety Awareness Training','This training introduces the fundamentals of K-Laser technology, focusing on how laser therapy works and its practical applications. It also covers key safety principles, including laser classifications, hazard awareness, proper use of protective equipment, and safe operating procedures to ensure both user and patient safety.','main',1,1,1,'QSS','completed',0,'2026-04-03 12:00:00','2026-04-03 12:00:00','/images/Training Headers/Header 1.jpg','2026-04-03 03:27:42','2026-04-04 01:08:27');
/*!40000 ALTER TABLE `trainings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `position` varchar(255) NOT NULL DEFAULT '',
  `phone_number` varchar(20) DEFAULT NULL,
  `area_of_specialization` varchar(255) DEFAULT NULL,
  `certificate_file` varchar(255) DEFAULT NULL,
  `role` enum('admin','trainer') NOT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_user_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin@lms.com','$2b$10$jDdfAHpJGnM1RYN9WHtnYuXg.qVdagofeO/MLVKVxboF41/wzmlEy','Mohamed','Aiman','Senior Trainer','01121787858',NULL,'/uploads/certificates/1-1775183429482.pdf','admin','/uploads/profiles/1-1775183513302.jpeg','2026-04-03 01:48:55','2026-04-04 01:47:27'),(2,'nssyahirah.razali@gmail.com','$2b$10$kHRBriAL2g31YSfGjf8rz.Dn0QvLJ3fhy5eHQ0zKVBclrjr7B7t1O','Ary','Lee','Trainer','+60 14-248 6414','Chronic kidney disease, Diabetic foot ulcer, Idiopathic pulmonary fibrosis, Pain management',NULL,'admin',NULL,'2026-04-02 23:51:39','2026-04-04 01:53:18'),(3,'Zulhazrael96@gmail.com','$2b$10$AmJGVYmLCSLImVNbwUXysOBvu1tgJFZPrdd89OXjX3.hrmjCUCqge','Zulhazrael','Edzuan','Trainer','+60 19-281 1372','Chronic kidney disease, Diabetic foot ulcer, Erectile dysfunction, Idiopathic pulmonary fibrosis, Pain management',NULL,'admin',NULL,'2026-04-02 23:52:59','2026-04-04 01:53:18'),(4,'devaraj.daryl@gmail.com','$2b$10$gQFxX5QsYEZz2gB.m.J..uQJfeV9PgRrvqbSqDnybFUL4NVwbqWQ2','Daryl','Devaraj','Trainer','+60 17-822 9186','Pain management, Erectile dysfunction, Idiopathic pulmonary fibrosis, Diabetic foot ulcer, Chronic kidney disease',NULL,'admin',NULL,'2026-04-02 23:56:20','2026-04-04 01:53:18'),(5,'qssmalaysia@yahoo.com','$2b$10$qBFNk/ZKGYV3.EtdCLGJJO5La7RiXR28vdtkZsz4kthr3FN/LTc62','Shah Zarak','Khan','Managing Director','+60 19-262 1626','Chronic kidney disease, Diabetic foot ulcer, Erectile dysfunction, Idiopathic pulmonary fibrosis, Pain management',NULL,'admin',NULL,'2026-04-04 01:57:59','2026-04-04 01:57:59');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-04 11:15:13
