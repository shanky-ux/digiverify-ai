const pool = require('./db');

async function cleanupDuplicates() {
  try {
    const connection = await pool.getConnection();
    
    console.log('\n=== FINDING DUPLICATE ACTIVE VIDEO REQUESTS ===');
    
    // Get all aadhaar_ids with multiple active video requests
    const [duplicateAadhaars] = await connection.query(`
      SELECT ar.aadhaar_id, ar.name, COUNT(*) as count
      FROM video_verification_requests vvr
      JOIN aadhaar_registry ar ON vvr.aadhaar_id = ar.aadhaar_id
      WHERE vvr.status IN ('pending', 'in_progress')
      GROUP BY vvr.aadhaar_id
      HAVING COUNT(*) > 1
    `);
    
    console.log('Aadhaar IDs with multiple active requests:', duplicateAadhaars);
    
    // For each duplicate, keep the latest one and delete others
    for (const dup of duplicateAadhaars) {
      console.log(`\nCleaning up ${dup.name} (${dup.aadhaar_id})...`);
      
      // Get all requests for this aadhaar, ordered by date
      const [allRequests] = await connection.query(`
        SELECT id, created_at
        FROM video_verification_requests
        WHERE aadhaar_id = ? AND status IN ('pending', 'in_progress')
        ORDER BY created_at DESC
      `, [dup.aadhaar_id]);
      
      console.log(`  Found ${allRequests.length} active requests`);
      console.log('  Keeping (latest):', allRequests[0].id, 'created:', allRequests[0].created_at);
      
      // Delete all except the first (latest) one
      if (allRequests.length > 1) {
        const idsToDelete = allRequests.slice(1).map(r => r.id);
        console.log('  Deleting old duplicates:', idsToDelete);
        
        // Delete old records
        await connection.query(
          `DELETE FROM video_verification_requests WHERE id IN (${idsToDelete.map(() => '?').join(',')})`,
          idsToDelete
        );
        
        console.log(`  ✓ Deleted ${idsToDelete.length} duplicate records`);
      }
    }
    
    console.log('\n=== VERIFYING CLEANUP ===');
    const [active] = await connection.query(`
      SELECT ar.name, ar.aadhaar_id, COUNT(*) as count
      FROM video_verification_requests vvr
      JOIN aadhaar_registry ar ON vvr.aadhaar_id = ar.aadhaar_id
      WHERE vvr.status IN ('pending', 'in_progress')
      GROUP BY ar.aadhaar_id
      HAVING count > 1
    `);
    
    if (active.length === 0) {
      console.log('✓ All duplicates cleaned! No more multiple active requests per aadhaar.');
    } else {
      console.log('Still have duplicates:', active);
    }
    
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

cleanupDuplicates();
