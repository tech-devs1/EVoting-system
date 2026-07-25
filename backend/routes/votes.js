[7/25/2026 2:58 PM] Sheriff: const express = require('express');
const router = express.Router();
const { db, admin } = require('../services/firebase');
const { verifyAuth } = require('../middleware/auth');
const { recordVoteAudit } = require('../services/audit');
const { logFraudAlert } = require('../services/fraud');

// Get list of election IDs the current user has voted in
router.get('/voted-elections', verifyAuth, async (req, res) => {
  try {
    const voterId = req.user.uid;
    // Selective retrieval to minimize network bandwidth
    const snapshot = await db.collection('voted_voters')
      .where('voterId', '==', voterId)
      .select('electionId')
      .get();
    
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

// Cast a vote (ATOMIC TRANSACTION & HIGH CONCURRENCY READY)
router.post('/cast', verifyAuth, async (req, res) => {
  try {
    let { electionId, candidateId, choice } = req.body;
    const voterId = req.user.uid;

    if (candidateId && (candidateId.endsWith(':yes') || candidateId.endsWith(':no'))) {
      const parts = candidateId.split(':');
      candidateId = parts[0];
      choice = parts[1];
    }

    console.log('[Cast Vote] Vote attempt:', { electionId, candidateId, choice, voterId });

    if (!electionId || !candidateId) {
      return res.status(400).json({ status: 'error', message: 'Missing election or candidate ID' });
    }

    // 1. Check if election is active and within valid time window
    const electionDoc = await db.collection('elections').doc(electionId).get();
    if (!electionDoc.exists || electionDoc.data().status !== 'active') {
      return res.status(400).json({ status: 'error', message: 'Election is not active' });
    }

    const electionData = electionDoc.data();
    const now = Date.now();
    if (electionData.startDate && now < new Date(electionData.startDate).getTime()) {
      return res.status(400).json({ status: 'error', message: 'Voting for this election has not started yet.' });
    }
    if (electionData.endDate && now > new Date(electionData.endDate).getTime()) {
      return res.status(400).json({ status: 'error', message: 'Voting duration for this election has expired.' });
    }

    // Pre-calculate references
    const candidateRef = db.collection('candidates').doc(candidateId);
    const candidateDoc = await candidateRef.get();
    if (!candidateDoc.exists || candidateDoc.data().electionId !== electionId) {
      return res.status(400).json({ status: 'error', message: 'Invalid candidate for this election' });
    }

    const position = candidateDoc.data().position || 'General';
    const candidateName = candidateDoc.data().name || '';
    const positionKey = position.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const votedRef = db.collection('voted_voters').doc(${electionId}_${voterId}_${positionKey});

    // Prepare Vote Payload
    const votePayload = {
      electionId,
      candidateId,
      position,
      timestamp: Date.now()
    };

    // 2. Generate Cryptographic Audit Trail prior to state lock
    const auditTxId = await recordVoteAudit(votePayload, electionId, { candidateName, position });

    // 3. ATOMIC TRANSACTION: Check double vote & Increment candidate vote count safely
    await db.runTransaction(async (transaction) => {
      const votedDoc = await transaction.get(votedRef);

      if (votedDoc.exists) {
        throw new Error('DUPLICATE_VOTE');
      }

      // Increment candidate vote tally atomically using FieldValue
      const updateData = (choice === 'no')
        ? { noVotes: admin.firestore.FieldValue.increment(1) }
        : { votes: admin.firestore.FieldValue.increment(1) };

      transaction.update(candidateRef, updateData);
[7/25/2026 2:58 PM] Sheriff: // Create anonymized vote record
      const votesRef = db.collection('votes').doc();
      transaction.set(votesRef, votePayload);

      // Mark voter as voted for this position
      transaction.set(votedRef, {
        voterId,
        electionId,
        position,
        timestamp: Date.now(),
        auditTxId
      });
    });

    console.log('[Cast Vote] Vote cast successfully:', { voterId, candidateId, position, choice: choice || 'yes' });

    res.status(200).json({ 
      status: 'success', 
      message: 'Vote cast successfully',
      data: { verificationId: auditTxId }
    });

  } catch (error) {
    if (error.message === 'DUPLICATE_VOTE') {
      console.log('[Cast Vote] User already voted.');
      await logFraudAlert('DUPLICATE_VOTE', 'Voter tried to vote twice in the same category', { 
        voterId: req.user.uid, 
        electionId: req.body.electionId, 
        candidateId: req.body.candidateId 
      });
      return res.status(403).json({ status: 'error', message: 'User has already voted for this position in this election' });
    }

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