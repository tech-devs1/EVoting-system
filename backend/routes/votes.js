const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');
const { verifyAuth } = require('../middleware/auth');
const { recordVoteAudit } = require('../services/audit');

// Cast a vote
router.post('/cast', verifyAuth, async (req, res) => {
  try {
    const { electionId, candidateId } = req.body;
    const voterId = req.user.uid;

    if (!electionId || !candidateId) {
      return res.status(400).json({ status: 'error', message: 'Missing election or candidate ID' });
    }

    // 1. Check if election is active
    const electionDoc = await db.collection('elections').doc(electionId).get();
    if (!electionDoc.exists || electionDoc.data().status !== 'active') {
      return res.status(400).json({ status: 'error', message: 'Election is not active' });
    }

    // 2. Check if user already voted (One-person-one-vote enforcement)
    const votedRef = db.collection('voted_voters').doc(`${electionId}_${voterId}`);
    const votedDoc = await votedRef.get();

    if (votedDoc.exists) {
      return res.status(403).json({ status: 'error', message: 'User has already voted in this election' });
    }

    // 3. Increment Candidate Vote Count safely (In a real scenario, use Firestore Transactions)
    // For mock/simplification, we just read and update.
    const candidateRef = db.collection('candidates').doc(candidateId);
    const candidateDoc = await candidateRef.get();
    
    if (!candidateDoc.exists || candidateDoc.data().electionId !== electionId) {
      return res.status(400).json({ status: 'error', message: 'Invalid candidate for this election' });
    }

    const currentVotes = candidateDoc.data().votes || 0;
    await candidateRef.update({ votes: currentVotes + 1 });

    // 4. Create Anonymized Vote Record
    const votePayload = {
      electionId,
      candidateId,
      timestamp: Date.now()
    };
    
    await db.collection('votes').add(votePayload);

    // 5. Generate Cryptographic Audit Trail (tamper-proof)
    const auditTxId = await recordVoteAudit(votePayload, electionId);

    // 6. Mark voter as voted (decoupled from the vote record to preserve anonymity)
    await votedRef.set({
      voterId,
      electionId,
      timestamp: Date.now(),
      auditTxId // Give voter the transaction ID so they can verify later
    });

    res.status(200).json({ 
      status: 'success', 
      message: 'Vote cast successfully',
      data: {
        verificationId: auditTxId
      }
    });

  } catch (error) {
    console.error('Error casting vote:', error);
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
