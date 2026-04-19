const pool = require('../db');
const { compareFaces } = require('../utils/faceMatching');
const { v4: uuidv4 } = require('uuid');

// Public Jitsi server (using reliable alternative to meet.jitsi.org)
const JITSI_SERVER = process.env.JITSI_SERVER || 'https://jitsi.riot.im';

/**
 * Verify Aadhaar ID against registry
 */
exports.verifyAadhaar = async (req, res) => {
  const { aadhaar_id } = req.body;

  try {
    if (!aadhaar_id || aadhaar_id.length !== 12) {
      return res.status(400).json({ success: false, error: 'Invalid Aadhaar ID' });
    }

    const connection = await pool.getConnection();
    
    // Query Aadhaar registry
    const [rows] = await connection.query(
      'SELECT * FROM aadhaar_registry WHERE aadhaar_id = ?',
      [aadhaar_id]
    );

    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Aadhaar ID not found in registry'
      });
    }

    const aadhaarData = rows[0];

    // Check if person is deceased
    const [deathRecords] = await pool.query(
      'SELECT * FROM death_certificates WHERE aadhaar_id = ?',
      [aadhaar_id]
    );

    if (deathRecords.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'This Aadhaar ID is associated with a deceased person',
        deceased: true
      });
    }

    res.status(200).json({
      success: true,
      message: 'Aadhaar verified successfully',
      data: {
        aadhaar_id: aadhaarData.aadhaar_id,
        name: aadhaarData.name,
        dob: aadhaarData.dob,
        gender: aadhaarData.gender,
        address: aadhaarData.address,
        phone: aadhaarData.phone,
        aadhaar_image_path: aadhaarData.aadhaar_image_path
      }
    });
  } catch (error) {
    console.error('Aadhaar verification error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Submit verification request with image
 */
exports.submitVerification = async (req, res) => {
  const { aadhaar_id } = req.body;
  const uploadedImage = req.file;

  try {
    if (!aadhaar_id || !uploadedImage) {
      return res.status(400).json({
        success: false,
        error: 'Aadhaar ID and image are required'
      });
    }

    const connection = await pool.getConnection();

    // Get Aadhaar data
    const [aadhaarRows] = await connection.query(
      'SELECT * FROM aadhaar_registry WHERE aadhaar_id = ?',
      [aadhaar_id]
    );

    if (aadhaarRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Aadhaar ID not found'
      });
    }

    const aadhaarData = aadhaarRows[0];
    const uploadedImagePath = uploadedImage.path;

    // Perform face matching
    let matchScore = 0;
    if (aadhaarData.aadhaar_image_path) {
      try {
        matchScore = await compareFaces(aadhaarData.aadhaar_image_path, uploadedImagePath);
      } catch (err) {
        console.error('Face matching failed:', err);
        matchScore = 0;
      }
    }

    // Determine verification status based on match score
    let status = 'pending';
    if (matchScore >= 70) {
      status = 'approved';
    } else if (matchScore < 40) {
      status = 'rejected';
    }

    // Create verification video room ID
    const videoRoomId = `verification-${aadhaar_id}-${uuidv4().substring(0, 8)}`;
    const videoRoomUrl = `https://meet.jit.si/${videoRoomId}`;

    // Insert verification request
    const [result] = await connection.query(
      `INSERT INTO verification_requests 
       (aadhaar_id, uploaded_image_path, match_score, status, video_room_id, video_room_url, video_mandatory)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [aadhaar_id, uploadedImagePath, matchScore, status, videoRoomId, videoRoomUrl, 1]
    );

    connection.release();

    res.status(201).json({
      success: true,
      message: 'Verification request submitted',
      data: {
        request_id: result.insertId,
        aadhaar_id,
        match_score: matchScore,
        status,
        video_room_id: videoRoomId,
        video_room_url: videoRoomUrl,
        recommendation: getRecommendation(matchScore)
      }
    });
  } catch (error) {
    console.error('Verification submission error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get verification status
 */
exports.getVerificationStatus = async (req, res) => {
  const { request_id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT vr.*, ar.name, ar.dob, ar.gender 
       FROM verification_requests vr
       JOIN aadhaar_registry ar ON vr.aadhaar_id = ar.aadhaar_id
       WHERE vr.id = ?`,
      [request_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Verification request not found'
      });
    }

    const verification = rows[0];
    res.status(200).json({
      success: true,
      data: {
        id: verification.id,
        aadhaar_id: verification.aadhaar_id,
        name: verification.name,
        match_score: verification.match_score,
        status: verification.status,
        video_room_url: verification.video_room_url,
        created_at: verification.created_at,
        recommendation: getRecommendation(verification.match_score)
      }
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get all verification requests (Admin)
 */
exports.getAllVerifications = async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    // Get latest COMPLETED verification per aadhaar (approved or rejected)
    // Using a JOIN with a derived table for compatibility
    let query = `
      SELECT vr.*, ar.name 
      FROM verification_requests vr
      JOIN aadhaar_registry ar ON vr.aadhaar_id = ar.aadhaar_id
      JOIN (
        SELECT aadhaar_id, MAX(id) as max_id
        FROM verification_requests
        WHERE status IN ('approved', 'rejected')
        GROUP BY aadhaar_id
      ) latest ON vr.aadhaar_id = latest.aadhaar_id AND vr.id = latest.max_id
    `;
    const params = [];

    if (status) {
      query += ` WHERE vr.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY vr.created_at DESC 
              LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    console.log('getAllVerifications query:', query);
    console.log('Parameters:', params);

    const [rows] = await pool.query(query, params);
    console.log('Verification rows returned:', rows.length, rows);

    // Get count - unique aadhaar count for completed verifications (not total verification records)
    let countQuery = `
      SELECT COUNT(*) as total FROM (
        SELECT DISTINCT vr.aadhaar_id
        FROM verification_requests vr
        WHERE vr.status IN ('approved', 'rejected')
    `;
    const countParams = [];
    if (status) {
      countQuery += ` AND vr.status = ?`;
      countParams.push(status);
    }
    countQuery += ` ) as distinct_aadhaars`;
    
    console.log('Count query:', countQuery);
    const [countRows] = await pool.query(countQuery, countParams);
    console.log('Total count:', countRows[0].total);

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countRows[0].total
      }
    });
  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
};

/**
 * Approve verification (Admin)
 */
exports.approveVerification = async (req, res) => {
  const { request_id } = req.params;
  const { approved_by } = req.body;

  try {
    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      'SELECT aadhaar_id, status FROM verification_requests WHERE id = ?',
      [request_id]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const { aadhaar_id, status } = rows[0];

    if (status === 'approved') {
      connection.release();
      return res.status(400).json({ success: false, error: 'Already approved' });
    }

    // Update verification status
    await connection.query(
      'UPDATE verification_requests SET status = ?, approved_by = ? WHERE id = ?',
      ['approved', approved_by || 'admin', request_id]
    );

    // Update beneficiary status if needed
    await connection.query(
      'UPDATE beneficiaries SET status = ? WHERE aadhaar_id = ?',
      ['active', aadhaar_id]
    );

    connection.release();

    res.status(200).json({
      success: true,
      message: 'Verification approved'
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Reject verification (Admin)
 */
exports.rejectVerification = async (req, res) => {
  const { request_id } = req.params;
  const { reason } = req.body;

  try {
    await pool.query(
      'UPDATE verification_requests SET status = ?, approved_by = ? WHERE id = ?',
      ['rejected', reason || 'Admin rejected', request_id]
    );

    res.status(200).json({
      success: true,
      message: 'Verification rejected'
    });
  } catch (error) {
    console.error('Rejection error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Initiate video conference (Admin)
 */
exports.initiateVideoCall = async (req, res) => {
  const { request_id } = req.params;
  const { admin_name, admin_id } = req.body;

  try {
    const connection = await pool.getConnection();

    // Get verification request details
    const [requests] = await connection.query(
      'SELECT * FROM verification_requests WHERE id = ?',
      [request_id]
    );

    if (requests.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const request = requests[0];
    const { aadhaar_id } = request;

    // Generate unique video room ID
    const videoRoomId = `verification_${request_id}_${Date.now()}`;
    const videoRoomLink = `https://meet.jitsi.org/${videoRoomId}`;

    // Update verification request with video call info
    await connection.query(
      'UPDATE verification_requests SET video_call_initiated = NOW(), video_call_status = ?, manual_approval_by = ? WHERE id = ?',
      ['initiated', admin_name || 'admin', request_id]
    );

    // Create video conference record
    await connection.query(
      'INSERT INTO video_conferences (request_id, aadhaar_id, initiated_by, video_call_status) VALUES (?, ?, ?, ?)',
      [request_id, aadhaar_id, admin_name || 'admin', 'initiated']
    );

    connection.release();

    res.status(200).json({
      success: true,
      videoRoomId,
      videoRoomLink,
      message: 'Video call initiated'
    });
  } catch (error) {
    console.error('Video call initiation error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Record video call result (Pass/Fail)
 */
exports.recordVideoCallResult = async (req, res) => {
  const { request_id } = req.params;
  const { callOutcome, duration, adminNotes, approved_by, approval_status } = req.body;

  try {
    const connection = await pool.getConnection();

    // Get verification request details
    const [requests] = await connection.query(
      'SELECT * FROM verification_requests WHERE id = ?',
      [request_id]
    );

    if (requests.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const request = requests[0];
    const { aadhaar_id } = request;

    // Update video call result in verification_requests
    await connection.query(
      'UPDATE verification_requests SET video_call_status = ?, manual_approval_status = ?, manual_approval_by = ?, manual_approval_notes = ?, manual_approval_timestamp = NOW() WHERE id = ?',
      [callOutcome, approval_status, approved_by || 'admin', adminNotes || '', request_id]
    );

    // Update video conference record
    const [videoConfs] = await connection.query(
      'SELECT id FROM video_conferences WHERE request_id = ? ORDER BY initiated_at DESC LIMIT 1',
      [request_id]
    );

    if (videoConfs.length > 0) {
      await connection.query(
        'UPDATE video_conferences SET call_outcome = ?, duration_seconds = ?, notes = ?, approval_status = ?, approved_by = ?, approval_timestamp = NOW() WHERE id = ?',
        [callOutcome, duration || 0, adminNotes || '', approval_status, approved_by || 'admin', videoConfs[0].id]
      );
    }

    // If passed and approval_status is 'approved', update main verification status
    if (callOutcome === 'passed' && approval_status === 'approved') {
      await connection.query(
        'UPDATE verification_requests SET status = ?, approved_by = ? WHERE id = ?',
        ['approved', approved_by || 'admin', request_id]
      );

      // Update beneficiary status
      await connection.query(
        'UPDATE beneficiaries SET status = ? WHERE aadhaar_id = ?',
        ['active', aadhaar_id]
      );
    } else if (callOutcome === 'failed' || approval_status === 'rejected') {
      await connection.query(
        'UPDATE verification_requests SET status = ? WHERE id = ?',
        ['rejected', request_id]
      );
    }

    connection.release();

    res.status(200).json({
      success: true,
      message: `Video call result recorded: ${callOutcome}`,
      verificationStatus: callOutcome === 'passed' ? 'approved' : 'rejected'
    });
  } catch (error) {
    console.error('Video call result error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get video call details
 */
exports.getVideoCallDetails = async (req, res) => {
  const { request_id } = req.params;

  try {
    const connection = await pool.getConnection();

    // Get video conference details
    const [videoConfs] = await connection.query(
      'SELECT * FROM video_conferences WHERE request_id = ? ORDER BY initiated_at DESC LIMIT 1',
      [request_id]
    );

    // Get verification request details
    const [requests] = await connection.query(
      'SELECT * FROM verification_requests WHERE id = ?',
      [request_id]
    );

    connection.release();

    if (requests.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const videoConf = videoConfs.length > 0 ? videoConfs[0] : null;

    res.status(200).json({
      success: true,
      verificationRequest: requests[0],
      videoConference: videoConf
    });
  } catch (error) {
    console.error('Get video call details error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Request video verification (User-initiated)
 */
exports.requestVideoVerification = async (req, res) => {
  const { aadhaar_id, request_id } = req.body;

  try {
    const connection = await pool.getConnection();

    // Validate that the verification request exists and belongs to this aadhaar
    const [requests] = await connection.query(
      'SELECT id, status FROM verification_requests WHERE id = ? AND aadhaar_id = ?',
      [request_id, aadhaar_id]
    );

    if (requests.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Verification request not found'
      });
    }

    // Generate unique Jitsi room ID
    const roomId = `verification_${request_id}_${Date.now()}`;
    const jitsiRoomLink = `${JITSI_SERVER}/${roomId}`;

    // Check if a video verification request already exists for this aadhaar (only pending/in_progress)
    const [existingVideo] = await connection.query(
      'SELECT id, verification_request_id FROM video_verification_requests WHERE aadhaar_id = ? AND status IN ("pending", "in_progress") LIMIT 1',
      [aadhaar_id]
    );

    let result;

    if (existingVideo.length > 0) {
      // Update existing pending/in_progress request (could be from different verification)
      await connection.query(
        'UPDATE video_verification_requests SET jitsi_room_link = ?, status = "pending" WHERE id = ?',
        [jitsiRoomLink, existingVideo[0].id]
      );
      result = existingVideo[0].id;
    } else {
      // Create new video verification request
      try {
        const [insertResult] = await connection.query(
          `INSERT INTO video_verification_requests (verification_request_id, aadhaar_id, jitsi_room_link, status, created_at)
           VALUES (?, ?, ?, 'pending', NOW())`,
          [request_id, aadhaar_id, jitsiRoomLink]
        );
        result = insertResult.insertId;
      } catch (insertError) {
        if (insertError.code === 'ER_DUP_ENTRY') {
          // Unique constraint violation - reuse the existing request
          console.warn(`Unique constraint violation, reusing existing request for aadhaar: ${aadhaar_id}`);
          const [recheck] = await connection.query(
            'SELECT id FROM video_verification_requests WHERE aadhaar_id = ? AND status IN ("pending", "in_progress") LIMIT 1',
            [aadhaar_id]
          );
          result = recheck[0]?.id || null;
        } else {
          throw insertError;
        }
      }
    }

    connection.release();

    res.status(200).json({
      success: true,
      message: 'Video verification requested successfully',
      data: {
        video_request_id: result,
        jitsi_room_link: jitsiRoomLink,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Request video verification error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get active video verifications (Admin)
 */
exports.getActiveVideoVerifications = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const connection = await pool.getConnection();

    // Get active/pending video verification requests with beneficiary details
    const [videos] = await connection.query(
      `SELECT DISTINCT
        vvr.id as video_request_id,
        vvr.verification_request_id,
        vvr.aadhaar_id,
        vvr.jitsi_room_link,
        vvr.status,
        vvr.outcome,
        vvr.created_at,
        vvr.completed_at,
        ar.name as beneficiary_name,
        ar.phone,
        ar.address,
        vr.status as verification_status
      FROM video_verification_requests vvr
      JOIN aadhaar_registry ar ON vvr.aadhaar_id = ar.aadhaar_id
      JOIN verification_requests vr ON vvr.verification_request_id = vr.id
      WHERE vvr.status IN ('pending', 'in_progress')
      ORDER BY vvr.created_at DESC
      LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );

    // Get total count
    const [countResult] = await connection.query(
      `SELECT COUNT(*) as total FROM video_verification_requests 
       WHERE status IN ('pending', 'in_progress')`
    );

    connection.release();

    res.status(200).json({
      success: true,
      data: videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total
      }
    });
  } catch (error) {
    console.error('Get active video verifications error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Upload proof video for video verification (Admin)
 */
exports.uploadProofVideo = async (req, res) => {
  const { id } = req.params;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file uploaded'
      });
    }

    const connection = await pool.getConnection();

    // Get video verification details
    const [videos] = await connection.query(
      'SELECT id, status FROM video_verification_requests WHERE id = ?',
      [id]
    );

    if (videos.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Video verification request not found' });
    }

    // Build proof URL path
    const proofUrl = `/uploads/${req.file.filename}`;

    // Update video verification with proof
    await connection.query(
      'UPDATE video_verification_requests SET proof_url = ?, status = ? WHERE id = ?',
      [proofUrl, 'in_progress', id]
    );

    connection.release();

    res.status(200).json({
      success: true,
      message: 'Proof video uploaded successfully',
      data: {
        video_request_id: id,
        proof_url: proofUrl,
        status: 'in_progress'
      }
    });
  } catch (error) {
    console.error('Upload proof video error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Mark video for verification - moves to verifications tab (Admin)
 */
exports.markVideoForVerification = async (req, res) => {
  const { id } = req.params;
  const { outcome } = req.body;

  try {
    if (!['verified', 'failed'].includes(outcome)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid outcome. Must be "verified" or "failed"'
      });
    }

    const connection = await pool.getConnection();

    // Get video verification details
    const [videos] = await connection.query(
      'SELECT id, proof_url FROM video_verification_requests WHERE id = ?',
      [id]
    );

    if (videos.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Video verification request not found' });
    }

    // Only require proof for 'verified' outcome, not for 'failed'
    if (outcome === 'verified' && !videos[0].proof_url) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Proof video must be uploaded before marking as verified'
      });
    }

    // Set status to marked_for_verification with tentative outcome
    await connection.query(
      'UPDATE video_verification_requests SET status = ?, outcome = ? WHERE id = ?',
      ['marked_for_verification', outcome, id]
    );

    connection.release();

    res.status(200).json({
      success: true,
      message: 'Video marked for verification - moved to Verifications tab',
      data: {
        video_request_id: id,
        status: 'marked_for_verification',
        outcome: outcome
      }
    });
  } catch (error) {
    console.error('Mark video for verification error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Complete video verification (Admin) - finalizes from verifications tab
 */
exports.completeVideoVerification = async (req, res) => {
  const { id } = req.params;
  const { outcome, notes } = req.body;
  const adminUser = req.body.admin_user || 'admin';

  try {
    if (!['verified', 'failed'].includes(outcome)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid outcome. Must be "verified" or "failed"'
      });
    }

    const connection = await pool.getConnection();

    // Get video verification details
    const [videos] = await connection.query(
      'SELECT verification_request_id, aadhaar_id, proof_url FROM video_verification_requests WHERE id = ?',
      [id]
    );

    if (videos.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Video verification request not found' });
    }

    const { verification_request_id, aadhaar_id, proof_url } = videos[0];

    // Only require proof for 'verified' outcome, not for 'failed'
    if (outcome === 'verified' && !proof_url) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Proof video required to mark as verified'
      });
    }

    // Update video verification request
    await connection.query(
      `UPDATE video_verification_requests 
       SET status = 'completed', outcome = ?, completed_at = NOW(), admin_who_verified = ?, notes = ?
       WHERE id = ?`,
      [outcome, adminUser, notes || null, id]
    );

    // Update main verification status based on outcome
    if (outcome === 'verified') {
      // Mark verification as approved
      await connection.query(
        'UPDATE verification_requests SET status = ?, approved_by = ? WHERE id = ?',
        ['approved', adminUser, verification_request_id]
      );

      // Update beneficiary status to active
      await connection.query(
        'UPDATE beneficiaries SET status = ? WHERE aadhaar_id = ?',
        ['active', aadhaar_id]
      );
    } else if (outcome === 'failed') {
      // Mark verification as rejected
      await connection.query(
        'UPDATE verification_requests SET status = ? WHERE id = ?',
        ['rejected', verification_request_id]
      );
    }

    connection.release();

    res.status(200).json({
      success: true,
      message: `Video verification completed as ${outcome}`,
      data: {
        video_request_id: id,
        outcome: outcome,
        verification_status: outcome === 'verified' ? 'approved' : 'rejected'
      }
    });
  } catch (error) {
    console.error('Complete video verification error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get recommendation based on match score
 */
function getRecommendation(score) {
  if (score >= 80) return 'EXCELLENT - Strong facial match. Safe to approve.';
  if (score >= 70) return 'GOOD - Acceptable match. May require video verification.';
  if (score >= 50) return 'FAIR - Moderate match. Recommend video verification.';
  if (score >= 30) return 'WEAK - Poor match. Video verification required.';
  return 'REJECT - No facial match detected.';
}
