const pool = require('../db');

/**
 * Get dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Total beneficiaries
    const [totalBeneficiaries] = await connection.query(
      'SELECT COUNT(*) as count FROM beneficiaries'
    );

    // Active beneficiaries
    const [activeBeneficiaries] = await connection.query(
      'SELECT COUNT(*) as count FROM beneficiaries WHERE status = "active"'
    );

    // Total verifications
    const [totalVerifications] = await connection.query(
      'SELECT COUNT(*) as count FROM verification_requests'
    );

    // Pending verifications
    const [pendingVerifications] = await connection.query(
      'SELECT COUNT(*) as count FROM verification_requests WHERE status = "pending"'
    );

    // Approved verifications
    const [approvedVerifications] = await connection.query(
      'SELECT COUNT(*) as count FROM verification_requests WHERE status = "approved"'
    );

    // Rejected verifications
    const [rejectedVerifications] = await connection.query(
      'SELECT COUNT(*) as count FROM verification_requests WHERE status = "rejected"'
    );

    // Average match score
    const [avgMatchScore] = await connection.query(
      'SELECT AVG(match_score) as average FROM verification_requests WHERE status != "pending"'
    );

    // Deceased records
    const [deceasedCount] = await connection.query(
      'SELECT COUNT(*) as count FROM death_certificates'
    );

    connection.release();

    res.status(200).json({
      success: true,
      data: {
        beneficiaries: {
          total: totalBeneficiaries[0].count,
          active: activeBeneficiaries[0].count
        },
        verifications: {
          total: totalVerifications[0].count,
          pending: pendingVerifications[0].count,
          approved: approvedVerifications[0].count,
          rejected: rejectedVerifications[0].count
        },
        metrics: {
          averageMatchScore: Math.round(avgMatchScore[0].average || 0),
          deceasedRecords: deceasedCount[0].count
        }
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get all beneficiaries
 */
exports.getAllBeneficiaries = async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = `SELECT b.*, ar.name, ar.dob, ar.phone 
                 FROM beneficiaries b
                 JOIN aadhaar_registry ar ON b.aadhaar_id = ar.aadhaar_id`;
    const params = [];

    if (status) {
      query += ' WHERE b.status = ?';
      params.push(status);
    }

    query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(query, params);
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM beneficiaries ${status ? 'WHERE status = ?' : ''}`,
      status ? [status] : []
    );

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
    console.error('Get beneficiaries error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Get beneficiary details
 */
exports.getBeneficiaryDetail = async (req, res) => {
  const { aadhaar_id } = req.params;

  try {
    const [beneficiary] = await pool.query(
      `SELECT b.*, ar.* FROM beneficiaries b
       JOIN aadhaar_registry ar ON b.aadhaar_id = ar.aadhaar_id
       WHERE b.aadhaar_id = ?`,
      [aadhaar_id]
    );

    if (beneficiary.length === 0) {
      return res.status(404).json({ success: false, error: 'Beneficiary not found' });
    }

    // Get verification history
    const [verifications] = await pool.query(
      'SELECT * FROM verification_requests WHERE aadhaar_id = ? ORDER BY created_at DESC',
      [aadhaar_id]
    );

    res.status(200).json({
      success: true,
      data: {
        beneficiary: beneficiary[0],
        verifications
      }
    });
  } catch (error) {
    console.error('Get beneficiary detail error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Update beneficiary status
 */
exports.updateBeneficiaryStatus = async (req, res) => {
  const { aadhaar_id } = req.params;
  const { status } = req.body;

  try {
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    await pool.query(
      'UPDATE beneficiaries SET status = ? WHERE aadhaar_id = ?',
      [status, aadhaar_id]
    );

    res.status(200).json({
      success: true,
      message: 'Beneficiary status updated'
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
