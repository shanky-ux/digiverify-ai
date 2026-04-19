-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: beneficiary_verification
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

DROP DATABASE IF EXISTS beneficiary_verification;
CREATE DATABASE beneficiary_verification DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE beneficiary_verification;

DROP TABLE IF EXISTS `aadhaar_registry`;
CREATE TABLE `aadhaar_registry` (
  `id` int NOT NULL AUTO_INCREMENT,
  `aadhaar_id` varchar(12) NOT NULL,
  `name` varchar(255) NOT NULL,
  `dob` date NOT NULL,
  `gender` varchar(10) DEFAULT NULL,
  `address` text,
  `phone` varchar(20) DEFAULT NULL,
  `aadhaar_image_path` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aadhaar_id` (`aadhaar_id`),
  KEY `idx_aadhaar_id` (`aadhaar_id`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

LOCK TABLES `aadhaar_registry` WRITE;
INSERT INTO `aadhaar_registry` VALUES (31,'123456789012','Rajesh Kumar','1985-05-15','Male','123 Main St, New Delhi','9876543210','uploads/sample-aadhaar-1.jpg','2026-03-27 15:00:08','2026-03-27 15:00:08'),(32,'234567890123','Priya Sharma','1990-08-22','Female','456 Park Ave, Mumbai','9876543211','uploads/sample-aadhaar-2.jpg','2026-03-27 15:00:08','2026-03-27 15:00:08'),(33,'345678901234','Vikram Singh','1988-12-10','Male','789 Oak Lane, Bangalore','9876543212','uploads/sample-aadhaar-3.jpg','2026-03-27 15:00:08','2026-03-27 15:00:08'),(34,'456789012345','Anita Gupta','1992-03-30','Female','321 Elm St, Pune','9876543213','uploads/sample-aadhaar-4.jpg','2026-03-27 15:00:08','2026-03-27 15:00:08'),(35,'567890123456','Deceased Person','1970-01-01','Male','555 Old Lane, Kolkata','9876543214','uploads/sample-aadhaar-5.jpg','2026-03-27 15:00:08','2026-03-27 15:00:08');
UNLOCK TABLES;

DROP TABLE IF EXISTS `beneficiaries`;
CREATE TABLE `beneficiaries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `aadhaar_id` varchar(12) NOT NULL,
  `status` varchar(50) DEFAULT 'active',
  `scheme_id` varchar(100) DEFAULT NULL,
  `enrollment_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_aadhaar_id` (`aadhaar_id`),
  CONSTRAINT `beneficiaries_ibfk_1` FOREIGN KEY (`aadhaar_id`) REFERENCES `aadhaar_registry` (`aadhaar_id`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

LOCK TABLES `beneficiaries` WRITE;
INSERT INTO `beneficiaries` VALUES (31,'123456789012','active','SCHEME_001','2023-01-15','2026-03-27 15:00:08','2026-03-27 15:00:08'),(32,'234567890123','active','SCHEME_002','2023-02-20','2026-03-27 15:00:08','2026-03-27 15:00:08'),(33,'345678901234','active','SCHEME_003','2023-03-10','2026-03-27 15:00:08','2026-03-27 15:00:08'),(34,'456789012345','active','SCHEME_004','2023-04-05','2026-03-27 15:00:08','2026-03-27 15:00:08'),(35,'567890123456','inactive','SCHEME_005','2022-12-01','2026-03-27 15:00:08','2026-03-27 15:00:08');
UNLOCK TABLES;

DROP TABLE IF EXISTS `death_certificates`;
CREATE TABLE `death_certificates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `aadhaar_id` varchar(12) NOT NULL,
  `death_date` date NOT NULL,
  `certificate_number` varchar(100) DEFAULT NULL,
  `issuing_authority` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_aadhaar_id` (`aadhaar_id`),
  CONSTRAINT `death_certificates_ibfk_1` FOREIGN KEY (`aadhaar_id`) REFERENCES `aadhaar_registry` (`aadhaar_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

LOCK TABLES `death_certificates` WRITE;
INSERT INTO `death_certificates` VALUES (7,'567890123456','2024-06-15','DEATH_CERT_001','Municipal Corporation','2026-03-27 15:00:08');
UNLOCK TABLES;

DROP TABLE IF EXISTS `verification_requests`;
CREATE TABLE `verification_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `aadhaar_id` varchar(12) NOT NULL,
  `uploaded_image_path` varchar(500) DEFAULT NULL,
  `match_score` int DEFAULT '0',
  `status` varchar(50) DEFAULT 'pending',
  `approved_by` varchar(255) DEFAULT NULL,
  `video_room_id` varchar(100) DEFAULT NULL,
  `video_room_url` varchar(500) DEFAULT NULL,
  `video_mandatory` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_aadhaar_id` (`aadhaar_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `verification_requests_ibfk_1` FOREIGN KEY (`aadhaar_id`) REFERENCES `aadhaar_registry` (`aadhaar_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

LOCK TABLES `verification_requests` WRITE;
INSERT INTO `verification_requests` VALUES (13,'123456789012','uploads\\sample-verify-1.jpg',45,'rejected',NULL,'verification-123456789012-77acf4ea','https://meet.jit.si/verification-123456789012-77acf4ea',1,'2026-03-27 15:01:35','2026-03-27 15:01:35');
UNLOCK TABLES;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
