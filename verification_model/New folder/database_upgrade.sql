-- Database upgrade: Add video conference tracking
-- Run this to add video call tracking to existing database

ALTER TABLE verification_requests 
ADD COLUMN video_call_initiated DATETIME NULL,
ADD COLUMN video_call_status VARCHAR(50) DEFAULT NULL,
ADD COLUMN video_call_duration INT DEFAULT 0,
ADD COLUMN manual_approval_status VARCHAR(50) DEFAULT NULL,
ADD COLUMN manual_approval_by VARCHAR(255) DEFAULT NULL,
ADD COLUMN manual_approval_notes TEXT DEFAULT NULL,
ADD COLUMN manual_approval_timestamp DATETIME NULL;

-- Create video conference tracking table
CREATE TABLE IF NOT EXISTS video_conferences (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `aadhaar_id` varchar(12) NOT NULL,
  `initiated_by` varchar(255) NOT NULL,
  `initiated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` timestamp NULL,
  `ended_at` timestamp NULL,
  `duration_seconds` int DEFAULT 0,
  `video_call_status` varchar(50) DEFAULT 'initiated',
  `call_outcome` varchar(50) DEFAULT NULL,
  `notes` text,
  `approved_by` varchar(255) DEFAULT NULL,
  `approval_status` varchar(50) DEFAULT NULL,
  `approval_timestamp` timestamp NULL,
  PRIMARY KEY (`id`),
  KEY `idx_request_id` (`request_id`),
  KEY `idx_aadhaar_id` (`aadhaar_id`),
  CONSTRAINT `video_conferences_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `verification_requests` (`id`),
  CONSTRAINT `video_conferences_ibfk_2` FOREIGN KEY (`aadhaar_id`) REFERENCES `aadhaar_registry` (`aadhaar_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE INDEX idx_call_status ON video_conferences(video_call_status);
CREATE INDEX idx_approval_status ON video_conferences(approval_status);
