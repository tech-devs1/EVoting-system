const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadminController');
const { verifyAuth, requireAdmin } = require('../middleware/auth');

router.get('/stats', verifyAuth, superadminController.getStats);
router.get('/departments', verifyAuth, superadminController.getDepartments);
router.get('/onboarding-requests', verifyAuth, superadminController.getOnboardingRequests);
router.post('/onboarding-requests/:id/approve', verifyAuth, superadminController.approveOnboardingRequest);
router.post('/onboarding-requests/:id/reject', verifyAuth, superadminController.rejectOnboardingRequest);

module.exports = router;
