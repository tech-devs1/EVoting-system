const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const { verifyAuth, requireAdmin, requireSuperAdmin } = require('../middleware/auth');

// Branding/settings for the signed-in admin's tenant. Declared before /:id
// so 'branding' isn't captured as an id.
router.get('/branding', verifyAuth, requireAdmin, tenantController.getBranding);
router.post('/branding', verifyAuth, requireAdmin, tenantController.updateBranding);

// Public reads (controller strips sensitive fields like adminPassword).
router.get('/', tenantController.getTenants);
router.get('/:id', tenantController.getTenantById);

// Mutations are superadmin-only (previously completely unauthenticated).
router.post('/', verifyAuth, requireSuperAdmin, tenantController.createTenant);
router.put('/:id', verifyAuth, requireSuperAdmin, tenantController.updateTenant);
router.delete('/:id', verifyAuth, requireSuperAdmin, tenantController.deleteTenant);

module.exports = router;
