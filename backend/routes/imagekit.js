const express = require('express');
const router = express.Router();
const imagekitController = require('../controllers/imagekitController');

router.get('/auth', imagekitController.getAuthenticationParameters);
router.post('/upload', imagekitController.uploadImage);

module.exports = router;
