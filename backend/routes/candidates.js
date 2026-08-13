const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidateController');
const { verifyAuth, requireAdmin } = require('../middleware/auth');

router.get('/', candidateController.getCandidates);
router.post('/', verifyAuth, requireAdmin, candidateController.createCandidate);
router.delete('/:id', verifyAuth, requireAdmin, candidateController.deleteCandidate);

module.exports = router;
