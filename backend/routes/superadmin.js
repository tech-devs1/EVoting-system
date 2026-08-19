const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadminController');
const { verifyAuth, requireSuperAdmin } = require('../middleware/auth');

// Every route below requires an authenticated superadmin. Previously these
// only used verifyAuth, meaning any signed-in voter could read/write them.
const auth = [verifyAuth, requireSuperAdmin];

router.get('/stats', auth, superadminController.getStats);
router.get('/departments', auth, superadminController.getDepartments);
router.post('/departments', auth, superadminController.createDepartment);
router.patch('/departments/:id', auth, superadminController.updateDepartment);
router.delete('/departments/:id', auth, superadminController.deleteDepartment);

// Department admin management (kept in sync with the tenants.admins JSON list
// and the users table so secondary admins can sign in).
router.get('/departments/:id/admins', auth, superadminController.getDepartmentAdmins);
router.post('/departments/:id/admins', auth, superadminController.addDepartmentAdmin);
router.patch('/departments/:id/admins/:adminId', auth, superadminController.updateDepartmentAdmin);
router.delete('/departments/:id/admins/:adminId', auth, superadminController.removeDepartmentAdmin);

router.get('/onboarding-requests', auth, superadminController.getOnboardingRequests);
router.post('/onboarding-requests/:id/approve', auth, superadminController.approveOnboardingRequest);
router.post('/onboarding-requests/:id/reject', auth, superadminController.rejectOnboardingRequest);

router.get('/audit', auth, superadminController.getAuditLogs);
router.get('/audit/pdf', auth, superadminController.downloadAuditPDF);
router.get('/audit/pdf/:tenantId', auth, superadminController.downloadAuditPDF);

module.exports = router;
