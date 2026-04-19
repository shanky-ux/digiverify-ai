/**
 * Database Migration: Add Video Conference Tracking
 * Adds video call columns to verification_requests and creates video_conferences table
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'beneficiary_verification',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function runMigration() {
  try {
    const connection = await pool.getConnection();

    console.log('Starting database migration: Add Video Conference Tracking...\n');

    // Step 1: Alter verification_requests table
    console.log('Step 1: Altering verification_requests table...');
    try {
      await connection.query(`
        ALTER TABLE verification_requests 
        ADD COLUMN video_call_initiated DATETIME NULL,
        ADD COLUMN video_call_status VARCHAR(50) NULL,
        ADD COLUMN video_call_duration INT DEFAULT 0,
        ADD COLUMN manual_approval_status VARCHAR(50) NULL,
        ADD COLUMN manual_approval_by VARCHAR(255) NULL,
        ADD COLUMN manual_approval_notes TEXT NULL,
        ADD COLUMN manual_approval_timestamp DATETIME NULL
      `);
      console.log('✓ verification_requests table updated\n');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠ Columns already exist (skipping)\n');
      } else {
        throw error;
      }
    }

    // Step 2: Create video_conferences table
    console.log('Step 2: Creating video_conferences table...');
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS video_conferences (
          id int NOT NULL AUTO_INCREMENT,
          request_id int NOT NULL,
          aadhaar_id varchar(12) NOT NULL,
          initiated_by varchar(255) NOT NULL,
          initiated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          started_at timestamp NULL,
          ended_at timestamp NULL,
          duration_seconds int DEFAULT 0,
          video_call_status varchar(50) DEFAULT 'initiated',
          call_outcome varchar(50) DEFAULT NULL,
          notes text,
          approved_by varchar(255) DEFAULT NULL,
          approval_status varchar(50) DEFAULT NULL,
          approval_timestamp timestamp NULL,
          PRIMARY KEY (id),
          KEY idx_request_id (request_id),
          KEY idx_aadhaar_id (aadhaar_id),
          KEY idx_call_status (video_call_status),
          KEY idx_approval_status (approval_status),
          CONSTRAINT video_conferences_ibfk_1 FOREIGN KEY (request_id) REFERENCES verification_requests (id),
          CONSTRAINT video_conferences_ibfk_2 FOREIGN KEY (aadhaar_id) REFERENCES aadhaar_registry (aadhaar_id)
        ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
      console.log('✓ video_conferences table created\n');
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('⚠ video_conferences table already exists (skipping)\n');
      } else {
        throw error;
      }
    }

    connection.release();
    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
