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

    res.status(200).json({
      status: 'success',
      data: {
        totalElections: electionsDoc.empty ? 0 : electionsDoc.docs.length,
        totalVoters: votersDoc.empty ? 0 : votersDoc.docs.length,
        totalVotesCast: votesDoc.empty ? 0 : votesDoc.docs.length,
        activeAlerts: 0 // Mock for now
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch dashboard data' });
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

// Get Fraud Alerts
router.get('/fraud-alerts', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const alertsDoc = await db.collection('fraud_alerts').get();
    if (alertsDoc.empty) {
      return res.status(200).json({ status: 'success', data: [] });
    }

    const alerts = [];
    alertsDoc.forEach(doc => alerts.push({ id: doc.id, ...doc.data() }));

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

// Live votes count endpoint – returns total votes cast across all elections
router.get('/live-votes', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const votesSnap = await db.collection('votes').get();
    const liveVotesCount = votesSnap.empty ? 0 : votesSnap.docs.length;
    console.log('[Admin Live Votes] Total votes:', liveVotesCount);
    res.status(200).json({
      status: 'success',
      data: { liveVotesCount }
    });
  } catch (error) {
    console.error('[Admin Live Votes] Error fetching live votes:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch live votes' });
  }
});

module.exports = router;
