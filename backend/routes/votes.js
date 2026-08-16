const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');
const { verifyAuth } = require('../middleware/auth');

router.post('/cast', verifyAuth, voteController.castVote);
router.get('/voted-elections', verifyAuth, voteController.getVotedElections);
router.get('/user-votes', verifyAuth, voteController.getUserVotes);

module.exports = router;
