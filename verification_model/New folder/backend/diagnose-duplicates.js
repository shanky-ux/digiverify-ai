const pool = require('./db');

async function checkDuplicates() {
  try {
    const connection = await pool.getConnection();
    
    console.log('\n=== CHECKING DUPLICATES IN verification_requests ===');
    const [vr] = await connection.query(
      `SELECT ar.name, ar.aadhaar_id, COUNT(*) as count
       FROM verification_requests vr
       JOIN aadhaar_registry ar ON vr.aadhaar_id = ar.aadhaar_id
       GROUP BY ar.aadhaar_id
       HAVING count > 1`
    );
    console.log('People with multiple verification requests:', vr);
    
    console.log('\n=== CHECKING DUPLICATES IN video_verification_requests ===');
    const [vvr] = await connection.query(
      `SELECT ar.name, ar.aadhaar_id, COUNT(*) as count
       FROM video_verification_requests vvr
       JOIN aadhaar_registry ar ON vvr.aadhaar_id = ar.aadhaar_id
       GROUP BY ar.aadhaar_id
       HAVING count > 1`
    );
    console.log('People with multiple video requests:', vvr);
    
    console.log('\n=== CHECKING ACTIVE VIDEO REQUESTS (pending/in_progress) ===');
    const [active] = await connection.query(
      `SELECT ar.name, ar.aadhaar_id, COUNT(*) as count, vvr.status
       FROM video_verification_requests vvr
       JOIN aadhaar_registry ar ON vvr.aadhaar_id = ar.aadhaar_id
       WHERE vvr.status IN ('pending', 'in_progress')
       GROUP BY ar.aadhaar_id, vvr.status
       HAVING count > 1`
    );
    console.log('Active video requests with duplicates:', active);
    
    console.log('\n=== RAMESH KUMAR SPECIFIC DATA ===');
    const [ramesh] = await connection.query(
      `SELECT 
        vvr.id, ar.aadhaar_id, ar.name,
        vvr.status, vvr.outcome, 
        vvr.jitsi_room_link,
        vvr.created_at, vvr.completed_at
       FROM video_verification_requests vvr
       JOIN aadhaar_registry ar ON vvr.aadhaar_id = ar.aadhaar_id
       WHERE ar.name LIKE '%ramesh%' OR ar.name LIKE '%Ramesh%'`
    );
    console.log('All Ramesh Kumar records in video_verification_requests:');
    console.table(ramesh);
    
    console.log('\n=== ALL VERIFICATIONS WITH NAMES ===');
    const [allVer] = await connection.query(
      `SELECT ar.name, ar.aadhaar_id, COUNT(*) as verification_count
       FROM verification_requests vr
       JOIN aadhaar_registry ar ON vr.aadhaar_id = ar.aadhaar_id
       GROUP BY ar.aadhaar_id
       ORDER BY ar.name`
    );
    console.log('Full verification list by person:');
    console.table(allVer);
    
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDuplicates();
