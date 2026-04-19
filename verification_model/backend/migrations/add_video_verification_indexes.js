const pool = require('../db');

/**
 * Migration: Add index on aadhaar_id for video_verification_requests
 */
async function addIndexes() {
  const connection = await pool.getConnection();

  try {
    // Check if index exists
    const [indexes] = await connection.query(
      "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_NAME = 'video_verification_requests' AND COLUMN_NAME = 'aadhaar_id' AND INDEX_NAME != 'PRIMARY'"
    );

    if (indexes.length > 0) {
      console.log('✓ Index on aadhaar_id already exists');
      connection.release();
      return;
    }

    // Add composite index for aadhaar_id and status
    await connection.query(`
      CREATE INDEX idx_aadhaar_status ON video_verification_requests(aadhaar_id, status)
    `);

    console.log('✓ Successfully created index on aadhaar_id and status');
    connection.release();
  } catch (error) {
    connection.release();
    console.error('Migration error:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  addIndexes()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addIndexes };
