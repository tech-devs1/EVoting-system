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
    
    if (snapshot.empty) {
      // Seed default candidates if empty
      const countSnapshot = await candidatesRef.get();
      if (countSnapshot.empty) {
        const defaultCandidates = [
          // Presidential election candidates
          {
            name: "Elena Rostova",
            position: "President",
            manifesto: "Driving sustainable campus energy policies, expanding student startup labs, and introducing digital academic counseling systems.",
            photoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300",
            votes: 432,
            electionId,
            createdAt: Date.now()
          },
          {
            name: "Marcus Vance",
            position: "President",
            manifesto: "Re-negotiating scholarship funding levels, creating direct administration-to-student feedback channels, and upgrading athletic complexes.",
            photoUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=300",
            votes: 389,
            electionId,
            createdAt: Date.now()
          },
          // Computer Science Rep candidates
          {
            name: "Sarah Chen",
            position: "CS Rep",
            manifesto: "Fostering industry mentorship, organizing hackathons with tech companies, and upgrading student labs with modern development machines.",
            photoUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=300",
            votes: 210,
            electionId,
            createdAt: Date.now()
          },
          {
            name: "Jordan Brooks",
            position: "CS Rep",
            manifesto: "Promoting opensource contributions, improving tutoring support networks, and securing department funding for project development.",
            photoUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=300",
            votes: 184,
            electionId,
            createdAt: Date.now()
          }
        ];

        // Seed based on title keywords of the election
        const electionDoc = await db.collection('elections').doc(electionId).get();
        const electionTitle = electionDoc.exists ? electionDoc.data().title.toLowerCase() : '';
        
        let candidatesToSeed = [];
        if (electionTitle.includes('president')) {
          candidatesToSeed = defaultCandidates.slice(0, 2);
        } else {
          candidatesToSeed = defaultCandidates.slice(2, 4);
        }

        const seeded = [];
        for (const item of candidatesToSeed) {
          const docRef = await candidatesRef.add(item);
          seeded.push({ id: docRef.id, ...item });
        }
        return res.status(200).json({ status: 'success', data: seeded });
      }
      return res.status(200).json({ status: 'success', data: [] });
    }

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
    const { name, manifesto, electionId, position, photoUrl } = req.body;
    
    if (!name || !electionId) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const newCandidate = {
      name,
      manifesto: manifesto || '',
      electionId,
      position: position || 'General',
      photoUrl: photoUrl || '',
      votes: 0, // Initial vote count
      createdAt: Date.now()
    };

    const docRef = await db.collection('candidates').add(newCandidate);
    res.status(201).json({ status: 'success', data: { id: docRef.id, ...newCandidate } });
  } catch (error) {
    console.error('Error adding candidate:', error);
    res.status(500).json({ status: 'error', message: 'Failed to add candidate' });
  }
});

module.exports = router;
