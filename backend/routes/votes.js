const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');
const { verifyAuth } = require('../middleware/auth');
const { recordVoteAudit } = require('../services/audit');
const { logFraudAlert } = require('../services/fraud');

// Get list of election IDs the current user has voted in
router.get('/voted-elections', verifyAuth, async (req, res) => {
  try {
    const voterId = req.user.uid;
    const snapshot = await db.collection('voted_voters').where('voterId', '==', voterId).get();
    
    const votedElectionIds = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.electionId) {
        votedElectionIds.add(data.electionId);
      }
    });

    res.status(200).json({ status: 'success', data: Array.from(votedElectionIds) });
  } catch (error) {
    console.error('Error fetching voted elections:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch voted status' });
  }
});

// Cast a vote
router.post('/cast', verifyAuth, async (req, res) => {
  try {
    const { electionId, candidateId } = req.body;
    const voterId = req.user.uid;

    console.log('[Cast Vote] Vote attempt:', { electionId, candidateId, voterId });

    if (!electionId || !candidateId) {
      return res.status(400).json({ status: 'error', message: 'Missing election or candidate ID' });
    }

    // 1. Check if election is active
    const electionDoc = await db.collection('elections').doc(electionId).get();
    if (!electionDoc.exists || electionDoc.data().status !== 'active') {
      return res.status(400).json({ status: 'error', message: 'Election is not active' });
    }

    // 2. Fetch candidate and verify it belongs to this election
    const candidateRef = db.collection('candidates').doc(candidateId);
    const candidateDoc = await candidateRef.get();
    if (!candidateDoc.exists || candidateDoc.data().electionId !== electionId) {
      return res.status(400).json({ status: 'error', message: 'Invalid candidate for this election' });
    }
    const position = candidateDoc.data().position || 'General';
    const positionKey = position.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // 3. Check if user already voted in this category/position (One-person-one-vote per category)
    const votedRef = db.collection('voted_voters').doc(`${electionId}_${voterId}_${positionKey}`);
    const votedDoc = await votedRef.get();

    if (votedDoc.exists) {
      console.log('[Cast Vote] User already voted for position:', position);
      // Log fraud alert for duplicate voting attempt in the same category
      await logFraudAlert('DUPLICATE_VOTE', `Voter tried to vote twice in the same category (${position})`, { voterId, electionId, candidateId, position });
      return res.status(403).json({ status: 'error', message: `User has already voted for position ${position} in this election` });
    }

    // 4. Increment Candidate Vote Count safely
    const currentVotes = candidateDoc.data().votes || 0;
    console.log('[Cast Vote] Current votes before increment:', currentVotes);
    await candidateRef.update({ votes: currentVotes + 1 });
    console.log('[Cast Vote] Votes incremented to:', currentVotes + 1);

    // 5. Create Anonymized Vote Record
    const votePayload = {
      electionId,
      candidateId,
      position,
      timestamp: Date.now()
    };
    await db.collection('votes').add(votePayload);

    // 6. Generate Cryptographic Audit Trail (tamper-proof)
    const candidateName = candidateDoc.data().name || '';
    const auditTxId = await recordVoteAudit(votePayload, electionId, { candidateName, position });

    // 7. Mark voter as voted for this position
    await votedRef.set({
      voterId,
      electionId,
      position,
      timestamp: Date.now(),
      auditTxId
    });

    console.log('[Cast Vote] Vote cast successfully:', { voterId, candidateId, position, newVoteCount: currentVotes + 1 });

    res.status(200).json({ 
      status: 'success', 
      message: 'Vote cast successfully',
      data: {
        verificationId: auditTxId
      }
    });

  } catch (error) {
    console.error('[Cast Vote] Error casting vote:', error);
    res.status(500).json({ status: 'error', message: 'Failed to cast vote' });
  }
});

// Verify a vote (Public / Voter)
router.get('/verify/:auditTxId', async (req, res) => {
  try {
    const { auditTxId } = req.params;
    const auditDoc = await db.collection('audit_logs').doc(auditTxId).get();

    if (!auditDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Verification record not found' });
    }

    // Return the anonymized audit record
    res.status(200).json({ status: 'success', data: auditDoc.data() });
  } catch (error) {
    console.error('Error verifying vote:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify vote' });
  }
});

module.exports = router;
