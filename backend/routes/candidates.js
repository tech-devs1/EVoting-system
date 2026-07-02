const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');
const { verifyAuth, requireAdmin } = require('../middleware/auth');

// Get all candidates for a specific election (Public/Voter access)
router.get('/election/:electionId', async (req, res) => {
  try {
    const { electionId } = req.params;
    const candidatesRef = db.collection('candidates');
    const snapshot = await candidatesRef.where('electionId', '==', electionId).get();
    
    const candidates = [];
    snapshot.forEach(doc => {
      candidates.push({ id: doc.id, ...doc.data() });
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

module.exports = router;
