const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadminController');
const { verifyAuth } = require('../middleware/auth');

router.get('/stats', verifyAuth, superadminController.getStats);
router.get('/departments', verifyAuth, superadminController.getDepartments);
router.post('/departments', verifyAuth, superadminController.createDepartment);
router.patch('/departments/:id', verifyAuth, superadminController.updateDepartment);
router.delete('/departments/:id', verifyAuth, superadminController.deleteDepartment);

router.get('/onboarding-requests', verifyAuth, superadminController.getOnboardingRequests);
router.post('/onboarding-requests/:id/approve', verifyAuth, superadminController.approveOnboardingRequest);
router.post('/onboarding-requests/:id/reject', verifyAuth, superadminController.rejectOnboardingRequest);

module.exports = router;
