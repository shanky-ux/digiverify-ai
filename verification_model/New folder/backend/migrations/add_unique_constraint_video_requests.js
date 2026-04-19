const pool = require('../db');

const migration = async () => {
  try {
    const connection = await pool.getConnection();

    // Add unique constraint: only one ACTIVE (pending/in_progress) video request per aadhaar
    // This prevents duplicate active requests while allowing completed/marked records
    console.log('Adding unique constraint on (aadhaar_id, status) for active video requests...');
    
    try {
      await connection.query(`
        ALTER TABLE video_verification_requests 
        ADD UNIQUE KEY unique_active_video_per_aadhaar (aadhaar_id, status)
      `);
      console.log('✓ Unique constraint added successfully');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('✓ Constraint already exists');
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
