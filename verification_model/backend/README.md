# Beneficiary Verification System - Backend

## Description
RESTful API for Aadhaar-based beneficiary verification with facial recognition capabilities.

## Features
- ✓ Aadhaar ID verification
- ✓ Image upload and facial matching
- ✓ Match scoring system
- ✓ Admin approval workflows
- ✓ Deceased person detection
- ✓ Dashboard analytics

## Setup

1. Copy `.env.example` to `.env` and update with your MySQL credentials:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=beneficiary_verification
PORT=5000
```

2. Install dependencies:
```bash
npm install
```

3. Import MySQL dump to create tables:
   - Run the SQL dump file in MySQL

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Verification Routes
- `POST /api/verification/verify-aadhaar` - Verify Aadhaar ID
- `POST /api/verification/submit-verification` - Submit image for verification
- `GET /api/verification/verification-status/:request_id` - Get verification status
- `GET /api/verification/all-verifications` - Get all verifications (Admin)
- `PUT /api/verification/approve-verification/:request_id` - Approve verification
- `PUT /api/verification/reject-verification/:request_id` - Reject verification

### Admin Routes
- `GET /api/admin/dashboard-stats` - Get dashboard statistics
- `GET /api/admin/beneficiaries` - Get all beneficiaries
- `GET /api/admin/beneficiary/:aadhaar_id` - Get beneficiary details
- `PUT /api/admin/update-beneficiary/:aadhaar_id` - Update beneficiary status
