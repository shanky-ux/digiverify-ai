const pool = require('../db');

/**
 * Migration: Add proof_url column and update status options for video verification
 */
async function addProofUrlColumn() {
  const connection = await pool.getConnection();

  try {
    // Check if column already exists
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_NAME = 'video_verification_requests' AND COLUMN_NAME = 'proof_url'"
    );

    if (columns.length > 0) {
      console.log('✓ proof_url column already exists');
      connection.release();
      return;
    }

    // Add proof_url column for storing proof video/image
    await connection.query(`
      ALTER TABLE video_verification_requests 
      ADD COLUMN proof_url VARCHAR(500) DEFAULT NULL,
      MODIFY COLUMN status ENUM('pending', 'in_progress', 'marked_for_verification', 'completed') DEFAULT 'pending'
    `);

    console.log('✓ Successfully added proof_url column and updated status enum');
    connection.release();
  } catch (error) {
    connection.release();
    console.error('Migration error:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  addProofUrlColumn()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addProofUrlColumn };
