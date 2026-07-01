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
    const { title, description, startDate, endDate, organizationId, type, department } = req.body;
    
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const newElection = {
      title,
      description: description || '',
      startDate,
      endDate,
      organizationId: organizationId || 'default',
      type: type || 'src',
      department: department || '',
      status: 'draft', // draft, active, completed
      createdBy: 'admin',
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

// Delete election (Admin only)
router.delete('/:id', verifyAuth, requireAdmin, async (req, res) => {
  try {
    await db.collection('elections').doc(req.params.id).delete();
    res.status(200).json({ status: 'success', message: 'Election deleted' });
  } catch (error) {
    console.error('Error deleting election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete election' });
  }
});

module.exports = router;
