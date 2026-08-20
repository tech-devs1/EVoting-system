const express = require('express');
const router = express.Router();
const { db, DEFAULT_TENANT_ID } = require('../services/firebase');

const getTenantId = (req) => {
  const h = req.headers['x-tenant-id'];
  if (h && typeof h === 'string' && h.trim()) return h.trim();
  const q = req.query?.tenantId;
  if (q && typeof q === 'string' && q.trim()) return q.trim();
  const b = req.body?.tenantId;
  if (b && typeof b === 'string' && b.trim()) return b.trim();
  return DEFAULT_TENANT_ID || 'compssa';
};
const getElectionsRef = (req) => db.collection('tenants').doc(getTenantId(req)).collection('elections');
const getCandidatesRef = (req) => db.collection('tenants').doc(getTenantId(req)).collection('candidates');
const getVotedVotersRef = (req) => db.collection('tenants').doc(getTenantId(req)).collection('voted_voters');
const getVotesRef = (req) => db.collection('tenants').doc(getTenantId(req)).collection('votes');
const getAuditLogsRef = (req) => db.collection('tenants').doc(getTenantId(req)).collection('audit_logs');
const { FieldValue } = require('firebase-admin/firestore');
const { verifyAuth } = require('../middleware/auth');
const { recordVoteAudit } = require('../services/audit');
const { logFraudAlert } = require('../services/fraud');
const { logActivity } = require('../services/activityLog');
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

// Helper: Resolve voter email and name from session or Firestore
async function getVoterInfo(req, voterId) {
  let email = req.user?.email;
  let name = req.user?.name;
  if (!email || email === 'voter' || !name) {
    try {
      const tenantId = getTenantId(req);
      const studentDoc = await db.collection('users').doc(tenantId).collection('voter_rolls').doc(voterId).get();
      if (studentDoc.exists) {
        const d = studentDoc.data();
        email = email || d.email;
        name = name || d.name;
      }
    } catch (_) {}
  }
  return { email: email || '', name: name || 'Student Voter' };
}

// Helper: Send vote confirmation email via EmailJS REST API
async function sendVoteConfirmationViaEmailJS({ email, name, electionTitle, votesSummary, verificationId, timestamp }) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn('[EmailJS Warning] Missing EmailJS env variables (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY). Ballot confirmation not sent to', email);
    return false;
  }

  if (!email) {
    console.warn('[EmailJS Warning] No recipient email available for voter confirmation.');
    return false;
  }

  const formattedDate = new Date(timestamp || Date.now()).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'UTC'
  });

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    accessToken: privateKey,
    template_params: {
      to_name: name || 'Voter',
      to_email: email,
      user_email: email,
      student_name: name || 'Voter',
      student_email: email,
      election_title: electionTitle,
      election_name: electionTitle,
      vote_details: votesSummary,
      details: votesSummary,
      candidates_voted: votesSummary,
      candidates: votesSummary,
      timestamp: formattedDate,
      date: formattedDate,
      time: formattedDate,
      verification_id: verificationId,
      receipt_id: verificationId,
      message: `Dear ${name || 'Voter'},\n\nYour ballot has been successfully cast and registered in the tamper-proof ledger for "${electionTitle}".\n\nVote Breakdown:\n${votesSummary}\n\nTimestamp: ${formattedDate}\nVerification ID: ${verificationId}\n\nThank you for participating in the electoral process.`
    }
  };

  try {
    const fetch = global.fetch || require('node-fetch');
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[EmailJS Vote Confirmation Error]:', errText);
      return false;
    }
    console.log('[EmailJS] Vote confirmation email sent successfully to', email);
    return true;
  } catch (err) {
    console.error('[EmailJS Vote Confirmation Failure]:', err.message || err);
    return false;
  }
}

// Cast a vote (ATOMIC TRANSACTION & HIGH CONCURRENCY READY) - CACHE INVALIDATING
router.post('/cast', verifyAuth, async (req, res) => {
  try {
    let { electionId, candidateId, choice, skipEmail } = req.body;
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

    const candidateData = candidateDoc.data();
    const position = candidateData.position || 'General';
    const candidateName = candidateData.name || '';
    const ballotNo = candidateData.ballotNumber ? ` (Ballot #${candidateData.ballotNumber})` : '';
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

    // Log vote cast activity (anonymous – no candidate name stored)
    const tenantId = getTenantId(req);
    await logActivity({
      tenantId,
      actorEmail: req.user?.email || 'voter',
      actorRole: 'voter',
      action: 'VOTE_CAST',
      description: `Vote cast in election "${election.title || electionId}"`,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      status: 'success',
      meta: { electionId, electionTitle: election.title || '' }
    });

    // Send confirmation email via EmailJS if not skipping for a batch
    if (!skipEmail) {
      const voterInfo = await getVoterInfo(req, voterId);
      if (voterInfo.email) {
        const choiceLabel = choice ? ` [Choice: ${choice.toUpperCase()}]` : '';
        const singleVoteSummary = `• ${position}: ${candidateName}${ballotNo}${choiceLabel}`;
        sendVoteConfirmationViaEmailJS({
          email: voterInfo.email,
          name: voterInfo.name,
          electionTitle: election.title || 'Election',
          votesSummary: singleVoteSummary,
          verificationId: auditTxId,
          timestamp: Date.now()
        }).catch(err => console.error('[EmailJS] Single vote confirmation error:', err));
      }
    }

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

// Explicit endpoint to send a full multi-category ballot confirmation email via EmailJS
router.post('/send-confirmation', verifyAuth, async (req, res) => {
  try {
    const { electionId, candidates, verificationId, timestamp } = req.body;
    const voterId = req.user.uid;

    if (!electionId) {
      return res.status(400).json({ status: 'error', message: 'Election ID is required.' });
    }

    const electionDoc = await getElectionsRef(req).doc(electionId).get();
    const electionTitle = electionDoc.exists ? (electionDoc.data().title || 'Election') : 'Election';

    const voterInfo = await getVoterInfo(req, voterId);
    if (!voterInfo.email) {
      return res.status(400).json({ status: 'error', message: 'Voter email not found.' });
    }

    let votesSummary = 'No candidate details recorded.';
    if (Array.isArray(candidates) && candidates.length > 0) {
      votesSummary = candidates.map(c => {
        const choiceStr = c.choice ? ` [Choice: ${c.choice.toUpperCase()}]` : '';
        const ballotStr = c.ballotNumber ? ` (Ballot #${c.ballotNumber})` : '';
        return `• ${c.position || 'General'}: ${c.name || 'Candidate'}${ballotStr}${choiceStr}`;
      }).join('\n');
    }

    await sendVoteConfirmationViaEmailJS({
      email: voterInfo.email,
      name: voterInfo.name,
      electionTitle,
      votesSummary,
      verificationId: verificationId || 'verified',
      timestamp: timestamp || Date.now()
    });

    res.status(200).json({ status: 'success', message: 'Confirmation email sent successfully.' });
  } catch (error) {
    console.error('Error sending vote confirmation email:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send confirmation email' });
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