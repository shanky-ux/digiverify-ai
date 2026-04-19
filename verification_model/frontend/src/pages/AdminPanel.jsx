import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/api';
import { toast } from 'react-toastify';
import '../styles/AdminPanel.css';

function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [verifications, setVerifications] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [activeVideoVerifications, setActiveVideoVerifications] = useState([]);
  const [selectedVideoRequest, setSelectedVideoRequest] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  const LIMIT = 10;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardStats();
    } else if (activeTab === 'verifications') {
      loadVerifications();
    } else if (activeTab === 'beneficiaries') {
      loadBeneficiaries();
    } else if (activeTab === 'video-verifications') {
      loadActiveVideoVerifications();
    }
  }, [activeTab, page]);

  // Auto-refresh active video verifications every 5 seconds
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === 'video-verifications') {
      const interval = setInterval(() => {
        loadActiveVideoVerifications();
      }, 5000); // 5 seconds
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const loadDashboardStats = async () => {
    try {
      const response = await adminService.getDashboardStats();
      setStats(response.data.data);
    } catch (error) {
      toast.error('Failed to load dashboard stats');
    }
  };

  const loadVerifications = async () => {
    setLoading(true);
    try {
      console.log('🔄 Loading verifications with status filter:', statusFilter, 'page:', page);
      const response = await adminService.getAllVerifications(statusFilter, page, LIMIT);
      console.log('✓ Verifications API Response:', response.data);
      console.log('✓ Data records:', response.data.data);
      setVerifications(response.data.data || []);
    } catch (error) {
      console.error('Error loading verifications:', error);
      toast.error('Failed to load verifications: ' + (error.message || 'Unknown error'));
      setVerifications([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBeneficiaries = async () => {
    setLoading(true);
    try {
      const response = await adminService.getAllBeneficiaries('', page, LIMIT);
      console.log('Beneficiaries loaded:', response.data);
      setBeneficiaries(response.data.data || []);
    } catch (error) {
      console.error('Error loading beneficiaries:', error);
      toast.error('Failed to load beneficiaries');
      setBeneficiaries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveVerification = async (requestId) => {
    try {
      await adminService.approveVerification(requestId, 'Admin Approved');
      toast.success('Verification approved');
      loadVerifications();
    } catch (error) {
      toast.error('Failed to approve verification');
    }
  };

  const handleRejectVerification = async (requestId) => {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
      try {
        await adminService.rejectVerification(requestId, reason);
        toast.success('Verification rejected');
        loadVerifications();
      } catch (error) {
        toast.error('Failed to reject verification');
      }
    }
  };

  const loadActiveVideoVerifications = async () => {
    setLoading(true);
    try {
      const response = await adminService.getActiveVideoVerifications(page, LIMIT);
      console.log('Active video verifications loaded:', response.data);
      setActiveVideoVerifications(response.data.data || []);
    } catch (error) {
      console.error('Error loading active video verifications:', error);
      toast.error('Failed to load active video verifications');
      setActiveVideoVerifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinVideoVerification = (videoRequest) => {
    // Open Jitsi room in new window
    window.open(videoRequest.jitsi_room_link, 'VideoVerification', 'width=1024,height=768');
    // Set this as selected for proof upload
    setSelectedVideoRequest(videoRequest);
  };

  const handleProofFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate video file (MP4 only, under 50MB)
      if (!['video/mp4', 'video/mpeg', 'video/quicktime'].includes(file.type)) {
        toast.error('Only MP4, MPEG, and MOV video files are allowed');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Video file must be under 50MB');
        return;
      }
      setProofFile(file);
    }
  };

  const handleUploadProof = async (videoRequestId) => {
    if (!proofFile) {
      toast.error('Please select a video proof file');
      return;
    }

    setUploadingProof(true);
    try {
      await adminService.uploadProofVideo(videoRequestId, proofFile);
      toast.success('Proof video uploaded successfully');
      setProofFile(null);
    } catch (error) {
      console.error('Error uploading proof video:', error);
      toast.error('Failed to upload proof video');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleMarkVideoForVerification = async (videoRequestId, outcome) => {
    // Verified requires proof, failed doesn't
    if (outcome === 'verified' && !proofFile && !selectedVideoRequest?.proof_url) {
      toast.error('Proof video must be uploaded to mark as verified');
      return;
    }

    setLoading(true);
    try {
      console.log(`📤 Submitting video verification: ${outcome} for video ID ${videoRequestId}`);
      // Call completeVideoVerification - this records the FINAL result in the system
      // Admin panel is the ONLY place where final results are finalized
      await adminService.completeVideoVerification(videoRequestId, outcome, `Verified by admin`);
      toast.success(`✅ Video verification ${outcome} - result recorded in system`);
      setSelectedVideoRequest(null);
      setProofFile(null);
      
      // Refresh data and switch tabs
      setPage(1); // Reset to first page
      console.log('🔄 Switching to verifications tab and loading fresh data...');
      
      // Load fresh verification data first, THEN switch tab
      await adminService.getAllVerifications('', 1, LIMIT).then(response => {
        console.log('✓ Fresh verification data loaded:', response.data.data);
        setVerifications(response.data.data || []);
      });
      
      // Now switch the tab
      setActiveTab('verifications');
      console.log('✓ Switched to verifications tab');
    } catch (error) {
      console.error('❌ Error marking video for verification:', error);
      toast.error('Failed to mark video for verification: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <button className="logout-btn" onClick={() => navigate('/')}>
          Back to User Portal
        </button>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => { setActiveTab('dashboard'); setPage(1); }}
        >
          Dashboard
        </button>
        <button
          className={`tab ${activeTab === 'video-verifications' ? 'active' : ''}`}
          onClick={() => { setActiveTab('video-verifications'); setPage(1); }}
        >
          Active Video Verifications
        </button>
        <button
          className={`tab ${activeTab === 'verifications' ? 'active' : ''}`}
          onClick={() => { setActiveTab('verifications'); setPage(1); }}
        >
          Verifications
        </button>
        <button
          className={`tab ${activeTab === 'beneficiaries' ? 'active' : ''}`}
          onClick={() => { setActiveTab('beneficiaries'); setPage(1); }}
        >
          Beneficiaries
        </button>
      </div>

      {/* Active Video Verifications Tab */}
      {activeTab === 'video-verifications' && (
        <div className="video-verifications-content">
          {loading ? (
            <p>Loading active video verifications...</p>
          ) : activeVideoVerifications.length === 0 ? (
            <div className="no-data">
              <p>No active video verifications at the moment</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="video-verifications-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Aadhaar</th>
                      <th>Status</th>
                      <th>Requested At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeVideoVerifications.map((v) => (
                      <React.Fragment key={v.video_request_id}>
                        <tr className={`status-${v.status}`}>
                          <td>#{v.video_request_id}</td>
                          <td>{v.beneficiary_name || 'N/A'}</td>
                          <td>{v.aadhaar_id}</td>
                          <td>
                            <span className={`badge badge-${v.status}`}>
                              {v.status === 'pending' ? 'Waiting' : v.status === 'in_progress' ? 'In Progress' : 'Proof Uploaded'}
                            </span>
                          </td>
                          <td>{new Date(v.created_at).toLocaleString('en-IN')}</td>
                          <td>
                            <button
                              className="action-btn join"
                              onClick={() => handleJoinVideoVerification(v)}
                            >
                              Join Now
                            </button>
                            {selectedVideoRequest?.video_request_id === v.video_request_id && (
                              <button
                                className="action-btn-secondary"
                                onClick={() => setSelectedVideoRequest(null)}
                              >
                                Close Proof
                              </button>
                            )}
                          </td>
                        </tr>
                        {selectedVideoRequest?.video_request_id === v.video_request_id && (
                          <tr className="proof-upload-row">
                            <td colSpan="6">
                              <div className="proof-upload-section">
                                <h4>Upload Proof Video (10 seconds)</h4>
                                <p>Record a short 10-second video of the video conversation as proof</p>
                                
                                <div className="proof-upload-area">
                                  <input 
                                    type="file"
                                    id={`proof-file-${v.video_request_id}`}
                                    accept="video/mp4,video/mpeg,video/quicktime"
                                    onChange={handleProofFileChange}
                                    disabled={uploadingProof}
                                  />
                                  <label htmlFor={`proof-file-${v.video_request_id}`} className="proof-label">
                                    Click to select video (MP4, max 50MB)
                                  </label>
                                  {proofFile && <p className="proof-file-name">Selected: {proofFile.name}</p>}
                                  
                                  <button
                                    className="btn-upload-proof"
                                    onClick={() => handleUploadProof(v.video_request_id)}
                                    disabled={!proofFile || uploadingProof}
                                  >
                                    {uploadingProof ? 'Uploading...' : 'Upload Proof'}
                                  </button>
                                </div>

                                {v.proof_url && (
                                  <div className="proof-status">
                                    <p>Proof video uploaded</p>
                                    <div className="proof-actions">
                                      <button
                                        className="action-btn verify-success"
                                        onClick={() => handleMarkVideoForVerification(v.video_request_id, 'verified')}
                                        disabled={loading}
                                      >
                                        Mark as Verified
                                      </button>
                                      <button
                                        className="action-btn verify-fail"
                                        onClick={() => handleMarkVideoForVerification(v.video_request_id, 'failed')}
                                        disabled={loading}
                                      >
                                        Mark as Not Verified
                                      </button>
                                    </div>  
                                  </div>
                                )}
                                {!v.proof_url && (
                                  <div className="proof-status proof-pending">
                                    <p>Upload proof to mark as verified, or click Not Verified without proof</p>
                                    <div className="proof-actions">
                                      <button
                                        className="action-btn verify-success"
                                        disabled={true}
                                        title="Upload proof video first"
                                      >
                                        Mark as Verified (requires proof)
                                      </button>
                                      <button
                                        className="action-btn verify-fail"
                                        onClick={() => handleMarkVideoForVerification(v.video_request_id, 'failed')}
                                        disabled={loading}
                                      >
                                        Mark as Not Verified
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </button>
                <span>Page {page}</span>
                <button onClick={() => setPage(p => p + 1)}>
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && stats && (
        <div className="dashboard-content">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Beneficiaries</h3>
              <div className="stat-value">{stats.beneficiaries.total}</div>
              <p className="stat-label">Active: {stats.beneficiaries.active}</p>
            </div>
            <div className="stat-card">
              <h3>Total Verifications</h3>
              <div className="stat-value">{stats.verifications.total}</div>
              <p className="stat-label">Pending: {stats.verifications.pending}</p>
            </div>
            <div className="stat-card">
              <h3>Approved</h3>
              <div className="stat-value success">{stats.verifications.approved}</div>
              <p className="stat-label">Completed</p>
            </div>
            <div className="stat-card">
              <h3>Rejected</h3>
              <div className="stat-value danger">{stats.verifications.rejected}</div>
              <p className="stat-label">Failed Match</p>
            </div>
            <div className="stat-card">
              <h3>Avg Match Score</h3>
              <div className="stat-value">{stats.metrics.averageMatchScore}%</div>
              <p className="stat-label">Accuracy</p>
            </div>
            <div className="stat-card">
              <h3>Deceased Records</h3>
              <div className="stat-value">{stats.metrics.deceasedRecords}</div>
              <p className="stat-label">Flagged</p>
            </div>
          </div>

          <div className="status-breakdown">
            <h3>Verification Status Breakdown</h3>
            <div className="status-items">
              <div className="status-item">
                <span className="status-label">Pending</span>
                <div className="status-bar">
                  <div className="bar pending" style={{width: `${(stats.verifications.pending / stats.verifications.total * 100) || 0}%`}}></div>
                </div>
                <span className="status-count">{stats.verifications.pending}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Approved</span>
                <div className="status-bar">
                  <div className="bar approved" style={{width: `${(stats.verifications.approved / stats.verifications.total * 100) || 0}%`}}></div>
                </div>
                <span className="status-count">{stats.verifications.approved}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Rejected</span>
                <div className="status-bar">
                  <div className="bar rejected" style={{width: `${(stats.verifications.rejected / stats.verifications.total * 100) || 0}%`}}></div>
                </div>
                <span className="status-count">{stats.verifications.rejected}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verifications Tab */}
      {activeTab === 'verifications' && (
        <div className="verifications-content">
          <div className="filter-bar">
            <label htmlFor="statusFilter">Filter by Status:</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {loading ? (
            <p>Loading verifications...</p>
          ) : verifications.length === 0 ? (
            <div className="no-data">
              <p>No verifications found</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="verifications-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Aadhaar</th>
                      <th>Match Score</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((v) => (
                      <tr key={v.id}>
                        <td>#{v.id}</td>
                        <td>{v.name || 'N/A'}</td>
                        <td>{v.aadhaar_id}</td>
                        <td>{v.match_score}%</td>
                        <td>
                          <span className={`badge badge-${v.status}`}>
                            {v.status.toUpperCase()}
                          </span>
                        </td>
                        <td>{new Date(v.created_at).toLocaleDateString('en-IN')}</td>
                        <td>
                          {v.status === 'pending' && (
                            <>
                              <button
                                className="action-btn approve"
                                onClick={() => handleApproveVerification(v.id)}
                              >
                                Approve
                              </button>
                              <button
                                className="action-btn reject"
                                onClick={() => handleRejectVerification(v.id)}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {v.status !== 'pending' && <span>-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </button>
                <span>Page {page}</span>
                <button onClick={() => setPage(p => p + 1)}>
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Beneficiaries Tab */}
      {activeTab === 'beneficiaries' && (
        <div className="beneficiaries-content">
          {loading ? (
            <p>Loading beneficiaries...</p>
          ) : (
            <>
              <div className="table-container">
                <table className="beneficiaries-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Aadhaar</th>
                      <th>DOB</th>
                      <th>Phone</th>
                      <th>Scheme</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {beneficiaries.map((b) => (
                      <tr key={b.id}>
                        <td>{b.name}</td>
                        <td>{b.aadhaar_id}</td>
                        <td>{new Date(b.dob).toLocaleDateString('en-IN')}</td>
                        <td>{b.phone}</td>
                        <td>{b.scheme_id}</td>
                        <td>
                          <span className={`badge badge-${b.status}`}>
                            {b.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <button
                            className="action-btn view"
                            onClick={() => navigate(`/admin/beneficiary/${b.aadhaar_id}`)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </button>
                <span>Page {page}</span>
                <button onClick={() => setPage(p => p + 1)}>
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
