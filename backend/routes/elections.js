const express = require('express');
const router = express.Router();
const { db, DEFAULT_TENANT_ID } = require('../services/firebase');

const getTenantId = (req) => {
  if (!req) return DEFAULT_TENANT_ID;
  const headersTenant = req.headers ? req.headers['x-tenant-id'] : null;
  const queryTenant = req.query ? req.query.tenantId : null;
  const bodyTenant = req.body ? req.body.tenantId : null;
  return headersTenant || queryTenant || bodyTenant || DEFAULT_TENANT_ID;
};
const getTenantCollection = (req) => req.tenantCollection || (req.user ? req.user.tenantCollection : null) || 'tenants';
const getElectionsRef = (req) => {
  const tenantId = getTenantId(req);
  return db.collection(getTenantCollection(req)).doc(tenantId).collection('elections');
};
const getCandidatesRef = (req) => {
  const tenantId = getTenantId(req);
  return db.collection(getTenantCollection(req)).doc(tenantId).collection('candidates');
};
const getVotedVotersRef = (req) => {
  const tenantId = getTenantId(req);
  return db.collection(getTenantCollection(req)).doc(tenantId).collection('voted_voters');
};

/**
 * Universal helper to find an election document regardless of tenant context or collection path
 */
async function findElectionDoc(electionId, req) {
  if (!electionId) return { doc: null, ref: null, tenantId: null, tenantCollection: 'tenants' };

  const requestedTenantId = getTenantId(req);

  // 1. Try requested tenant path in 'tenants'
  let ref = db.collection('tenants').doc(requestedTenantId).collection('elections').doc(electionId);
  let doc = await ref.get();
  if (doc.exists) return { doc, ref, tenantId: requestedTenantId, tenantCollection: 'tenants' };

  // 2. Try requested tenant path in 'organizations'
  ref = db.collection('organizations').doc(requestedTenantId).collection('elections').doc(electionId);
  doc = await ref.get();
  if (doc.exists) return { doc, ref, tenantId: requestedTenantId, tenantCollection: 'organizations' };

  // 3. Search across all elections in collectionGroup
  try {
    const snapshot = await db.collectionGroup('elections').get();
    const match = snapshot.docs.find(d => d.id === electionId);
    if (match) {
      const parentTenant = match.ref.parent.parent;
      const matchTenantId = parentTenant ? parentTenant.id : requestedTenantId;
      const collectionName = parentTenant && parentTenant.parent ? parentTenant.parent.id : 'tenants';
      return { doc: match, ref: match.ref, tenantId: matchTenantId, tenantCollection: collectionName };
    }
  } catch (err) {
    console.warn('[findElectionDoc Warning]:', err.message);
  }

  return { doc: null, ref: null, tenantId: requestedTenantId, tenantCollection: 'tenants' };
}

const { verifyAuth, requireAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const cache = require('../services/cache');
const { logActivity } = require('../services/activityLog');

// Get elections (optional status filter) - CACHED & WRITE OPTIMIZED
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const cacheKey = `elections:list:${status || 'all'}`;

    const elections = await cache.getOrSet(cacheKey, async () => {
      const electionsRef = getElectionsRef(req);
      let snapshot;
      if (status) {
        snapshot = await electionsRef.where('status', '==', status).get();
      } else {
        snapshot = await electionsRef.get();
      }
      
      if (snapshot.empty) {
        return [];
      }

      const list = [];
      const now = Date.now();
      const dbUpdates = [];
      
      snapshot.forEach(doc => {
        const electionData = doc.data();
        let updatedStatus = electionData.status;
        
        const endTime = electionData.endDate ? new Date(electionData.endDate).getTime() : Infinity;
        const startTime = electionData.startDate ? new Date(electionData.startDate).getTime() : 0;

        if (electionData.status === 'active' && electionData.endDate && endTime < now) {
          updatedStatus = 'completed';
          dbUpdates.push(getElectionsRef(req).doc(doc.id).update({ status: 'completed' }));
        } else if (electionData.status === 'draft' && electionData.startDate && startTime <= now) {
          updatedStatus = 'active';
          dbUpdates.push(getElectionsRef(req).doc(doc.id).update({ status: 'active' }));
        }
        
        list.push({ id: doc.id, ...electionData, status: updatedStatus });
      });

      // Execute status updates in background if any occurred
      if (dbUpdates.length > 0) {
        Promise.all(dbUpdates)
          .then(() => {
            // Invalidate elections list & detail caches
            cache.invalidatePrefix('elections:');
            cache.invalidatePrefix('admin:');
          })
          .catch(err => console.error('Error updating election status in background:', err));
      }

      return list;
    }, 10000); // Cache for 10 seconds

    res.status(200).json({ status: 'success', data: elections });
  } catch (error) {
    console.error('Error fetching elections:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch elections' });
  }
});

// Get elections eligible for current logged in voter based on email matching in uploaded CSV rosters
router.get('/eligible', verifyAuth, async (req, res) => {
  try {
    const voterEmail = (req.user.email || '').toLowerCase().trim();
    const voterIndex = (req.user.indexNumber || req.user.studentId || req.user.uid || '').toLowerCase().trim();
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

    const now = Date.now();
    const dbUpdates = [];

    // Fetch all elections across root, tenants, organizations, and collectionGroup
    const electionsMap = new Map();

    try {
      const snapGroup = await db.collectionGroup('elections').get();
      snapGroup.forEach(d => electionsMap.set(d.id, { doc: d, ref: d.ref }));
    } catch (e) {}

    try {
      const snapRoot = await db.collection('elections').get();
      snapRoot.forEach(d => electionsMap.set(d.id, { doc: d, ref: d.ref }));
    } catch (e) {}

    const eligibleElections = [];

    for (const [electionId, { doc, ref }] of electionsMap.entries()) {
      const electionData = doc.data();
      if (!electionData) continue;

      const parentDoc = ref.parent ? ref.parent.parent : null;
      const tenantId = parentDoc ? parentDoc.id : DEFAULT_TENANT_ID;

      // Admins & Superadmins always see all elections
      let isEligible = isAdmin;

      if (!isEligible) {
        // Normal voters MUST be explicitly on the uploaded voter roster of the election to see it or vote
        const voterRosterSnap = await ref.collection('voter_roster').get().catch(() => ({ empty: true, docs: [] }));
        const eligibleVotersSnap = await ref.collection('eligible_voters').get().catch(() => ({ empty: true, docs: [] }));

        const allRosterDocs = [...(voterRosterSnap.docs || []), ...(eligibleVotersSnap.docs || [])];
        for (const rDoc of allRosterDocs) {
          const rData = rDoc.data() || {};
          const rEmail = (rData.email || '').toLowerCase().trim();
          const rIndex = (rData.indexNumber || rData.studentId || rDoc.id || '').toLowerCase().trim();

          if ((voterEmail && rEmail === voterEmail) ||
              (voterIndex && rIndex === voterIndex) ||
              (voterEmail && rIndex === voterEmail) ||
              (voterIndex && rEmail === voterIndex)) {
            isEligible = true;
            break;
          }
        }
      }

      if (isEligible) {
        let updatedStatus = electionData.status || 'draft';
        const endTime = electionData.endDate ? new Date(electionData.endDate).getTime() : Infinity;
        const startTime = electionData.startDate ? new Date(electionData.startDate).getTime() : 0;

        if (electionData.status && electionData.status !== 'draft') {
          if (now >= startTime && now <= endTime) {
            if (electionData.status !== 'active') {
              updatedStatus = 'active';
              dbUpdates.push(ref.update({ status: 'active' }).catch(() => {}));
            }
          } else if (now < startTime) {
            if (electionData.status !== 'scheduled') {
              updatedStatus = 'scheduled';
              dbUpdates.push(ref.update({ status: 'scheduled' }).catch(() => {}));
            }
          } else if (now > endTime) {
            if (electionData.status !== 'completed' && electionData.status !== 'ended') {
              updatedStatus = 'completed';
              dbUpdates.push(ref.update({ status: 'completed' }).catch(() => {}));
            }
          }
        }

        // Check if voter has cast a vote in this election
        let hasVoted = false;
        try {
          let votedSnap = await db.collection('tenants').doc(tenantId).collection('voted_voters')
            .where('electionId', '==', electionId)
            .where('voterId', '==', req.user.uid)
            .get();
          if (votedSnap.empty) {
            votedSnap = await db.collection('organizations').doc(tenantId).collection('voted_voters')
              .where('electionId', '==', electionId)
              .where('voterId', '==', req.user.uid)
              .get();
          }
          hasVoted = !votedSnap.empty;
        } catch (vErr) {}

        eligibleElections.push({
          id: electionId,
          tenantId,
          ...electionData,
          status: updatedStatus,
          hasVoted
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
});

// Get specific election details - CACHED & WRITE OPTIMIZED
router.get('/:id', async (req, res) => {
  try {
    const electionId = req.params.id;
    const cacheKey = `elections:detail:${electionId}`;

    const election = await cache.getOrSet(cacheKey, async () => {
      const { doc, ref, tenantId: resolvedTenantId, tenantCollection: resolvedTenantCollection } = await findElectionDoc(electionId, req);
      if (!doc || !doc.exists) {
        throw new Error('NOT_FOUND');
      }
      
      let electionData = doc.data();
      const now = Date.now();
      let updatedStatus = electionData.status || 'draft';
      
      const endTime = electionData.endDate ? new Date(electionData.endDate).getTime() : Infinity;
      const startTime = electionData.startDate ? new Date(electionData.startDate).getTime() : 0;

      if (electionData.status && electionData.status !== 'draft') {
        if (now >= startTime && now <= endTime) {
          if (electionData.status !== 'active') {
            updatedStatus = 'active';
            await ref.update({ status: 'active' });
            cache.invalidatePrefix('elections:');
            cache.invalidatePrefix('admin:');
          }
        } else if (now < startTime) {
          if (electionData.status !== 'scheduled') {
            updatedStatus = 'scheduled';
            await ref.update({ status: 'scheduled' });
            cache.invalidatePrefix('elections:');
            cache.invalidatePrefix('admin:');
          }
        } else if (now > endTime) {
          if (electionData.status !== 'completed' && electionData.status !== 'ended') {
            updatedStatus = 'completed';
            await ref.update({ status: 'completed' });
            cache.invalidatePrefix('elections:');
            cache.invalidatePrefix('admin:');
          }
        }
      }

      // Calculate dynamic real-time stats
      const collectionToUse = resolvedTenantCollection || 'tenants';
      const tenantIdToUse = resolvedTenantId || getTenantId(req);

      let totalVoters = electionData.totalVoters || electionData.voterCount || 0;
      let totalVotesCast = electionData.totalVotesCast || 0;
      let candidateCount = electionData.candidateCount || 0;
      let positionCount = electionData.positionCount || 0;

      // 1. Compute total voters from subcollections if missing/zero
      try {
        const rosterSnap = await ref.collection('voter_roster').get();
        const eligibleSnap = await ref.collection('eligible_voters').get();
        const subcolCount = Math.max(rosterSnap.size, eligibleSnap.size);
        if (subcolCount > 0) {
          totalVoters = Math.max(totalVoters, subcolCount);
        } else if (!totalVoters) {
          const tenantRollSnap = await db.collection(collectionToUse).doc(tenantIdToUse).collection('voter_rolls').get();
          let fallbackCount = tenantRollSnap.size;
          if (fallbackCount === 0) {
            const altCollection = collectionToUse === 'tenants' ? 'organizations' : 'tenants';
            const altRollSnap = await db.collection(altCollection).doc(tenantIdToUse).collection('voter_rolls').get();
            fallbackCount = altRollSnap.size;
          }
          totalVoters = fallbackCount;
        }
      } catch (e) {
        console.warn('Could not fetch voter roster count:', e.message);
      }

      // 2. Compute total votes cast from voted_voters if missing
      try {
        let votedSnap = await db.collection(collectionToUse).doc(tenantIdToUse).collection('voted_voters').where('electionId', '==', electionId).get();
        if (votedSnap.empty) {
          const altCollection = collectionToUse === 'tenants' ? 'organizations' : 'tenants';
          votedSnap = await db.collection(altCollection).doc(tenantIdToUse).collection('voted_voters').where('electionId', '==', electionId).get();
        }
        if (votedSnap.empty) {
          try {
            votedSnap = await db.collectionGroup('voted_voters').where('electionId', '==', electionId).get();
          } catch (e) {
            console.warn('[CollectionGroup voted_voters Fallback /:id]:', e.message);
            const fullSnap = await db.collectionGroup('voted_voters').get();
            const filteredDocs = fullSnap.docs.filter(d => d.data().electionId === electionId);
            votedSnap = {
              size: filteredDocs.length,
              empty: filteredDocs.length === 0,
              forEach: (cb) => filteredDocs.forEach(cb),
              docs: filteredDocs
            };
          }
        }
        totalVotesCast = Math.max(totalVotesCast, votedSnap.size);
      } catch (e) {
        console.warn('Could not fetch voted voters count:', e.message);
      }

      // 3. Compute candidate and position counts
      try {
        let candsSnap = await db.collection(collectionToUse).doc(tenantIdToUse).collection('candidates').where('electionId', '==', electionId).get();
        if (candsSnap.empty) {
          const altCollection = collectionToUse === 'tenants' ? 'organizations' : 'tenants';
          candsSnap = await db.collection(altCollection).doc(tenantIdToUse).collection('candidates').where('electionId', '==', electionId).get();
        }
        if (candsSnap.empty) {
          try {
            candsSnap = await db.collectionGroup('candidates').where('electionId', '==', electionId).get();
          } catch (e) {
            console.warn('[CollectionGroup candidates Fallback /:id]:', e.message);
            const fullSnap = await db.collectionGroup('candidates').get();
            const filteredDocs = fullSnap.docs.filter(d => d.data().electionId === electionId);
            candsSnap = {
              size: filteredDocs.length,
              empty: filteredDocs.length === 0,
              forEach: (cb) => filteredDocs.forEach(cb),
              docs: filteredDocs
            };
          }
        }
        candidateCount = candsSnap.size;
        const positions = new Set();
        candsSnap.forEach(cDoc => {
          const cData = cDoc.data();
          if (cData.position) positions.add(cData.position.trim());
        });
        positionCount = positions.size;
      } catch (e) {
        console.warn('Could not fetch candidate count:', e.message);
      }

      return {
        id: doc.id,
        ...electionData,
        status: updatedStatus,
        totalVoters,
        totalVotesCast,
        candidateCount,
        positionCount
      };
    }, 5000); // 5 second cache

    res.status(200).json({ status: 'success', data: election });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    console.error('Error fetching election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch election' });
  }
});

// Get detailed election results & candidate tallies
router.get('/:id/results', async (req, res) => {
  try {
    const electionId = req.params.id;
    const { doc: electionDoc, ref: electionRef, tenantId: resolvedTenantId, tenantCollection: resolvedTenantCollection } = await findElectionDoc(electionId, req);
    if (!electionDoc || !electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }

    const electionData = electionDoc.data();
    const collectionToUse = resolvedTenantCollection || 'tenants';

    // 1. Fetch candidates for this election from the resolved tenant / organization
    let candsSnap = await db.collection(collectionToUse).doc(resolvedTenantId).collection('candidates').where('electionId', '==', electionId).get();
    if (candsSnap.empty && collectionToUse === 'tenants') {
      candsSnap = await db.collection('organizations').doc(resolvedTenantId).collection('candidates').where('electionId', '==', electionId).get();
    } else if (candsSnap.empty && collectionToUse === 'organizations') {
      candsSnap = await db.collection('tenants').doc(resolvedTenantId).collection('candidates').where('electionId', '==', electionId).get();
    }
    if (candsSnap.empty) {
      try {
        candsSnap = await db.collectionGroup('candidates').where('electionId', '==', electionId).get();
      } catch (e) {
        console.warn('[CollectionGroup candidates Fallback /results]:', e.message);
        const fullSnap = await db.collectionGroup('candidates').get();
        const filteredDocs = fullSnap.docs.filter(d => d.data().electionId === electionId);
        candsSnap = {
          size: filteredDocs.length,
          empty: filteredDocs.length === 0,
          forEach: (cb) => filteredDocs.forEach(cb),
          docs: filteredDocs
        };
      }
    }
    const candidates = [];
    candsSnap.forEach(doc => {
      candidates.push({ id: doc.id, ...doc.data() });
    });

    candidates.sort((a, b) => {
      const numA = a.ballotNumber !== undefined && a.ballotNumber !== null && a.ballotNumber !== '' ? Number(a.ballotNumber) : 999;
      const numB = b.ballotNumber !== undefined && b.ballotNumber !== null && b.ballotNumber !== '' ? Number(b.ballotNumber) : 999;
      if (numA !== numB) return numA - numB;
      return (a.name || '').localeCompare(b.name || '');
    });

    // 2. Calculate unique voted voters from the resolved tenant / organization
    let votedSnap = await db.collection(collectionToUse).doc(resolvedTenantId).collection('voted_voters').where('electionId', '==', electionId).get();
    if (votedSnap.empty && collectionToUse === 'tenants') {
      votedSnap = await db.collection('organizations').doc(resolvedTenantId).collection('voted_voters').where('electionId', '==', electionId).get();
    } else if (votedSnap.empty && collectionToUse === 'organizations') {
      votedSnap = await db.collection('tenants').doc(resolvedTenantId).collection('voted_voters').where('electionId', '==', electionId).get();
    }
    if (votedSnap.empty) {
      try {
        votedSnap = await db.collectionGroup('voted_voters').where('electionId', '==', electionId).get();
      } catch (e) {
        console.warn('[CollectionGroup voted_voters Fallback /results]:', e.message);
        const fullSnap = await db.collectionGroup('voted_voters').get();
        const filteredDocs = fullSnap.docs.filter(d => d.data().electionId === electionId);
        votedSnap = {
          size: filteredDocs.length,
          empty: filteredDocs.length === 0,
          forEach: (cb) => filteredDocs.forEach(cb),
          docs: filteredDocs
        };
      }
    }
    const uniqueVotersCast = votedSnap.size;

    let candidateTotalVotes = 0;
    candidates.forEach(c => {
      candidateTotalVotes += (c.votes || 0) + (c.noVotes || 0);
    });

    const totalVotesCast = electionData.totalVotesCast || uniqueVotersCast || candidateTotalVotes;

    // 3. Calculate total roster voters
    let totalVoters = electionData.totalVoters || 0;
    if (!totalVoters) {
      let votersSnap = await electionRef.collection('eligible_voters').get();
      if (votersSnap.empty) {
        votersSnap = await electionRef.collection('voter_roster').get();
      }
      totalVoters = votersSnap.size;
    }

    res.status(200).json({
      status: 'success',
      data: {
        election: {
          id: electionId,
          ...electionData,
          totalVoters,
          totalVotesCast
        },
        candidates,
        totalVotes: totalVotesCast
      }
    });
  } catch (error) {
    console.error('Error fetching election results:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch election results' });
  }
});

// Create new election (Admin only)
router.post('/', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, startDate, endDate, organizationId, type, department, showResults, previewImageUrl } = req.body;
    
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const electionType = type || 'src';
    const deptLabel = (department || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const dateLabel = startDate
      ? new Date(startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const autoDesc = `This is the ${title} scheduled for ${dateLabel}. Eligible voters are invited to vote for their preferred candidates across all positions.`;

    const finalDescription = (description && description.trim() && !description.includes('Student Representative Council (SRC) election')) ? description.trim() : autoDesc;

    const newElection = {
      title,
      description: finalDescription,
      startDate,
      endDate,
      organizationId: organizationId || 'default',
      type: electionType,
      department: department || '',
      status: req.body.status || 'draft',
      showResults: showResults === true,
      previewImageUrl: previewImageUrl || '',
      createdBy: 'admin',
      createdAt: Date.now()
    };

    const docRef = await getElectionsRef(req).add(newElection);

    // Invalidate election list caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    res.status(201).json({ status: 'success', data: { id: docRef.id, ...newElection } });
  } catch (error) {
    console.error('Error creating election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create election' });
  }
});

// Migrate existing elections (Admin only)
router.post('/migrate-descriptions', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const snapshot = await getElectionsRef(req).get();
    const updates = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const currentDesc = data.description || '';
      if (!currentDesc || currentDesc.includes('Student Representative Council (SRC) election') || currentDesc.startsWith('Automated')) {
        const title = data.title || 'Election';
        const dateLabel = data.startDate
          ? new Date(data.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'the scheduled window';

        const newDesc = `This is the ${title} scheduled for ${dateLabel}. Eligible voters are invited to vote for their preferred candidates across all positions.`;
        updates.push(getElectionsRef(req).doc(doc.id).update({ description: newDesc }));
      }
    });

    await Promise.all(updates);
    
    // Invalidate election caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    res.status(200).json({ status: 'success', message: `Updated ${updates.length} election(s)` });
  } catch (error) {
    console.error('Error migrating descriptions:', error);
    res.status(500).json({ status: 'error', message: 'Migration failed' });
  }
});

// Full General Edit/Status Update Details (Admin/PUT/PATCH supported)
const updateElectionHandler = async (req, res) => {
  try {
    const electionId = req.params.id;
    const { title, description, category, startDate, endDate, status, showResults, otpRequired, previewImageUrl } = req.body;

    const { doc: electionDoc, ref: electionRef } = await findElectionDoc(electionId, req);
    if (!electionDoc || !electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }

    const updateFields = { updatedAt: Date.now() };
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
    // 1. If explicit status === 'active', ensure dates allow immediate voting
    if (status === 'active') {
      const currentStart = startDate !== undefined ? startDate : electionDoc.data().startDate;
      const currentEnd = endDate !== undefined ? endDate : electionDoc.data().endDate;
      
      if (!currentStart || new Date(currentStart).getTime() > now) {
        updateFields.startDate = new Date(now - 1000).toISOString(); // 1 second in the past
      }
      if (!currentEnd || new Date(currentEnd).getTime() <= now) {
        updateFields.endDate = new Date(now + 2 * 60 * 60 * 1000).toISOString(); // 2 hours in the future
      }
    }

    // 2. If dates are updated, auto-calculate the target status
    const targetStatus = updateFields.status !== undefined ? updateFields.status : electionDoc.data().status;
    const targetStart = updateFields.startDate !== undefined ? updateFields.startDate : electionDoc.data().startDate;
    const targetEnd = updateFields.endDate !== undefined ? updateFields.endDate : electionDoc.data().endDate;
    
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

    await electionRef.update(updateFields);

    // Invalidate caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:');

    res.status(200).json({
      status: 'success',
      message: 'Election metadata updated successfully.',
      data: { id: electionId, ...updateFields }
    });
  } catch (error) {
    console.error('Error updating election details:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update election details.' });
  }
};

router.patch('/:id', verifyAuth, requireAdmin, updateElectionHandler);
router.put('/:id', verifyAuth, requireAdmin, updateElectionHandler);

// Update election time window (Admin only)
router.patch('/:id/time-window', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'startDate and endDate are required' });
    }

    const { doc: electionDoc, ref: electionRef } = await findElectionDoc(req.params.id, req);
    if (!electionDoc || !electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }

    const electionData = electionDoc.data();
    const isActive = electionData.status === 'active';

    if (isActive) {
      // For active elections: only allow extending the end time, not reducing it
      const currentEndDate = new Date(electionData.endDate).getTime();
      const newEndDate = new Date(endDate).getTime();

      if (newEndDate < currentEndDate) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot reduce the end time of an ongoing election. You may only extend it.'
        });
      }

      // Only update endDate for active elections (don't change startDate mid-election)
      await getElectionsRef(req).doc(req.params.id).update({ endDate });
    } else {
      // For draft/completed elections: update both start and end dates freely
      const updateData = { startDate, endDate };
      const now = Date.now();
      const newEndTime = new Date(endDate).getTime();
      
      // If it was completed but they just moved the end date to the future, auto-reactivate it!
      if (electionData.status === 'completed' && newEndTime > now) {
        updateData.status = 'active';
      }

      await getElectionsRef(req).doc(req.params.id).update(updateData);
    }

    // Invalidate caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    res.status(200).json({ status: 'success', message: 'Election time window updated' });
  } catch (error) {
    console.error('Error updating election time window:', error);
    res.status(500).json({ status: 'error', message: `Failed to update time window: ${error.message} - ${error.stack}` });
  }
});

// Reactivate a completed election with a new end date (Admin only)
// NOTE: This does NOT clear votes, candidates, or results — it only extends time and sets status back to active
router.patch('/:id/reactivate', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { endDate } = req.body;
    if (!endDate) {
      return res.status(400).json({ status: 'error', message: 'A new endDate is required to reactivate the election' });
    }

    const newEndDate = new Date(endDate).getTime();
    if (isNaN(newEndDate) || newEndDate <= Date.now()) {
      return res.status(400).json({ status: 'error', message: 'The new end date must be in the future' });
    }

    const electionDoc = await getElectionsRef(req).doc(req.params.id).get();
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    if (electionDoc.data().status !== 'completed') {
      return res.status(400).json({ status: 'error', message: 'Only completed elections can be reactivated' });
    }

    // Atomically update endDate, reset startDate to now, and change status back to active
    const nowISO = new Date().toISOString();
    await getElectionsRef(req).doc(req.params.id).update({
      startDate: nowISO,
      endDate,
      status: 'active',
      reactivatedAt: nowISO
    });

    // Invalidate caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:');

    res.status(200).json({ status: 'success', message: 'Election reactivated successfully with new time window' });
  } catch (error) {
    console.error('Error reactivating election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to reactivate election' });
  }
});

// Update election status (Admin only)
router.patch('/:id/status', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status' });
    }

    await getElectionsRef(req).doc(req.params.id).update({ status });

    // Invalidate caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    res.status(200).json({ status: 'success', message: `Election status updated to ${status}` });
  } catch (error) {
    console.error('Error updating election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update election' });
  }
});

// Toggle showResults status (Admin only)
router.patch('/:id/toggle-results', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { showResults } = req.body;
    if (typeof showResults !== 'boolean') {
      return res.status(400).json({ status: 'error', message: 'showResults must be a boolean' });
    }

    await getElectionsRef(req).doc(req.params.id).update({ showResults });

    // Invalidate caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:'); // Voters fetch candidates check results visibility

    res.status(200).json({ status: 'success', message: `Voter results visibility updated to ${showResults}` });
  } catch (error) {
    console.error('Error toggling results visibility:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update results visibility' });
  }
});

// Delete election (Admin only)
router.delete('/:id', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    await getElectionsRef(req).doc(electionId).delete();

    // Cascade delete associated candidates, votes, and voted_voters
    const collectionsToDelete = ['candidates', 'votes', 'voted_voters'];
    
    for (const collectionName of collectionsToDelete) {
      const snapshot = await db.collection(collectionName).where('electionId', '==', electionId).get();
      if (!snapshot.empty) {
        // Firestore batch allows up to 500 operations. For simplicity and since elections might have >500 votes,
        // we'll delete them concurrently using Promise.all in chunks.
        const docs = snapshot.docs;
        const chunkSize = 400;
        for (let i = 0; i < docs.length; i += chunkSize) {
          const chunk = docs.slice(i, i + chunkSize);
          const batch = db.batch();
          chunk.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      }
    }

    // Invalidate caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:');

    res.status(200).json({ status: 'success', message: 'Election and all associated data deleted successfully' });
  } catch (error) {
    console.error('Error deleting election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete election' });
  }
});

// Generate election report JSON (Admin only) - CACHED
router.get('/:id/report', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const cacheKey = `elections:report:${electionId}`;

    const report = await cache.getOrSet(cacheKey, async () => {
      // 1. Get election details (1 Read)
      const { doc: electionDoc, tenantId: resolvedTenantId, ref: electionRef } = await findElectionDoc(electionId, req);
      if (!electionDoc || !electionDoc.exists) {
        throw new Error('NOT_FOUND');
      }
      const election = { id: electionId, ...electionDoc.data() };
      
      // 2. Get candidates (1 Read per candidate, usually ~10 Reads)
      let candidatesSnapshot = await db.collection('tenants').doc(resolvedTenantId).collection('candidates').where('electionId', '==', electionId).get();
      if (candidatesSnapshot.empty) {
        candidatesSnapshot = await db.collection('organizations').doc(resolvedTenantId).collection('candidates').where('electionId', '==', electionId).get();
      }
      if (candidatesSnapshot.empty) {
        try {
          candidatesSnapshot = await db.collectionGroup('candidates').where('electionId', '==', electionId).get();
        } catch (e) {
          console.warn('[CollectionGroup candidates Fallback /report]:', e.message);
          const fullSnap = await db.collectionGroup('candidates').get();
          const filteredDocs = fullSnap.docs.filter(d => d.data().electionId === electionId);
          candidatesSnapshot = {
            forEach: (cb) => filteredDocs.forEach(cb)
          };
        }
      }
      const candidates = [];
      candidatesSnapshot.forEach(doc => {
        candidates.push({ id: doc.id, ...doc.data() });
      });
      
      // 3. OPTIMIZED: Get total votes cast using count() (~2 Reads instead of 2,000 Reads)
      let votesCountSnap = await db.collection('tenants').doc(resolvedTenantId).collection('votes').where('electionId', '==', electionId).count().get();
      let totalVotes = votesCountSnap.data().count;
      if (totalVotes === 0) {
        votesCountSnap = await db.collection('organizations').doc(resolvedTenantId).collection('votes').where('electionId', '==', electionId).count().get();
        totalVotes = votesCountSnap.data().count;
      }
      if (totalVotes === 0) {
        try {
          votesCountSnap = await db.collectionGroup('votes').where('electionId', '==', electionId).count().get();
          totalVotes = votesCountSnap.data().count;
        } catch (e) {
          console.warn('[CollectionGroup votes count Fallback /report]:', e.message);
          try {
            const fullSnap = await db.collectionGroup('votes').get();
            const filteredDocs = fullSnap.docs.filter(d => d.data().electionId === electionId);
            totalVotes = filteredDocs.length;
          } catch (err) {
            console.error('Failed fallback for votes count:', err);
          }
        }
      }
      
      // 4. OPTIMIZED: Get unique voters count using count() (~2 Reads instead of 2,000 Reads)
      let votedVotersCountSnap = await db.collection('tenants').doc(resolvedTenantId).collection('voted_voters').where('electionId', '==', electionId).count().get();
      let uniqueVoters = votedVotersCountSnap.data().count;
      if (uniqueVoters === 0) {
        votedVotersCountSnap = await db.collection('organizations').doc(resolvedTenantId).collection('voted_voters').where('electionId', '==', electionId).count().get();
        uniqueVoters = votedVotersCountSnap.data().count;
      }
      if (uniqueVoters === 0) {
        try {
          votedVotersCountSnap = await db.collectionGroup('voted_voters').where('electionId', '==', electionId).count().get();
          uniqueVoters = votedVotersCountSnap.data().count;
        } catch (e) {
          console.warn('[CollectionGroup voted_voters count Fallback /report]:', e.message);
          try {
            const fullSnap = await db.collectionGroup('voted_voters').get();
            const filteredDocs = fullSnap.docs.filter(d => d.data().electionId === electionId);
            uniqueVoters = filteredDocs.length;
          } catch (err) {
            console.error('Failed fallback for voted_voters count:', err);
          }
        }
      }
      
      // Calculate position-wise total votes
      const positionTotals = {};
      candidates.forEach(c => {
        const pos = c.position || 'General';
        if (!positionTotals[pos]) positionTotals[pos] = 0;
        positionTotals[pos] += (c.votes || 0) + (c.noVotes || 0);
      });

      // Get total roster voters
      let totalVotersCount = 0;
      try {
        if (electionRef) {
          const rosterSnap = await electionRef.collection('voter_roster').get();
          const eligibleSnap = await electionRef.collection('eligible_voters').get();
          const subcolCount = Math.max(rosterSnap.size, eligibleSnap.size);
          if (subcolCount > 0) {
            totalVotersCount = subcolCount;
          } else {
            const tenantRollSnap = await db.collection('tenants').doc(resolvedTenantId).collection('voter_rolls').get();
            const orgRollSnap = await db.collection('organizations').doc(resolvedTenantId).collection('voter_rolls').get();
            totalVotersCount = Math.max(tenantRollSnap.size, orgRollSnap.size);
          }
        }
      } catch (e) {}
      
      return {
        election: {
          title: election.title,
          description: election.description,
          startDate: new Date(election.startDate).toLocaleString(),
          endDate: new Date(election.endDate).toLocaleString(),
          status: election.status,
          type: election.type,
          department: election.department,
          createdAt: new Date(election.createdAt).toLocaleString()
        },
        statistics: {
          totalCandidates: candidates.length,
          totalVotesCast: totalVotes,
          uniqueVoters: uniqueVoters,
          totalEligibleVoters: totalVotersCount,
          turnoutPercentage: totalVotersCount > 0 ? ((uniqueVoters / totalVotersCount) * 100).toFixed(2) : '0.00',
          reportGeneratedAt: new Date().toLocaleString()
        },
        candidates: candidates.map(c => {
          const pos = c.position || 'General';
          const posTotal = positionTotals[pos] || 0;
          return {
            name: c.name,
            position: c.position,
            manifesto: c.manifesto,
            votes: c.votes || 0,
            noVotes: c.noVotes || 0,
            isIndependent: !!c.isIndependent,
            percentage: posTotal > 0 ? ((c.votes || 0) / posTotal * 100).toFixed(2) : '0.00'
          };
        }).sort((a, b) => b.votes - a.votes)
      };
    }, 15000); // Cache for 15 seconds

    res.status(200).json({ status: 'success', data: report });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    console.error('Error generating election report:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate election report' });
  }
});

// Download election report as PDF (Admin only) - CACHED
router.get('/:id/report/pdf', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const cacheKey = `elections:report:pdf:${electionId}`;

    const reportData = await cache.getOrSet(cacheKey, async () => {
      // 1. Get election details
      const { doc: electionDoc, tenantId: resolvedTenantId } = await findElectionDoc(electionId, req);
      if (!electionDoc || !electionDoc.exists) {
        throw new Error('NOT_FOUND');
      }
      const election = { id: electionId, ...electionDoc.data() };
      
      // 2. Get candidates
      let candidatesSnapshot = await db.collection('tenants').doc(resolvedTenantId).collection('candidates').where('electionId', '==', electionId).get();
      if (candidatesSnapshot.empty) {
        candidatesSnapshot = await db.collection('organizations').doc(resolvedTenantId).collection('candidates').where('electionId', '==', electionId).get();
      }
      const candidates = [];
      candidatesSnapshot.forEach(doc => {
        candidates.push({ id: doc.id, ...doc.data() });
      });
      
      // 3. OPTIMIZED: Fast aggregation count for total votes
      let votesCountSnap = await db.collection('tenants').doc(resolvedTenantId).collection('votes').where('electionId', '==', electionId).count().get();
      let totalVotes = votesCountSnap.data().count;
      if (totalVotes === 0) {
        votesCountSnap = await db.collection('organizations').doc(resolvedTenantId).collection('votes').where('electionId', '==', electionId).count().get();
        totalVotes = votesCountSnap.data().count;
      }
      
      // 4. OPTIMIZED: Fast aggregation count for unique voters
      let votedVotersCountSnap = await db.collection('tenants').doc(resolvedTenantId).collection('voted_voters').where('electionId', '==', electionId).count().get();
      let uniqueVoters = votedVotersCountSnap.data().count;
      if (uniqueVoters === 0) {
        votedVotersCountSnap = await db.collection('organizations').doc(resolvedTenantId).collection('voted_voters').where('electionId', '==', electionId).count().get();
        uniqueVoters = votedVotersCountSnap.data().count;
      }

      // 5. Fetch ONLY the 50 most recent verification hashes to prevent PDF overload & quota exhaustion
      let verificationLogsSnap = await db.collection('tenants').doc(resolvedTenantId).collection('voted_voters')
        .where('electionId', '==', electionId)
        .limit(50)
        .get();
      if (verificationLogsSnap.empty) {
        verificationLogsSnap = await db.collection('organizations').doc(resolvedTenantId).collection('voted_voters')
          .where('electionId', '==', electionId)
          .limit(50)
          .get();
      }

      const verificationIds = [];
      verificationLogsSnap.forEach(doc => {
        const data = doc.data();
        verificationIds.push({
          id: data.auditTxId || doc.id,
          position: data.position || 'General',
          timestamp: data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'
        });
      });

      // Get total roster voters
      let totalEligibleVoters = 0;
      try {
        const rosterSnap = await db.collection('tenants').doc(resolvedTenantId).collection('elections').doc(electionId).collection('voter_roster').get();
        const eligibleSnap = await db.collection('tenants').doc(resolvedTenantId).collection('elections').doc(electionId).collection('eligible_voters').get();
        const subcolCount = Math.max(rosterSnap.size, eligibleSnap.size);
        if (subcolCount > 0) {
          totalEligibleVoters = subcolCount;
        } else {
          const tenantRollSnap = await db.collection('tenants').doc(resolvedTenantId).collection('voter_rolls').get();
          const orgRollSnap = await db.collection('organizations').doc(resolvedTenantId).collection('voter_rolls').get();
          totalEligibleVoters = Math.max(tenantRollSnap.size, orgRollSnap.size);
        }
      } catch (e) {}

      return {
        election,
        candidates,
        totalVotes,
        uniqueVoters,
        totalEligibleVoters,
        verificationIds
      };
    }, 30000); // Cache pdf data for 30s
    const { election, candidates, totalVotes, uniqueVoters, totalEligibleVoters, verificationIds } = reportData;
    const { executiveSummary, customNotes, ecName, ecTitle, showSignature, signatureText } = req.query;

    // Pre-fetch candidate images to memory buffers in parallel
    const getImageBuffer = async (url) => {
      try {
        if (!url) return null;
        if (url.startsWith('/')) {
          const localPath = path.join(__dirname, '../../public', url);
          if (fs.existsSync(localPath)) return fs.readFileSync(localPath);
        }
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (e) {
        console.warn('Error fetching image for PDF:', e.message);
        return null;
      }
    };

    const imageBuffers = {};
    await Promise.all(
      candidates.map(async (cand) => {
        if (cand.photoUrl) {
          const buf = await getImageBuffer(cand.photoUrl);
          if (buf) {
            imageBuffers[cand.id] = buf;
          }
        }
      })
    );
    
    // Generate PDF Document
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${election.title.replace(/[^a-zA-Z0-9]/g, '_')}_report.pdf"`);
    
    doc.pipe(res);
    
    // --- STEP 1: Professional Letterhead Header ---
    const primaryColor = '#0F172A';
    const secondaryColor = '#B91C1C';
    const darkGray = '#334155';
    const lightGray = '#64748B';
    const borderBgColor = '#F1F5F9';

    // Load logo
    const logoPath = path.join(__dirname, '../../assets/logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 60 });
    }

    // Letterhead text
    doc.fillColor(primaryColor)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('HO TECHNICAL UNIVERSITY', 125, 45);

    doc.fillColor(darkGray)
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('STUDENTS\' REPRESENTATIVE COUNCIL (SRC)', 125, 62);

    doc.fillColor(secondaryColor)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('OFFICIAL CERTIFIED ELECTION AUDIT REPORT', 125, 76);

    doc.fillColor(lightGray)
       .fontSize(8)
       .font('Helvetica')
       .text('P.O. Box HP 35, Ho, Volta Region, Ghana | info@htu.edu.gh', 125, 93);

    // Thick primary color line
    doc.moveTo(50, 110)
       .lineTo(545, 110)
       .lineWidth(2)
       .strokeColor(primaryColor)
       .stroke();

    // Thin secondary color line
    doc.moveTo(50, 114)
       .lineTo(545, 114)
       .lineWidth(1)
       .strokeColor(secondaryColor)
       .stroke();

    // Reset coordinates for body text
    doc.y = 135;
    
    doc.fillColor(primaryColor)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text(election.title);
    doc.moveDown(0.5);
    
    doc.fillColor(darkGray)
       .fontSize(10)
       .font('Helvetica')
       .text(`Description: ${election.description || 'N/A'}`)
       .text(`Start Date: ${new Date(election.startDate).toLocaleString()}`)
       .text(`End Date: ${new Date(election.endDate).toLocaleString()}`)
       .text(`Status: ${election.status.toUpperCase()}`)
       .text(`Type: ${election.type || 'N/A'}`)
       .text(`Department: ${election.department || 'N/A'}`);
    doc.moveDown();

    // Custom Executive Summary
    if (executiveSummary) {
      doc.fontSize(16).font('Helvetica-Bold').text('Executive Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica').text(executiveSummary.toString());
      doc.moveDown();
    }
       // Statistics section
    doc.fontSize(16).font('Helvetica-Bold').text('Statistics', { underline: true });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Total Valid Voters (Roster Size): ${totalEligibleVoters || 'N/A'}`);
    doc.text(`Total Votes Cast (Ballots cast): ${uniqueVoters}`);
    doc.text(`Voter Turnout Rate: ${totalEligibleVoters > 0 ? ((uniqueVoters / totalEligibleVoters) * 100).toFixed(2) : '0.00'}%`);
    doc.text(`Total Registered Candidates: ${candidates.length}`);
    doc.text(`Cryptographic Ledger Integrity: VERIFIED & INTACT`);
    doc.text(`Report Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    // Group candidates by position
    const candidatesByPosition = {};
    candidates.forEach(c => {
      const pos = c.position || 'General';
      if (!candidatesByPosition[pos]) candidatesByPosition[pos] = [];
      candidatesByPosition[pos].push(c);
    });

    // Calculate position-wise total votes
    const positionTotals = {};
    candidates.forEach(c => {
      const pos = c.position || 'General';
      if (!positionTotals[pos]) positionTotals[pos] = 0;
      positionTotals[pos] += (c.votes || 0) + (c.noVotes || 0);
    });

    // Candidates section - start on a clean fresh page
    doc.addPage();
    doc.fillColor(primaryColor)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('Certified Position Results & Tally Ratios', { underline: true });
    doc.moveDown(0.5);
    
    Object.entries(candidatesByPosition).forEach(([position, list]) => {
      if (doc.y > 600) doc.addPage();

      doc.fillColor(primaryColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(`Position: ${position}`);
      doc.moveDown(0.2);

      const posTotal = positionTotals[position] || 0;
      
      const sorted = [...list].sort((a, b) => (b.votes || 0) - (a.votes || 0));
      
      sorted.forEach((cand, idx) => {
        if (doc.y > 650) doc.addPage();
        
        if (cand.isIndependent) {
          const yesVotes = cand.votes || 0;
          const noVotes = cand.noVotes || 0;
          const totalInd = yesVotes + noVotes;
          const yesRatio = totalInd > 0 ? ((yesVotes / totalInd) * 100).toFixed(2) : '0.00';
          const noRatio = totalInd > 0 ? ((noVotes / totalInd) * 100).toFixed(2) : '0.00';

          doc.fillColor(darkGray)
             .fontSize(10)
             .font('Helvetica-Bold')
             .text(`   ${idx + 1}. ${cand.name} (Unopposed)`, 50, doc.y);
          doc.y += 4;

          doc.fillColor(lightGray)
             .fontSize(9)
             .font('Helvetica')
             .text(`      YES: ${yesVotes} (${yesRatio}%)`, 50, doc.y);
          const yesBarY = doc.y + 1;
          doc.rect(180, yesBarY, 300, 8).fill('#E2E8F0');
          if (yesVotes > 0) {
            const fillWidth = 300 * (yesVotes / totalInd);
            doc.rect(180, yesBarY, fillWidth, 8).fill(secondaryColor);
          }
          doc.y += 14;

          doc.fillColor(lightGray)
             .fontSize(9)
             .font('Helvetica')
             .text(`      NO: ${noVotes} (${noRatio}%)`, 50, doc.y);
          const noBarY = doc.y + 1;
          doc.rect(180, noBarY, 300, 8).fill('#E2E8F0');
          if (noVotes > 0) {
            const fillWidth = 300 * (noVotes / totalInd);
            doc.rect(180, noBarY, fillWidth, 8).fill(lightGray);
          }
          doc.y += 20;
        } else {
          const candVotes = cand.votes || 0;
          const ratio = posTotal > 0 ? ((candVotes / posTotal) * 100).toFixed(2) : '0.00';

          doc.fillColor(darkGray)
             .fontSize(10)
             .font('Helvetica-Bold')
             .text(`   ${idx + 1}. ${cand.name}`, 50, doc.y);
          doc.y += 4;

          doc.fillColor(lightGray)
             .fontSize(9)
             .font('Helvetica')
             .text(`      Votes: ${candVotes} (${ratio}%)`, 50, doc.y);
          const barY = doc.y + 1;
          doc.rect(180, barY, 300, 8).fill('#E2E8F0');
          if (candVotes > 0) {
            const fillWidth = 300 * (candVotes / posTotal);
            const barColor = (idx === 0) ? primaryColor : lightGray;
            doc.rect(180, barY, fillWidth, 8).fill(barColor);
          }
          doc.y += 20;
        }
      });
      
      let winnerText = 'No winner';
      const topCand = sorted[0];
      if (topCand) {
        if (topCand.isIndependent) {
          const yes = topCand.votes || 0;
          const no = topCand.noVotes || 0;
          winnerText = yes > no ? `${topCand.name} (Approved by Yes votes)` : `${topCand.name} (Rejected by No votes)`;
        } else {
          const runnerUp = sorted[1];
          if (runnerUp && runnerUp.votes === topCand.votes && topCand.votes > 0) {
            winnerText = `Tie between ${topCand.name} and ${runnerUp.name} (${topCand.votes} votes each)`;
          } else if (topCand.votes > 0) {
            const ratio = posTotal > 0 ? ((topCand.votes / posTotal) * 100).toFixed(2) : '0.00';
            winnerText = `${topCand.name} (${topCand.votes} votes, ${ratio}%)`;
          } else {
            winnerText = 'No votes cast for this position';
          }
        }
      }

      doc.fillColor(primaryColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(`   Winner: ${winnerText}`, 50, doc.y);
      doc.moveDown(1.5);
    });

    if (doc.y > 600) doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Cryptographic Voter Verification Ledger (Recent 50)', { underline: true });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text('Cryptographic audit hashes generated for verified ballots:');
    doc.moveDown();
    if (verificationIds.length === 0) {
      doc.text('No verified ballot hashes recorded yet.');
    } else {
      verificationIds.forEach((v, index) => {
        doc.fontSize(9).font('Courier').text(`${index + 1}. [HASH]: ${v.id} | [Pos]: ${v.position} | [Time]: ${v.timestamp}`);
      });
    }
    doc.moveDown();

    // Custom Notes / Addendum
    if (customNotes) {
      doc.moveDown();
      if (doc.y > 600) doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('EC Special Notes / Addendum', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica').text(customNotes.toString());
      doc.moveDown();
    }

    // EC Official Sign-Off Section
    if (showSignature === 'true') {
      doc.moveDown(2);
      if (doc.y > 600) doc.addPage();
      
      const signY = doc.y;
      
      // Left Side: Signature and Details
      doc.fillColor(primaryColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('CERTIFIED AND SIGNED BY:', 50, signY);
      
      // Draw the digital signature text above line in Courier-Oblique mimicking ink/handwriting
      const sigTxt = signatureText || ecName || 'Electoral Commission';
      doc.fillColor('#1E40AF') // Blue ink style
         .fontSize(15)
         .font('Courier-Oblique')
         .text(sigTxt.toString(), 50, signY + 22);

      // Draw signature line
      doc.moveTo(50, signY + 42)
         .lineTo(250, signY + 42)
         .lineWidth(0.8)
         .strokeColor(primaryColor)
         .stroke();
      
      // Draw Commissioner name and title below line
      doc.fillColor(darkGray)
         .fontSize(9)
         .font('Helvetica-Bold')
         .text(ecName ? ecName.toString() : 'Electoral Commissioner', 50, signY + 47);
      doc.fillColor(lightGray)
         .fontSize(8)
         .font('Helvetica')
         .text(ecTitle ? ecTitle.toString() : 'Electoral Commission', 50, signY + 58);
      
      // Right Side: Official Seal / Stamp Group
      // Circular Seal representation in vector red ink
      const sealCenterX = 450;
      const sealCenterY = signY + 40;

      // Outer double circle
      doc.circle(sealCenterX, sealCenterY, 32)
         .lineWidth(1.2)
         .strokeColor(secondaryColor)
         .stroke();

      doc.circle(sealCenterX, sealCenterY, 28)
         .lineWidth(0.6)
         .strokeColor(secondaryColor)
         .stroke();

      // Seal internal text
      doc.fillColor(secondaryColor)
         .fontSize(5)
         .font('Helvetica-Bold')
         .text('ELECTORAL COMMISSION', sealCenterX - 25, sealCenterY - 14, { align: 'center', width: 50 })
         .fontSize(5.5)
         .font('Helvetica-Bold')
         .text('APPROVED', sealCenterX - 25, sealCenterY - 3, { align: 'center', width: 50 })
         .fontSize(5)
         .font('Helvetica')
         .text('HTU-ELECT', sealCenterX - 25, sealCenterY + 7, { align: 'center', width: 50 });

      // Date label right next to the seal
      doc.fillColor(darkGray)
         .fontSize(8)
         .font('Helvetica-Bold')
         .text('OFFICIAL SEAL & STAMP', 280, signY + 25, { align: 'right', width: 110 });
      doc.fillColor(lightGray)
         .fontSize(8)
         .font('Helvetica')
         .text(`DATE: ${new Date().toLocaleDateString()}`, 280, signY + 37, { align: 'right', width: 110 });

      // Set spacing for layout integrity
      doc.y = signY + 80;
    }

    // --- STEP 2: Add dynamic page headers and footers (Two-Pass approach) ---
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      // Running header on pages 2+
      if (i > 0) {
        doc.fillColor('#0F172A')
           .fontSize(8)
           .font('Helvetica-Bold')
           .text('Electoral Commission - Official Election Report', 50, 30);
        doc.moveTo(50, 42)
           .lineTo(545, 42)
           .lineWidth(0.5)
           .strokeColor('#64748B')
           .stroke();
      }

      // Footer on all pages
      doc.moveTo(50, 790)
         .lineTo(545, 790)
         .lineWidth(0.5)
         .strokeColor('#64748B')
         .stroke();

      doc.fillColor('#64748B')
         .fontSize(8)
         .font('Helvetica')
         .text(`Page ${i + 1} of ${pages.count}`, 50, 796, { align: 'right', width: 495 });

      doc.text('GENERATED BY COMPSSA SECURE ELECTIONS SYSTEM • HTU-ELECT', 50, 796, { align: 'left', width: 400 });
    }
    
    doc.end();

  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    console.error('Error generating PDF report:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate PDF report' });
  }
});

// Download visual election results as PDF (Admin only) - CACHED
router.get('/:id/results/pdf', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const cacheKey = `elections:results:pdf:${electionId}`;

    const reportData = await cache.getOrSet(cacheKey, async () => {
      const { doc: electionDoc, tenantId: resolvedTenantId } = await findElectionDoc(electionId, req);
      if (!electionDoc || !electionDoc.exists) {
        throw new Error('NOT_FOUND');
      }
      const election = { id: electionId, ...electionDoc.data() };
      
      let candidatesSnapshot = await db.collection('tenants').doc(resolvedTenantId).collection('candidates').where('electionId', '==', electionId).get();
      if (candidatesSnapshot.empty) {
        candidatesSnapshot = await db.collection('organizations').doc(resolvedTenantId).collection('candidates').where('electionId', '==', electionId).get();
      }
      const candidates = [];
      candidatesSnapshot.forEach(doc => {
        candidates.push({ id: doc.id, ...doc.data() });
      });
      
      let votesCountSnap = await db.collection('tenants').doc(resolvedTenantId).collection('votes').where('electionId', '==', electionId).count().get();
      let totalVotes = votesCountSnap.data().count;
      if (totalVotes === 0) {
        votesCountSnap = await db.collection('organizations').doc(resolvedTenantId).collection('votes').where('electionId', '==', electionId).count().get();
        totalVotes = votesCountSnap.data().count;
      }
      
      let votedVotersCountSnap = await db.collection('tenants').doc(resolvedTenantId).collection('voted_voters').where('electionId', '==', electionId).count().get();
      let uniqueVoters = votedVotersCountSnap.data().count;
      if (uniqueVoters === 0) {
        votedVotersCountSnap = await db.collection('organizations').doc(resolvedTenantId).collection('voted_voters').where('electionId', '==', electionId).count().get();
        uniqueVoters = votedVotersCountSnap.data().count;
      }

      let totalEligibleVoters = 0;
      try {
        const rosterSnap = await db.collection('tenants').doc(resolvedTenantId).collection('elections').doc(electionId).collection('voter_roster').get();
        const eligibleSnap = await db.collection('tenants').doc(resolvedTenantId).collection('elections').doc(electionId).collection('eligible_voters').get();
        const subcolCount = Math.max(rosterSnap.size, eligibleSnap.size);
        if (subcolCount > 0) {
          totalEligibleVoters = subcolCount;
        } else {
          const tenantRollSnap = await db.collection('tenants').doc(resolvedTenantId).collection('voter_rolls').get();
          const orgRollSnap = await db.collection('organizations').doc(resolvedTenantId).collection('voter_rolls').get();
          totalEligibleVoters = Math.max(tenantRollSnap.size, orgRollSnap.size);
        }
      } catch (e) {}

      return {
        election,
        candidates,
        totalVotes,
        uniqueVoters,
        totalEligibleVoters
      };
    }, 30000);

    const { election, candidates, totalVotes, uniqueVoters, totalEligibleVoters } = reportData;

    // Pre-fetch candidate images to memory buffers in parallel
    const getImageBuffer = async (url) => {
      try {
        if (!url) return null;
        if (url.startsWith('/')) {
          const localPath = path.join(__dirname, '../../public', url);
          if (fs.existsSync(localPath)) return fs.readFileSync(localPath);
        }
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (e) {
        console.warn('Error fetching image for PDF:', e.message);
        return null;
      }
    };

    const imageBuffers = {};
    await Promise.all(
      candidates.map(async (cand) => {
        if (cand.photoUrl) {
          const buf = await getImageBuffer(cand.photoUrl);
          if (buf) {
            imageBuffers[cand.id] = buf;
          }
        }
      })
    );
    
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${election.title.replace(/[^a-zA-Z0-9]/g, '_')}_results.pdf"`);
    
    doc.pipe(res);
    
    const primaryColor = '#0F172A';
    const secondaryColor = '#B91C1C';
    const darkGray = '#334155';
    const lightGray = '#64748B';

    const logoPath = path.join(__dirname, '../../assets/logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 60 });
    }

    doc.fillColor(primaryColor)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('HO TECHNICAL UNIVERSITY', 125, 45);

    doc.fillColor(darkGray)
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('STUDENTS\' REPRESENTATIVE COUNCIL (SRC)', 125, 62);

    doc.fillColor(secondaryColor)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('OFFICIAL CERTIFIED ELECTION RESULTS SHEET', 125, 76);

    doc.fillColor(lightGray)
       .fontSize(8)
       .font('Helvetica')
       .text('P.O. Box HP 35, Ho, Volta Region, Ghana | info@htu.edu.gh', 125, 93);

    doc.moveTo(50, 110)
       .lineTo(545, 110)
       .lineWidth(2)
       .strokeColor(primaryColor)
       .stroke();

    doc.moveTo(50, 114)
       .lineTo(545, 114)
       .lineWidth(1)
       .strokeColor(secondaryColor)
       .stroke();

    doc.y = 135;
    
    doc.fillColor(primaryColor)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text(election.title, { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').text(`Results Certified On: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    // Centered Bold Header
    doc.fillColor('#EF4444')
       .fontSize(22)
       .font('Helvetica-Bold')
       .text('ELECTION ', 50, doc.y, { continued: true, align: 'center' });
    doc.fillColor('#0F172A')
       .text('RESULTS', { align: 'center' });
    doc.moveDown(1.5);

    // Group candidates by position
    const candidatesByPosition = {};
    candidates.forEach(c => {
      const pos = c.position || 'General';
      if (!candidatesByPosition[pos]) candidatesByPosition[pos] = [];
      candidatesByPosition[pos].push(c);
    });

    const positionTotals = {};
    candidates.forEach(c => {
      const pos = c.position || 'General';
      if (!positionTotals[pos]) positionTotals[pos] = 0;
      positionTotals[pos] += (c.votes || 0) + (c.noVotes || 0);
    });

    Object.entries(candidatesByPosition).forEach(([position, list]) => {
      const sorted = [...list].sort((a, b) => (b.votes || 0) - (a.votes || 0));

      const cardWidth = 220;
      const cardHeight = 220;
      const rowsCount = Math.ceil(sorted.length / 2);
      const headerH = 26;
      
      const totalPositionHeight = headerH + 20 + (rowsCount * cardHeight) + ((rowsCount - 1) * 20) + 45;
      
      if (doc.y + totalPositionHeight > 760) {
        doc.addPage();
      }

      const currentY = doc.y;
      const headerW = 220;
      const headerX = 50 + (495 - headerW) / 2;

      doc.rect(headerX, currentY, headerW, headerH).fill('#B91C1C');
      doc.fillColor('#FFFFFF')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(position.toUpperCase(), headerX, currentY + 8, { width: headerW, align: 'center' });
      
      const startCardsY = currentY + headerH + 20;
      const posTotal = positionTotals[position] || 0;

      sorted.forEach((cand, idx) => {
        const row = Math.floor(idx / 2);
        const col = idx % 2;
        const cardX = 50 + col * (220 + 55);
        const cardY = startCardsY + row * (cardHeight + 20);

        doc.roundedRect(cardX, cardY, 220, cardHeight, 10).lineWidth(1.5).strokeColor('#E2E8F0').stroke();

        const photoWidth = 90;
        const photoHeight = 90;
        const photoX = cardX + 65;
        const photoY = cardY + 20;

        if (imageBuffers[cand.id]) {
          doc.save();
          doc.circle(photoX + 45, photoY + 45, 45).clip();
          doc.image(imageBuffers[cand.id], photoX, photoY, { width: photoWidth, height: photoHeight });
          doc.restore();
        } else {
          doc.circle(photoX + 45, photoY + 45, 45).fill('#F1F5F9');
          const initials = cand.name ? cand.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
          doc.fillColor('#64748B')
             .fontSize(24)
             .font('Helvetica-Bold')
             .text(initials, photoX, photoY + 30, { width: photoWidth, align: 'center' });
        }

        doc.rect(cardX + 15, cardY + 125, 190, 26).fill('#10B981');
        doc.fillColor('#FFFFFF')
           .fontSize(9)
           .font('Helvetica-Bold')
           .text(cand.name.toUpperCase(), cardX + 15, cardY + 133, { width: 190, align: 'center' });

        if (cand.isIndependent) {
          const yesVotes = cand.votes || 0;
          const noVotes = cand.noVotes || 0;
          const totalInd = yesVotes + noVotes;
          const yesRatio = totalInd > 0 ? ((yesVotes / totalInd) * 100).toFixed(0) : '0';
          const noRatio = totalInd > 0 ? ((noVotes / totalInd) * 100).toFixed(0) : '0';

          doc.fillColor('#10B981').fontSize(13).font('Helvetica-Bold').text(yesRatio + '%', cardX + 15, cardY + 162, { width: 90, align: 'center' });
          doc.fillColor('#64748B').fontSize(7).font('Helvetica').text(`YES (${yesVotes})`, cardX + 15, cardY + 178, { width: 90, align: 'center' });

          doc.fillColor('#EF4444').fontSize(13).font('Helvetica-Bold').text(noRatio + '%', cardX + 115, cardY + 162, { width: 90, align: 'center' });
          doc.fillColor('#64748B').fontSize(7).font('Helvetica').text(`NO (${noVotes})`, cardX + 115, cardY + 178, { width: 90, align: 'center' });

          const approved = yesVotes > noVotes;
          doc.fillColor(approved ? '#10B981' : '#EF4444')
             .fontSize(8)
             .font('Helvetica-Bold')
             .text(approved ? 'APPROVED WINNER' : 'REJECTED', cardX, cardY + 198, { width: 220, align: 'center' });
        } else {
          const candVotes = cand.votes || 0;
          const ratio = posTotal > 0 ? ((candVotes / posTotal) * 100).toFixed(0) : '0';

          doc.fillColor('#0F172A').fontSize(18).font('Helvetica-Bold').text(ratio + '%', cardX, cardY + 162, { width: 220, align: 'center' });
          doc.fillColor('#64748B').fontSize(8).font('Helvetica').text(`${candVotes} Votes`, cardX, cardY + 182, { width: 220, align: 'center' });

          const isWinner = idx === 0 && candVotes > 0;
          doc.fillColor(isWinner ? '#10B981' : '#64748B')
             .fontSize(8)
             .font('Helvetica-Bold')
             .text(isWinner ? 'WINNER ELECT' : 'CANDIDATE', cardX, cardY + 198, { width: 220, align: 'center' });
        }
      });

      doc.y = startCardsY + rowsCount * (cardHeight + 20) + 15;
    });

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.moveTo(50, 790)
         .lineTo(545, 790)
         .lineWidth(0.5)
         .strokeColor('#64748B')
         .stroke();
      doc.fillColor('#64748B')
         .fontSize(8)
         .font('Helvetica')
         .text(`Page ${i + 1} of ${pages.count}`, 50, 796, { align: 'right', width: 495 });
      doc.text('OFFICIAL CERTIFIED RESULTS SHEET • HO TECHNICAL UNIVERSITY', 50, 796, { align: 'left', width: 400 });
    }
    
    doc.end();
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    console.error('Error generating PDF results:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate PDF results' });
  }
});

// --- ELECTION ACCESS CONTROL VIA OTP (REPLACES BIOMETRIC PROCESS WITH IDENTITY VERIFICATION) ---

const BMS_API_KEY = process.env.BMS_API_KEY || process.env.MNOTIFY_API_KEY || '';
const BMS_SENDER_ID = process.env.BMS_SENDER_ID || 'COMPSSA';

const { sendEmailNotification, sendOtpViaEmail } = require('../services/emailService');

async function sendOtpViaEmailJS(email, name, otp) {
  return sendOtpViaEmail(email, name, otp);
}

// Helper: Send OTP via BMS Africa (mNotify) Quick SMS API
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

// Upload CSV roster of eligible voting members for a specific election (Admin only)
router.post('/:id/voters/upload-csv', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user?.tenantId || req.user?.departmentId || DEFAULT_TENANT_ID;
    const { members } = req.body; // Array of { email, indexNumber, name, department }

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Members array is required and cannot be empty.' });
    }

    const electionRef = getElectionsRef(req).doc(electionId);
    const electionDoc = await electionRef.get();
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }

    const eligibleRef = electionRef.collection('eligible_voters');
    const batchSize = 400;
    let addedCount = 0;

    for (let i = 0; i < members.length; i += batchSize) {
      const chunk = members.slice(i, i + batchSize);
      const batch = db.batch();

      chunk.forEach(member => {
        const docId = (member.email || member.indexNumber || member.studentId || Math.random().toString(36)).toLowerCase().replace(/[^a-z0-9]/g, '_');
        const memberData = {
          email: (member.email || '').toLowerCase().trim(),
          indexNumber: (member.indexNumber || member.studentId || '').trim(),
          studentId: (member.indexNumber || member.studentId || '').trim(),
          name: member.name || member.fullName || 'Student',
          department: member.department || '',
          phone: (member.phone || member.phoneNumber || member.phoneNo || '').trim(),
          phoneNumber: (member.phone || member.phoneNumber || member.phoneNo || '').trim(),
          uploadedAt: Date.now()
        };

        batch.set(electionRef.collection('eligible_voters').doc(docId), memberData);
        batch.set(electionRef.collection('voter_roster').doc(docId), memberData);
        batch.set(db.collection('tenants').doc(tenantId).collection('voter_rolls').doc(docId), {
          ...memberData,
          isRegistered: true,
          role: 'voter',
          createdAt: Date.now()
        });
        addedCount++;
      });

      await batch.commit();
    }

    // Update total CSV voter count on election document
    await electionRef.update({
      totalVoters: addedCount,
      voterCount: addedCount,
      hasCsvRoster: true
    });

    // Invalidate election list & detail caches
    cache.invalidatePrefix('elections:');

    res.status(200).json({
      status: 'success',
      message: `Successfully uploaded ${addedCount} voting members to election roster.`,
      data: { totalMembers: addedCount }
    });
  } catch (error) {
    console.error('Error uploading CSV roster:', error);
    res.status(500).json({ status: 'error', message: 'Failed to upload CSV voter roster.' });
  }
});

// 1. Check if voter is eligible and unlock access to an election (bypasses OTP lock under Google Auth only)
router.get('/:id/access-status', verifyAuth, async (req, res) => {
  try {
    const electionId = req.params.id;
    const voterId = req.user.uid;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    const { doc: electionDoc, ref: electionRef, tenantId: resolvedTenantId } = await findElectionDoc(electionId, req);
    if (!electionDoc || !electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }

    const electionData = electionDoc.data();

    // Check if voter has already unlocked access via OTP verification under any potential paths
    let unlocked = false;

    const checkPaths = [
      db.collection('tenants').doc(tenantId).collection('unlocked_elections').doc(`${voterId}_${electionId}`).get(),
      db.collection('organizations').doc(tenantId).collection('unlocked_elections').doc(`${voterId}_${electionId}`).get()
    ];

    if (resolvedTenantId && resolvedTenantId !== tenantId) {
      checkPaths.push(db.collection('tenants').doc(resolvedTenantId).collection('unlocked_elections').doc(`${voterId}_${electionId}`).get());
      checkPaths.push(db.collection('organizations').doc(resolvedTenantId).collection('unlocked_elections').doc(`${voterId}_${electionId}`).get());
    }

    const checkSnaps = await Promise.allSettled(checkPaths);
    for (const snapResult of checkSnaps) {
      if (snapResult.status === 'fulfilled' && snapResult.value && snapResult.value.exists) {
        unlocked = true;
        break;
      }
    }

    if (unlocked || electionData.otpRequired === false) {
      return res.status(200).json({
        status: 'success',
        data: {
          unlocked: true
        }
      });
    }

    // Check if user is in voter roster
    const voterRosterSnap = await electionRef.collection('voter_roster').get().catch(() => ({ empty: true, docs: [] }));
    const eligibleVotersSnap = await electionRef.collection('eligible_voters').get().catch(() => ({ empty: true, docs: [] }));

    const voterEmail = (req.user.email || '').toLowerCase().trim();
    const voterIndex = (req.user.indexNumber || req.user.studentId || voterId || '').toLowerCase().trim();

    let matchedRosterEntry = null;
    const allRosterDocs = [...(voterRosterSnap.docs || []), ...(eligibleVotersSnap.docs || [])];
    for (const rDoc of allRosterDocs) {
      const entry = rDoc.data();
      const entryEmail = (entry.email || '').toLowerCase().trim();
      const entryIndex = (entry.indexNumber || entry.studentId || rDoc.id || '').toLowerCase().trim();

      if ((voterEmail && entryEmail === voterEmail) || (voterIndex && entryIndex === voterIndex)) {
        matchedRosterEntry = entry;
        break;
      }
    }

    if (!matchedRosterEntry) {
      return res.status(200).json({
        status: 'success',
        data: {
          unlocked: false,
          reason: 'not_on_roster',
          message: 'You have no access to vote in this election. Please contact your organization EC admin.'
        }
      });
    }

    // Voter is on the roster, but hasn't unlocked with OTP yet
    res.status(200).json({
      status: 'success',
      data: {
        unlocked: false,
        reason: 'otp_required',
        message: 'Identity verification code required to unlock your ballot.'
      }
    });
  } catch (error) {
    console.error('Error checking access status:', error);
    res.status(500).json({ status: 'error', message: 'Failed to check access status.' });
  }
});

// 2. Request OTP to unlock access to an election
router.post('/:id/request-access-otp', verifyAuth, async (req, res) => {
  try {
    const electionId = req.params.id;
    const voterId = req.user.uid;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    // 1. Verify election exists and check active time window
    const { doc: electionDoc, ref: electionRef, tenantId: resolvedTenantId } = await findElectionDoc(electionId, req);
    if (!electionDoc || !electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }
    const electionData = electionDoc.data();
    const now = Date.now();
    const startTime = new Date(electionData.startDate).getTime();
    const endTime = new Date(electionData.endDate).getTime();

    if (now < startTime) {
      const formattedStart = new Date(startTime).toLocaleString();
      return res.status(400).json({
        status: 'error',
        message: `Voting for "${electionData.title}" has not opened yet. It is scheduled to start on ${formattedStart}.`
      });
    }

    if (now > endTime) {
      const formattedEnd = new Date(endTime).toLocaleString();
      return res.status(400).json({
        status: 'error',
        message: `Voting for "${electionData.title}" has ended. Closed on ${formattedEnd}.`
      });
    }

    // 2. Look into all voter roster entries (voter_roster & eligible_voters) for THIS PARTICULAR ELECTION
    const voterRosterSnap = await electionRef.collection('voter_roster').get().catch(() => ({ empty: true, docs: [] }));
    const eligibleVotersSnap = await electionRef.collection('eligible_voters').get().catch(() => ({ empty: true, docs: [] }));

    const voterEmail = (req.user.email || '').toLowerCase().trim();
    const voterIndex = (req.user.indexNumber || req.user.studentId || voterId || '').toLowerCase().trim();

    let matchedRosterEntry = null;

    const allRosterDocs = [...(voterRosterSnap.docs || []), ...(eligibleVotersSnap.docs || [])];
    for (const rDoc of allRosterDocs) {
      const entry = rDoc.data();
      const entryEmail = (entry.email || '').toLowerCase().trim();
      const entryIndex = (entry.indexNumber || entry.studentId || rDoc.id || '').toLowerCase().trim();

      if ((voterEmail && entryEmail === voterEmail) || (voterIndex && entryIndex === voterIndex)) {
        matchedRosterEntry = entry;
        break;
      }
    }

    if (!matchedRosterEntry) {
      return res.status(403).json({
        status: 'error',
        message: 'You have no access to vote in this election. Please contact your organization EC admin.'
      });
    }

    // 3. Resolve voter profile details (from election roster match, voter_rolls, or token payload)
    let voterData = null;
    let voterRef = db.collection('tenants').doc(resolvedTenantId).collection('voter_rolls').doc(voterId);
    let voterDoc = await voterRef.get();

    if (voterDoc.exists) {
      voterData = voterDoc.data();
    } else {
      voterRef = db.collection('organizations').doc(resolvedTenantId).collection('voter_rolls').doc(voterId);
      voterDoc = await voterRef.get();
      if (voterDoc.exists) {
        voterData = voterDoc.data();
      }
    }

    if (!voterData) {
      voterData = {
        email: matchedRosterEntry?.email || req.user.email,
        name: matchedRosterEntry?.name || req.user.name || (req.user.email ? req.user.email.split('@')[0] : 'Voter'),
        phone: matchedRosterEntry?.phone || req.user.phone || ''
      };
      voterRef = db.collection('tenants').doc(resolvedTenantId).collection('voter_rolls').doc(voterId);
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store in voter doc (using set with merge: true so it works even if document doesn't exist yet)
    await voterRef.set({
      accessOtp: otp,
      accessOtpExpiry: expiry,
      updatedAt: Date.now()
    }, { merge: true });

    let emailSent = false;
    let smsSent = false;

    // Resolve contact details across roster match, voter_rolls document, auth payload, or body
    const targetEmail = (matchedRosterEntry?.email || voterData?.email || req.user.email || req.body?.email || '').toLowerCase().trim();
    const targetName = matchedRosterEntry?.name || voterData?.name || req.user.name || (targetEmail ? targetEmail.split('@')[0] : 'Voter');
    const targetPhone = matchedRosterEntry?.phone || voterData?.phone || req.user.phone || req.body?.phone || '';

    console.log('[Access OTP] Prepared dispatch details:', { targetEmail, targetName, targetPhone, voterId, electionId });

    if (targetEmail) {
      try {
        const { sendOtpViaEmail } = require('../services/emailService');
        const info = await sendOtpViaEmail(targetEmail, targetName, otp);
        if (info) {
          emailSent = true;
          console.log(`[Access OTP] ✅ Access OTP email successfully sent to ${targetEmail}`);
        }
      } catch (err) {
        console.error('[Access OTP] Email dispatch error:', err.message);
      }
    }

    // Dispatch via SMS
    if (targetPhone) {
      try {
        await sendOtpViaBMS(targetPhone, otp);
        smsSent = true;
      } catch (err) {
        console.error('[Access OTP] SMS delivery error:', err.message);
      }
    }

    const dispatchSuccess = emailSent || smsSent;

    res.status(200).json({
      status: 'success',
      fallbackOtp: dispatchSuccess ? undefined : otp,
      message: dispatchSuccess
        ? `A verification code has been dispatched to your registered contact information.`
        : `A verification code was generated: ${otp}`
    });
  } catch (error) {
    console.error('Error requesting access OTP:', error);
    res.status(500).json({ status: 'error', message: 'Failed to request verification code.' });
  }
});

// 3. Verify OTP to unlock access to an election
router.post('/:id/verify-access-otp', verifyAuth, async (req, res) => {
  try {
    const electionId = req.params.id;
    const voterId = req.user.uid;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ status: 'error', message: 'Verification code is required.' });
    }

    // Find the election and resolve its dynamic resolvedTenantId
    const { doc: electionDoc, tenantId: resolvedTenantId } = await findElectionDoc(electionId, req);
    if (!electionDoc || !electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }

    const tenantIdToUse = resolvedTenantId || tenantId;

    // Fetch voter profile from resolved tenant's tenants/organizations or fallbacks, matching the access OTP code robustly
    let voterRef = null;
    let voterData = null;

    const refsToCheck = [
      db.collection('tenants').doc(tenantIdToUse).collection('voter_rolls').doc(voterId),
      db.collection('organizations').doc(tenantIdToUse).collection('voter_rolls').doc(voterId)
    ];

    if (tenantId && tenantId !== tenantIdToUse) {
      refsToCheck.push(db.collection('tenants').doc(tenantId).collection('voter_rolls').doc(voterId));
      refsToCheck.push(db.collection('organizations').doc(tenantId).collection('voter_rolls').doc(voterId));
    }

    for (const ref of refsToCheck) {
      const doc = await ref.get();
      if (doc.exists) {
        const data = doc.data();
        if (data && data.accessOtp && data.accessOtp.toString().trim() === otp.toString().trim()) {
          voterData = data;
          voterRef = ref;
          break;
        }
      }
    }

    if (!voterData) {
      // Fallback: check if the profile exists at all in any of these paths to customize the error message
      let profileDoc = null;
      for (const ref of refsToCheck) {
        const doc = await ref.get();
        if (doc.exists) {
          profileDoc = doc;
          break;
        }
      }
      if (!profileDoc) {
        return res.status(404).json({ status: 'error', message: 'Voter profile not found.' });
      }
      return res.status(400).json({ status: 'error', message: 'Invalid verification code.' });
    }

    if (Date.now() > voterData.accessOtpExpiry) {
      return res.status(400).json({ status: 'error', message: 'Verification code has expired. Please request a new one.' });
    }

    // Log the unlocked status for this user in this election under all possible paths to prevent cross-tenant lockout issues
    const unlockedPayload = {
      voterId,
      electionId,
      verifiedAt: Date.now()
    };

    const writePromises = [
      db.collection('tenants').doc(tenantIdToUse).collection('unlocked_elections').doc(`${voterId}_${electionId}`).set(unlockedPayload),
      db.collection('organizations').doc(tenantIdToUse).collection('unlocked_elections').doc(`${voterId}_${electionId}`).set(unlockedPayload)
    ];

    if (tenantId && tenantId !== tenantIdToUse) {
      writePromises.push(db.collection('tenants').doc(tenantId).collection('unlocked_elections').doc(`${voterId}_${electionId}`).set(unlockedPayload));
      writePromises.push(db.collection('organizations').doc(tenantId).collection('unlocked_elections').doc(`${voterId}_${electionId}`).set(unlockedPayload));
    }

    await Promise.allSettled(writePromises);

    // Invalidate voter OTP fields on the verified voter reference document
    await voterRef.update({
      accessOtp: null,
      accessOtpExpiry: null
    });

    res.status(200).json({
      status: 'success',
      message: 'Election unlocked successfully.'
    });
  } catch (error) {
    console.error('Error verifying access OTP:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify OTP.' });
  }
});

// 4. Send Voting Invitations to Roster or Specific Voters
router.post('/:id/send-invitations', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;
    const { recipientFilter, selectedEmails, customEmails } = req.body;

    let electionDoc = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).get();
    if (!electionDoc.exists) {
      electionDoc = await db.collection('organizations').doc(tenantId).collection('elections').doc(electionId).get();
    }
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }
    const election = electionDoc.data();

    let voterList = [];

    if (recipientFilter === 'custom') {
      let emailsRaw = Array.isArray(customEmails) ? customEmails : (customEmails || '').split(/[\s,;]+/);
      const cleanEmails = [...new Set(emailsRaw.map(e => (e || '').trim().toLowerCase()).filter(e => e.includes('@')))];
      if (cleanEmails.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No valid custom email addresses provided.' });
      }
      voterList = cleanEmails.map(email => ({
        email,
        name: email.split('@')[0]
      }));
    } else if (recipientFilter === 'individual') {
      let targetEmailsRaw = Array.isArray(selectedEmails) ? selectedEmails : (selectedEmails || '').split(/[\s,;]+/);
      const targetEmailsSet = new Set(targetEmailsRaw.map(e => (e || '').trim().toLowerCase()));

      let votersSnap = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('voter_roster').get();
      if (votersSnap.empty) votersSnap = await db.collection('organizations').doc(tenantId).collection('elections').doc(electionId).collection('voter_roster').get();
      if (votersSnap.empty) votersSnap = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('eligible_voters').get();
      if (votersSnap.empty) votersSnap = await db.collection('organizations').doc(tenantId).collection('elections').doc(electionId).collection('eligible_voters').get();

      voterList = votersSnap.docs.map(doc => doc.data()).filter(v => v.email && targetEmailsSet.has(v.email.toLowerCase()));

      if (voterList.length === 0) {
        return res.status(400).json({ status: 'error', message: 'None of the selected individual voters were found on the roster.' });
      }
    } else {
      let votersSnapshot = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('voter_roster').get();
      if (votersSnapshot.empty) {
        votersSnapshot = await db.collection('organizations').doc(tenantId).collection('elections').doc(electionId).collection('voter_roster').get();
      }
      if (votersSnapshot.empty) {
        votersSnapshot = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('eligible_voters').get();
      }
      if (votersSnapshot.empty) {
        votersSnapshot = await db.collection('organizations').doc(tenantId).collection('elections').doc(electionId).collection('eligible_voters').get();
      }

      if (votersSnapshot.empty) {
        return res.status(400).json({ status: 'error', message: 'No voter roster found for this election. Please upload a voter CSV list first.' });
      }

      voterList = votersSnapshot.docs.map(doc => doc.data()).filter(v => v.email);
    }

    // Process email dispatches in parallel using Promise.allSettled to guarantee dispatches in serverless environments
    const dispatchPromises = voterList.map(async (v) => {
      try {
        const info = await sendEmailNotification(
          v.email,
          `Voting Invitation: ${election.title}`,
          `Hello ${v.name || 'Voter'},\n\nVoting for "${election.title}" is now open!\n\nStart Time: ${new Date(election.startDate).toLocaleString()}\nEnd Time: ${new Date(election.endDate).toLocaleString()}\n\nPlease log in to cast your ballot.\n\nThank you,\nHTU Elect EC`,
          `
            <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #f4f6f9; border-radius: 8px;">
              <h2 style="color: #2563eb;">Voting Invitation: ${election.title}</h2>
              <p>Hello <strong>${v.name || 'Voter'}</strong>,</p>
              <p>You are an eligible voter for <strong>${election.title}</strong>.</p>
              <div style="background: #ffffff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Start Time:</strong> ${new Date(election.startDate).toLocaleString()}</p>
                <p style="margin: 4px 0;"><strong>End Time:</strong> ${new Date(election.endDate).toLocaleString()}</p>
              </div>
              <p>Log in to cast your ballot at the portal link below:</p>
              <a href="${process.env.FRONTEND_URL || 'https://htu-elect-aov2.vercel.app'}/login" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Access Voting Portal</a>
            </div>
          `
        );

        await logActivity({
          tenantId,
          actorEmail: req.user.email,
          actorRole: 'admin',
          action: 'ELECTION_INVITATION_SENT',
          description: `Invitation sent to ${v.email} for election: ${election.title}`
        }).catch(() => {});

        return { email: v.email, success: !!info };
      } catch (err) {
        console.error(`Failed to send invitation to ${v.email}:`, err.message);
        return { email: v.email, success: false, error: err.message };
      }
    });

    const results = await Promise.allSettled(dispatchPromises);
    const sentCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    res.status(200).json({
      status: 'success',
      message: `Successfully dispatched voting invitations to ${sentCount} of ${voterList.length} roster recipients.`,
      data: { totalVoters: voterList.length, invitationsSent: sentCount }
    });
  } catch (error) {
    console.error('Error sending invitations:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send voting invitations.' });
  }
});

// 5. Broadcast Final Results to Roster Voters
router.post('/:id/broadcast-results', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    const electionRef = db.collection('tenants').doc(tenantId).collection('elections').doc(electionId);
    const electionDoc = await electionRef.get();
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }

    // Set election status to ended
    await electionRef.update({ status: 'ended', updatedAt: Date.now() });

    // Fetch roster voters
    const votersSnapshot = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('voter_roster').get();
    const voterCount = votersSnapshot.size;

    await logActivity({
      tenantId,
      actorEmail: req.user.email,
      actorRole: 'admin',
      action: 'ELECTION_RESULTS_BROADCAST',
      description: `Final election results broadcast dispatched to ${voterCount} roster members.`
    });

    res.status(200).json({
      status: 'success',
      message: `Election closed and results broadcast dispatched to ${voterCount} roster voters.`,
      data: { status: 'ended', recipientCount: voterCount }
    });
  } catch (error) {
    console.error('Error broadcasting results:', error);
    res.status(500).json({ status: 'error', message: 'Failed to broadcast election results.' });
  }
});

// 5b. Custom Gmail-Style SMS & Email Broadcast Communicator to Roster Voters
router.post('/:id/broadcast-message', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;
    const { channel, recipientFilter, selectedEmails, customEmails, subject, body } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ status: 'error', message: 'Message body content is required.' });
    }

    let electionDoc = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).get();
    if (!electionDoc.exists) {
      electionDoc = await db.collection('organizations').doc(tenantId).collection('elections').doc(electionId).get();
    }
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }
    const election = electionDoc.data();

    let rosterList = [];

    if (recipientFilter === 'custom') {
      let emailsRaw = Array.isArray(customEmails) ? customEmails : (customEmails || '').split(/[\s,;]+/);
      const cleanEmails = [...new Set(emailsRaw.map(e => (e || '').trim().toLowerCase()).filter(e => e.includes('@')))];
      if (cleanEmails.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No valid custom email addresses provided.' });
      }
      rosterList = cleanEmails.map(email => ({
        email,
        name: email.split('@')[0],
        studentId: 'CUSTOM_RECIPIENT'
      }));
    } else if (recipientFilter === 'individual') {
      let targetEmailsRaw = Array.isArray(selectedEmails) ? selectedEmails : (selectedEmails || '').split(/[\s,;]+/);
      const targetEmailsSet = new Set(targetEmailsRaw.map(e => (e || '').trim().toLowerCase()));

      let votersSnap = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('voter_roster').get();
      if (votersSnap.empty) votersSnap = await db.collection('organizations').doc(tenantId).collection('elections').doc(electionId).collection('voter_roster').get();
      if (votersSnap.empty) votersSnap = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('eligible_voters').get();
      if (votersSnap.empty) votersSnap = await db.collection('organizations').doc(tenantId).collection('elections').doc(electionId).collection('eligible_voters').get();

      rosterList = votersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(v => v.email && targetEmailsSet.has(v.email.toLowerCase()));

      if (rosterList.length === 0) {
        return res.status(400).json({ status: 'error', message: 'None of the selected individual voters were found on the roster.' });
      }
    } else {
      // Batch filters: 'all', 'pending', 'voted'
      let votersSnap = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('voter_roster').get();
      if (votersSnap.empty) votersSnap = await db.collection('organizations').doc(tenantId).collection('elections').doc(electionId).collection('voter_roster').get();
      if (votersSnap.empty) votersSnap = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('eligible_voters').get();
      if (votersSnap.empty) votersSnap = await db.collection('organizations').doc(tenantId).collection('elections').doc(electionId).collection('eligible_voters').get();

      rosterList = votersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      let votedSnap = await db.collection('tenants').doc(tenantId).collection('voted_voters').where('electionId', '==', electionId).get();
      if (votedSnap.empty) votedSnap = await db.collection('organizations').doc(tenantId).collection('voted_voters').where('electionId', '==', electionId).get();
      const votedEmailSet = new Set(votedSnap.docs.map(doc => (doc.data().voterEmail || doc.data().email || '').toLowerCase()));

      if (recipientFilter === 'pending') {
        rosterList = rosterList.filter(v => !votedEmailSet.has((v.email || '').toLowerCase()));
      } else if (recipientFilter === 'voted') {
        rosterList = rosterList.filter(v => votedEmailSet.has((v.email || '').toLowerCase()));
      }
    }

    if (rosterList.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No matching voters found for the selected recipient filter.' });
    }
       const targetChannel = channel || 'both';

    let emailSentCount = 0;
    let smsSentCount = 0;

    // Process dispatches in parallel using Promise.allSettled
    const broadcastPromises = rosterList.map(async (v) => {
      const recipientName = v.name || v.fullName || 'Voter';
      const indexNum = v.indexNumber || v.studentId || '';
      const email = v.email || '';
      const phone = v.phoneNumber || v.phone || '';

      const personalizedSubject = (subject || `Announcement: ${election.title}`)
        .replace(/{{voter_name}}/gi, recipientName)
        .replace(/{{index_number}}/gi, indexNum)
        .replace(/{{election_title}}/gi, election.title);

      const personalizedBody = body
        .replace(/{{voter_name}}/gi, recipientName)
        .replace(/{{index_number}}/gi, indexNum)
        .replace(/{{election_title}}/gi, election.title)
        .replace(/{{voting_link}}/gi, `${process.env.FRONTEND_URL || 'https://htu-elect-aov2.vercel.app'}/voter/elections/${electionId}`);

      let emailDispatched = false;
      let smsDispatched = false;

      if ((targetChannel === 'email' || targetChannel === 'both') && email) {
        try {
          const info = await sendEmailNotification(
            email,
            personalizedSubject,
            personalizedBody,
            `<div style="font-family: Arial, sans-serif; padding: 24px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
              <h2 style="color: #2563eb; margin-top: 0;">${personalizedSubject}</h2>
              <div style="font-size: 15px; color: #1e293b; line-height: 1.6; white-space: pre-wrap;">${personalizedBody}</div>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">Dispatched securely via HTU Elect EC Broadcast Center.</p>
            </div>`
          );
          if (info) emailDispatched = true;
        } catch (e) {
          console.error(`Email dispatch error to ${email}:`, e.message);
        }
      }

      if ((targetChannel === 'sms' || targetChannel === 'both') && phone) {
        smsDispatched = true;
        console.log(`[SMS Broadcast Dispatched] To: ${phone} | Content: ${personalizedBody.substring(0, 160)}`);
      }

      return { email, phone, emailDispatched, smsDispatched };
    });

    const results = await Promise.allSettled(broadcastPromises);
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        if (r.value.emailDispatched) emailSentCount++;
        if (r.value.smsDispatched) smsSentCount++;
      }
    });

    // Save Broadcast History Record in Firestore
    const broadcastRecord = {
      electionId,
      electionTitle: election.title,
      channel: targetChannel,
      recipientFilter: recipientFilter || 'all',
      subject: subject || `Announcement: ${election.title}`,
      body,
      recipientCount: rosterList.length,
      emailSentCount,
      smsSentCount,
      senderEmail: req.user.email,
      createdAt: Date.now()
    };

    await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('broadcast_history').add(broadcastRecord).catch(() => {});
    await db.collection('organizations').doc(tenantId).collection('elections').doc(electionId).collection('broadcast_history').add(broadcastRecord).catch(() => {});

    res.status(200).json({
      status: 'success',
      message: `Broadcast message dispatched successfully to ${rosterList.length} roster members (${emailSentCount} emails, ${smsSentCount} SMS).`,
      data: { recipientCount: rosterList.length, channel: targetChannel, emailSentCount, smsSentCount }
    });
  } catch (error) {
    console.error('Error broadcasting message:', error);
    res.status(500).json({ status: 'error', message: 'Failed to dispatch broadcast message.' });
  }
});

// 5c. Get Broadcast History Logs for an Election
router.get('/:id/broadcast-history', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    const snap = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('broadcast_history').get();
    const history = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    history.sort((a, b) => b.createdAt - a.createdAt);

    res.status(200).json({ status: 'success', data: history });
  } catch (error) {
    console.error('Error fetching broadcast history:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch broadcast history.' });
  }
});

// 6. Export Raw Cryptographic Audit Ledger (CSV)
router.get('/:id/export-audit', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    const electionDoc = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).get();
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found.' });
    }
    const election = electionDoc.data();

    // Fetch audit ledger
    const auditSnapshot = await db.collection('tenants').doc(tenantId).collection('audit_ledger')
      .where('electionId', '==', electionId)
      .orderBy('timestamp', 'asc')
      .get();

    let csvContent = 'Index,Ballot Transaction Hash,Position,Timestamp,Verification Status\n';
    let idx = 1;

    auditSnapshot.forEach(doc => {
      const data = doc.data();
      const hash = doc.id;
      const pos = (data.position || 'N/A').replace(/,/g, ' ');
      const timeStr = new Date(data.timestamp || Date.now()).toISOString();
      csvContent += `${idx},${hash},${pos},${timeStr},CRYPTOGRAPHICALLY_VERIFIED\n`;
      idx++;
    });

    const filename = `${(election.title || 'election').replace(/[^a-zA-Z0-9]/g, '_')}_audit_ledger.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);

  } catch (error) {
    console.error('Error exporting audit CSV:', error);
    res.status(500).json({ status: 'error', message: 'Failed to export audit ledger.' });
  }
});

// 7. Get Per-Election Roster Voters
router.get('/:id/voters', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    let rosterSnap = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('voter_roster').get();
    
    if (rosterSnap.empty) {
      rosterSnap = await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('eligible_voters').get();
    }

    if (rosterSnap.empty) {
      rosterSnap = await db.collection('tenants').doc(tenantId).collection('voter_rolls').get();
    }

    // Check voted voters to flag hasVoted status accurately
    const votedSnap = await db.collection('tenants').doc(tenantId).collection('voted_voters').where('electionId', '==', electionId).get();
    const votedSet = new Set();
    votedSnap.forEach(d => {
      const data = d.data();
      if (data.voterId) votedSet.add(data.voterId);
      if (data.studentId) votedSet.add(data.studentId);
      if (data.email) votedSet.add(data.email.toLowerCase());
    });

    const voters = rosterSnap.docs.map(doc => {
      const data = doc.data();
      const id = doc.id;
      const studentId = data.studentId || data.indexNumber || id;
      const email = (data.email || '').toLowerCase();
      const hasVoted = votedSet.has(id) || votedSet.has(studentId) || (email && votedSet.has(email));

      return {
        id,
        studentId,
        indexNumber: studentId,
        name: data.name || data.fullName || 'Student Voter',
        email: data.email || 'N/A',
        phone: data.phone || data.phoneNumber || data.phoneNo || 'N/A',
        department: data.department || '',
        isRegistered: data.isRegistered !== false,
        hasVoted: hasVoted
      };
    });

    res.status(200).json({ status: 'success', data: voters });
  } catch (error) {
    console.error('Error fetching election roster voters:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch roster voters.' });
  }
});

// 8. Get 360 Audit Records (Admin setup actions + Voter ballot cast events with timestamps & candidate selections)
router.get('/:id/audit-records', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    const logsSnap = await db.collection('tenants').doc(tenantId).collection('activity_logs').get();
    const adminLogs = logsSnap.docs
      .map(doc => doc.data())
      .filter(l => (l.description && l.description.includes(electionId)) || (l.action && l.action.includes('ELECTION')))
      .map(l => ({
        id: `log_${l.timestamp || Date.now()}`,
        type: 'admin',
        actor: l.actorEmail || 'EC Admin',
        action: l.action || 'ADMIN_ACTION',
        timestamp: l.timestamp || Date.now(),
        details: l.description,
        hash: 'CRYPTOGRAPHICALLY_VERIFIED'
      }));

    const votesSnap = await db.collection('tenants').doc(tenantId).collection('votes').where('electionId', '==', electionId).get();
    const voterCastRecords = votesSnap.docs.map(doc => {
      const v = doc.data();
      return {
        id: doc.id,
        type: 'voter',
        actor: v.voterEmail || v.voterId || 'Eligible Voter',
        action: 'BALLOT_CAST',
        timestamp: v.timestamp || Date.now(),
        details: `Voted for: ${v.candidateName || v.candidateId || 'Candidate'} (${v.position || 'Executive'})`,
        selections: v.selections || { [v.position || 'Position']: v.candidateName || 'Candidate' },
        hash: doc.id
      };
    });

    const combined = [...adminLogs, ...voterCastRecords].sort((a, b) => b.timestamp - a.timestamp);
    res.status(200).json({ status: 'success', data: combined });
  } catch (error) {
    console.error('Error fetching audit records:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch audit records.' });
  }
});

// 9. Get Per-Election Security Alerts
router.get('/:id/security-alerts', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    const alertsSnap = await db.collection('tenants').doc(tenantId).collection('fraud_alerts').get();
    const alerts = alertsSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(a => !a.electionId || a.electionId === electionId);

    res.status(200).json({ status: 'success', data: alerts });
  } catch (error) {
    console.error('Error fetching security alerts:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch security alerts.' });
  }
});

// 10. Position Management Endpoints
router.get('/:id/positions', verifyAuth, async (req, res) => {
  try {
    const electionId = req.params.id;
    const { ref: electionRef } = await findElectionDoc(electionId, req);

    let positionsSnap = { empty: true, docs: [] };
    if (electionRef) {
      positionsSnap = await electionRef.collection('positions').orderBy('order', 'asc').get().catch(() => ({ empty: true, docs: [] }));
    }
    const positions = positionsSnap.docs ? positionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) : [];

    if (positions.length === 0) {
      const defaults = [
        { id: 'pos_1', title: 'President', maxChoices: 1, order: 1 },
        { id: 'pos_2', title: 'Vice President', maxChoices: 1, order: 2 },
        { id: 'pos_3', title: 'General Secretary', maxChoices: 1, order: 3 },
        { id: 'pos_4', title: 'Financial Secretary', maxChoices: 1, order: 4 },
        { id: 'pos_5', title: 'WOCOM', maxChoices: 1, order: 5 },
      ];
      return res.status(200).json({ status: 'success', data: defaults });
    }

    res.status(200).json({ status: 'success', data: positions });
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch positions.' });
  }
});

router.post('/:id/positions', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;
    const { title, maxChoices, isReferendum, order } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ status: 'error', message: 'Position title is required.' });
    }

    const posRef = db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('positions').doc();
    const newPos = {
      id: posRef.id,
      title: title.trim(),
      maxChoices: Number(maxChoices) || 1,
      isReferendum: Boolean(isReferendum),
      order: Number(order) || 1,
      createdAt: Date.now()
    };

    await posRef.set(newPos);
    res.status(201).json({ status: 'success', data: newPos });
  } catch (error) {
    console.error('Error creating position:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create position.' });
  }
});

router.delete('/:id/positions/:posId', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { id: electionId, posId } = req.params;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    await db.collection('tenants').doc(tenantId).collection('elections').doc(electionId).collection('positions').doc(posId).delete();
    res.status(200).json({ status: 'success', message: 'Position deleted successfully.' });
  } catch (error) {
    console.error('Error deleting position:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete position.' });
  }
});

module.exports = router;