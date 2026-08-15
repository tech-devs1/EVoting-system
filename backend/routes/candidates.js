const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidateController');
const { verifyAuth, requireAdmin } = require('../middleware/auth');

router.get('/', candidateController.getCandidates);
router.get('/election', candidateController.getCandidates);
router.get('/election/:electionId', candidateController.getCandidates);
router.post('/', verifyAuth, requireAdmin, candidateController.createCandidate);
router.patch('/:id', verifyAuth, requireAdmin, candidateController.updateCandidate);
router.delete('/:id', verifyAuth, requireAdmin, candidateController.deleteCandidate);

module.exports = router;
