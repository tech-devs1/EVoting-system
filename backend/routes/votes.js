const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');
const { verifyAuth } = require('../middleware/auth');

router.post('/cast', verifyAuth, voteController.castVote);

module.exports = router;
