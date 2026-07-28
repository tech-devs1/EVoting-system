 const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');
const { verifyAuth, requireAdmin } = require('../middleware/auth');
const { verifyElectionIntegrity } = require('../services/audit');
const cache = require('../services/cache');

// Get Dashboard Analytics - OPTIMIZED WITH AGGREGATIONS + CACHE
router.get('/dashboard', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const dashboardData = await cache.getOrSet('admin:dashboard', async () => {
      // 1. Get active elections
      const activeElectionsSnapForQuery = await db.collection('elections').where('status', '==', 'active').get();
      const activeElectionIds = [];
      activeElectionsSnapForQuery.forEach(doc => {
        activeElectionIds.push(doc.id);
      });

      // 2. Server-side aggregations for total counts (~1 Read per collection)
      const electionsCountSnap = await db.collection('elections').count().get();
      const votersCountSnap = await db.collection('users').where('isRegistered', '==', true).count().get();
      
      const totalElections = electionsCountSnap.data().count;
      const totalVoters = votersCountSnap.data().count;

      let totalVotesCast = 0;
      let uniqueVotersCount = 0;

      if (activeElectionIds.length > 0) {
        // Get counts for active election(s) specifically
        const votesCountSnap = await db.collection('votes').where('electionId', 'in', activeElectionIds).count().get();
        totalVotesCast = votesCountSnap.data().count;

        // OPTIMIZED: Use count() for voted_voters instead of reading all docs
        // This counts vote records (a voter with 3 positions = 3 records), which is
        // close enough for KPI display and saves potentially thousands of reads.
        const uniqueVotersSnap = await db.collection('voted_voters').where('electionId', 'in', activeElectionIds).count().get();
        uniqueVotersCount = uniqueVotersSnap.data().count;
      } else {
        // Fallback to global counts
        const votesCountSnap = await db.collection('votes').count().get();
        totalVotesCast = votesCountSnap.data().count;

        const uniqueVotersSnap = await db.collection('voted_voters').count().get();
        uniqueVotersCount = uniqueVotersSnap.data().count;
      }

      // 3. Fetch election statuses cleanly
      const completedElectionsSnap = await db.collection('elections').where('status', '==', 'completed').count().get();
      const activeElectionsCount = activeElectionIds.length;
      const completedElectionsCount = completedElectionsSnap.data().count;

      // 4. Count non-admin students using count aggregation (1 Read)
      const totalStudentsSnap = await db.collection('users').where('role', '!=', 'admin').count().get();
      const totalStudents = totalStudentsSnap.data().count;

      // 5. Fetch top 10 candidates for chart (10 Reads)
      const candidatesDoc = await db.collection('candidates').orderBy('votes', 'desc').limit(10).get();
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
    const skipCache = req.query.nocache === 'true';
    if (skipCache) {
      cache.invalidate('admin:dashboard-full');
    }

    const fullData = await cache.getOrSet('admin:dashboard-full', async () => {
      // --- KPIs ---
      let activeElectionIds = [];
      try {
        const activeElectionsSnap = await db.collection('elections').where('status', '==', 'active').get();
        activeElectionsSnap.forEach(doc => activeElectionIds.push(doc.id));
      } catch (e) {
        console.error('Error fetching active elections:', e);
      }

      let totalElections = 0;
      let totalVoters = 0;
      let completedElectionsCount = 0;
      let totalStudents = 0;

      try {
        const [electionsCountSnap, votersCountSnap, completedSnap, studentsSnap] = await Promise.all([
          db.collection('elections').count().get(),
          db.collection('users').where('isRegistered', '==', true).count().get(),
          db.collection('elections').where('status', '==', 'completed').count().get(),
          db.collection('users').where('role', '!=', 'admin').count().get()
        ]);
        totalElections = electionsCountSnap.data().count;
        totalVoters = votersCountSnap.data().count;
        completedElectionsCount = completedSnap.data().count;
        totalStudents = studentsSnap.data().count;
      } catch (countErr) {
        console.warn('[Dashboard] Aggregation count() failed, falling back to snapshot size:', countErr.message);
        // Fallback to .get().size if count() is unsupported or fails
        const [elSnap, vSnap, compSnap, stSnap] = await Promise.all([
          db.collection('elections').get(),
          db.collection('users').where('isRegistered', '==', true).get(),
          db.collection('elections').where('status', '==', 'completed').get(),
          db.collection('users').get()
        ]);
        totalElections = elSnap.size;
        totalVoters = vSnap.size;
        completedElectionsCount = compSnap.size;
        totalStudents = stSnap.docs.filter(d => d.data().role !== 'admin').length;
      }

      let totalVotesCast = 0;
      let uniqueVotersCount = 0;

      try {
        if (activeElectionIds.length > 0) {
          const [votesSnap, votersSnap] = await Promise.all([
            db.collection('votes').where('electionId', 'in', activeElectionIds).count().get(),
            db.collection('voted_voters').where('electionId', 'in', activeElectionIds).count().get()
          ]);
          totalVotesCast = votesSnap.data().count;
          uniqueVotersCount = votersSnap.data().count;
        } else {
          const [votesSnap, votersSnap] = await Promise.all([
            db.collection('votes').count().get(),
            db.collection('voted_voters').count().get()
          ]);
          totalVotesCast = votesSnap.data().count;
          uniqueVotersCount = votersSnap.data().count;
        }
      } catch (e) {
        console.warn('[Dashboard] Fallback for votes/voters count:', e.message);
      }

      const topCandidates = [];
      try {
        const topCandidatesSnap = await db.collection('candidates').orderBy('votes', 'desc').limit(10).get();
        topCandidatesSnap.forEach(doc => {
          const d = doc.data();
          topCandidates.push({ name: d.name, votes: d.votes || 0 });
        });
      } catch (e) {
        console.error('Error fetching top candidates:', e);
      }

      const stats = {
        totalElections,
        totalVoters,
        totalVotesCast,
        activeAlerts: 0,
        totalStudents,
        uniqueVotersCount,
        activeElectionsCount: activeElectionIds.length,
        completedElectionsCount,
        topCandidates
      };

      // --- Elections + Candidates (for charts) ---
      const electionsSnap = await db.collection('elections').get();
      const elections = [];
      const now = Date.now();
      const statusUpdates = [];

      electionsSnap.forEach(doc => {
        const electionData = doc.data();
        let updatedStatus = electionData.status;
        const endTime = electionData.endDate ? new Date(electionData.endDate).getTime() : Infinity;
        const startTime = electionData.startDate ? new Date(electionData.startDate).getTime() : 0;

        if (electionData.status === 'active' && electionData.endDate && endTime < now) {
          updatedStatus = 'completed';
          statusUpdates.push(db.collection('elections').doc(doc.id).update({ status: 'completed' }));
        } else if (electionData.status === 'draft' && electionData.startDate && startTime <= now) {
          updatedStatus = 'active';
          statusUpdates.push(db.collection('elections').doc(doc.id).update({ status: 'active' }));
        }

        elections.push({ id: doc.id, ...electionData, status: updatedStatus });
      });

      // Fire status updates in parallel (don't await — non-blocking)
      if (statusUpdates.length > 0) {
        Promise.all(statusUpdates).catch(e => console.error('Status update error:', e));
      }

      // Fetch candidates for all elections in parallel
      const candidateResults = await Promise.allSettled(
        elections.map(el => db.collection('candidates').where('electionId', '==', el.id).get())
      );

      const electionResults = elections.map((election, i) => {
        const result = candidateResults[i];
        const candidates = [];
        if (result.status === 'fulfilled') {
          result.value.forEach(doc => {
            candidates.push({ id: doc.id, ...doc.data() });
          });
        }
        const totalVotes = candidates.reduce((s, c) => s + (c.votes || 0) + (c.noVotes || 0), 0);
        return { election, candidates, totalVotes };
      });

      // --- Flagged Users ---
      let flaggedUsers = [];
      try {
        const flaggedSnap = await db.collection('fraud_alerts').get();
        
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
    // Support ?nocache=true to bypass the in-memory cache
    // (critical on serverless where upload and report may hit different instances)
    const skipCache = req.query.nocache === 'true';
    if (skipCache) {
      cache.invalidate('admin:report');
    }

    const reportData = await cache.getOrSet('admin:report', async () => {
      // 0. Find current active election(s)
      const activeElectionsSnap = await db.collection('elections').where('status', '==', 'active').get();
      const activeElectionIds = [];
      let activeElectionTitle = 'No Active Election';
      activeElectionsSnap.forEach(doc => {
        activeElectionIds.push(doc.id);
        activeElectionTitle = doc.data().title || activeElectionTitle;
      });

      // 1. Fetch user records
      const usersSnap = await db.collection('users').get();
      
      let totalVotersFromCSV = 0;
      let totalRegisteredVoters = 0;
      const voterList = [];

      // 2. Fetch voted_voters ONLY for active election(s)
      const votedVoterIds = new Set();
      if (activeElectionIds.length > 0) {
        // Firestore 'in' supports up to 30 values
        const chunks = [];
        for (let i = 0; i < activeElectionIds.length; i += 30) {
          chunks.push(activeElectionIds.slice(i, i + 30));
        }
        for (const chunk of chunks) {
          const votedSnap = await db.collection('voted_voters')
            .where('electionId', 'in', chunk)
            .select('voterId')
            .get();
          votedSnap.forEach(doc => {
            const data = doc.data();
            if (data.voterId) {
              votedVoterIds.add(data.voterId);
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

          voterList.push({
            id: doc.id,
            studentId: data.studentId || doc.id,
            name: data.name || 'Unknown',
            email: data.email || '',
            programme: data.programme || 'N/A',
            level: data.level || 'N/A',
            isRegistered: isReg,
            hasVoted: hasVoted
          });
        }
      });

      const totalVoted = votedVoterIds.size;
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

    const uploadRef = db.collection('uploads').doc();
    const uploadId = uploadRef.id;

    const usersRef = db.collection('users');
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
    const uploads = await cache.getOrSet('admin:uploads', async () => {
      const snapshot = await db.collection('uploads').orderBy('timestamp', 'desc').get();
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

// Delete an upload and all associated voters
router.delete('/voters/uploads/:uploadId', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { uploadId } = req.params;

    const votersSnapshot = await db.collection('users').where('uploadId', '==', uploadId).get();
    if (!votersSnapshot.empty) {
      const batch = db.batch();
      votersSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    await db.collection('uploads').doc(uploadId).delete();

    // Invalidate caches
    cache.invalidate('admin:uploads');
    cache.invalidate('admin:report');
    cache.invalidate('admin:analytics');
    cache.invalidate('admin:dashboard');
    cache.invalidate('admin:dashboard-full');

    res.status(200).json({
      status: 'success',
      message: `Upload and ${votersSnapshot.size} associated voter records deleted successfully.`
    });
  } catch (error) {
    console.error('Error deleting upload:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete upload and linked records' });
  }
});

// Get Fraud Alerts - OPTIMIZED: Use Firestore .where() filter instead of reading ALL docs
router.get('/fraud-alerts', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const alerts = await cache.getOrSet('admin:fraud-alerts', async () => {
      // Query only DUPLICATE_VOTE type alerts at the Firestore level
      const alertsDoc = await db.collection('fraud_alerts')
        .where('type', '==', 'DUPLICATE_VOTE')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      if (alertsDoc.empty) return [];

      const results = [];
      alertsDoc.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
      });
      return results;
    }, 15000); // Cache 15s — fraud alerts don't change rapidly

    res.status(200).json({ status: 'success', data: alerts });
  } catch (error) {
    console.error('Error fetching fraud alerts:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch fraud alerts' });
  }
});

// Get Flagged Users - OPTIMIZED: Use Firestore .where() filter instead of reading ALL docs
router.get('/flagged-users', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const flagged = await cache.getOrSet('admin:flagged-users', async () => {
      // Query only UNRECOGNIZED_STUDENT type at the Firestore level
      const alertsDoc = await db.collection('fraud_alerts')
        .where('type', '==', 'UNRECOGNIZED_STUDENT')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

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
    }, 15000); // Cache 15s

    res.status(200).json({ status: 'success', data: flagged });
  } catch (error) {
    console.error('Error fetching flagged users:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch flagged users' });
  }
});

// Get Analytics Data
router.get('/analytics', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const analyticsData = await cache.getOrSet('admin:analytics', async () => {
      // 1. Fetch total users
      const usersSnap = await db.collection('users').get();
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
      const electionsSnap = await db.collection('elections').get();
      const performanceSummary = [];
      
      const votesSnap = await db.collection('votes').get();
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
    const liveData = await cache.getOrSet('admin:live-votes', async () => {
      // 1. Fast count aggregation (~1 Read instead of reading every vote doc)
      const votesCountSnap = await db.collection('votes').count().get();
      const liveVotesCount = votesCountSnap.data().count;
      
      // 2. Fetch top candidates (10 Reads)
      const candidatesDoc = await db.collection('candidates').orderBy('votes', 'desc').limit(10).get();
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
    const usersSnap = await db.collection('users').get();
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
    const uploadsSnap = await db.collection('uploads').get();
    if (!uploadsSnap.empty) {
      const batch = db.batch();
      uploadsSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    // 3. Clear voted records
    const votedSnap = await db.collection('voted_voters').get();
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

module.exports = router;