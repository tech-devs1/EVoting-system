const { Op } = require('sequelize');
const { Election, Position, Candidate, Voter, Vote, VotedVoter, Tenant, UnlockedElection, ActivityLog, BroadcastLog, User } = require('../models');
const { computeElectionStatus } = require('../services/electionStatus');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const cache = require('../services/cache');
const { logActivity } = require('../services/activityLog');
const { sendOtpViaEmail, sendEmailNotification } = require('../services/emailService');

/**
 * Find a voter roster entry for a given election and user info.
 * Tries email first (most reliable), then indexNumber/studentId.
 * Returns the roster entry or null.
 */
async function findRosterEntry(electionId, user) {
  const voterEmail = (user.email || '').toLowerCase().trim();
  const voterIndex = (user.indexNumber || user.studentId || user.uid || '').toLowerCase().trim();

  const conditions = [];
  if (voterEmail && voterEmail.includes('@')) {
    conditions.push({ email: voterEmail });
  }
  if (voterIndex) {
    conditions.push({ studentId: voterIndex });
    conditions.push({ indexNumber: voterIndex });
  }

  if (conditions.length === 0) return null;

  return await Voter.findOne({
    where: {
      electionId,
      [Op.or]: conditions
    }
  });
}

/**
 * Find a User record by matching email, studentId, or indexNo.
 * Used to resolve voterId for hasVoted checks.
 */
async function findUserByEmailOrIndex(email, indexNumber) {
  const conditions = [];
  if (email && email.includes('@')) {
    conditions.push({ email: email.toLowerCase().trim() });
  }
  if (indexNumber) {
    conditions.push({ studentId: indexNumber });
    conditions.push({ indexNo: indexNumber });
  }
  if (conditions.length === 0) return null;
  return await User.findOne({ where: { [Op.or]: conditions } });
}

const DEFAULT_TENANT_ID = 'compssa';
const BMS_API_KEY = process.env.BMS_API_KEY || process.env.MNOTIFY_API_KEY || '';
const BMS_SENDER_ID = process.env.BMS_SENDER_ID || 'COMPSSA';

const getTenantId = (req) => {
  if (!req) return DEFAULT_TENANT_ID;
  const headersTenant = req.headers ? req.headers['x-tenant-id'] : null;
  const queryTenant = req.query ? req.query.tenantId : null;
  const bodyTenant = req.body ? req.body.tenantId : null;
  return headersTenant || queryTenant || bodyTenant || DEFAULT_TENANT_ID;
};

// Helper: Send OTP SMS via BMS Africa (mNotify) Quick SMS API
async function sendOtpViaBMS(phoneNumber, otp) {
  if (!BMS_API_KEY) {
    console.warn('[BMS SMS Warning] No BMS_API_KEY configured — SMS not dispatched. Code for', phoneNumber, 'is:', otp);
    return;
  }

  let formattedPhone = phoneNumber.replace(/\s+/g, '');
  if (formattedPhone.startsWith('+233')) {
    formattedPhone = '0' + formattedPhone.substring(4);
  } else if (!formattedPhone.startsWith('0') && formattedPhone.length === 9) {
    formattedPhone = '0' + formattedPhone;
  }

  const messageText = `Your HTU Elect verification code to unlock election access is ${otp}. It expires in 10 minutes.`;

  const payload = {
    recipient: [formattedPhone],
    sender: BMS_SENDER_ID,
    message: messageText,
    is_schedule: false
  };

  console.log(`[BMS SMS] Dispatching OTP ${otp} to ${formattedPhone} via BMS Africa (Sender ID: ${BMS_SENDER_ID})`);

  try {
    let res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${BMS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });

    let responseText = await res.text();
    console.log('[BMS SMS] Response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`BMS API returned non-JSON response: ${responseText.substring(0, 100)}`);
    }

    const isUnregistered = responseText.toLowerCase().includes('sender id is not registered') ||
                           responseText.toLowerCase().includes('sender id not approved') ||
                           responseText.toLowerCase().includes('unregistered') ||
                           responseData.code === '1005' ||
                           (responseData.error && responseText.toLowerCase().includes('sender id'));

    if (isUnregistered && BMS_SENDER_ID !== 'mNotify') {
      console.warn(`[BMS SMS Warning] Sender ID "${BMS_SENDER_ID}" not registered. Retrying with fallback "mNotify"...`);
      payload.sender = 'mNotify';
      res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${BMS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });
      responseText = await res.text();
      console.log('[BMS SMS Fallback 1] Response:', responseText);
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`BMS API returned non-JSON response: ${responseText.substring(0, 100)}`);
      }
    }

    const isStillUnregistered = responseText.toLowerCase().includes('sender id is not registered') ||
                                responseText.toLowerCase().includes('sender id not approved');
    if (isStillUnregistered && payload.sender !== 'BMS Africa') {
      console.warn(`[BMS SMS Warning] Fallback "mNotify" not registered. Retrying with fallback "BMS Africa"...`);
      payload.sender = 'BMS Africa';
      res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${BMS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });
      responseText = await res.text();
      console.log('[BMS SMS Fallback 2] Response:', responseText);
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`BMS API returned non-JSON response: ${responseText.substring(0, 100)}`);
      }
    }

    const isStillUnregistered2 = responseText.toLowerCase().includes('sender id is not registered') ||
                                 responseText.toLowerCase().includes('sender id not approved');
    if (isStillUnregistered2 && payload.sender !== 'COMPSSA') {
      console.warn(`[BMS SMS Warning] Fallback "BMS Africa" not registered. Retrying with fallback "COMPSSA"...`);
      payload.sender = 'COMPSSA';
      res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${BMS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });
      responseText = await res.text();
      console.log('[BMS SMS Fallback 3] Response:', responseText);
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`BMS API returned non-JSON response: ${responseText.substring(0, 100)}`);
      }
    }

    if (!res.ok || (responseData.status !== 'success' && responseData.code !== '2000' && responseData.status !== 2000)) {
      throw new Error('BMS API returned error: ' + (responseData.message || responseData.error || responseText));
    }

    return responseData;
  } catch (err) {
    console.error('[BMS SMS Error]:', err.message || err);
    throw err;
  }
}

// computeElectionStatus imported from ../services/electionStatus

exports.getElections = async (req, res) => {
  try {
    const { status } = req.query;
    const tenantId = getTenantId(req);
    const where = { tenantId };

    const list = await Election.findAll({ where });
    const dbUpdates = [];

    const result = [];
    for (const e of list) {
      const item = e.toJSON();
      const computedStatus = computeElectionStatus(item);

      if (item.status !== 'draft' && item.status !== computedStatus) {
        dbUpdates.push(e.update({ status: computedStatus }));
      }

      const totalVoters = await Voter.count({ where: { electionId: item.id } });
      const totalVotesCast = await VotedVoter.count({ where: { electionId: item.id } });

      result.push({
        ...item,
        status: computedStatus,
        totalVoters,
        voterCount: totalVoters,
        totalVotesCast,
        totalVotes: totalVotesCast
      });
    }

    if (dbUpdates.length > 0) {
      Promise.all(dbUpdates)
        .then(() => {
          cache.invalidatePrefix('elections:');
          cache.invalidatePrefix('admin:');
        })
        .catch(err => console.error('Error updating election status in background:', err));
    }

    const filteredResult = status ? result.filter(r => r.status === status) : result;
    res.status(200).json({ status: 'success', data: filteredResult });
  } catch (error) {
    console.error('Error fetching elections:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch elections' });
  }
};

exports.getEligibleElections = async (req, res) => {
  try {
    const voterEmail = (req.user.email || '').toLowerCase().trim();
    const voterIndex = (req.user.indexNumber || req.user.studentId || req.user.uid || '').toLowerCase().trim();
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

    const now = Date.now();
    const dbUpdates = [];

    // Find all elections
    const allElections = await Election.findAll();
    const eligibleElections = [];

    for (const election of allElections) {
      let isEligible = isAdmin;

      if (!isEligible) {
        // Use the robust helper to find the roster entry
        const voterMatch = await findRosterEntry(election.id, req.user);
        if (voterMatch) {
          isEligible = true;
        }
      }

      if (isEligible) {
        const item = election.toJSON();
        const updatedStatus = computeElectionStatus(item);

        if (election.status !== 'draft' && election.status !== updatedStatus) {
          dbUpdates.push(election.update({ status: updatedStatus }));
        }

        // Check voted voters
        const voted = await VotedVoter.findOne({
          where: {
            electionId: election.id,
            voterId: req.user.uid
          }
        });

        const totalVoters = await Voter.count({ where: { electionId: election.id } });
        const totalVotesCast = await VotedVoter.count({ where: { electionId: election.id } });

        eligibleElections.push({
          ...item,
          status: updatedStatus,
          totalVoters,
          voterCount: totalVoters,
          totalVotesCast,
          totalVotes: totalVotesCast,
          hasVoted: !!voted
        });
      }
    }

    if (dbUpdates.length > 0) {
      Promise.all(dbUpdates).catch(() => {});
    }

    res.status(200).json({ status: 'success', data: eligibleElections });
  } catch (error) {
    console.error('Error fetching eligible elections:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch eligible elections' });
  }
};

exports.getElectionById = async (req, res) => {
  try {
    const electionId = req.params.id;

    const electionRecord = await Election.findByPk(electionId);
    if (!electionRecord) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }

    const item = electionRecord.toJSON();
    const updatedStatus = computeElectionStatus(item);

    if (item.status !== 'draft' && item.status !== updatedStatus) {
      await electionRecord.update({ status: updatedStatus });
      cache.invalidatePrefix('elections:');
      cache.invalidatePrefix('admin:');
    }

    // Compute stats
    const totalVoters = await Voter.count({ where: { electionId } });
    const totalVotesCast = await VotedVoter.count({ where: { electionId } });
    const candidateCount = await Candidate.count({ where: { electionId } });
    const positionCount = await Position.count({ where: { electionId } });

    const election = {
      ...item,
      status: updatedStatus,
      totalVoters,
      voterCount: totalVoters,
      totalVotesCast,
      totalVotes: totalVotesCast,
      candidateCount,
      positionCount
    };

    res.status(200).json({ status: 'success', data: election });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    console.error('Error fetching election details:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch election' });
  }
};

exports.getElectionResults = async (req, res) => {
  try {
    const electionId = req.params.id;
    const electionRecord = await Election.findByPk(electionId);
    if (!electionRecord) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }

    const item = electionRecord.toJSON();
    const updatedStatus = computeElectionStatus(item);
    if (item.status !== 'draft' && item.status !== updatedStatus) {
      await electionRecord.update({ status: updatedStatus });
      cache.invalidatePrefix('elections:');
      cache.invalidatePrefix('admin:');
    }
    item.status = updatedStatus;

    const candidates = await Candidate.findAll({ where: { electionId } });

    const sortedCands = candidates.map(c => c.toJSON()).sort((a, b) => {
      const numA = a.ballotNumber !== undefined && a.ballotNumber !== null && a.ballotNumber !== '' ? Number(a.ballotNumber) : 999;
      const numB = b.ballotNumber !== undefined && b.ballotNumber !== null && b.ballotNumber !== '' ? Number(b.ballotNumber) : 999;
      if (numA !== numB) return numA - numB;
      return (a.name || '').localeCompare(b.name || '');
    });

    const uniqueVotersCast = await VotedVoter.count({ where: { electionId } });

    const positionTotals = {};
    sortedCands.forEach(c => {
      const pos = c.positionTitle || 'General';
      if (!positionTotals[pos]) positionTotals[pos] = 0;
      positionTotals[pos] += (c.votes || 0) + (c.noVotes || 0);
    });
    const maxPositionVotes = Object.values(positionTotals).length > 0 ? Math.max(...Object.values(positionTotals)) : 0;

    let finalUniqueVoters = uniqueVotersCast;
    if (finalUniqueVoters < maxPositionVotes) {
      finalUniqueVoters = maxPositionVotes;
    }

    let candidateTotalVotes = 0;
    sortedCands.forEach(c => {
      candidateTotalVotes += (c.votes || 0) + (c.noVotes || 0);
    });

    const totalVotesCast = item.totalVotesCast || finalUniqueVoters || candidateTotalVotes;
    const totalVoters = await Voter.count({ where: { electionId } });

    res.status(200).json({
      status: 'success',
      data: {
        election: {
          ...item,
          totalVoters,
          voterCount: totalVoters,
          totalVotesCast,
          totalVotes: totalVotesCast
        },
        candidates: sortedCands.map(c => ({ ...c, position: c.positionTitle })),
        totalVotes: totalVotesCast
      }
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch results' });
  }
};

exports.createElection = async (req, res) => {
  try {
    const { title, description, startDate, endDate, organizationId, type, department, showResults, previewImageUrl } = req.body;
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const electionType = type || 'src';
    const dateLabel = startDate
      ? new Date(startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const autoDesc = `This is the ${title} scheduled for ${dateLabel}. Eligible voters are invited to vote for their preferred candidates across all positions.`;
    const finalDescription = (description && description.trim() && !description.includes('Student Representative Council (SRC) election')) ? description.trim() : autoDesc;

    const tenantId = req.user?.tenantId || getTenantId(req);
    const id = `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newElection = await Election.create({
      id,
      tenantId,
      title,
      description: finalDescription,
      startDate,
      endDate,
      organizationId: organizationId || tenantId || 'default',
      category: electionType,
      department: department || '',
      status: req.body.status || 'draft',
      showResults: showResults === true,
      previewImageUrl: previewImageUrl || ''
    });

    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    await logActivity({
      tenantId,
      electionId: newElection.id,
      actorEmail: req.user.email,
      actorRole: 'admin',
      action: 'ELECTION_CREATE',
      description: `Created new election "${title}" (ID: ${newElection.id})`
    });

    res.status(201).json({ status: 'success', data: newElection });
  } catch (error) {
    console.error('Error creating election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create election' });
  }
};

exports.updateElection = async (req, res) => {
  try {
    const electionId = req.params.id;
    const { title, description, category, startDate, endDate, showResults, otpRequired, previewImageUrl } = req.body;

    const election = await Election.findByPk(electionId);
    if (!election) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }

    const now = Date.now();
    const currentStartMs = new Date(election.startDate).getTime();
    const currentEndMs = new Date(election.endDate).getTime();
    const hasStarted = now >= currentStartMs;
    const hasEnded = now > currentEndMs;

    const updateFields = {};
    if (title !== undefined) updateFields.title = title.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (category !== undefined) updateFields.category = category.trim();
    if (showResults !== undefined) updateFields.showResults = Boolean(showResults);
    if (otpRequired !== undefined) updateFields.otpRequired = Boolean(otpRequired);
    if (previewImageUrl !== undefined) updateFields.previewImageUrl = previewImageUrl.trim();

    // Time edit validation rules
    if (!hasStarted) {
      // Election hasn't started yet — Admin can freely edit startDate and endDate
      if (startDate !== undefined) updateFields.startDate = startDate;
      if (endDate !== undefined) updateFields.endDate = endDate;
    } else if (!hasEnded) {
      // Election is currently ongoing — Admin CANNOT change startDate, and can only extend endDate
      if (startDate !== undefined && new Date(startDate).getTime() !== currentStartMs) {
        return res.status(400).json({
          status: 'error',
          message: 'An election that has already started cannot have its start date modified.'
        });
      }
      if (endDate !== undefined) {
        const newEndMs = new Date(endDate).getTime();
        if (newEndMs <= now) {
          return res.status(400).json({
            status: 'error',
            message: 'Ongoing election end date can only be extended to a future time.'
          });
        }
        updateFields.endDate = endDate;
      }
    } else {
      // Election has ended — Admin can extend the end date to reactivate the poll
      if (endDate !== undefined) {
        const newEndMs = new Date(endDate).getTime();
        if (newEndMs <= now) {
          return res.status(400).json({
            status: 'error',
            message: 'To extend an ended election, the new end date must be in the future.'
          });
        }
        updateFields.endDate = endDate;
      }
    }

    // Automatically recompute status based on updated time window
    const targetStart = updateFields.startDate || election.startDate;
    const targetEnd = updateFields.endDate || election.endDate;
    const targetStartMs = new Date(targetStart).getTime();
    const targetEndMs = new Date(targetEnd).getTime();

    if (now < targetStartMs) {
      updateFields.status = 'scheduled';
    } else if (now >= targetStartMs && now <= targetEndMs) {
      updateFields.status = 'active';
    } else {
      updateFields.status = 'ended';
    }

    await election.update(updateFields);

    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:');

    await logActivity({
      tenantId: getTenantId(req),
      electionId,
      actorEmail: req.user.email,
      actorRole: 'admin',
      action: 'ELECTION_UPDATE',
      description: `Updated metadata for election "${election.title}" (ID: ${electionId})`
    });

    res.status(200).json({ status: 'success', message: 'Election metadata updated successfully.', data: election });
  } catch (error) {
    console.error('Error updating election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update election details.' });
  }
};

exports.updateElectionTimeWindow = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'startDate and endDate are required' });
    }

    const election = await Election.findByPk(req.params.id);
    if (!election) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }

    const isActive = election.status === 'active';
    if (isActive) {
      const currentEndDate = new Date(election.endDate).getTime();
      const newEndDate = new Date(endDate).getTime();
      if (newEndDate < currentEndDate) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot reduce the end time of an ongoing election. You may only extend it.'
        });
      }
      // When extending an active election, keep it active (don't recompute status)
      await election.update({ endDate });
    } else {
      const now = Date.now();
      const updateData = { startDate, endDate };
      // Always recompute status based on the new time window
      const newStartTime = new Date(startDate).getTime();
      const newEndTime = new Date(endDate).getTime();
      if (now < newStartTime) {
        updateData.status = 'scheduled';
      } else if (now >= newStartTime && now <= newEndTime) {
        updateData.status = 'active';
      } else {
        updateData.status = 'ended';
      }
      await election.update(updateData);
    }

    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    await logActivity({
      tenantId: getTenantId(req),
      electionId: req.params.id,
      actorEmail: req.user.email,
      actorRole: 'admin',
      action: 'ELECTION_TIME_WINDOW_UPDATE',
      description: `Updated time window for election ID: ${req.params.id}`
    });

    res.status(200).json({ status: 'success', message: 'Election time window updated' });
  } catch (error) {
    console.error('Error updating election time window:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update time window.' });
  }
};

exports.reactivateElection = async (req, res) => {
  try {
    const { endDate } = req.body;
    if (!endDate) {
      return res.status(400).json({ status: 'error', message: 'A new endDate is required to reactivate' });
    }

    const newEndDate = new Date(endDate).getTime();
    if (isNaN(newEndDate) || newEndDate <= Date.now()) {
      return res.status(400).json({ status: 'error', message: 'The new end date must be in the future' });
    }

    const election = await Election.findByPk(req.params.id);
    if (!election) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    if (election.status !== 'completed' && election.status !== 'ended') {
      return res.status(400).json({ status: 'error', message: 'Only completed/ended elections can be reactivated' });
    }

    const nowISO = new Date().toISOString();
    await election.update({
      startDate: nowISO,
      endDate,
      status: 'active',
      reactivatedAt: nowISO
    });

    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:');

    await logActivity({
      tenantId: getTenantId(req),
      electionId: req.params.id,
      actorEmail: req.user.email,
      actorRole: 'admin',
      action: 'ELECTION_REACTIVATE',
      description: `Reactivated completed election ID: ${req.params.id}`
    });

    res.status(200).json({ status: 'success', message: 'Election reactivated successfully' });
  } catch (error) {
    console.error('Error reactivating election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to reactivate election' });
  }
};

exports.updateElectionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'scheduled', 'active', 'ended'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status' });
    }

    const election = await Election.findByPk(req.params.id);
    if (!election) return res.status(404).json({ status: 'error', message: 'Election not found' });

    await election.update({ status });

    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    await logActivity({
      tenantId: getTenantId(req),
      electionId: req.params.id,
      actorEmail: req.user.email,
      actorRole: 'admin',
      action: 'ELECTION_STATUS_UPDATE',
      description: `Updated status of election ID: ${req.params.id} to ${status.toUpperCase()}`
    });

    res.status(200).json({ status: 'success', message: `Election status updated to ${status}` });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update election status' });
  }
};

exports.toggleResults = async (req, res) => {
  try {
    const { showResults } = req.body;
    if (typeof showResults !== 'boolean') {
      return res.status(400).json({ status: 'error', message: 'showResults must be a boolean' });
    }

    const election = await Election.findByPk(req.params.id);
    if (!election) return res.status(404).json({ status: 'error', message: 'Election not found' });

    await election.update({ showResults });

    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:');

    await logActivity({
      tenantId: getTenantId(req),
      electionId: req.params.id,
      actorEmail: req.user.email,
      actorRole: 'admin',
      action: 'ELECTION_TOGGLE_RESULTS',
      description: `${showResults ? 'Published' : 'Hidden'} results for election ID: ${req.params.id}`
    });

    res.status(200).json({ status: 'success', message: `Voter results visibility updated to ${showResults}` });
  } catch (error) {
    console.error('Error toggling results:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update results visibility' });
  }
};

exports.deleteElection = async (req, res) => {
  try {
    const electionId = req.params.id;
    const election = await Election.findByPk(electionId);
    if (!election) return res.status(404).json({ status: 'error', message: 'Election not found' });

    await election.destroy(); // Cascades deletes on Positions, Candidates, etc because of hasMany constraints.

    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:');

    await logActivity({
      tenantId: getTenantId(req),
      electionId,
      actorEmail: req.user.email,
      actorRole: 'admin',
      action: 'ELECTION_DELETE',
      description: `Deleted election ID: ${electionId}`
    });

    res.status(200).json({ status: 'success', message: 'Election and associated data deleted successfully' });
  } catch (error) {
    console.error('Error deleting election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete election' });
  }
}

/**
 * Extend the closing time of an ended/completed election.
 * Admins cannot manually start polls - they auto-activate at startDate.
 * But they CAN extend the end time after a poll has ended.
 */
exports.extendEndTime = async (req, res) => {
  try {
    const { newEndDate } = req.body;
    if (!newEndDate) {
      return res.status(400).json({ status: 'error', message: 'newEndDate is required (ISO string).' });
    }

    const election = await Election.findByPk(req.params.id);
    if (!election) return res.status(404).json({ status: 'error', message: 'Election not found' });

    const newEndMs = new Date(newEndDate).getTime();
    if (isNaN(newEndMs)) {
      return res.status(400).json({ status: 'error', message: 'Invalid date format for newEndDate.' });
    }

    const now = Date.now();
    if (newEndMs <= now) {
      return res.status(400).json({ status: 'error', message: 'New end date must be in the future.' });
    }

    const updateFields = { endDate: newEndDate };
    if (election.status === 'ended' || election.status === 'completed') {
      updateFields.status = 'active';
    }

    await election.update(updateFields);

    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    await logActivity({
      tenantId: getTenantId(req),
      electionId: election.id,
      actorEmail: req.user.email,
      actorRole: 'admin',
      action: 'ELECTION_EXTEND_TIME',
      description: 'Extended end time of election "' + election.title + '" to ' + new Date(newEndDate).toLocaleString()
    });

    res.status(200).json({
      status: 'success',
      message: 'Election end time extended. Status: ' + (updateFields.status || election.status),
      data: { endDate: newEndDate, status: updateFields.status || election.status }
    });
  } catch (error) {
    console.error('Error extending election time:', error);
    res.status(500).json({ status: 'error', message: 'Failed to extend election time.' });
  }
};
;

exports.uploadCsv = async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user?.tenantId || DEFAULT_TENANT_ID;
    const { members } = req.body;

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Members array is required.' });
    }

    const election = await Election.findByPk(electionId);
    if (!election) return res.status(404).json({ status: 'error', message: 'Election not found.' });

    let addedCount = 0;
    const bulkData = members.map(m => {
      const rawEmail = (m.email || '').toLowerCase().trim();
      const rawIndex = (m.indexNumber || m.studentId || '').trim().toLowerCase();
      const rawKey = rawEmail || rawIndex || Math.random().toString(36).substring(2, 8);
      const cleanKey = rawKey.replace(/[^a-z0-9]/g, '_');
      const docId = `vtr_${cleanKey}_${electionId}`;
      addedCount++;
      return {
        id: docId,
        tenantId,
        electionId,
        studentId: (m.indexNumber || m.studentId || '').trim(),
        indexNumber: (m.indexNumber || m.studentId || '').trim(),
        name: m.name || m.fullName || 'Student',
        phone: (m.phone || m.phoneNumber || m.phoneNo || '').trim(),
        email: rawEmail || ((m.indexNumber || m.studentId || '').trim() + '@htu.edu.gh'),
        program: (m.program || m.department || '').trim(),
        level: (m.level || '').trim(),
        isRegistered: true,
        role: 'voter'
      };
    });

    // Bulk create or upsert voters per election ID
    await Voter.bulkCreate(bulkData, { updateOnDuplicate: ['electionId', 'tenantId', 'name', 'phone', 'email', 'program', 'level', 'isRegistered'] });

    cache.invalidatePrefix('elections:');

    await logActivity({
      tenantId,
      electionId,
      actorEmail: req.user.email,
      actorRole: 'admin',
      action: 'ELECTION_CSV_UPLOAD',
      description: `Uploaded voter roster with ${addedCount} members for election: ${electionId}`
    });

    res.status(200).json({
      status: 'success',
      message: `Successfully uploaded ${addedCount} voting members.`,
      data: { totalMembers: addedCount }
    });
  } catch (error) {
    console.error('Error uploading CSV:', error);
    res.status(500).json({ status: 'error', message: 'Failed to upload CSV voter roster.' });
  }
};

exports.getAccessStatus = async (req, res) => {
  try {
    const electionId = req.params.id;
    const voterId = req.user.uid;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    const election = await Election.findByPk(electionId);
    if (!election) return res.status(404).json({ status: 'error', message: 'Election not found.' });

    const unlocked = await UnlockedElection.findByPk(`${voterId}_${electionId}`);
    if (unlocked || election.otpRequired === false) {
      return res.status(200).json({ status: 'success', data: { unlocked: true } });
    }

    const rosterEntry = await findRosterEntry(electionId, req.user);

    if (!rosterEntry) {
      return res.status(200).json({
        status: 'success',
        data: {
          unlocked: false,
          reason: 'not_on_roster',
          message: 'You have no access to vote in this election. Please contact your organization EC admin.'
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        unlocked: false,
        reason: 'otp_required',
        message: 'Identity verification code required to unlock your ballot.'
      }
    });
  } catch (error) {
    console.error('Error checking access:', error);
    res.status(500).json({ status: 'error', message: 'Failed to check access status.' });
  }
};

exports.requestAccessOtp = async (req, res) => {
  try {
    const electionId = req.params.id;
    const voterId = req.user.uid;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    const election = await Election.findByPk(electionId);
    if (!election) return res.status(404).json({ status: 'error', message: 'Election not found.' });

    const now = Date.now();
    const startTime = new Date(election.startDate).getTime();
    const endTime = new Date(election.endDate).getTime();

    if (now < startTime) {
      return res.status(400).json({
        status: 'error',
        message: `Voting for "${election.title}" has not opened yet.`
      });
    }

    if (now > endTime) {
      return res.status(400).json({
        status: 'error',
        message: `Voting for "${election.title}" has ended.`
      });
    }

    let rosterEntry = await findRosterEntry(electionId, req.user);

    if (!rosterEntry) {
      return res.status(403).json({
        status: 'error',
        message: 'You have no access to vote in this election. Please contact your organization EC admin.'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000;

    rosterEntry.accessOtp = otp;
    rosterEntry.accessOtpExpiry = expiry;
    rosterEntry.otpAttempts = 0;
    await rosterEntry.save();

    let emailSent = false;
    let smsSent = false;

    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const rosterEmail = (rosterEntry?.email || '').toLowerCase().trim();
    const targetEmail = (userEmail && userEmail.includes('@')) ? userEmail : ((rosterEmail && rosterEmail.includes('@')) ? rosterEmail : '');

    const targetName = rosterEntry?.name || req.user?.name || 'Voter';
    const targetPhone = rosterEntry?.phone || req.user?.phone || '';

    console.log('[Access OTP] Prepared dispatch details:', { targetEmail, targetName, targetPhone, voterId, electionId });

    if (targetEmail && targetEmail.includes('@')) {
      try {
        const info = await sendOtpViaEmail(targetEmail, targetName, otp);
        if (info) emailSent = true;
      } catch (err) {
        console.error('[Access OTP] Email dispatch error:', err.message);
      }
    }

    if (targetPhone) {
      try {
        await sendOtpViaBMS(targetPhone, otp);
        smsSent = true;
      } catch (err) {
        console.error('[Access OTP] SMS dispatch error:', err.message);
      }
    }

    const dispatchSuccess = emailSent || smsSent;

    // The plaintext OTP is only ever returned when delivery failed AND we are
    // not in production — in production the code must never leak via the API.
    const devFallback = !dispatchSuccess && process.env.NODE_ENV !== 'production';

    res.status(200).json({
      status: 'success',
      fallbackOtp: devFallback ? otp : undefined,
      message: dispatchSuccess
        ? 'A verification code has been dispatched.'
        : 'A verification code has been generated. If it did not arrive, please contact support.'
    });
  } catch (error) {
    console.error('Error requesting OTP:', error);
    res.status(500).json({ status: 'error', message: 'Failed to request verification code.' });
  }
};

exports.verifyAccessOtp = async (req, res) => {
  try {
    const electionId = req.params.id;
    const voterId = req.user.uid;
    const { otp } = req.body;

    if (!otp) return res.status(400).json({ status: 'error', message: 'Verification code is required.' });

    const voter = await findRosterEntry(electionId, req.user);

    if (!voter || !voter.accessOtp) {
      return res.status(400).json({ status: 'error', message: 'Invalid verification code.' });
    }

    if (Date.now() > Number(voter.accessOtpExpiry)) {
      voter.accessOtp = null;
      voter.accessOtpExpiry = null;
      voter.otpAttempts = 0;
      await voter.save();
      return res.status(400).json({ status: 'error', message: 'Verification code has expired.' });
    }

    if (String(voter.accessOtp) !== String(otp).trim()) {
      const attempts = Number(voter.otpAttempts || 0) + 1;
      if (attempts >= 5) {
        voter.accessOtp = null;
        voter.accessOtpExpiry = null;
        voter.otpAttempts = 0;
        await voter.save();
        return res.status(429).json({ status: 'error', message: 'Too many incorrect attempts. Please request a new code.' });
      }
      voter.otpAttempts = attempts;
      await voter.save();
      return res.status(400).json({ status: 'error', message: 'Invalid verification code.' });
    }

    await UnlockedElection.upsert({
      id: `${voterId}_${electionId}`,
      voterId,
      electionId,
      verifiedAt: Date.now()
    });

    voter.accessOtp = null;
    voter.accessOtpExpiry = null;
    voter.otpAttempts = 0;
    await voter.save();

    res.status(200).json({ status: 'success', message: 'Election unlocked successfully.' });
  } catch (error) {
    console.error('Error verifying access OTP:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify OTP.' });
  }
};

exports.getVoters = async (req, res) => {
  try {
    const electionId = req.params.id;
    const list = await Voter.findAll({ where: { electionId } });
    const votesCast = await VotedVoter.findAll({ where: { electionId } });
    const votedIdSet = new Set(votesCast.map(v => (v.voterId || '').toLowerCase()));

    // Build a map from email/studentId → User.id so we can match VotedVoter records
    const emailToUserIds = new Set();
    const indexToUserIds = new Set();
    for (const v of list) {
      const item = v.toJSON ? v.toJSON() : v;
      const email = (item.email || '').toLowerCase().trim();
      const idx = (item.studentId || item.indexNumber || '').toLowerCase().trim();
      if (email) emailToUserIds.add(email);
      if (idx) indexToUserIds.add(idx);
    }

    // Fetch all User records that match any of these emails or indices
    const allUserConditions = [];
    if (emailToUserIds.size > 0) {
      allUserConditions.push({ email: { [Op.in]: Array.from(emailToUserIds) } });
    }
    if (indexToUserIds.size > 0) {
      allUserConditions.push({ studentId: { [Op.in]: Array.from(indexToUserIds) } });
      allUserConditions.push({ indexNo: { [Op.in]: Array.from(indexToUserIds) } });
    }
    let userIdByEmail = new Map();
    let userIdByIndex = new Map();
    if (allUserConditions.length > 0) {
      const users = await User.findAll({ where: { [Op.or]: allUserConditions } });
      for (const u of users) {
        const ud = u.toJSON ? u.toJSON() : u;
        if (ud.email) userIdByEmail.set(ud.email.toLowerCase().trim(), ud.id);
        if (ud.studentId) userIdByIndex.set(ud.studentId.toLowerCase().trim(), ud.id);
        if (ud.indexNo) userIdByIndex.set(ud.indexNo.toLowerCase().trim(), ud.id);
      }
    }

    const result = list.map(v => {
      const item = v.toJSON ? v.toJSON() : v;
      const studentId = item.studentId || item.indexNumber || item.id;
      const email = (item.email || '').toLowerCase().trim();
      const idx = studentId.toLowerCase();

      // Resolve User.id for this roster entry
      const resolvedUserId = userIdByEmail.get(email) || userIdByIndex.get(idx) || '';

      const hasVoted =
        (resolvedUserId && votedIdSet.has(resolvedUserId.toLowerCase())) ||
        votedIdSet.has(email) ||
        votedIdSet.has(idx);

      return {
        id: item.id,
        studentId,
        indexNumber: studentId,
        name: item.name || 'Student Voter',
        email: item.email || 'N/A',
        phone: item.phone || 'N/A',
        phoneNumber: item.phone || 'N/A',
        program: item.program || item.department || '',
        programme: item.program || item.department || '',
        department: item.program || item.department || '',
        level: item.level || '',
        isRegistered: true,
        hasVoted
      };
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    console.error('Error getting voters:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch roster voters.' });
  }
};

exports.addVoter = async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user?.tenantId || DEFAULT_TENANT_ID;
    const { studentId, name, email, phone, program, level } = req.body;

    if (!studentId || !studentId.trim()) {
      return res.status(400).json({ status: 'error', message: 'Index/Student number is required.' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ status: 'error', message: 'Full name is required.' });
    }

    const election = await Election.findByPk(electionId);
    if (!election) return res.status(404).json({ status: 'error', message: 'Election not found.' });

    const cleanIndex = studentId.trim();
    const cleanEmail = (email || '').trim().toLowerCase() || (cleanIndex.toLowerCase() + '@htu.edu.gh');

    // Check for duplicate within this election
    const existing = await Voter.findOne({ where: { electionId, studentId: cleanIndex } });
    if (existing) {
      return res.status(409).json({ status: 'error', message: `Voter with index ${cleanIndex} already exists in this election.` });
    }

    const docId = `vtr_${cleanIndex.replace(/[^a-zA-Z0-9]/g, '_')}_${electionId}`;
    const voter = await Voter.create({
      id: docId,
      tenantId,
      electionId,
      studentId: cleanIndex,
      indexNumber: cleanIndex,
      name: name.trim(),
      email: cleanEmail,
      phone: (phone || '').trim(),
      program: (program || '').trim(),
      level: (level || '').trim(),
      isRegistered: true,
      role: 'voter'
    });

    // Ensure a User record exists so the voter can register/login immediately
    try {
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { email: cleanEmail },
            { studentId: cleanIndex },
            { indexNo: cleanIndex }
          ]
        }
      });
      if (!existingUser) {
        const userId = `usr_${cleanIndex.replace(/[^a-zA-Z0-9]/g, '_')}`;
        await User.create({
          id: userId,
          tenantId,
          name: name.trim(),
          email: cleanEmail,
          phone: (phone || '').trim(),
          role: 'voter',
          studentId: cleanIndex,
          indexNo: cleanIndex,
          status: 'active',
          isVerified: false
        });
      } else {
        // Update existing user's roster-linked fields if missing
        const updates = {};
        if (!existingUser.studentId) updates.studentId = cleanIndex;
        if (!existingUser.indexNo) updates.indexNo = cleanIndex;
        if (!existingUser.tenantId) updates.tenantId = tenantId;
        if (Object.keys(updates).length > 0) {
          await existingUser.update(updates);
        }
      }
    } catch (userErr) {
      console.error('[addVoter] Failed to ensure User record:', userErr.message);
      // Non-fatal — roster entry was still created
    }

    cache.invalidatePrefix('elections:');
    await logActivity({
      tenantId,
      electionId,
      actorEmail: req.user.email,
      actorRole: 'admin',
      action: 'VOTER_ADDED_MANUALLY',
      description: `Manually added voter ${cleanIndex} (${name.trim()}) to election: ${electionId}`
    });

    res.status(201).json({ status: 'success', data: voter });
  } catch (error) {
    console.error('Error adding voter:', error);
    res.status(500).json({ status: 'error', message: 'Failed to add voter.' });
  }
};

exports.updateVoter = async (req, res) => {
  try {
    const electionId = req.params.id;
    const voterId = req.params.voterId;
    const { name, email, phone, program, level } = req.body;

    const voter = await Voter.findOne({ where: { id: voterId, electionId } });
    if (!voter) {
      return res.status(404).json({ status: 'error', message: 'Voter not found in this election.' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email.trim().toLowerCase();
    if (phone !== undefined) updates.phone = phone.trim();
    if (program !== undefined) updates.program = program.trim();
    if (level !== undefined) updates.level = level.trim();

    await voter.update(updates);

    cache.invalidatePrefix('elections:');
    await logActivity({
      tenantId: req.user?.tenantId || DEFAULT_TENANT_ID,
      electionId,
      actorEmail: req.user.email,
      actorRole: 'admin',
      action: 'VOTER_UPDATED',
      description: `Updated voter details for ${voter.studentId} in election: ${electionId}`
    });

    res.status(200).json({ status: 'success', data: voter });
  } catch (error) {
    console.error('Error updating voter:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update voter.' });
  }
};

exports.getPositions = async (req, res) => {
  try {
    const electionId = req.params.id;
    const positions = await Position.findAll({ where: { electionId }, order: [['order', 'ASC']] });
    res.status(200).json({ status: 'success', data: positions });
  } catch (error) {
    console.error('Error getting positions:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch positions.' });
  }
};

exports.createPosition = async (req, res) => {
  try {
    const electionId = req.params.id;
    const { title, maxChoices, isReferendum, order } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ status: 'error', message: 'Position title is required.' });
    }

    const cleanTitle = title.trim();
    let existingPos = await Position.findOne({ where: { electionId, title: cleanTitle } });
    if (existingPos) {
      await existingPos.update({
        maxChoices: Number(maxChoices) || existingPos.maxChoices,
        isReferendum: isReferendum !== undefined ? Boolean(isReferendum) : existingPos.isReferendum,
        order: Number(order) || existingPos.order
      });
      return res.status(200).json({ status: 'success', data: existingPos });
    }

    const id = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newPos = await Position.create({
      id,
      electionId,
      title: cleanTitle,
      maxChoices: Number(maxChoices) || 1,
      isReferendum: Boolean(isReferendum),
      order: Number(order) || 1
    });

    res.status(201).json({ status: 'success', data: newPos });
  } catch (error) {
    console.error('Error creating position:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create position.' });
  }
};

exports.deletePosition = async (req, res) => {
  try {
    const { posId } = req.params;
    const pos = await Position.findByPk(posId);
    if (!pos) return res.status(404).json({ status: 'error', message: 'Position not found' });
    await pos.destroy();
    res.status(200).json({ status: 'success', message: 'Position deleted successfully.' });
  } catch (error) {
    console.error('Error deleting position:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete position.' });
  }
};

exports.getReport = async (req, res) => {
  try {
    const electionId = req.params.id;
    const cacheKey = `elections:report:${electionId}`;

    const report = await cache.getOrSet(cacheKey, async () => {
      const election = await Election.findByPk(electionId);
      if (!election) throw new Error('NOT_FOUND');

      const candidates = await Candidate.findAll({ where: { electionId } });
      const totalVotes = await Vote.count({ where: { electionId } });
      let uniqueVoters = await VotedVoter.count({ where: { electionId } });

      const positionTotals = {};
      candidates.forEach(c => {
        const pos = c.positionTitle || 'General';
        if (!positionTotals[pos]) positionTotals[pos] = 0;
        positionTotals[pos] += (c.votes || 0) + (c.noVotes || 0);
      });

      const maxPositionVotes = Object.values(positionTotals).length > 0 ? Math.max(...Object.values(positionTotals)) : 0;
      if (uniqueVoters < maxPositionVotes) {
        uniqueVoters = maxPositionVotes;
      }

      const totalVotersCount = await Voter.count({ where: { electionId } });

      const computedStatus = computeElectionStatus(election.toJSON());
      return {
        election: {
          title: election.title,
          description: election.description,
          startDate: new Date(election.startDate).toLocaleString(),
          endDate: new Date(election.endDate).toLocaleString(),
          status: computedStatus,
          category: election.category,
          department: election.department,
          createdAt: new Date(election.createdAt).toLocaleString()
        },
        statistics: {
          totalCandidates: candidates.length,
          totalVotesCast: totalVotes,
          uniqueVoters,
          totalEligibleVoters: totalVotersCount,
          turnoutPercentage: totalVotersCount > 0 ? ((uniqueVoters / totalVotersCount) * 100).toFixed(2) : '0.00',
          reportGeneratedAt: new Date().toLocaleString()
        },
        candidates: candidates.map(c => {
          const pos = c.positionTitle || 'General';
          const posTotal = positionTotals[pos] || 0;
          return {
            name: c.name,
            position: c.positionTitle,
            manifesto: c.manifesto,
            votes: c.votes || 0,
            noVotes: c.noVotes || 0,
            isIndependent: !!c.isIndependent,
            percentage: posTotal > 0 ? ((c.votes || 0) / posTotal * 100).toFixed(2) : '0.00'
          };
        }).sort((a, b) => b.votes - a.votes)
      };
    }, 15000);

    res.status(200).json({ status: 'success', data: report });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    console.error('Error generating report:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate election report' });
  }
};

exports.getBroadcastHistory = async (req, res) => {
  try {
    const electionId = req.params.id;
    const history = await BroadcastLog.findAll({
      where: { electionId },
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({ status: 'success', data: history });
  } catch (error) {
    console.error('Error fetching broadcast history:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch broadcast history.' });
  }
};

exports.sendInvitations = async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user?.tenantId || DEFAULT_TENANT_ID;
    const { recipientFilter, selectedEmails, customEmails } = req.body;

    const election = await Election.findByPk(electionId);
    if (!election) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }

    const allRosterVoters = await Voter.findAll({
      where: { electionId }
    });
    const votesCast = await VotedVoter.findAll({ where: { electionId } });
    const votedIdSet = new Set(votesCast.map(v => v.voterId.toLowerCase()));

    let targetRecipients = [];

    if (recipientFilter === 'pending') {
      targetRecipients = allRosterVoters.filter(v => {
        const studentId = (v.studentId || v.indexNumber || v.id || '').toLowerCase();
        return !votedIdSet.has(studentId) && !votedIdSet.has(v.id.toLowerCase());
      });
    } else if (recipientFilter === 'voted') {
      targetRecipients = allRosterVoters.filter(v => {
        const studentId = (v.studentId || v.indexNumber || v.id || '').toLowerCase();
        return votedIdSet.has(studentId) || votedIdSet.has(v.id.toLowerCase());
      });
    } else if (recipientFilter === 'individual') {
      const selectedSet = new Set((Array.isArray(selectedEmails) ? selectedEmails : []).map(e => e.toLowerCase()));
      targetRecipients = allRosterVoters.filter(v => v.email && selectedSet.has(v.email.toLowerCase()));
    } else if (recipientFilter === 'custom') {
      const parsedEmails = (customEmails || '')
        .split(/[,;\n\s]+/)
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0 && e.includes('@'));

      targetRecipients = parsedEmails.map(email => ({
        id: email,
        name: 'Voter',
        studentId: 'N/A',
        email,
        phone: ''
      }));
    } else {
      targetRecipients = allRosterVoters;
    }

    if (targetRecipients.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No eligible recipients matched the selected filter criteria or voter roster is empty.',
        sentCount: 0
      });
    }

    let sentCount = 0;
    const baseUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://e-voting.htu.edu.gh';
    const votingLink = `${baseUrl}/voter/elections/detail?id=${electionId}`;

    // Bounded-concurrency worker pool: large broadcasts (1,000+ recipients) would
    // take 30+ minutes if sent sequentially. Per-recipient logic is unchanged;
    // counters are incremented atomically per send.
    const SEND_CONCURRENCY = 10;
    let recipientCursor = 0;
    const sendWorkers = Array.from({ length: Math.min(SEND_CONCURRENCY, targetRecipients.length) }, async () => {
    while (recipientCursor < targetRecipients.length) {
      const recipient = targetRecipients[recipientCursor++];
      const voterName = recipient.name || recipient.email?.split('@')[0] || 'Voter';
      const recipientEmail = recipient.email ? recipient.email.trim() : '';

      if (recipientEmail) {
        const emailSubject = `Official Voting Invitation: ${election.title}`;
        const emailBody = `Hello ${voterName},\n\nYou are invited to cast your vote in the election: "${election.title}".\n\nPlease visit the voting portal to participate:\n${votingLink}\n\nThank you,\nHTU Elect Electoral Commission`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #f8fafc; border-radius: 12px;">
            <h2 style="color: #2563eb; margin-bottom: 12px;">Official Voting Invitation</h2>
            <p>Hello <strong>${voterName}</strong>,</p>
            <p>You have been registered as an eligible voter for <strong>${election.title}</strong>.</p>
            <div style="margin: 24px 0;">
              <a href="${votingLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                Cast Your Vote Now
              </a>
            </div>
            <p style="font-size: 13px; color: #64748b;">If the button above does not work, copy and paste this link into your browser:<br/><a href="${votingLink}">${votingLink}</a></p>
          </div>
        `;

        try {
          const info = await sendEmailNotification(recipientEmail, emailSubject, emailBody, emailHtml);
          if (info) sentCount++;
        } catch (err) {
          console.error(`[Send Invitation Error] ${recipientEmail}:`, err.message);
        }
      }
    }
    }
    );

    await Promise.all(sendWorkers);

    await logActivity({
      tenantId,
      electionId,
      actorEmail: req.user?.email || 'admin@htu.edu.gh',
      actorRole: 'admin',
      action: 'ELECTION_SEND_INVITATIONS',
      description: `Dispatched voting invitations to ${sentCount} recipient(s) out of ${targetRecipients.length} target(s) for election: ${election.title}`
    });

    if (sentCount === 0 && targetRecipients.length > 0) {
      return res.status(200).json({
        status: 'warning',
        message: `Matched ${targetRecipients.length} recipient(s), but 0 invitations could be delivered. Please verify that recipients have valid email addresses and that the email service is configured correctly.`,
        sentCount: 0
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Successfully sent voting invitations to ${sentCount} recipient(s).`
    });
  } catch (error) {
    console.error('Error sending invitations:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send invitations.' });
  }
};

exports.sendBroadcastMessage = async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user?.tenantId || DEFAULT_TENANT_ID;
    const senderEmail = req.user?.email || 'admin@htu.edu.gh';

    const { channel, recipientFilter, selectedEmails, customEmails, subject, body } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ status: 'error', message: 'Message body cannot be empty.' });
    }

    const election = await Election.findByPk(electionId);
    if (!election) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }

    // Retrieve all roster voters for this election
    const allRosterVoters = await Voter.findAll({
      where: { electionId }
    });
    const votesCast = await VotedVoter.findAll({ where: { electionId } });
    const votedIdSet = new Set(votesCast.map(v => v.voterId.toLowerCase()));

    let targetRecipients = [];

    if (recipientFilter === 'pending') {
      targetRecipients = allRosterVoters.filter(v => {
        const studentId = (v.studentId || v.indexNumber || v.id || '').toLowerCase();
        return !votedIdSet.has(studentId) && !votedIdSet.has(v.id.toLowerCase());
      });
    } else if (recipientFilter === 'voted') {
      targetRecipients = allRosterVoters.filter(v => {
        const studentId = (v.studentId || v.indexNumber || v.id || '').toLowerCase();
        return votedIdSet.has(studentId) || votedIdSet.has(v.id.toLowerCase());
      });
    } else if (recipientFilter === 'individual') {
      const selectedSet = new Set((Array.isArray(selectedEmails) ? selectedEmails : []).map(e => e.toLowerCase()));
      targetRecipients = allRosterVoters.filter(v => v.email && selectedSet.has(v.email.toLowerCase()));
    } else if (recipientFilter === 'custom') {
      const parsedEmails = (customEmails || '')
        .split(/[,;\n\s]+/)
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0 && e.includes('@'));

      targetRecipients = parsedEmails.map(email => ({
        id: email,
        name: 'Voter',
        studentId: 'N/A',
        email,
        phone: ''
      }));
    } else {
      // 'all' or fallback
      targetRecipients = allRosterVoters;
    }

    if (targetRecipients.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No eligible recipients matched the selected filter criteria or voter roster is empty.',
        recipientCount: 0,
        emailSentCount: 0,
        smsSentCount: 0
      });
    }

    let emailSentCount = 0;
    let smsSentCount = 0;

    const dispatchChannel = channel || 'email';
    const baseUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://e-voting.htu.edu.gh';
    const votingLink = `${baseUrl}/voter/elections/detail?id=${electionId}`;

    // Bounded-concurrency worker pool: large broadcasts (1,000+ recipients) would
    // take 30+ minutes if sent sequentially. Per-recipient logic is unchanged;
    // counters are incremented atomically per send.
    const SEND_CONCURRENCY = 10;
    let recipientCursor = 0;
    const sendWorkers = Array.from({ length: Math.min(SEND_CONCURRENCY, targetRecipients.length) }, async () => {
    while (recipientCursor < targetRecipients.length) {
      const recipient = targetRecipients[recipientCursor++];
      const voterName = recipient.name || recipient.email?.split('@')[0] || 'Voter';
      const indexNumber = recipient.studentId || recipient.indexNumber || recipient.id || 'N/A';
      const recipientEmail = recipient.email ? recipient.email.trim() : '';
      const recipientPhone = recipient.phone ? recipient.phone.trim() : '';

      // Personalized body interpolation
      const personalizedBody = body
        .replace(/{{voter_name}}/gi, voterName)
        .replace(/{{index_number}}/gi, indexNumber)
        .replace(/{{election_title}}/gi, election.title)
        .replace(/{{voting_link}}/gi, votingLink);

      const emailSubject = subject || `Important Notice: ${election.title}`;

      // Send Email if channel is 'email' or 'both'
      if ((dispatchChannel === 'email' || dispatchChannel === 'both') && recipientEmail) {
        try {
          const sentInfo = await sendEmailNotification(recipientEmail, emailSubject, personalizedBody);
          if (sentInfo) {
            emailSentCount++;
          } else {
            console.warn(`[Broadcast Email Dispatch Warning] Failed to send email to ${recipientEmail}`);
          }
        } catch (err) {
          console.error(`[Broadcast Email Error] Failed to send to ${recipientEmail}:`, err.message);
        }
      }

      // Send SMS if channel is 'sms' or 'both'
      if ((dispatchChannel === 'sms' || dispatchChannel === 'both') && recipientPhone) {
        try {
          await sendOtpViaBMS(recipientPhone, personalizedBody);
          smsSentCount++;
        } catch (err) {
          console.error(`[Broadcast SMS Error] Failed to send to ${recipientPhone}:`, err.message);
        }
      }
    }
    }
    );

    await Promise.all(sendWorkers);

    const logId = `brd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const broadcastLog = await BroadcastLog.create({
      id: logId,
      tenantId,
      electionId,
      channel: dispatchChannel,
      recipientFilter: recipientFilter || 'all',
      subject: subject || `Important Notice: ${election.title}`,
      body,
      recipientCount: targetRecipients.length,
      emailSentCount,
      smsSentCount,
      senderEmail
    });

    await logActivity({
      tenantId,
      electionId,
      actorEmail: senderEmail,
      actorRole: 'admin',
      action: 'BROADCAST_MESSAGE_SENT',
      description: `Dispatched ${dispatchChannel.toUpperCase()} broadcast to ${targetRecipients.length} recipients for election ${election.title}`
    });

    if (emailSentCount === 0 && smsSentCount === 0 && targetRecipients.length > 0) {
      return res.status(200).json({
        status: 'warning',
        message: `Broadcast attempted for ${targetRecipients.length} recipient(s), but 0 emails or SMS messages were delivered. Please verify recipient email/phone numbers and email provider configuration.`,
        data: broadcastLog
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Broadcast successfully dispatched to ${targetRecipients.length} recipient(s) (${emailSentCount} emails, ${smsSentCount} SMS messages).`,
      data: broadcastLog
    });
  } catch (error) {
    console.error('Error sending broadcast message:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send broadcast message.' });
  }
};
