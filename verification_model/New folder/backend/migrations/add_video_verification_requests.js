const pool = require('../db');

/**
 * Migration: Create video_verification_requests table for user-initiated video verification
 */
async function migrateVideoVerificationRequests() {
  const connection = await pool.getConnection();

  try {
    // Check if table already exists
    const [tables] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'video_verification_requests'"
    );

    if (tables.length > 0) {
      console.log('✓ video_verification_requests table already exists');
      connection.release();
      return;
    }

    // Create video_verification_requests table
    await connection.query(`
      CREATE TABLE video_verification_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        verification_request_id INT NOT NULL,
        aadhaar_id VARCHAR(12) NOT NULL,
        jitsi_room_link VARCHAR(500),
        status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
        outcome ENUM('verified', 'failed') DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP DEFAULT NULL,
        admin_who_verified VARCHAR(100) DEFAULT NULL,
        notes TEXT,
        FOREIGN KEY (verification_request_id) REFERENCES verification_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (aadhaar_id) REFERENCES aadhaar_registry(aadhaar_id) ON DELETE CASCADE,
        INDEX idx_status (status),
        INDEX idx_verification_request_id (verification_request_id),
        INDEX idx_aadhaar_id (aadhaar_id),
        INDEX idx_created_at (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    console.log('✓ Successfully created video_verification_requests table');
    connection.release();
  } catch (error) {
    connection.release();
    console.error('Migration error:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateVideoVerificationRequests()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateVideoVerificationRequests };
