const express = require('express');
const router = express.Router();
const { db, DEFAULT_TENANT_ID } = require('../services/firebase');

const getTenantId = (req) => req.headers['x-tenant-id'] || req.query.tenantId || req.body.tenantId || DEFAULT_TENANT_ID;
const getElectionsRef = (req) => db.collection('tenants').doc(getTenantId(req)).collection('elections');
const getCandidatesRef = (req) => db.collection('tenants').doc(getTenantId(req)).collection('candidates');
const { verifyAuth, requireAdmin } = require('../middleware/auth');
const cache = require('../services/cache');

// Get all candidates for a specific election (Public/Voter access) - CACHED
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

    const cacheKey = `candidates:election:${electionId}:${isAdmin ? 'admin' : 'voter'}`;

    const candidates = await cache.getOrSet(cacheKey, async () => {
      // Fetch election to see if live charts are published to voters
      const electionDoc = await getElectionsRef(req).doc(electionId).get();
      if (!electionDoc.exists) {
        throw new Error('ELECTION_NOT_FOUND');
      }
      const electionData = electionDoc.data();
      const showResults = electionData.showResults === true;

      const candidatesRef = getCandidatesRef(req);
      const snapshot = await candidatesRef.where('electionId', '==', electionId).get();
      
      const list = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Hide votes from API response if not admin and showResults is false
        if (!isAdmin && !showResults) {
          data.votes = 0;
          data.noVotes = 0;
        }
        list.push({ id: doc.id, ...data });
      });

      return list;
    }, 10000); // Cache for 10 seconds

    res.status(200).json({ status: 'success', data: candidates });
  } catch (error) {
    if (error.message === 'ELECTION_NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    console.error('Error fetching candidates:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch candidates' });
  }
});

// Add a new candidate (Admin only)
router.post('/', verifyAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Add Candidate] Request body:', req.body);
    const { name, manifesto, manifestoUrl, electionId, position, photoUrl, isIndependent } = req.body;
    
    if (!name || !electionId) {
      console.log('[Add Candidate] Missing required fields:', { name, electionId });
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const electionDoc = await getElectionsRef(req).doc(electionId).get();
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    if (electionDoc.data().status === 'active') {
      return res.status(400).json({ status: 'error', message: 'Cannot add candidates to an ongoing election' });
    }

    // Check if the image/photoUrl is already used in the same election
    if (photoUrl && photoUrl.trim() !== '') {
      const duplicatePhotoSnap = await getCandidatesRef(req)
        .where('electionId', '==', electionId)
        .where('photoUrl', '==', photoUrl.trim())
        .get();

      if (!duplicatePhotoSnap.empty) {
        return res.status(400).json({
          status: 'error',
          message: 'This candidate image is already in use by another candidate in this election.'
        });
      }
    }

    const newCandidate = {
      name,
      manifesto: manifesto || '',
      manifestoUrl: manifestoUrl || '',
      electionId,
      position: position || 'General',
      photoUrl: photoUrl || '',
      votes: 0, // Initial vote count
      noVotes: 0, // Initial no-vote count (for independent candidates)
      isIndependent: isIndependent === true,
      createdAt: Date.now()
    };

    console.log('[Add Candidate] Creating candidate with data:', newCandidate);
    const docRef = await getCandidatesRef(req).add(newCandidate);
    console.log('[Add Candidate] Candidate created with ID:', docRef.id);
    
    // Invalidate caches
    cache.invalidatePrefix(`candidates:election:${electionId}`);
    cache.invalidate('admin:dashboard-full');

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
    
    // Retrieve candidate first to get electionId for cache invalidation
    const candDoc = await getCandidatesRef(req).doc(candidateId).get();
    if (candDoc.exists) {
      const electionId = candDoc.data().electionId;
      await getCandidatesRef(req).doc(candidateId).delete();
      cache.invalidatePrefix(`candidates:election:${electionId}`);
      cache.invalidate('admin:dashboard-full');
    }
    
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

    const candRef = getCandidatesRef(req).doc(candidateId);
    const candDoc = await candRef.get();
    if (!candDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Candidate not found' });
    }
    const electionId = candDoc.data().electionId;

    if (updates.photoUrl && updates.photoUrl.trim() !== '') {
      const duplicatePhotoSnap = await getCandidatesRef(req)
        .where('electionId', '==', electionId)
        .where('photoUrl', '==', updates.photoUrl.trim())
        .get();

      const otherDuplicates = duplicatePhotoSnap.docs.filter(doc => doc.id !== candidateId);
      if (otherDuplicates.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'This candidate image is already in use by another candidate in this election.'
        });
      }
    }

    await candRef.update(updates);
    
    // Invalidate caches
    cache.invalidatePrefix(`candidates:election:${electionId}`);
    cache.invalidate('admin:dashboard-full');

    res.status(200).json({ status: 'success', message: 'Candidate updated successfully' });
  } catch (error) {
    console.error('[Update Candidate] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update candidate' });
  }
});

module.exports = router;
