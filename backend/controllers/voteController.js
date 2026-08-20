const { Candidate, Position, Vote, VotedVoter, sequelize } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { logActivity } = require('../services/activityLog');
const { logFraudAlert } = require('../services/fraud');
const cache = require('../services/cache');

exports.castVote = async (req, res) => {
  let transaction;
  try {
    const { electionId, candidateId, choice } = req.body;
    const voterId = req.user.uid;

    if (!electionId || !candidateId) {
      return res.status(400).json({ status: 'error', message: 'Missing electionId or candidateId' });
    }

    // Wrap double voting and tally updates inside a direct ACID SQL Transaction
    transaction = await sequelize.transaction();

    const candidate = await Candidate.findByPk(candidateId, { transaction });
    if (!candidate) {
      await transaction.rollback();
      return res.status(404).json({ status: 'error', message: 'Candidate not found' });
    }

    const posId = candidate.positionId;

    // Check if voter already cast ballot for this position
    const priorVote = await Vote.findOne({
      where: {
        electionId,
        voterId,
        positionId: posId
      },
      transaction
    });

    if (priorVote) {
      await transaction.rollback();
      // Log flagged user — double voting attempt detected!
      await logFraudAlert('DUPLICATE_VOTE', `Voter tried to vote twice in the same category`, {
        voterId,
        electionId,
        positionId: posId
      });
      return res.status(400).json({ status: 'error', message: 'User has already voted for this position in this election' });
    }

    // Cast vote block
    const blockIndex = (await Vote.count({ where: { electionId }, transaction })) + 1;
    const lastVote = await Vote.findOne({
      where: { electionId },
      order: [['blockIndex', 'DESC']],
      transaction
    });
    const prevHash = lastVote ? lastVote.encryptedHash : '0000000000000000000000000000000000000000000000000000000000000000';

    const timestamp = Date.now();
    const voteId = `vt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Compute simple SHA-256 block hash for the cryptographic audit trail sequential ledger
    const hashPayload = `${blockIndex}-${prevHash}-${electionId}-${voterId}-${posId}-${candidateId}-${timestamp}`;
    const encryptedHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    await Vote.create({
      id: voteId,
      electionId,
      voterId,
      positionId: posId,
      candidateId,
      encryptedHash,
      blockIndex,
      prevHash,
      timestamp
    }, { transaction });

    // Track total ballot processed for double-voting protection
    await VotedVoter.findOrCreate({
      where: { electionId, voterId },
      defaults: { id: `vv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, timestamp },
      transaction
    });

    // Update candidate tally atomically
    // Handle Yes/No votes: if choice is 'no', increment noVotes; otherwise increment votes
    if (choice === 'no') {
      candidate.noVotes = (candidate.noVotes || 0) + 1;
    } else {
      candidate.votes = (candidate.votes || 0) + 1;
    }
    await candidate.save({ transaction });

    await transaction.commit();

    cache.invalidatePrefix('candidates:');
    cache.invalidatePrefix('elections:');

    res.status(200).json({
      status: 'success',
      message: 'Vote cast successfully',
      data: {
        verificationId: voteId,
        voterId,
        candidateId,
        position: candidate.positionTitle,
        choice: choice || 'yes',
        verificationId: voteId
      }
    });
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error('Error casting vote:', error);
    res.status(500).json({ status: 'error', message: 'Failed to cast vote' });
  }
};

/**
 * List of election IDs the signed-in voter has already voted in.
 * Used by the voter elections/dashboard pages to show "✓ Voted" states.
 */
exports.getVotedElections = async (req, res) => {
  try {
    const voterId = req.user.uid;
    const votedList = await VotedVoter.findAll({ where: { voterId } });
    const votesList = await Vote.findAll({ where: { voterId } });

    const electionIds = Array.from(new Set([
      ...votedList.map(v => v.electionId),
      ...votesList.map(v => v.electionId)
    ]));

    res.status(200).json({ status: 'success', data: electionIds });
  } catch (error) {
    console.error('Error fetching voted elections:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch voted elections' });
  }
};

/**
 * Look up a ballot receipt (the verificationId returned by /votes/cast) and
 * return the audit-ledger details shown on the voter verify page.
 */
exports.verifyVote = async (req, res) => {
  try {
    const voteId = String(req.params.id || '').trim();
    if (!voteId) {
      return res.status(400).json({ status: 'error', message: 'Verification ID is required.' });
    }

    const vote = await Vote.findByPk(voteId);
    if (!vote) {
      return res.status(404).json({ status: 'error', message: 'No ballot record matches this verification ID.' });
    }

    const candidate = await Candidate.findByPk(vote.candidateId);

    res.status(200).json({
      status: 'success',
      data: {
        electionId: vote.electionId,
        timestamp: Number(vote.timestamp) || Date.now(),
        previousHash: vote.prevHash || '',
        currentHash: vote.encryptedHash || '',
        dataPayload: vote.id,
        candidateName: candidate ? candidate.name : 'Unknown candidate',
        position: candidate ? candidate.positionTitle : (vote.positionId || 'General')
      }
    });
  } catch (error) {
    console.error('Error verifying vote:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify ballot record.' });
  }
};

exports.getUserVotes = async (req, res) => {
  try {
    const voterId = req.user.uid;
    const { electionId } = req.query;

    const whereClause = { voterId };
    if (electionId) {
      whereClause.electionId = electionId;
    }

    const votes = await Vote.findAll({ where: whereClause });

    const candidateIds = votes.map(v => v.candidateId);
    const candidates = candidateIds.length > 0 ? await Candidate.findAll({ where: { id: candidateIds } }) : [];
    const candidateMap = new Map(candidates.map(c => [c.id, c]));

    const data = votes.map(v => {
      const cand = candidateMap.get(v.candidateId);
      return {
        id: v.id,
        electionId: v.electionId,
        positionId: v.positionId,
        positionTitle: cand ? cand.positionTitle : null,
        candidateId: v.candidateId,
        verificationId: v.id || v.encryptedHash,
        encryptedHash: v.encryptedHash,
        timestamp: v.timestamp
      };
    });

    res.status(200).json({ status: 'success', data });
  } catch (error) {
    console.error('Error fetching user votes:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch user votes' });
  }
};
