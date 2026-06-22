const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');
const { verifyAuth, requireAdmin } = require('../middleware/auth');

// Get elections (optional status filter)
router.get('/', async (req, res) => {
  try {
    const electionsRef = db.collection('elections');
    const { status } = req.query;
    
    let snapshot;
    if (status) {
      snapshot = await electionsRef.where('status', '==', status).get();
    } else {
      snapshot = await electionsRef.get();
    }
    
    if (snapshot.empty) {
      // Seed default elections if the mock DB has no elections yet
      const countSnapshot = await electionsRef.get();
      if (countSnapshot.empty) {
        const defaultElections = [
          {
            title: "University Student Council Presidential Election",
            description: "Vote for the next Student Council President to lead HTU initiatives, policy changes, and events for the academic year 2026/2027.",
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 86400000 * 2).toISOString(),
            status: "active",
            organizationId: "htu",
            createdAt: Date.now()
          },
          {
            title: "Department of Computer Science Representative",
            description: "Annual representative vote for Computer Science faculty board and curriculum adjustment committee representation.",
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 86400000 * 5).toISOString(),
            status: "active",
            organizationId: "htu",
            createdAt: Date.now()
          },
          {
            title: "HTU Sports Club Board Members",
            description: "General board elections for sports facilities allocations, event funding boards, and club tournament operations management.",
            startDate: new Date(Date.now() + 86400000 * 3).toISOString(),
            endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
            status: "draft", // acts as upcoming/draft
            organizationId: "htu",
            createdAt: Date.now()
          },
          {
            title: "Annual Budget Allocation Referendum",
            description: "Vote on proposed allocation of surplus university funds between campus construction projects vs student activity grants.",
            startDate: new Date(Date.now() - 86400000 * 5).toISOString(),
            endDate: new Date(Date.now() - 86400000 * 1).toISOString(),
            status: "completed", // closed
            organizationId: "htu",
            createdAt: Date.now()
          }
        ];
        
        const seeded = [];
        for (const item of defaultElections) {
          const docRef = await electionsRef.add(item);
          seeded.push({ id: docRef.id, ...item });
        }
        return res.status(200).json({ status: 'success', data: seeded });
      }
      return res.status(200).json({ status: 'success', data: [] });
    }

    const elections = [];
    snapshot.forEach(doc => {
      elections.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json({ status: 'success', data: elections });
  } catch (error) {
    console.error('Error fetching elections:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch elections' });
  }
});

// Get specific election details
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('elections').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    res.status(200).json({ status: 'success', data: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error('Error fetching election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch election' });
  }
});

// Create new election (Admin only)
router.post('/', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, startDate, endDate, organizationId } = req.body;
    
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const newElection = {
      title,
      description: description || '',
      startDate,
      endDate,
      organizationId: organizationId || 'default',
      status: 'draft', // draft, active, completed
      createdAt: Date.now()
    };

    const docRef = await db.collection('elections').add(newElection);
    res.status(201).json({ status: 'success', data: { id: docRef.id, ...newElection } });
  } catch (error) {
    console.error('Error creating election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create election' });
  }
});

// Update election status (Admin only)
router.patch('/:id/status', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status' });
    }

    await db.collection('elections').doc(req.params.id).update({ status });
    res.status(200).json({ status: 'success', message: `Election status updated to ${status}` });
  } catch (error) {
    console.error('Error updating election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update election' });
  }
});

module.exports = router;
