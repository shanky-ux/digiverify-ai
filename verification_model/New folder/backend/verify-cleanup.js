const pool = require('./db');

async function verify() {
  try {
    const connection = await pool.getConnection();
    
    console.log('\n=== ACTIVE VIDEO REQUESTS STATUS ===');
    const [active] = await connection.query(`
      SELECT ar.name, ar.aadhaar_id, COUNT(*) as count
      FROM video_verification_requests vvr
      JOIN aadhaar_registry ar ON vvr.aadhaar_id = ar.aadhaar_id
      WHERE vvr.status IN ('pending', 'in_progress')
      GROUP BY ar.aadhaar_id
      HAVING count > 1
    `);
    
    if (active.length === 0) {
      console.log('✓ SUCCESS: No duplicate active video requests found!');
    } else {
      console.log('Still have duplicates:', active);
    }
    
    console.log('\n=== TOTAL ACTIVE VIDEO REQUESTS ===');
    const [total] = await connection.query(`
      SELECT COUNT(*) as total_active
      FROM video_verification_requests
      WHERE status IN ('pending', 'in_progress')
    `);
    console.log(`Total active video requests: ${total[0].total_active}`);
    
    console.log('\n=== ALL ACTIVE REQUESTS ===');
    const [all] = await connection.query(`
      SELECT 
        vvr.id,
        ar.name, 
        ar.aadhaar_id, 
        vvr.status,
        vvr.created_at
      FROM video_verification_requests vvr
      JOIN aadhaar_registry ar ON vvr.aadhaar_id = ar.aadhaar_id
      WHERE vvr.status IN ('pending', 'in_progress')
      ORDER BY vvr.created_at DESC
    `);
    console.table(all);
    
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

verify();
