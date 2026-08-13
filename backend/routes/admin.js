const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyAuth, requireAdmin } = require('../middleware/auth');

router.get('/dashboard', verifyAuth, requireAdmin, adminController.getDashboardStats);
router.get('/dashboard-full', verifyAuth, requireAdmin, adminController.getDashboardFullStats);

module.exports = router;
