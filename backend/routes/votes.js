const express = require('express');
const router = express.Router();
const { db, DEFAULT_TENANT_ID } = require('../services/firebase');

const getTenantId = (req) => req.headers['x-tenant-id'] || req.query.tenantId || req.body.tenantId || DEFAULT_TENANT_ID;
const getElectionsRef = (req) => db.collection('tenants').doc(getTenantId(req)).collection('elections');
const getCandidatesRef = (req) => db.collection('tenants').doc(getTenantId(req)).collection('candidates');
const getVotedVotersRef = (req) => db.collection('tenants').doc(getTenantId(req)).collection('voted_voters');
const getVotesRef = (req) => db.collection('tenants').doc(getTenantId(req)).collection('votes');
const getAuditLogsRef = (req) => db.collection('tenants').doc(getTenantId(req)).collection('audit_logs');
const { FieldValue } = require('firebase-admin/firestore');
const { verifyAuth } = require('../middleware/auth');
const { recordVoteAudit } = require('../services/audit');
const { logFraudAlert } = require('../services/fraud');
const cache = require('../services/cache');

// Get list of election IDs the current user has voted in - CACHED
router.get('/voted-elections', verifyAuth, async (req, res) => {
  try {
    const voterId = req.user.uid;
    const cacheKey = `votes:voted-elections:${voterId}`;

    const electionIds = await cache.getOrSet(cacheKey, async () => {
      // Selective retrieval to minimize network bandwidth
      const snapshot = await getVotedVotersRef(req)
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
      return Array.from(votedElectionIds);
    }, 5000); // Cache for 5 seconds

    res.status(200).json({ status: 'success', data: electionIds });
  } catch (error) {
    console.error('Error fetching voted elections:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch voted status' });
  }
});

// Cast a vote (ATOMIC TRANSACTION & HIGH CONCURRENCY READY) - CACHE INVALIDATING
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
    // (We get this from Cache to avoid reading elections document every single time a vote is cast!)
    const election = await cache.getOrSet(`elections:detail:${electionId}`, async () => {
      const doc = await getElectionsRef(req).doc(electionId).get();
      if (!doc.exists) {
        throw new Error('ELECTION_NOT_FOUND');
      }
      return { id: doc.id, ...doc.data() };
    }, 15000);

    if (election.status !== 'active') {
      return res.status(400).json({ status: 'error', message: 'Election is not active' });
    }

    const now = Date.now();
    if (election.startDate && now < new Date(election.startDate).getTime()) {
      return res.status(400).json({ status: 'error', message: 'Voting for this election has not started yet.' });
    }
    if (election.endDate && now > new Date(election.endDate).getTime()) {
      return res.status(400).json({ status: 'error', message: 'Voting duration for this election has expired.' });
    }

    // Pre-calculate references
    const candidateRef = getCandidatesRef(req).doc(candidateId);
    const candidateDoc = await candidateRef.get();
    if (!candidateDoc.exists || candidateDoc.data().electionId !== electionId) {
      return res.status(400).json({ status: 'error', message: 'Invalid candidate for this election' });
    }

    const position = candidateDoc.data().position || 'General';
    const candidateName = candidateDoc.data().name || '';
    const positionKey = position.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const votedRef = getVotedVotersRef(req).doc(`${electionId}_${voterId}_${positionKey}`);

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
        ? { noVotes: FieldValue.increment(1) }
        : { votes: FieldValue.increment(1) };

      transaction.update(candidateRef, updateData);
      // Create anonymized vote record
      const votesRef = getVotesRef(req).doc();
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

    // --- INVALIDATE ALL RELATED CACHES FOR REAL-TIME ACCURACY ---
    cache.invalidate(`votes:voted-elections:${voterId}`);
    cache.invalidate(`elections:report:${electionId}`);
    cache.invalidate(`elections:report:pdf:${electionId}`);
    cache.invalidate(`admin:dashboard`);
    cache.invalidate(`admin:dashboard-full`);
    cache.invalidate(`admin:live-votes`);
    cache.invalidatePrefix(`candidates:election:${electionId}`);

    res.status(200).json({ 
      status: 'success', 
      message: 'Vote cast successfully',
      data: { verificationId: auditTxId }
    });

  } catch (error) {
    if (error.message === 'ELECTION_NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
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
    res.status(500).json({ status: 'error', message: `Failed to cast vote: ${error.message}` });
  }
});

// Verify a vote (Public / Voter)
router.get('/verify/:auditTxId', async (req, res) => {
  try {
    const { auditTxId } = req.params;
    const cacheKey = `votes:verify:${auditTxId}`;

    const auditData = await cache.getOrSet(cacheKey, async () => {
      const auditDoc = await getAuditLogsRef(req).doc(auditTxId).get();
      if (!auditDoc.exists) {
        throw new Error('NOT_FOUND');
      }
      return auditDoc.data();
    }, 60000); // Verify requests can be cached for a long time (1 minute)

    res.status(200).json({ status: 'success', data: auditData });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Verification record not found' });
    }
    console.error('Error verifying vote:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify vote' });
  }
});

module.exports = router;