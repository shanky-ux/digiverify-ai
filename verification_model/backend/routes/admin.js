const express = require('express');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.get('/dashboard-stats', adminController.getDashboardStats);
router.get('/beneficiaries', adminController.getAllBeneficiaries);
router.get('/beneficiary/:aadhaar_id', adminController.getBeneficiaryDetail);
router.put('/update-beneficiary/:aadhaar_id', adminController.updateBeneficiaryStatus);

module.exports = router;
