const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');
const { verifyAuth, requireAdmin } = require('../middleware/auth');

// Get all candidates for a specific election (Public/Voter access)
router.get('/election/:electionId', async (req, res) => {
  try {
    const { electionId } = req.params;
    
    // Check if requester is an admin by decoding JWT/Mock token
    const authHeader = req.headers.authorization;
    let isAdmin = false;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      try {
        if (token.startsWith('MOCK_')) {
          const uid = token.replace('MOCK_', '');
          if (uid.startsWith('admin_')) isAdmin = true;
        } else {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.decode(token);
          if (decoded && (decoded.role === 'admin' || decoded.email?.includes('admin'))) {
            isAdmin = true;
          }
        }
      } catch (err) {
        // ignore
      }
    }

    // Fetch election to see if live charts are published to voters
    const electionDoc = await db.collection('elections').doc(electionId).get();
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    const electionData = electionDoc.data();
    const showResults = electionData.showResults === true;

    const candidatesRef = db.collection('candidates');
    const snapshot = await candidatesRef.where('electionId', '==', electionId).get();
    
    const candidates = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Hide votes from API response if not admin and showResults is false
      if (!isAdmin && !showResults) {
        data.votes = 0;
      }
      candidates.push({ id: doc.id, ...data });
    });

    res.status(200).json({ status: 'success', data: candidates });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch candidates' });
  }
});

// Add a new candidate (Admin only)
router.post('/', verifyAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Add Candidate] Request body:', req.body);
    const { name, manifesto, manifestoUrl, electionId, position, photoUrl } = req.body;
    
    if (!name || !electionId) {
      console.log('[Add Candidate] Missing required fields:', { name, electionId });
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const newCandidate = {
      name,
      manifesto: manifesto || '',
      manifestoUrl: manifestoUrl || '',
      electionId,
      position: position || 'General',
      photoUrl: photoUrl || '',
      votes: 0, // Initial vote count
      createdAt: Date.now()
    };

    console.log('[Add Candidate] Creating candidate with data:', newCandidate);
    const docRef = await db.collection('candidates').add(newCandidate);
    console.log('[Add Candidate] Candidate created with ID:', docRef.id);
    
    res.status(201).json({ status: 'success', data: { id: docRef.id, ...newCandidate } });
  } catch (error) {
    console.error('[Add Candidate] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to add candidate' });
  }
});

// Delete a candidate (Admin only)
router.delete('/:candidateId', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { candidateId } = req.params;
    console.log('[Delete Candidate] Deleting candidate:', candidateId);
    
    await db.collection('candidates').doc(candidateId).delete();
    console.log('[Delete Candidate] Candidate deleted successfully');
    
    res.status(200).json({ status: 'success', message: 'Candidate deleted successfully' });
  } catch (error) {
    console.error('[Delete Candidate] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete candidate' });
  }
});

// Update a candidate field (Admin only) — used for manifesto URL uploads
router.patch('/:candidateId', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { candidateId } = req.params;
    const updates = req.body; // e.g. { manifestoUrl: '...' }
    
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ status: 'error', message: 'No update fields provided' });
    }

    await db.collection('candidates').doc(candidateId).update(updates);
    res.status(200).json({ status: 'success', message: 'Candidate updated successfully' });
  } catch (error) {
    console.error('[Update Candidate] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update candidate' });
  }
});

module.exports = router;
