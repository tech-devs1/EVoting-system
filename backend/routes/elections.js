const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');
const { verifyAuth, requireAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const cache = require('../services/cache');

// Get elections (optional status filter) - CACHED & WRITE OPTIMIZED
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const cacheKey = `elections:list:${status || 'all'}`;

    const elections = await cache.getOrSet(cacheKey, async () => {
      const electionsRef = db.collection('elections');
      let snapshot;
      if (status) {
        snapshot = await electionsRef.where('status', '==', status).get();
      } else {
        snapshot = await electionsRef.get();
      }
      
      if (snapshot.empty) {
        return [];
      }

      const list = [];
      const now = Date.now();
      const dbUpdates = [];
      
      snapshot.forEach(doc => {
        const electionData = doc.data();
        let updatedStatus = electionData.status;
        
        const endTime = electionData.endDate ? new Date(electionData.endDate).getTime() : Infinity;
        const startTime = electionData.startDate ? new Date(electionData.startDate).getTime() : 0;

        if (electionData.status === 'active' && electionData.endDate && endTime < now) {
          updatedStatus = 'completed';
          dbUpdates.push(db.collection('elections').doc(doc.id).update({ status: 'completed' }));
        } else if (electionData.status === 'draft' && electionData.startDate && startTime <= now) {
          updatedStatus = 'active';
          dbUpdates.push(db.collection('elections').doc(doc.id).update({ status: 'active' }));
        }
        
        list.push({ id: doc.id, ...electionData, status: updatedStatus });
      });

      // Execute status updates in background if any occurred
      if (dbUpdates.length > 0) {
        Promise.all(dbUpdates)
          .then(() => {
            // Invalidate elections list & detail caches
            cache.invalidatePrefix('elections:');
            cache.invalidatePrefix('admin:');
          })
          .catch(err => console.error('Error updating election status in background:', err));
      }

      return list;
    }, 10000); // Cache for 10 seconds

    res.status(200).json({ status: 'success', data: elections });
  } catch (error) {
    console.error('Error fetching elections:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch elections' });
  }
});

// Get specific election details - CACHED & WRITE OPTIMIZED
router.get('/:id', async (req, res) => {
  try {
    const electionId = req.params.id;
    const cacheKey = `elections:detail:${electionId}`;

    const election = await cache.getOrSet(cacheKey, async () => {
      const doc = await db.collection('elections').doc(electionId).get();
      if (!doc.exists) {
        throw new Error('NOT_FOUND');
      }
      
      let electionData = doc.data();
      const now = Date.now();
      let updatedStatus = electionData.status;
      
      const endTime = electionData.endDate ? new Date(electionData.endDate).getTime() : Infinity;
      const startTime = electionData.startDate ? new Date(electionData.startDate).getTime() : 0;

      if (electionData.status === 'active' && electionData.endDate && endTime < now) {
        updatedStatus = 'completed';
        await db.collection('elections').doc(doc.id).update({ status: 'completed' });
        // Invalidate caches
        cache.invalidatePrefix('elections:');
        cache.invalidatePrefix('admin:');
      } else if (electionData.status === 'draft' && electionData.startDate && startTime <= now) {
        updatedStatus = 'active';
        await db.collection('elections').doc(doc.id).update({ status: 'active' });
        // Invalidate caches
        cache.invalidatePrefix('elections:');
        cache.invalidatePrefix('admin:');
      }

      return { id: doc.id, ...electionData, status: updatedStatus };
    }, 10000); // Cache for 10 seconds

    res.status(200).json({ status: 'success', data: election });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    console.error('Error fetching election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch election' });
  }
});

// Create new election (Admin only)
router.post('/', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, startDate, endDate, organizationId, type, department, showResults } = req.body;
    
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const electionType = type || 'src';
    const deptLabel = (department || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const dateLabel = startDate
      ? new Date(startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString();

    const autoDesc = electionType === 'src'
      ? `This is the Student Representative Council (SRC) election scheduled for ${dateLabel}. Eligible students are invited to vote for their preferred candidates across all SRC positions.`
      : `This is the ${deptLabel} Departmental election scheduled for ${dateLabel}. Students in the ${deptLabel} department are invited to elect their departmental representatives.`;

    const finalDescription = (description && !description.startsWith('Automated')) ? description : autoDesc;

    const newElection = {
      title,
      description: finalDescription,
      startDate,
      endDate,
      organizationId: organizationId || 'default',
      type: electionType,
      department: department || '',
      status: 'draft',
      showResults: showResults === true,
      createdBy: 'admin',
      createdAt: Date.now()
    };

    const docRef = await db.collection('elections').add(newElection);

    // Invalidate election list caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    res.status(201).json({ status: 'success', data: { id: docRef.id, ...newElection } });
  } catch (error) {
    console.error('Error creating election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create election' });
  }
});

// Migrate existing elections (Admin only)
router.post('/migrate-descriptions', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('elections').get();
    const updates = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.description || data.description.startsWith('Automated')) {
        const electionType = data.type || 'src';
        const deptLabel = (data.department || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const dateLabel = data.startDate
          ? new Date(data.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'a scheduled date';

        const newDesc = electionType === 'src'
          ? `This is the Student Representative Council (SRC) election scheduled for ${dateLabel}. Eligible students are invited to vote for their preferred candidates across all SRC positions.`
          : `This is the ${deptLabel} Departmental election scheduled for ${dateLabel}. Students in the ${deptLabel} department are invited to elect their departmental representatives.`;

        updates.push(db.collection('elections').doc(doc.id).update({ description: newDesc }));
      }
    });

    await Promise.all(updates);
    
    // Invalidate election caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    res.status(200).json({ status: 'success', message: `Updated ${updates.length} election(s)` });
  } catch (error) {
    console.error('Error migrating descriptions:', error);
    res.status(500).json({ status: 'error', message: 'Migration failed' });
  }
});

// Update election time window (Admin only)
router.patch('/:id/time-window', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'startDate and endDate are required' });
    }

    const electionDoc = await db.collection('elections').doc(req.params.id).get();
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }

    const electionData = electionDoc.data();
    const isActive = electionData.status === 'active';

    if (isActive) {
      // For active elections: only allow extending the end time, not reducing it
      const currentEndDate = new Date(electionData.endDate).getTime();
      const newEndDate = new Date(endDate).getTime();

      if (newEndDate < currentEndDate) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot reduce the end time of an ongoing election. You may only extend it.'
        });
      }

      // Only update endDate for active elections (don't change startDate mid-election)
      await db.collection('elections').doc(req.params.id).update({ endDate });
    } else {
      // For draft/completed elections: update both start and end dates freely
      await db.collection('elections').doc(req.params.id).update({ startDate, endDate });
    }

    // Invalidate caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    res.status(200).json({ status: 'success', message: 'Election time window updated' });
  } catch (error) {
    console.error('Error updating election time window:', error);
    res.status(500).json({ status: 'error', message: `Failed to update time window: ${error.message} - ${error.stack}` });
  }
});

// Reactivate a completed election with a new end date (Admin only)
// NOTE: This does NOT clear votes, candidates, or results — it only extends time and sets status back to active
router.patch('/:id/reactivate', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { endDate } = req.body;
    if (!endDate) {
      return res.status(400).json({ status: 'error', message: 'A new endDate is required to reactivate the election' });
    }

    const newEndDate = new Date(endDate).getTime();
    if (isNaN(newEndDate) || newEndDate <= Date.now()) {
      return res.status(400).json({ status: 'error', message: 'The new end date must be in the future' });
    }

    const electionDoc = await db.collection('elections').doc(req.params.id).get();
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    if (electionDoc.data().status !== 'completed') {
      return res.status(400).json({ status: 'error', message: 'Only completed elections can be reactivated' });
    }

    // Atomically update endDate and status — votes, candidates, results are untouched
    await db.collection('elections').doc(req.params.id).update({
      endDate,
      status: 'active',
      reactivatedAt: new Date().toISOString()
    });

    // Invalidate caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:');

    res.status(200).json({ status: 'success', message: 'Election reactivated successfully with new end date' });
  } catch (error) {
    console.error('Error reactivating election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to reactivate election' });
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

    // Invalidate caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');

    res.status(200).json({ status: 'success', message: `Election status updated to ${status}` });
  } catch (error) {
    console.error('Error updating election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update election' });
  }
});

// Toggle showResults status (Admin only)
router.patch('/:id/toggle-results', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { showResults } = req.body;
    if (typeof showResults !== 'boolean') {
      return res.status(400).json({ status: 'error', message: 'showResults must be a boolean' });
    }

    await db.collection('elections').doc(req.params.id).update({ showResults });

    // Invalidate caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:'); // Voters fetch candidates check results visibility

    res.status(200).json({ status: 'success', message: `Voter results visibility updated to ${showResults}` });
  } catch (error) {
    console.error('Error toggling results visibility:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update results visibility' });
  }
});

// Delete election (Admin only)
router.delete('/:id', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    await db.collection('elections').doc(electionId).delete();

    // Cascade delete associated candidates, votes, and voted_voters
    const collectionsToDelete = ['candidates', 'votes', 'voted_voters'];
    
    for (const collectionName of collectionsToDelete) {
      const snapshot = await db.collection(collectionName).where('electionId', '==', electionId).get();
      if (!snapshot.empty) {
        // Firestore batch allows up to 500 operations. For simplicity and since elections might have >500 votes,
        // we'll delete them concurrently using Promise.all in chunks.
        const docs = snapshot.docs;
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
    }

    // Invalidate caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:');

    res.status(200).json({ status: 'success', message: 'Election and all associated data deleted successfully' });
  } catch (error) {
    console.error('Error deleting election:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete election' });
  }
});

// Generate election report JSON (Admin only) - CACHED
router.get('/:id/report', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const cacheKey = `elections:report:${electionId}`;

    const report = await cache.getOrSet(cacheKey, async () => {
      // 1. Get election details (1 Read)
      const electionDoc = await db.collection('elections').doc(electionId).get();
      if (!electionDoc.exists) {
        throw new Error('NOT_FOUND');
      }
      const election = { id: electionId, ...electionDoc.data() };
      
      // 2. Get candidates (1 Read per candidate, usually ~10 Reads)
      const candidatesSnapshot = await db.collection('candidates').where('electionId', '==', electionId).get();
      const candidates = [];
      candidatesSnapshot.forEach(doc => {
        candidates.push({ id: doc.id, ...doc.data() });
      });
      
      // 3. OPTIMIZED: Get total votes cast using count() (~2 Reads instead of 2,000 Reads)
      const votesCountSnap = await db.collection('votes').where('electionId', '==', electionId).count().get();
      const totalVotes = votesCountSnap.data().count;
      
      // 4. OPTIMIZED: Get unique voters count using count() (~2 Reads instead of 2,000 Reads)
      const votedVotersCountSnap = await db.collection('voted_voters').where('electionId', '==', electionId).count().get();
      const uniqueVoters = votedVotersCountSnap.data().count;
      
      return {
        election: {
          title: election.title,
          description: election.description,
          startDate: new Date(election.startDate).toLocaleString(),
          endDate: new Date(election.endDate).toLocaleString(),
          status: election.status,
          type: election.type,
          department: election.department,
          createdAt: new Date(election.createdAt).toLocaleString()
        },
        statistics: {
          totalCandidates: candidates.length,
          totalVotesCast: totalVotes,
          uniqueVoters: uniqueVoters,
          reportGeneratedAt: new Date().toLocaleString()
        },
        candidates: candidates.map(c => ({
          name: c.name,
          position: c.position,
          manifesto: c.manifesto,
          votes: c.votes || 0,
          percentage: totalVotes > 0 ? ((c.votes || 0) / totalVotes * 100).toFixed(2) : '0.00'
        })).sort((a, b) => b.votes - a.votes)
      };
    }, 15000); // Cache for 15 seconds

    res.status(200).json({ status: 'success', data: report });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    console.error('Error generating election report:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate election report' });
  }
});

// Download election report as PDF (Admin only) - CACHED
router.get('/:id/report/pdf', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    const cacheKey = `elections:report:pdf:${electionId}`;

    const reportData = await cache.getOrSet(cacheKey, async () => {
      // 1. Get election details
      const electionDoc = await db.collection('elections').doc(electionId).get();
      if (!electionDoc.exists) {
        throw new Error('NOT_FOUND');
      }
      const election = { id: electionId, ...electionDoc.data() };
      
      // 2. Get candidates
      const candidatesSnapshot = await db.collection('candidates').where('electionId', '==', electionId).get();
      const candidates = [];
      candidatesSnapshot.forEach(doc => {
        candidates.push({ id: doc.id, ...doc.data() });
      });
      
      // 3. OPTIMIZED: Fast aggregation count for total votes
      const votesCountSnap = await db.collection('votes').where('electionId', '==', electionId).count().get();
      const totalVotes = votesCountSnap.data().count;
      
      // 4. OPTIMIZED: Fast aggregation count for unique voters
      const votedVotersCountSnap = await db.collection('voted_voters').where('electionId', '==', electionId).count().get();
      const uniqueVoters = votedVotersCountSnap.data().count;

      // 5. Fetch ONLY the 50 most recent verification hashes to prevent PDF overload & quota exhaustion
      const verificationLogsSnap = await db.collection('voted_voters')
        .where('electionId', '==', electionId)
        .limit(50)
        .get();

      const verificationIds = [];
      verificationLogsSnap.forEach(doc => {
        const data = doc.data();
        verificationIds.push({
          id: data.auditTxId || doc.id,
          position: data.position || 'General',
          timestamp: data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'
        });
      });

      return {
        election,
        candidates,
        totalVotes,
        uniqueVoters,
        verificationIds
      };
    }, 30000); // Cache pdf data for 30s

    const { election, candidates, totalVotes, uniqueVoters, verificationIds } = reportData;
    
    // Generate PDF Document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${election.title.replace(/[^a-zA-Z0-9]/g, '_')}_report.pdf"`);
    
    doc.pipe(res);
    
    doc.fontSize(24).font('Helvetica-Bold').text('Election Report', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(18).font('Helvetica-Bold').text(election.title);
    doc.moveDown();
    
    doc.fontSize(12).font('Helvetica').text(`Description: ${election.description || 'N/A'}`);
    doc.text(`Start Date: ${new Date(election.startDate).toLocaleString()}`);
    doc.text(`End Date: ${new Date(election.endDate).toLocaleString()}`);
    doc.text(`Status: ${election.status.toUpperCase()}`);
    doc.text(`Type: ${election.type || 'N/A'}`);
    doc.text(`Department: ${election.department || 'N/A'}`);
    doc.moveDown();
    
    // Statistics section
    doc.fontSize(16).font('Helvetica-Bold').text('Statistics', { underline: true });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Total Candidates: ${candidates.length}`);
    doc.text(`Total Votes Cast: ${totalVotes}`);
    doc.text(`Unique Voters: ${uniqueVoters}`);
    doc.text(`Report Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    // Candidates section
    doc.fontSize(16).font('Helvetica-Bold').text('Candidate Results', { underline: true });
    doc.moveDown();
    
    candidates.forEach((candidate, index) => {
      const percentage = totalVotes > 0 ? ((candidate.votes || 0) / totalVotes * 100).toFixed(2) : '0.00';
      doc.fontSize(14).font('Helvetica-Bold').text(`${index + 1}. ${candidate.name}`);
      doc.fontSize(12).font('Helvetica').text(`   Position: ${candidate.position}`);
      if (candidate.isIndependent) {
        doc.text(`   Yes Votes: ${candidate.votes || 0} | No Votes: ${candidate.noVotes || 0}`);
      } else {
        doc.text(`   Votes: ${candidate.votes || 0} (${percentage}%)`);
      }
      doc.moveDown();
    });

    if (doc.y > 650) doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Cryptographic Voter Verification Ledger (Recent 50)', { underline: true });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text('Cryptographic audit hashes generated for verified ballots:');
    doc.moveDown();
    if (verificationIds.length === 0) {
      doc.text('No verified ballot hashes recorded yet.');
    } else {
      verificationIds.forEach((v, index) => {
        doc.fontSize(9).font('Courier').text(`${index + 1}. [HASH]: ${v.id} | [Pos]: ${v.position} | [Time]: ${v.timestamp}`);
      });
    }
    doc.moveDown();
    
    doc.fontSize(10).font('Helvetica').text('Generated by COMPSSA ELECTIONS SYSTEM', { align: 'center' });
    doc.end();

  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    console.error('Error generating PDF report:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate PDF report' });
  }
});

module.exports = router;