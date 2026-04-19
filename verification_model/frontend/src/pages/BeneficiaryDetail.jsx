import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../services/api';
import { toast } from 'react-toastify';
import '../styles/BeneficiaryDetail.css';

function BeneficiaryDetail() {
  const { aadhaarId } = useParams();
  const navigate = useNavigate();
  const [beneficiary, setBeneficiary] = useState(null);
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBeneficiaryData();
  }, [aadhaarId]);

  const loadBeneficiaryData = async () => {
    try {
      const response = await adminService.getBeneficiaryDetail(aadhaarId);
      setBeneficiary(response.data.data.beneficiary);
      setVerifications(response.data.data.verifications);
    } catch (error) {
      toast.error('Failed to load beneficiary data');
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading beneficiary details...</div>;
  if (!beneficiary) return <div className="error">Beneficiary not found</div>;

  return (
    <div className="beneficiary-detail">
      <button className="back-btn" onClick={() => navigate('/admin')}>
        ← Back to Admin Panel
      </button>

      <div className="detail-container">
        <div className="detail-header">
          <h1>{beneficiary.name}</h1>
          <span className={`status-badge badge-${beneficiary.status}`}>
            {beneficiary.status.toUpperCase()}
          </span>
        </div>

        <div className="detail-grid">
          <div className="detail-section">
            <h2>Personal Information</h2>
            <div className="info-list">
              <div className="info-row">
                <label>Aadhaar ID</label>
                <span>{beneficiary.aadhaar_id}</span>
              </div>
              <div className="info-row">
                <label>Full Name</label>
                <span>{beneficiary.name}</span>
              </div>
              <div className="info-row">
                <label>Date of Birth</label>
                <span>{new Date(beneficiary.dob).toLocaleDateString('en-IN')}</span>
              </div>
              <div className="info-row">
                <label>Gender</label>
                <span>{beneficiary.gender}</span>
              </div>
              <div className="info-row">
                <label>Phone</label>
                <span>{beneficiary.phone}</span>
              </div>
              <div className="info-row">
                <label>Address</label>
                <span>{beneficiary.address}</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h2>Beneficiary Information</h2>
            <div className="info-list">
              <div className="info-row">
                <label>Scheme ID</label>
                <span>{beneficiary.scheme_id}</span>
              </div>
              <div className="info-row">
                <label>Enrollment Date</label>
                <span>{new Date(beneficiary.enrollment_date).toLocaleDateString('en-IN')}</span>
              </div>
              <div className="info-row">
                <label>Status</label>
                <span>{beneficiary.status}</span>
              </div>
              <div className="info-row">
                <label>Last Updated</label>
                <span>{new Date(beneficiary.updated_at).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        {beneficiary.aadhaar_image_path && (
          <div className="document-section">
            <h2>Aadhaar Image</h2>
            <div className="image-display">
              <img src={`http://localhost:5000/${beneficiary.aadhaar_image_path}`} alt="Aadhaar" />
            </div>
          </div>
        )}

        <div className="verification-history">
          <h2>Verification History</h2>
          {verifications.length === 0 ? (
            <p className="no-data">No verification requests yet</p>
          ) : (
            <div className="table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Match Score</th>
                    <th>Status</th>
                    <th>Image</th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.map((v) => (
                    <tr key={v.id}>
                      <td>#{v.id}</td>
                      <td>{new Date(v.created_at).toLocaleDateString('en-IN')}</td>
                      <td>{v.match_score}%</td>
                      <td>
                        <span className={`badge badge-${v.status}`}>
                          {v.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {v.uploaded_image_path && (
                          <a href={`http://localhost:5000/${v.uploaded_image_path}`} target="_blank" rel="noopener noreferrer">
                            View
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BeneficiaryDetail;
