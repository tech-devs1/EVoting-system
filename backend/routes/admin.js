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
const getElectionsRef = (req) => db.collection(getTenantCollection(req)).doc(getTenantId(req)).collection('elections');
const getCandidatesRef = (req) => db.collection(getTenantCollection(req)).doc(getTenantId(req)).collection('candidates');
const getVotedVotersRef = (req) => db.collection(getTenantCollection(req)).doc(getTenantId(req)).collection('voted_voters');
const getVotesRef = (req) => db.collection(getTenantCollection(req)).doc(getTenantId(req)).collection('votes');
const getAuditLogsRef = (req) => db.collection(getTenantCollection(req)).doc(getTenantId(req)).collection('audit_logs');
const getUsersRef = (req) => db.collection(getTenantCollection(req)).doc(getTenantId(req)).collection('voter_rolls');
const getFraudAlertsRef = (req) => db.collection(getTenantCollection(req)).doc(getTenantId(req)).collection('fraud_alerts');
const getUploadsRef = (req) => db.collection(getTenantCollection(req)).doc(getTenantId(req)).collection('uploads');
const { verifyAuth, requireAdmin } = require('../middleware/auth');
const { verifyElectionIntegrity } = require('../services/audit');
const cache = require('../services/cache');
const { logActivity } = require('../services/activityLog');

// Get Dashboard Analytics - OPTIMIZED WITH AGGREGATIONS + CACHE
router.get('/dashboard', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const dashboardData = await cache.getOrSet(`admin:${tenantId}:dashboard`, async () => {
      // 1. Get active elections
      const activeElectionsSnapForQuery = await getElectionsRef(req).where('status', '==', 'active').get();
      const activeElectionIds = [];
      activeElectionsSnapForQuery.forEach(doc => {
        activeElectionIds.push(doc.id);
      });

      // 2. Server-side aggregations for total counts (~1 Read per collection)
      const electionsCountSnap = await getElectionsRef(req).count().get();
      const votersCountSnap = await getUsersRef(req).where('isRegistered', '==', true).count().get();
      
      const totalElections = electionsCountSnap.data().count;
      const totalVoters = votersCountSnap.data().count;

      let totalVotesCast = 0;
      let uniqueVotersCount = 0;

      // Target active elections, or fallback to all/completed elections if no active election exists
      let targetElectionIds = [...activeElectionIds];
      if (targetElectionIds.length === 0) {
        const allElectionsSnap = await getElectionsRef(req).get();
        allElectionsSnap.forEach(doc => targetElectionIds.push(doc.id));
      }

      if (targetElectionIds.length > 0) {
        try {
          const votesCountSnap = await getVotesRef(req).where('electionId', 'in', targetElectionIds.slice(0, 30)).count().get();
          totalVotesCast = votesCountSnap.data().count;

          const uniqueVotersSnap = await getVotedVotersRef(req).where('electionId', 'in', targetElectionIds.slice(0, 30)).count().get();
          uniqueVotersCount = uniqueVotersSnap.data().count;
        } catch (err) {
          console.warn('[Dashboard] Error querying votes/voted_voters:', err.message);
        }
      }

      // Robust fallback: If totalVotesCast is 0, sum votes directly from candidate tallies across elections
      if (totalVotesCast === 0) {
        try {
          const candsSnap = await getCandidatesRef(req).get();
          let candTotal = 0;
          const posTotals = {};
          candsSnap.forEach(doc => {
            const d = doc.data();
            const v = (d.votes || 0) + (d.noVotes || 0);
            candTotal += v;
            const pos = d.position || 'General';
            posTotals[pos] = (posTotals[pos] || 0) + v;
          });
          totalVotesCast = candTotal;
          if (uniqueVotersCount === 0) {
            // Unique voters = max votes in any single category
            const maxPosVotes = Math.max(0, ...Object.values(posTotals));
            uniqueVotersCount = maxPosVotes;
          }
        } catch (err) {
          console.warn('[Dashboard] Candidate fallback failed:', err.message);
        }
      }

      // 3. Fetch election statuses cleanly
      const completedElectionsSnap = await getElectionsRef(req).where('status', '==', 'completed').count().get();
      const activeElectionsCount = activeElectionIds.length;
      const completedElectionsCount = completedElectionsSnap.data().count;

      // 4. Count non-admin students using count aggregation (1 Read)
      const totalStudentsSnap = await getUsersRef(req).where('role', '!=', 'admin').count().get();
      const totalStudents = totalStudentsSnap.data().count;

      // 5. Fetch top 10 candidates for chart (10 Reads)
      const candidatesDoc = await getCandidatesRef(req).orderBy('votes', 'desc').limit(10).get();
      const topCandidates = [];
      candidatesDoc.forEach(doc => {
        const data = doc.data();
        topCandidates.push({
          name: data.name,
          votes: data.votes || 0
        });
      });

      return {
        totalElections,
        totalVoters,
        totalVotesCast,
        activeAlerts: 0,
        totalStudents,
        uniqueVotersCount,
        activeElectionsCount,
        completedElectionsCount,
        topCandidates
      };
    }, 10000); // Cache for 10 seconds

    res.status(200).json({ status: 'success', data: dashboardData });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch dashboard data' });
  }
});

// COMBINED endpoint: Dashboard KPIs + Election Results + Flagged Users in ONE call
// Replaces 3+ separate API calls with a single round-trip
router.get('/dashboard-full', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const skipCache = req.query.nocache === 'true';
    if (skipCache) {
      cache.invalidate(`admin:${tenantId}:dashboard-full`);
    }

    const fullData = await cache.getOrSet(`admin:${tenantId}:dashboard-full`, async () => {
      // 1. Fetch elections with fallback
      let electionsSnap = await getElectionsRef(req).get();
      if (electionsSnap.empty) {
        const altCollection = getTenantCollection(req) === 'tenants' ? 'organizations' : 'tenants';
        electionsSnap = await db.collection(altCollection).doc(tenantId).collection('elections').get();
      }
      if (electionsSnap.empty) {
        electionsSnap = await db.collectionGroup('elections').get();
      }

      const elections = [];
      const now = Date.now();
      const statusUpdates = [];
      let activeElectionIds = [];
      let completedElectionsCount = 0;

      electionsSnap.forEach(doc => {
        const electionData = doc.data();
        // Ignore elections not belonging to this tenant/org in collectionGroup query
        if (doc.ref.parent && doc.ref.parent.parent && doc.ref.parent.parent.id !== tenantId) return;
        
        let updatedStatus = electionData.status || 'draft';
        const endTime = electionData.endDate ? new Date(electionData.endDate).getTime() : Infinity;
        const startTime = electionData.startDate ? new Date(electionData.startDate).getTime() : 0;

        if (electionData.status && electionData.status !== 'draft') {
          if (now >= startTime && now <= endTime) {
            if (electionData.status !== 'active') {
              updatedStatus = 'active';
              statusUpdates.push(doc.ref.update({ status: 'active' }));
            }
          } else if (now < startTime) {
            if (electionData.status !== 'scheduled') {
              updatedStatus = 'scheduled';
              statusUpdates.push(doc.ref.update({ status: 'scheduled' }));
            }
          } else if (now > endTime) {
            if (electionData.status !== 'completed' && electionData.status !== 'ended') {
              updatedStatus = 'completed';
              statusUpdates.push(doc.ref.update({ status: 'completed' }));
            }
          }
        }

        if (updatedStatus === 'active') activeElectionIds.push(doc.id);
        if (updatedStatus === 'completed' || updatedStatus === 'ended') completedElectionsCount++;

        elections.push({ id: doc.id, ...electionData, status: updatedStatus });
      });

      // Fire status updates in parallel
      if (statusUpdates.length > 0) {
        Promise.all(statusUpdates).catch(e => console.error('Status update error:', e));
      }

      // 2. Fetch voter rolls size (voters count)
      let votersSnap = await getUsersRef(req).get();
      if (votersSnap.empty) {
        const altCollection = getTenantCollection(req) === 'tenants' ? 'organizations' : 'tenants';
        votersSnap = await db.collection(altCollection).doc(tenantId).collection('voter_rolls').get();
      }
      const totalVoters = votersSnap.size;
      const totalStudents = votersSnap.docs.filter(d => d.data().role !== 'admin').length;

      // 3. Fetch candidates
      let candsSnap = await getCandidatesRef(req).get();
      if (candsSnap.empty) {
        const altCollection = getTenantCollection(req) === 'tenants' ? 'organizations' : 'tenants';
        candsSnap = await db.collection(altCollection).doc(tenantId).collection('candidates').get();
      }
      if (candsSnap.empty) {
        candsSnap = await db.collectionGroup('candidates').get();
      }

      let totalVotesCast = 0;
      const posTotals = {};
      const topCandidates = [];

      candsSnap.forEach(doc => {
        const d = doc.data();
        if (d.electionId && !elections.some(el => el.id === d.electionId)) return;
        const v = (d.votes || 0) + (d.noVotes || 0);
        totalVotesCast += v;
        const pos = d.position || 'General';
        posTotals[pos] = (posTotals[pos] || 0) + v;
      });

      // Get top candidates sorted by votes
      const sortedCands = [...candsSnap.docs]
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(c => c.electionId && elections.some(el => el.id === c.electionId))
        .sort((a, b) => (b.votes || 0) - (a.votes || 0))
        .slice(0, 10);
      
      sortedCands.forEach(c => {
        topCandidates.push({ name: c.name, votes: c.votes || 0 });
      });

      const uniqueVotersCount = Math.max(0, ...Object.values(posTotals));

      const stats = {
        totalElections: elections.length,
        totalVoters,
        totalVotesCast,
        activeAlerts: 0,
        totalStudents,
        uniqueVotersCount,
        activeElectionsCount: activeElectionIds.length,
        completedElectionsCount,
        topCandidates
      };

      const electionResults = elections.map(election => {
        const candidates = [];
        candsSnap.forEach(doc => {
          const d = doc.data();
          if (d.electionId === election.id) {
            candidates.push({ id: doc.id, ...d });
          }
        });
        const totalVotes = candidates.reduce((s, c) => s + (c.votes || 0) + (c.noVotes || 0), 0);
        return { election, candidates, totalVotes };
      });

      // --- Flagged Users ---
      let flaggedUsers = [];
      try {
        let flaggedSnap = await getFraudAlertsRef(req).get();
        if (flaggedSnap.empty) {
          flaggedSnap = await db.collection('fraud_alerts').get();
        }
        
        const rawUsers = [];
        flaggedSnap.forEach(doc => {
          const data = doc.data();
          if (data.type === 'UNRECOGNIZED_STUDENT') {
            const studentId = data.metadata?.studentId || 'Unknown';
            rawUsers.push({
              id: doc.id,
              studentId: studentId,
              attemptedAt: data.metadata?.attemptedAt || new Date(data.timestamp || Date.now()).toISOString(),
              email: studentId !== 'Unknown' ? `${studentId}@htu.edu.gh` : 'Unknown',
              timestamp: data.timestamp || Date.now(),
              status: data.status || 'unresolved'
            });
          }
        });
        
        // Sort in memory to avoid needing a composite index for where() + orderBy() in Firestore
        flaggedUsers = rawUsers.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
      } catch (err) {
        console.error('Error fetching flagged users:', err);
      }

      return { stats, electionResults, flaggedUsers };
    }, 10000); // Cache for 10 seconds

    res.status(200).json({
      status: 'success',
      data: fullData
    });
  } catch (error) {
    console.error('Error fetching full dashboard:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch dashboard data' });
  }
});

// Get Comprehensive Voter & Election Activity Report
router.get('/report', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const skipCache = req.query.nocache === 'true';
    if (skipCache) {
      cache.invalidate(`admin:${tenantId}:report`);
    }

    const reportData = await cache.getOrSet(`admin:${tenantId}:report`, async () => {
      // 0. Find current active election(s) or fallback to completed/all elections
      const activeElectionsSnap = await getElectionsRef(req).where('status', '==', 'active').get();
      const activeElectionIds = [];
      let activeElectionTitle = 'No Active Election';
      activeElectionsSnap.forEach(doc => {
        activeElectionIds.push(doc.id);
        activeElectionTitle = doc.data().title || activeElectionTitle;
      });

      let targetElectionIds = [...activeElectionIds];
      if (targetElectionIds.length === 0) {
        const allElectionsSnap = await getElectionsRef(req).get();
        allElectionsSnap.forEach(doc => {
          targetElectionIds.push(doc.id);
          if (activeElectionTitle === 'No Active Election') {
            activeElectionTitle = doc.data().title || 'Completed Election';
          }
        });
      }

      // 1. Fetch user records
      const usersSnap = await getUsersRef(req).get();
      
      let totalVotersFromCSV = 0;
      let totalRegisteredVoters = 0;
      const voterList = [];

      // 2. Fetch voted_voters for target election(s)
      const votedVoterIds = new Set();
      const voterAuditCodes = {}; // Maps voterId -> array of auditTxIds
      if (targetElectionIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < targetElectionIds.length; i += 30) {
          chunks.push(targetElectionIds.slice(i, i + 30));
        }
        for (const chunk of chunks) {
          const votedSnap = await getVotedVotersRef(req)
            .where('electionId', 'in', chunk)
            .select('voterId', 'auditTxId')
            .get();
          votedSnap.forEach(doc => {
            const data = doc.data();
            if (data.voterId) {
              votedVoterIds.add(data.voterId);
              if (data.auditTxId) {
                if (!voterAuditCodes[data.voterId]) {
                  voterAuditCodes[data.voterId] = new Set();
                }
                voterAuditCodes[data.voterId].add(data.auditTxId);
              }
            }
          });
        }
      }

      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.role !== 'admin') {
          totalVotersFromCSV++;
          const isReg = data.isRegistered === true;
          if (isReg) totalRegisteredVoters++;

          const hasVoted = votedVoterIds.has(doc.id) || votedVoterIds.has(data.studentId);
          const verificationCodes = hasVoted && voterAuditCodes[doc.id] 
            ? Array.from(voterAuditCodes[doc.id]).join(', ') 
            : (hasVoted && voterAuditCodes[data.studentId] ? Array.from(voterAuditCodes[data.studentId]).join(', ') : 'N/A');

          voterList.push({
            id: doc.id,
            studentId: data.studentId || doc.id,
            name: data.name || 'Unknown',
            email: data.email || '',
            programme: data.programme || 'N/A',
            level: data.level || 'N/A',
            isRegistered: isReg,
            hasVoted: hasVoted,
            verificationCode: verificationCodes
          });
        }
      });

      let totalVoted = votedVoterIds.size;

      // Fallback: If totalVoted is 0, estimate from candidate max category votes
      if (totalVoted === 0) {
        try {
          const candsSnap = await getCandidatesRef(req).get();
          const posTotals = {};
          candsSnap.forEach(doc => {
            const d = doc.data();
            const v = (d.votes || 0) + (d.noVotes || 0);
            const pos = d.position || 'General';
            posTotals[pos] = (posTotals[pos] || 0) + v;
          });
          totalVoted = Math.max(0, ...Object.values(posTotals));
        } catch (e) {}
      }

      const summary = {
        field1_totalVoters: {
          label: 'Number of Voters (from CSV file)',
          count: totalVotersFromCSV,
          isSuccessful: totalVotersFromCSV > 0,
          mark: totalVotersFromCSV > 0 ? '✓' : '✗'
        },
        field2_registeredVoters: {
          label: 'Number of Registered Voters',
          count: totalRegisteredVoters,
          isSuccessful: totalRegisteredVoters > 0,
          mark: totalRegisteredVoters > 0 ? '✓' : '✗'
        },
        field3_successfullyVoted: {
          label: 'Number of People that have Successfully Voted',
          count: totalVoted,
          isSuccessful: totalVoted > 0,
          mark: totalVoted > 0 ? '✓' : '✗'
        }
      };

      return {
        summary,
        totalVotersFromCSV,
        totalRegisteredVoters,
        totalVoted,
        activeElectionTitle,
        voters: voterList
      };
    }, 15000); // Cache for 15 seconds

    res.status(200).json({ status: 'success', data: reportData });
  } catch (error) {
    console.error('Error generating admin report:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate report' });
  }
});

// Trigger an Audit Check on an election
router.get('/audit/:electionId', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { electionId } = req.params;
    const result = await verifyElectionIntegrity(electionId);
    
    if (result.valid) {
      res.status(200).json({ status: 'success', data: result });
    } else {
      res.status(409).json({ status: 'error', message: 'Audit failure detected', data: result });
    }
  } catch (error) {
    console.error('Error running audit:', error);
    res.status(500).json({ status: 'error', message: 'Failed to run audit' });
  }
});

// Bulk upload voters
router.post('/voters/bulk', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { filename, voters } = req.body;
    if (!Array.isArray(voters)) {
      return res.status(400).json({ status: 'error', message: 'Invalid data format. Expected an array of voters.' });
    }

    const uploadRef = getUploadsRef(req).doc();
    const uploadId = uploadRef.id;

    const usersRef = getUsersRef(req);
    let added = 0;
    let skipped = 0;
    const unsuccessful = [];

    // Filter out initially invalid voters to avoid query overhead
    const validVoters = voters.filter(voter => {
      if (!voter.id || !voter.name) {
        unsuccessful.push({
          ...voter,
          reason: 'Missing ID or Name'
        });
        skipped++;
        return false;
      }
      return true;
    });

    // Chunk check for duplicates in batches of 30 to stay within Firestore limits
    const existingIds = new Set();
    const chunkSize = 30;
    for (let i = 0; i < validVoters.length; i += chunkSize) {
      const chunk = validVoters.slice(i, i + chunkSize).map(v => v.id);
      if (chunk.length > 0) {
        const snapshot = await usersRef.where('studentId', 'in', chunk).get();
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data && data.studentId) {
            existingIds.add(data.studentId);
          }
        });
      }
    }

    // Process valid voters using Firestore Batched Writes (500 operations max per batch)
    let batch = db.batch();
    let opCount = 0;

    for (const voter of validVoters) {
      if (existingIds.has(voter.id)) {
        unsuccessful.push({
          ...voter,
          reason: 'Student ID already exists in database'
        });
        skipped++;
        continue;
      }

      const docRef = usersRef.doc(voter.id);
      batch.set(docRef, {
        name: voter.name,
        studentId: voter.id,
        email: voter.email,
        programme: voter.programme || '',
        level: voter.level || '',
        phone: voter.phone ? voter.phone.replace(/\s+/g, '') : '',
        role: 'voter',
        isRegistered: false,
        uploadId: uploadId,
        createdAt: Date.now()
      });

      added++;
      opCount++;

      if (opCount === 500) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    await uploadRef.set({
      filename: filename || 'unknown_upload.csv',
      timestamp: Date.now(),
      added,
      skipped
    });

    // Invalidate report cache since voter data changed
    cache.invalidate('admin:report');
    cache.invalidate('admin:analytics');
    cache.invalidate('admin:dashboard');
    cache.invalidate('admin:dashboard-full');

    // Log activity
    const tenantId = getTenantId(req);
    await logActivity({
      tenantId,
      actorEmail: req.user?.email || 'admin',
      actorRole: 'admin',
      action: 'CSV_UPLOAD',
      description: `Uploaded voter roster "${filename || 'unknown.csv'}" — ${added} added, ${skipped} skipped`,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      status: 'success',
      meta: { filename, added, skipped }
    });

    res.status(200).json({ 
      status: 'success', 
      message: `Processed ${voters.length} records. Added ${added} new voters, skipped ${skipped}.`,
      data: { added, skipped, unsuccessful }
    });
  } catch (error) {
    console.error('Error in bulk voter upload:', error);
    res.status(500).json({ status: 'error', message: 'Failed to process bulk upload' });
  }
});

// Get voter upload history
router.get('/voters/uploads', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const uploads = await cache.getOrSet(`admin:${tenantId}:uploads`, async () => {
      const snapshot = await getUploadsRef(req).orderBy('timestamp', 'desc').get();
      const results = [];
      snapshot.forEach(doc => {
         results.push({ id: doc.id, ...doc.data() });
      });
      return results;
    }, 15000); // Cache 15s

    res.status(200).json({ status: 'success', data: uploads });
  } catch (error) {
    console.error('Error fetching uploads list:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch upload history' });
  }
});

// Delete an upload and all associated voters, and clear flagged users
router.delete('/voters/uploads/:uploadId', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { uploadId } = req.params;

    // 1. Delete associated voters
    const votersSnapshot = await getUsersRef(req).where('uploadId', '==', uploadId).get();
    if (!votersSnapshot.empty) {
      const docs = votersSnapshot.docs;
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

    // 2. Clear flagged users (UNRECOGNIZED_STUDENT fraud alerts)
    const fraudSnapshot = await getFraudAlertsRef(req).where('type', '==', 'UNRECOGNIZED_STUDENT').get();
    if (!fraudSnapshot.empty) {
      const docs = fraudSnapshot.docs;
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

    // 3. Delete the upload document itself
    await getUploadsRef(req).doc(uploadId).delete();

    // Invalidate caches
    cache.invalidate('admin:uploads');
    cache.invalidate('admin:report');
    cache.invalidate('admin:analytics');
    cache.invalidate('admin:dashboard');
    cache.invalidate('admin:dashboard-full');
    cache.invalidate('admin:flagged-users');
    cache.invalidate('admin:fraud-alerts');

    res.status(200).json({
      status: 'success',
      message: `Upload, ${votersSnapshot.size} associated voter records, and ${fraudSnapshot.size} flagged users cleared successfully.`
    });
  } catch (error) {
    console.error('Error deleting upload and flagged users:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete upload and linked records' });
  }
});

// Get Fraud Alerts - OPTIMIZED: Use Firestore .where() filter instead of reading ALL docs
router.get('/fraud-alerts', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const alerts = await cache.getOrSet(`admin:${tenantId}:fraud-alerts`, async () => {
      let alertsDoc = await getFraudAlertsRef(req)
        .where('type', '==', 'DUPLICATE_VOTE')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      if (alertsDoc.empty) {
        alertsDoc = await db.collection('fraud_alerts')
          .where('type', '==', 'DUPLICATE_VOTE')
          .orderBy('timestamp', 'desc')
          .limit(100)
          .get();
      }

      if (alertsDoc.empty) return [];

      const results = [];
      alertsDoc.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
      });
      return results;
    }, 15000);

    res.status(200).json({ status: 'success', data: alerts });
  } catch (error) {
    console.error('Error fetching fraud alerts:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch fraud alerts' });
  }
});

// Get Flagged Users - OPTIMIZED: Use Firestore .where() filter instead of reading ALL docs
router.get('/flagged-users', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const flagged = await cache.getOrSet(`admin:${tenantId}:flagged-users`, async () => {
      let alertsDoc = await getFraudAlertsRef(req)
        .where('type', '==', 'UNRECOGNIZED_STUDENT')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      if (alertsDoc.empty) {
        alertsDoc = await db.collection('fraud_alerts')
          .where('type', '==', 'UNRECOGNIZED_STUDENT')
          .orderBy('timestamp', 'desc')
          .limit(50)
          .get();
      }

      if (alertsDoc.empty) return [];

      const results = [];
      alertsDoc.forEach(doc => {
        const data = doc.data();
        const studentId = data.metadata?.studentId || 'Unknown';
        results.push({
          id: doc.id,
          studentId: studentId,
          attemptedAt: data.metadata?.attemptedAt || new Date(data.timestamp || Date.now()).toISOString(),
          email: studentId !== 'Unknown' ? `${studentId}@htu.edu.gh` : 'Unknown',
          timestamp: data.timestamp || Date.now(),
          status: data.status || 'unresolved'
        });
      });
      return results;
    }, 15000);

    res.status(200).json({ status: 'success', data: flagged });
  } catch (error) {
    console.error('Error fetching flagged users:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch flagged users' });
  }
});

// Get Analytics Data
router.get('/analytics', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const analyticsData = await cache.getOrSet(`admin:${tenantId}:analytics`, async () => {
      // 1. Fetch total users
      const usersSnap = await getUsersRef(req).get();
      let totalVoters = 0;
      const deptCounts = {};
      
      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.role !== 'admin') {
          totalVoters++;
          const dept = data.programme || 'Other';
          deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        }
      });

      const sortedDepts = Object.entries(deptCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
      const deptLabels = sortedDepts.map(d => d[0]);
      const deptData = sortedDepts.map(d => d[1]);
      
      // 2. Fetch elections & votes for performance summary
      const electionsSnap = await getElectionsRef(req).get();
      const performanceSummary = [];
      
      const votesSnap = await getVotesRef(req).get();
      const castPerElection = {};
      const votesByHour = {};
      
      votesSnap.forEach(doc => {
        const data = doc.data();
        if (data.electionId) {
          castPerElection[data.electionId] = (castPerElection[data.electionId] || 0) + 1;
        }
        if (data.timestamp) {
           const date = new Date(data.timestamp);
           const hour = date.getHours();
           const timeLabel = `${hour.toString().padStart(2, '0')}:00`;
           votesByHour[timeLabel] = (votesByHour[timeLabel] || 0) + 1;
        }
      });
      
      electionsSnap.forEach(doc => {
        const el = doc.data();
        const cast = castPerElection[doc.id] || 0;
        const rate = totalVoters > 0 ? ((cast / totalVoters) * 100).toFixed(1) + '%' : '—';
        performanceSummary.push({
          name: el.title || 'Unknown Election',
          total: totalVoters,
          cast: cast,
          rate: rate,
          status: el.status || 'unknown'
        });
      });
      
      const sortedHours = Object.keys(votesByHour).sort();
      const peakLabels = sortedHours.length > 0 ? sortedHours : ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];
      const peakData = sortedHours.length > 0 ? sortedHours.map(h => votesByHour[h]) : [0, 0, 0, 0, 0, 0];

      return {
        departmentParticipation: {
          labels: deptLabels.length > 0 ? deptLabels : ['No Data'],
          datasets: [{
            label: 'Students Enrolled',
            data: deptData.length > 0 ? deptData : [0],
            backgroundColor: '#3B82F6',
            borderRadius: 6
          }]
        },
        peakVotingTimes: {
          labels: peakLabels,
          datasets: [{
            label: 'Ballots Processed',
            data: peakData,
            borderColor: '#7C3AED',
            backgroundColor: 'rgba(124, 58, 237, 0.1)',
            tension: 0.3,
            fill: true
          }]
        },
        performanceSummary: performanceSummary
      };
    }, 15000);
    
    res.status(200).json({ status: 'success', data: analyticsData });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch analytics data' });
  }
});

// Export Analytics Report
router.get('/export/:format', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { format } = req.params;
    if (!['pdf', 'csv', 'excel'].includes(format)) {
      return res.status(400).json({ status: 'error', message: 'Invalid export format' });
    }
    res.status(200).json({ 
      status: 'success', 
      message: `Export generated in ${format.toUpperCase()} format`,
      downloadUrl: `/mock-downloads/report.${format}`
    });
  } catch (error) {
    console.error(`Error exporting ${req.params.format}:`, error);
    res.status(500).json({ status: 'error', message: `Failed to export ${req.params.format}` });
  }
});

// Live votes count endpoint - OPTIMIZED WITH AGGREGATIONS + CACHE
router.get('/live-votes', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const liveData = await cache.getOrSet(`admin:${tenantId}:live-votes`, async () => {
      // 1. Fast count aggregation (~1 Read instead of reading every vote doc)
      const votesCountSnap = await getVotesRef(req).count().get();
      const liveVotesCount = votesCountSnap.data().count;
      
      // 2. Fetch top candidates (10 Reads)
      const candidatesDoc = await getCandidatesRef(req).orderBy('votes', 'desc').limit(10).get();
      const topCandidates = [];
      candidatesDoc.forEach(doc => {
        const data = doc.data();
        topCandidates.push({
          name: data.name,
          votes: data.votes || 0
        });
      });

      return { liveVotesCount, topCandidates };
    }, 5000); // Cache 5s for live data

    res.status(200).json({ status: 'success', data: liveData });
  } catch (error) {
    console.error('[Admin Live Votes] Error fetching live votes:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch live votes' });
  }
});

// Clear all voter database records, upload history, and voted records (excluding admins)
router.post('/voters/clear', verifyAuth, requireAdmin, async (req, res) => {
  try {
    // 1. Delete all non-admin voters
    const usersSnap = await getUsersRef(req).get();
    let deletedVotersCount = 0;
    if (!usersSnap.empty) {
      const batch = db.batch();
      usersSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.role !== 'admin') {
          batch.delete(doc.ref);
          deletedVotersCount++;
        }
      });
      if (deletedVotersCount > 0) {
        await batch.commit();
      }
    }

    // 2. Clear upload history
    const uploadsSnap = await getUploadsRef(req).get();
    if (!uploadsSnap.empty) {
      const batch = db.batch();
      uploadsSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    // 3. Clear voted records
    const votedSnap = await getVotedVotersRef(req).get();
    if (!votedSnap.empty) {
      const batch = db.batch();
      votedSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    // Invalidate all caches
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:');
    cache.invalidatePrefix('elections:');

    res.status(200).json({
      status: 'success',
      message: `Database cleared successfully. Deleted ${deletedVotersCount} voter records, all upload histories, and voting records.`
    });
  } catch (error) {
    console.error('Error clearing voter database:', error);
    res.status(500).json({ status: 'error', message: 'Failed to clear voter database' });
  }
});

// ── Admin Password Reset ─────────────────────────────────────────────────
// Allows department admins to change their own login password.
// Writes the new bcrypt hash directly to the tenant doc so the superadmin
// portal always stays in sync.
const bcrypt = require('bcryptjs');

router.post('/change-password', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ status: 'error', message: 'New password must be at least 6 characters' });
    }

    const tenantId = getTenantId(req);
    const tenantRef = db.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();

    if (!tenantSnap.exists) {
      return res.status(404).json({ status: 'error', message: 'Department not found' });
    }

    const tenantData = tenantSnap.data();

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, tenantData.adminPassword);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Current password is incorrect' });
    }

    // Hash and save the new password to the tenant doc
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await tenantRef.update({
      adminPassword: hashedPassword,
      passwordUpdatedAt: Date.now()
    });

    // Log the password change activity
    try {
      await logActivity({
        tenantId,
        actorEmail: req.user?.email || 'admin',
        actorRole: 'admin',
        action: 'PASSWORD_CHANGE',
        description: `Admin password changed by ${req.user?.email || 'admin'}`,
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        status: 'success'
      });
    } catch (logErr) {
      console.warn('[Admin] Failed to log password change activity:', logErr.message);
    }

    res.status(200).json({ status: 'success', message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing admin password:', error);
    res.status(500).json({ status: 'error', message: 'Failed to change password' });
  }
});

module.exports = router;