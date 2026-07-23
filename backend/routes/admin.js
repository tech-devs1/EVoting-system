const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');
const { verifyAuth, requireAdmin } = require('../middleware/auth');
const { verifyElectionIntegrity } = require('../services/audit');

// Get Dashboard Analytics
router.get('/dashboard', verifyAuth, requireAdmin, async (req, res) => {
  try {
    // In a real database, use aggregations. Using mock get() here.
    const electionsDoc = await db.collection('elections').get();
    const votersDoc = await db.collection('users').where('isRegistered', '==', true).get();
    const votesDoc = await db.collection('votes').get();

    console.log('[Admin Dashboard] Total elections:', electionsDoc.docs.length);
    console.log('[Admin Dashboard] Total registered voters (isRegistered=true):', votersDoc.docs.length);
    console.log('[Admin Dashboard] Total votes:', votesDoc.docs.length);

    // Debug: Count all users and their isRegistered status
    const allUsersDoc = await db.collection('users').get();
    let registeredCount = 0;
    let unregisteredCount = 0;
    let noFieldCount = 0;
    
    allUsersDoc.forEach(doc => {
      const data = doc.data();
      if (data.isRegistered === true) {
        registeredCount++;
      } else if (data.isRegistered === false) {
        unregisteredCount++;
      } else {
        noFieldCount++;
      }
    });

    console.log('[Admin Dashboard] All users breakdown:');
    console.log('  - isRegistered=true:', registeredCount);
    console.log('  - isRegistered=false:', unregisteredCount);
    console.log('  - no isRegistered field:', noFieldCount);
    console.log('  - Total:', allUsersDoc.docs.length);

    // Fetch candidates for real-time chart
    const candidatesDoc = await db.collection('candidates').orderBy('votes', 'desc').limit(10).get();
    const topCandidates = [];
    candidatesDoc.forEach(doc => {
      const data = doc.data();
      topCandidates.push({
        name: data.name,
        votes: data.votes || 0
      });
    });

    res.status(200).json({
      status: 'success',
      data: {
        totalElections: electionsDoc.empty ? 0 : electionsDoc.docs.length,
        totalVoters: votersDoc.empty ? 0 : votersDoc.docs.length,
        totalVotesCast: votesDoc.empty ? 0 : votesDoc.docs.length,
        activeAlerts: 0, // Mock for now
        topCandidates
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch dashboard data' });
  }
});

// Get Comprehensive Voter & Election Activity Report
router.get('/report', verifyAuth, requireAdmin, async (req, res) => {
  try {
    // 1. Fetch all user records (voters from CSV)
    const usersSnap = await db.collection('users').get();
    
    let totalVotersFromCSV = 0;
    let totalRegisteredVoters = 0;
    const voterList = [];

    // 2. Fetch voted_voters to determine unique voters who voted
    const votedSnap = await db.collection('voted_voters').get();
    const votedVoterIds = new Set();
    votedSnap.forEach(doc => {
      const data = doc.data();
      if (data.voterId) {
        votedVoterIds.add(data.voterId);
      }
    });

    usersSnap.forEach(doc => {
      const data = doc.data();
      // Exclude admin accounts if role is explicitly 'admin'
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

    // Field status checks (Tick ✓ vs Cross ✗)
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

    res.status(200).json({
      status: 'success',
      data: {
        summary,
        totalVotersFromCSV,
        totalRegisteredVoters,
        totalVoted,
        voters: voterList
      }
    });
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

    for (const voter of voters) {
      if (!voter.id || !voter.name) {
        unsuccessful.push({
          ...voter,
          reason: 'Missing ID or Name'
        });
        skipped++;
        continue;
      }

      const docRef = usersRef.doc(voter.id);
      const existing = await docRef.get();
      if (existing.exists) {
        unsuccessful.push({
          ...voter,
          reason: 'Student ID already exists in database'
        });
        skipped++;
      } else {
        await docRef.set({
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
      }
    }

    // Save upload metadata
    await uploadRef.set({
      filename: filename || 'unknown_upload.csv',
      timestamp: Date.now(),
      added,
      skipped
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
    const snapshot = await db.collection('uploads').orderBy('timestamp', 'desc').get();
    const uploads = [];
    snapshot.forEach(doc => {
      uploads.push({ id: doc.id, ...doc.data() });
    });
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

    // 1. Delete associated voters
    const votersSnapshot = await db.collection('users').where('uploadId', '==', uploadId).get();
    if (!votersSnapshot.empty) {
      const batch = db.batch();
      votersSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`[Admin Upload Cleanup] Deleted ${votersSnapshot.size} voters linked to upload: ${uploadId}`);
    }

    // 2. Delete upload metadata
    await db.collection('uploads').doc(uploadId).delete();

    res.status(200).json({
      status: 'success',
      message: `Upload and ${votersSnapshot.size} associated voter records deleted successfully.`
    });
  } catch (error) {
    console.error('Error deleting upload:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete upload and linked records' });
  }
});

// Get Fraud Alerts
router.get('/fraud-alerts', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const alertsDoc = await db.collection('fraud_alerts').get();
    if (alertsDoc.empty) {
      return res.status(200).json({ status: 'success', data: [] });
    }

    const alerts = [];
    alertsDoc.forEach(doc => {
      const data = doc.data();
      if (data.message && data.message.toLowerCase().includes('duplicate')) {
        alerts.push({ id: doc.id, ...data });
      }
    });

    res.status(200).json({ status: 'success', data: alerts });
  } catch (error) {
    console.error('Error fetching fraud alerts:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch fraud alerts' });
  }
});
// Get Analytics Data
router.get('/analytics', verifyAuth, requireAdmin, async (req, res) => {
  try {
    // Return mock analytics data matching frontend structures
    const analyticsData = {
      departmentParticipation: {
        labels: ['Computer Science', 'Engineering', 'Business School', 'Design & Arts', 'Medical Sci'],
        datasets: [{
          label: 'Turnout %',
          data: [92, 85, 78, 88, 71],
          backgroundColor: '#3B82F6',
          borderRadius: 6
        }]
      },
      peakVotingTimes: {
        labels: ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'],
        datasets: [{
          label: 'Ballots Processed',
          data: [50, 180, 420, 290, 510, 230],
          borderColor: '#7C3AED',
          backgroundColor: 'rgba(124, 58, 237, 0.1)',
          tension: 0.3,
          fill: true
        }]
      },
      performanceSummary: [
        { name: 'University Student Council Presidential Election', total: 2840, cast: 2085, rate: '73.4%', status: 'active' },
        { name: 'Department of Computer Science Representative', total: 450, cast: 394, rate: '87.6%', status: 'active' },
        { name: 'HTU Sports Club Board Members', total: 1200, cast: 0, rate: '—', status: 'upcoming' },
        { name: 'Annual Budget Allocation Referendum', total: 2840, cast: 2095, rate: '73.8%', status: 'completed' }
      ]
    };
    
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
    // In a real application, this would generate and return a file buffer/stream
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

// Live votes count endpoint – returns total votes cast across all elections and top candidates
router.get('/live-votes', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const votesSnap = await db.collection('votes').get();
    const liveVotesCount = votesSnap.empty ? 0 : votesSnap.docs.length;
    
    // Fetch candidates for real-time chart
    const candidatesDoc = await db.collection('candidates').orderBy('votes', 'desc').limit(10).get();
    const topCandidates = [];
    candidatesDoc.forEach(doc => {
      const data = doc.data();
      topCandidates.push({
        name: data.name,
        votes: data.votes || 0
      });
    });

    res.status(200).json({
      status: 'success',
      data: { liveVotesCount, topCandidates }
    });
  } catch (error) {
    console.error('[Admin Live Votes] Error fetching live votes:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch live votes' });
  }
});

module.exports = router;
