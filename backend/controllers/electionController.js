const { Op } = require('sequelize');
const { Election, Position, Candidate, Voter, Vote, VotedVoter, Tenant, UnlockedElection, ActivityLog, BroadcastLog } = require('../models');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const cache = require('../services/cache');
const { logActivity } = require('../services/activityLog');
const { sendOtpViaEmail, sendEmailNotification } = require('../services/emailService');

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

exports.getElections = async (req, res) => {
  try {
    const { status } = req.query;
    const cacheKey = `elections:list:${status || 'all'}`;

    const elections = await cache.getOrSet(cacheKey, async () => {
      const tenantId = getTenantId(req);
      const where = { tenantId };
      if (status) {
        where.status = status;
      }

      const list = await Election.findAll({ where });
      const now = Date.now();
      const dbUpdates = [];

      const result = list.map(e => {
        const item = e.toJSON();
        let updatedStatus = item.status;
        const endTime = item.endDate ? new Date(item.endDate).getTime() : Infinity;
        const startTime = item.startDate ? new Date(item.startDate).getTime() : 0;

        if (item.status === 'active' && item.endDate && endTime < now) {
          updatedStatus = 'completed';
          dbUpdates.push(e.update({ status: 'completed' }));
        } else if (item.status === 'draft' && item.startDate && startTime <= now) {
          updatedStatus = 'active';
          dbUpdates.push(e.update({ status: 'active' }));
        }

        return { ...item, status: updatedStatus };
      });

      if (dbUpdates.length > 0) {
        Promise.all(dbUpdates)
          .then(() => {
            cache.invalidatePrefix('elections:');
            cache.invalidatePrefix('admin:');
          })
          .catch(err => console.error('Error updating election status in background:', err));
      }

      return result;
    }, 10000);

    res.status(200).json({ status: 'success', data: elections });
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
        // Voter must be on election voter roster
        const voterMatch = await Voter.findOne({
          where: {
            electionId: election.id,
            [Op.or]: [
              { email: voterEmail },
              { studentId: voterIndex },
              { indexNumber: voterIndex }
            ]
          }
        });
        if (voterMatch) {
          isEligible = true;
        }
      }

      if (isEligible) {
        const item = election.toJSON();
        let updatedStatus = item.status || 'draft';
        const endTime = item.endDate ? new Date(item.endDate).getTime() : Infinity;
        const startTime = item.startDate ? new Date(item.startDate).getTime() : 0;

        if (item.status && item.status !== 'draft') {
          if (now >= startTime && now <= endTime) {
            if (item.status !== 'active') {
              updatedStatus = 'active';
              dbUpdates.push(election.update({ status: 'active' }));
            }
          } else if (now < startTime) {
            if (item.status !== 'scheduled') {
              updatedStatus = 'scheduled';
              dbUpdates.push(election.update({ status: 'scheduled' }));
            }
          } else if (now > endTime) {
            if (item.status !== 'completed' && item.status !== 'ended') {
              updatedStatus = 'completed';
              dbUpdates.push(election.update({ status: 'completed' }));
            }
          }
        }

        // Check voted voters
        const voted = await VotedVoter.findOne({
          where: {
            electionId: election.id,
            voterId: req.user.uid
          }
        });

        eligibleElections.push({
          ...item,
          status: updatedStatus,
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
    const cacheKey = `elections:detail:${electionId}`;

    const election = await cache.getOrSet(cacheKey, async () => {
      const electionRecord = await Election.findByPk(electionId);
      if (!electionRecord) {
        throw new Error('NOT_FOUND');
      }

      const item = electionRecord.toJSON();
      const now = Date.now();
      let updatedStatus = item.status || 'draft';
      const endTime = item.endDate ? new Date(item.endDate).getTime() : Infinity;
      const startTime = item.startDate ? new Date(item.startDate).getTime() : 0;

      if (item.status && item.status !== 'draft') {
        if (now >= startTime && now <= endTime) {
          if (item.status !== 'active') {
            updatedStatus = 'active';
            await electionRecord.update({ status: 'active' });
            cache.invalidatePrefix('elections:');
            cache.invalidatePrefix('admin:');
          }
        } else if (now < startTime) {
          if (item.status !== 'scheduled') {
            updatedStatus = 'scheduled';
            await electionRecord.update({ status: 'scheduled' });
            cache.invalidatePrefix('elections:');
            cache.invalidatePrefix('admin:');
          }
        } else if (now > endTime) {
          if (item.status !== 'completed' && item.status !== 'ended') {
            updatedStatus = 'completed';
            await electionRecord.update({ status: 'completed' });
            cache.invalidatePrefix('elections:');
            cache.invalidatePrefix('admin:');
          }
        }
      }

      // Compute stats
      const totalVoters = await Voter.count({ where: { electionId } });
      const totalVotesCast = await VotedVoter.count({ where: { electionId } });
      const candidateCount = await Candidate.count({ where: { electionId } });
      const positionCount = await Position.count({ where: { electionId } });

      return {
        ...item,
        status: updatedStatus,
        totalVoters,
        totalVotesCast,
        candidateCount,
        positionCount
      };
    }, 5000);

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
          totalVotesCast
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
    const { title, description, category, startDate, endDate, status, showResults, otpRequired, previewImageUrl } = req.body;

    const election = await Election.findByPk(electionId);
    if (!election) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }

    const updateFields = {};
    if (title !== undefined) updateFields.title = title.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (category !== undefined) updateFields.category = category.trim();
    if (startDate !== undefined) updateFields.startDate = startDate;
    if (endDate !== undefined) updateFields.endDate = endDate;
    if (status !== undefined) updateFields.status = status;
    if (showResults !== undefined) updateFields.showResults = Boolean(showResults);
    if (otpRequired !== undefined) updateFields.otpRequired = Boolean(otpRequired);
    if (previewImageUrl !== undefined) updateFields.previewImageUrl = previewImageUrl.trim();

    const now = Date.now();
    if (status === 'active') {
      const currentStart = startDate !== undefined ? startDate : election.startDate;
      const currentEnd = endDate !== undefined ? endDate : election.endDate;
      if (!currentStart || new Date(currentStart).getTime() > now) {
        updateFields.startDate = new Date(now - 1000).toISOString();
      }
      if (!currentEnd || new Date(currentEnd).getTime() <= now) {
        updateFields.endDate = new Date(now + 2 * 60 * 60 * 1000).toISOString();
      }
    }

    const targetStatus = updateFields.status !== undefined ? updateFields.status : election.status;
    const targetStart = updateFields.startDate !== undefined ? updateFields.startDate : election.startDate;
    const targetEnd = updateFields.endDate !== undefined ? updateFields.endDate : election.endDate;

    if (targetStatus && targetStatus !== 'draft') {
      const startMs = targetStart ? new Date(targetStart).getTime() : 0;
      const endMs = targetEnd ? new Date(targetEnd).getTime() : Infinity;
      if (now >= startMs && now <= endMs) {
        updateFields.status = 'active';
      } else if (now < startMs) {
        updateFields.status = 'scheduled';
      } else {
        updateFields.status = 'completed';
      }
    }

    await election.update(updateFields);

    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:');

    await logActivity({
      tenantId: getTenantId(req),
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
      await election.update({ endDate });
    } else {
      const updateData = { startDate, endDate };
      const now = Date.now();
      const newEndTime = new Date(endDate).getTime();
      if (election.status === 'completed' && newEndTime > now) {
        updateData.status = 'active';
      }
      await election.update(updateData);
    }

    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    await logActivity({
      tenantId: getTenantId(req),
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
    if (election.status !== 'completed') {
      return res.status(400).json({ status: 'error', message: 'Only completed elections can be reactivated' });
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
    if (!['draft', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status' });
    }

    const election = await Election.findByPk(req.params.id);
    if (!election) return res.status(404).json({ status: 'error', message: 'Election not found' });

    await election.update({ status });

    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    await logActivity({
      tenantId: getTenantId(req),
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
};

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
      const docId = (m.email || m.indexNumber || m.studentId || Math.random().toString(36)).toLowerCase().replace(/[^a-z0-9]/g, '_');
      addedCount++;
      return {
        id: docId,
        tenantId,
        electionId,
        studentId: (m.indexNumber || m.studentId || '').trim(),
        indexNumber: (m.indexNumber || m.studentId || '').trim(),
        name: m.name || m.fullName || 'Student',
        phone: (m.phone || m.phoneNumber || m.phoneNo || '').trim(),
        email: (m.email || '').toLowerCase().trim(),
        isRegistered: true,
        role: 'voter'
      };
    });

    // Bulk create or upsert voters
    await Voter.bulkCreate(bulkData, { updateOnDuplicate: ['name', 'phone', 'email', 'isRegistered'] });

    cache.invalidatePrefix('elections:');

    await logActivity({
      tenantId,
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

    const voterEmail = (req.user.email || '').toLowerCase().trim();
    const voterIndex = (req.user.indexNumber || req.user.studentId || voterId || '').toLowerCase().trim();

    const rosterEntry = await Voter.findOne({
      where: {
        electionId,
        [Op.or]: [
          { email: voterEmail },
          { studentId: voterIndex },
          { indexNumber: voterIndex }
        ]
      }
    });

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

    const voterEmail = (req.user.email || '').toLowerCase().trim();
    const voterIndex = (req.user.indexNumber || req.user.studentId || voterId || '').toLowerCase().trim();

    const rosterEntry = await Voter.findOne({
      where: {
        electionId,
        [Op.or]: [
          { email: voterEmail },
          { studentId: voterIndex },
          { indexNumber: voterIndex }
        ]
      }
    });

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

    res.status(200).json({
      status: 'success',
      fallbackOtp: dispatchSuccess ? undefined : otp,
      message: dispatchSuccess
        ? 'A verification code has been dispatched.'
        : `A verification code was generated: ${otp}`
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

    const voterEmail = (req.user.email || '').toLowerCase().trim();
    const voterIndex = (req.user.indexNumber || req.user.studentId || voterId || '').toLowerCase().trim();

    const voter = await Voter.findOne({
      where: {
        electionId,
        accessOtp: otp,
        [Op.or]: [
          { email: voterEmail },
          { studentId: voterIndex },
          { indexNumber: voterIndex }
        ]
      }
    });

    if (!voter) {
      return res.status(400).json({ status: 'error', message: 'Invalid verification code.' });
    }

    if (Date.now() > Number(voter.accessOtpExpiry)) {
      return res.status(400).json({ status: 'error', message: 'Verification code has expired.' });
    }

    await UnlockedElection.upsert({
      id: `${voterId}_${electionId}`,
      voterId,
      electionId,
      verifiedAt: Date.now()
    });

    voter.accessOtp = null;
    voter.accessOtpExpiry = null;
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
    const votedIdSet = new Set(votesCast.map(v => v.voterId.toLowerCase()));

    const result = list.map(v => {
      const item = v.toJSON();
      const studentId = item.studentId || item.indexNumber || item.id;
      const hasVoted = votedIdSet.has(studentId.toLowerCase()) || votedIdSet.has(item.id.toLowerCase());
      return {
        id: item.id,
        studentId,
        indexNumber: studentId,
        name: item.name || 'Student Voter',
        email: item.email || 'N/A',
        phone: item.phone || 'N/A',
        department: item.department || '',
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

      return {
        election: {
          title: election.title,
          description: election.description,
          startDate: new Date(election.startDate).toLocaleString(),
          endDate: new Date(election.endDate).toLocaleString(),
          status: election.status,
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

    const allRosterVoters = await Voter.findAll({ where: { electionId } });
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

    let sentCount = 0;
    const baseUrl = process.env.PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://htu-elect.vercel.app');
    const votingLink = `${baseUrl}/voter/elections/detail?id=${electionId}`;

    for (const recipient of targetRecipients) {
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

    await logActivity({
      tenantId,
      actorEmail: req.user?.email || 'admin@htu.edu.gh',
      actorRole: 'admin',
      action: 'ELECTION_SEND_INVITATIONS',
      description: `Dispatched voting invitations to ${sentCount} recipient(s) for election: ${election.title}`
    });

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
    const allRosterVoters = await Voter.findAll({ where: { electionId } });
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

    let emailSentCount = 0;
    let smsSentCount = 0;

    const dispatchChannel = channel || 'email';
    const baseUrl = process.env.PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://htu-elect.vercel.app';
    const votingLink = `${baseUrl}/voter/elections/detail?id=${electionId}`;

    for (const recipient of targetRecipients) {
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
      actorEmail: senderEmail,
      actorRole: 'admin',
      action: 'BROADCAST_MESSAGE_SENT',
      description: `Dispatched ${dispatchChannel.toUpperCase()} broadcast to ${targetRecipients.length} recipients for election ${election.title}`
    });

    res.status(200).json({
      status: 'success',
      message: `Broadcast successfully dispatched to ${targetRecipients.length} recipients (${emailSentCount} emails, ${smsSentCount} SMS messages).`,
      data: broadcastLog
    });
  } catch (error) {
    console.error('Error sending broadcast message:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send broadcast message.' });
  }
};
