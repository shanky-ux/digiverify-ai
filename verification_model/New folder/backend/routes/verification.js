const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const verificationController = require('../controllers/verificationController');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG and PNG images are allowed'), false);
  }
};

const videoFilter = (req, file, cb) => {
  const allowedVideoMimes = ['video/mp4', 'video/mpeg', 'video/quicktime'];
  if (allowedVideoMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only MP4, MPEG, and MOV video formats are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const uploadVideo = multer({
  storage,
  fileFilter: videoFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for videos
});

// Routes
router.post('/verify-aadhaar', verificationController.verifyAadhaar);
router.post('/submit-verification', upload.single('image'), verificationController.submitVerification);
router.get('/verification-status/:request_id', verificationController.getVerificationStatus);
router.get('/all-verifications', verificationController.getAllVerifications);
router.put('/approve-verification/:request_id', verificationController.approveVerification);
router.put('/reject-verification/:request_id', verificationController.rejectVerification);

// Video conference routes
router.post('/initiate-video-call/:request_id', verificationController.initiateVideoCall);
router.put('/record-video-result/:request_id', verificationController.recordVideoCallResult);
router.get('/video-call-details/:request_id', verificationController.getVideoCallDetails);

// User-initiated video verification routes
router.post('/request-video-verification', verificationController.requestVideoVerification);
router.get('/active-video-verifications', verificationController.getActiveVideoVerifications);
router.post('/upload-proof-video/:id', uploadVideo.single('proof_video'), verificationController.uploadProofVideo);
router.post('/mark-video-for-verification/:id', verificationController.markVideoForVerification);
router.put('/complete-video-verification/:id', verificationController.completeVideoVerification);

module.exports = router;
