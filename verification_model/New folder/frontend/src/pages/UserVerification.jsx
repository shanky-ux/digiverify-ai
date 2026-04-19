import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { verificationService } from '../services/api';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/UserVerification.css';

function UserVerification() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [aadhaarId, setAadhaarId] = useState('');
  const [userData, setUserData] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [videoRoomUrl, setVideoRoomUrl] = useState(null);

  const handleAadhaarVerify = async () => {
    if (!aadhaarId || aadhaarId.length !== 12) {
      toast.error('Please enter a valid 12-digit Aadhaar ID');
      return;
    }

    setLoading(true);
    try {
      const response = await verificationService.verifyAadhaar(aadhaarId);
      setUserData(response.data.data);
      setStep(2);
      toast.success('Aadhaar verified successfully!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Aadhaar verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitVerification = async () => {
    if (!imageFile) {
      toast.error('Please select an image');
      return;
    }

    setLoading(true);
    try {
      const response = await verificationService.submitVerification(aadhaarId, imageFile);
      setVerificationResult(response.data.data);
      setStep(3);
      toast.success('Verification submitted successfully!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Verification submission failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setAadhaarId('');
    setUserData(null);
    setImageFile(null);
    setPreviewUrl('');
    setVerificationResult(null);
    setVideoRoomUrl(null);
  };

  const handleRequestVideoVerification = async () => {
    if (!verificationResult) return;

    setLoading(true);
    try {
      const response = await verificationService.requestVideoVerification(
        aadhaarId,
        verificationResult.request_id
      );
      setVideoRoomUrl(response.data.data.jitsi_room_link);
      toast.success('Video verification requested! Opening video room...');
      // Open Jitsi room in new window
      window.open(response.data.data.jitsi_room_link, 'VideoVerification', 'width=1024,height=768');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to request video verification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-verification">
      <ToastContainer position="top-right" autoClose={4000} />
      
      <div className="verification-container">
        <h1>Beneficiary Verification System</h1>
        <p className="subtitle">Verify your identity with Aadhaar and facial recognition</p>

        <div className="steps-indicator">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Verify Aadhaar</span>
          </div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Upload Image</span>
          </div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Result</span>
          </div>
        </div>

        {/* Step 1: Aadhaar Verification */}
        {step === 1 && (
          <div className="step-content">
            <h2>Step 1: Aadhaar Verification</h2>
            <p>Enter your 12-digit Aadhaar ID to get started</p>
            
            <div className="form-group">
              <label htmlFor="aadhaar">Aadhaar ID</label>
              <input
                type="text"
                id="aadhaar"
                placeholder="000000000000"
                maxLength="12"
                value={aadhaarId}
                onChange={(e) => setAadhaarId(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleAadhaarVerify}
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify Aadhaar'}
            </button>
          </div>
        )}

        {/* Step 2: Image Upload */}
        {step === 2 && userData && (
          <div className="step-content">
            <h2>Step 2: Upload Your Photo</h2>
            
            <div className="user-info">
              <div className="info-item">
                <label>Name:</label>
                <span>{userData.name}</span>
              </div>
              <div className="info-item">
                <label>Date of Birth:</label>
                <span>{new Date(userData.dob).toLocaleDateString('en-IN')}</span>
              </div>
              <div className="info-item">
                <label>Gender:</label>
                <span>{userData.gender}</span>
              </div>
              <div className="info-item">
                <label>Phone:</label>
                <span>{userData.phone}</span>
              </div>
            </div>

            <div className="image-upload-area">
              <div className="upload-box">
                {previewUrl ? (
                  <div className="image-preview">
                    <img src={previewUrl} alt="Selected" />
                  </div>
                ) : (
                  <>
                    <svg className="upload-icon" viewBox="0 0 24 24">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54h2.63l2.96-3.83 3.6 4.83h2.63L12.5 6.5z"/>
                    </svg>
                    <p>Click to upload your photo</p>
                    <span className="upload-hint">JPG or PNG image, max 10MB</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                  id="imageInput"
                  disabled={loading}
                />
              </div>
              <label htmlFor="imageInput" className="file-upload-label">
                Choose Image
              </label>
            </div>

            <div className="button-group">
              <button
                className="btn btn-secondary"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitVerification}
                disabled={loading || !imageFile}
              >
                {loading ? 'Submitting...' : 'Submit for Verification'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 3 && verificationResult && (
          <div className="step-content">
            <h2>Verification Results</h2>
            
            <div className={`result-card ${verificationResult.status}`}>
              <div className="result-header">
                <h3>Status: <span className={`status-badge ${verificationResult.status}`}>
                  {verificationResult.status.toUpperCase()}
                </span></h3>
              </div>

              <div className="result-details">
                <div className="detail-item">
                  <label>Match Score</label>
                  <div className="score-display">
                    <div className="score-bar">
                      <div
                        className="score-fill"
                        style={{ width: `${verificationResult.match_score}%` }}
                      ></div>
                    </div>
                    <span className="score-text">{verificationResult.match_score}%</span>
                  </div>
                </div>

                <div className="detail-item">
                  <label>Recommendation</label>
                  <p className="recommendation">{verificationResult.recommendation}</p>
                </div>

                {verificationResult.status === 'approved' && (
                  <div className="success-message">
                    ✓ Your verification has been approved!
                  </div>
                )}

                {verificationResult.status === 'pending' && (
                  <div className="pending-message">
                    ⏳ Your verification is under review. 
                  </div>
                )}

                {verificationResult.status === 'rejected' && (
                  <div className="error-message">
                    ✗ The facial match score is too low. Video verification will help us verify your identity.
                  </div>
                )}
              </div>

              <div className="video-verification-section">
                <h4>📹 Video Verification Required</h4>
                <p>For your security and to ensure accurate verification, please complete a live video verification with our admin.</p>
                <button
                  className="btn btn-video"
                  onClick={handleRequestVideoVerification}
                  disabled={loading}
                >
                  {loading ? 'Opening Video Room...' : '🎥 Request Video Verification'}
                </button>
                {videoRoomUrl && (
                  <p className="video-link-info">
                    Video room opened. If it didn't open automatically, <a href={videoRoomUrl} target="_blank" rel="noopener noreferrer">click here</a>
                  </p>
                )}
              </div>
            </div>

            <div className="button-group">
              <button className="btn btn-secondary" onClick={handleReset}>
                Start New Verification
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserVerification;
