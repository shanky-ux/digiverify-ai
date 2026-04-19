const pool = require('../db');

const migration = async () => {
  try {
    const connection = await pool.getConnection();

    console.log('Removing problematic unique constraint...');
    
    // Drop the existing constraint that was causing issues
    try {
      await connection.query(`
        ALTER TABLE video_verification_requests 
        DROP INDEX unique_active_video_per_aadhaar
      `);
      console.log('✓ Dropped problematic constraint');
    } catch (err) {
      if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('✓ Constraint did not exist');
      } else {
        throw err;
      }
    }

    // Keep the composite index on (aadhaar_id, status) for query performance
    try {
      await connection.query(`
        ALTER TABLE video_verification_requests 
        ADD INDEX idx_aadhaar_status (aadhaar_id, status)
      `);
      console.log('✓ Added performance index on (aadhaar_id, status)');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('✓ Index already exists');
      } else {
        throw err;
      }
    }

    connection.release();
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
};

migration();
