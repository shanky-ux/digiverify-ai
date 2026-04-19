import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Verification Services
export const verificationService = {
  verifyAadhaar: (aadhaarId) =>
    api.post('/verification/verify-aadhaar', { aadhaar_id: aadhaarId }),

  submitVerification: (aadhaarId, imageFile) => {
    const formData = new FormData();
    formData.append('aadhaar_id', aadhaarId);
    formData.append('image', imageFile);
    return api.post('/verification/submit-verification', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  getVerificationStatus: (requestId) =>
    api.get(`/verification/verification-status/${requestId}`),

  getAllVerifications: (status, page, limit) =>
    api.get('/verification/all-verifications', {
      params: { status, page, limit }
    }),

  approveVerification: (requestId, approvedBy) =>
    api.put(`/verification/approve-verification/${requestId}`, { approved_by: approvedBy }),

  rejectVerification: (requestId, reason) =>
    api.put(`/verification/reject-verification/${requestId}`, { reason }),

  requestVideoVerification: (aadhaarId, requestId) =>
    api.post(`/verification/request-video-verification`, { aadhaar_id: aadhaarId, request_id: requestId }),

  getActiveVideoVerifications: (page, limit) =>
    api.get('/verification/active-video-verifications', { params: { page, limit } }),

  uploadProofVideo: (videoRequestId, videoFile) => {
    const formData = new FormData();
    formData.append('proof_video', videoFile);
    return api.post(`/verification/upload-proof-video/${videoRequestId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  markVideoForVerification: (videoRequestId, outcome) =>
    api.post(`/verification/mark-video-for-verification/${videoRequestId}`, { outcome }),

  completeVideoVerification: (videoRequestId, outcome, notes) =>
    api.put(`/verification/complete-video-verification/${videoRequestId}`, { outcome, notes })
};

// Admin Services
export const adminService = {
  getDashboardStats: () =>
    api.get('/admin/dashboard-stats'),

  getAllVerifications: (status, page, limit) =>
    api.get('/verification/all-verifications', {
      params: { status, page, limit }
    }),

  getAllBeneficiaries: (status, page, limit) =>
    api.get('/admin/beneficiaries', {
      params: { status, page, limit }
    }),

  getBeneficiaryDetail: (aadhaarId) =>
    api.get(`/admin/beneficiary/${aadhaarId}`),

  updateBeneficiaryStatus: (aadhaarId, status) =>
    api.put(`/admin/update-beneficiary/${aadhaarId}`, { status }),

  getActiveVideoVerifications: (page, limit) =>
    api.get('/verification/active-video-verifications', { params: { page, limit } }),

  uploadProofVideo: (videoRequestId, videoFile) => {
    const formData = new FormData();
    formData.append('proof_video', videoFile);
    return api.post(`/verification/upload-proof-video/${videoRequestId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  markVideoForVerification: (videoRequestId, outcome) =>
    api.post(`/verification/mark-video-for-verification/${videoRequestId}`, { outcome }),

  completeVideoVerification: (videoRequestId, outcome, notes) =>
    api.put(`/verification/complete-video-verification/${videoRequestId}`, { outcome, notes })
};

// Health check
export const healthCheck = () => api.get('/verification/../health');

export default api;
