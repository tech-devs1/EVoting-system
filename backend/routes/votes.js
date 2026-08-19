const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');
const { verifyAuth } = require('../middleware/auth');

router.post('/cast', verifyAuth, voteController.castVote);
router.get('/voted-elections', verifyAuth, voteController.getVotedElections);
router.get('/verify/:id', verifyAuth, voteController.verifyVote);

module.exports = router;
