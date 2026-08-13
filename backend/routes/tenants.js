const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const { verifyAuth } = require('../middleware/auth');

router.get('/', tenantController.getTenants);
router.get('/:id', tenantController.getTenantById);
router.post('/', tenantController.createTenant);
router.put('/:id', tenantController.updateTenant);
router.delete('/:id', tenantController.deleteTenant);

module.exports = router;
