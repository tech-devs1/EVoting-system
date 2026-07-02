const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');
const { verifyAuth, requireAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

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
    const now = Date.now();
    
    snapshot.forEach(doc => {
      const electionData = doc.data();
      // Auto-update status based on time
      let updatedStatus = electionData.status;
      if (electionData.status === 'active' && electionData.endDate && electionData.endDate < now) {
        updatedStatus = 'completed';
        // Update the election status in background
        db.collection('elections').doc(doc.id).update({ status: 'completed' });
      } else if (electionData.status === 'draft' && electionData.startDate && electionData.startDate <= now) {
        updatedStatus = 'active';
        // Update the election status in background
        db.collection('elections').doc(doc.id).update({ status: 'active' });
      }
      
      elections.push({ id: doc.id, ...electionData, status: updatedStatus });
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

// Generate election report (Admin only)
router.get('/:id/report', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    
    // Get election details
    const electionDoc = await db.collection('elections').doc(electionId).get();
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    const election = { id: electionId, ...electionDoc.data() };
    
    // Get candidates for this election
    const candidatesSnapshot = await db.collection('candidates').where('electionId', '==', electionId).get();
    const candidates = [];
    candidatesSnapshot.forEach(doc => {
      candidates.push({ id: doc.id, ...doc.data() });
    });
    
    // Get total votes cast
    const votesSnapshot = await db.collection('votes').where('electionId', '==', electionId).get();
    const totalVotes = votesSnapshot.size;
    
    // Get unique voters who voted
    const votedVotersSnapshot = await db.collection('voted_voters').where('electionId', '==', electionId).get();
    const uniqueVoters = votedVotersSnapshot.size;
    
    // Generate report data
    const report = {
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
    
    res.status(200).json({ status: 'success', data: report });
  } catch (error) {
    console.error('Error generating election report:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate election report' });
  }
});

// Download election report as PDF (Admin only)
router.get('/:id/report/pdf', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const electionId = req.params.id;
    
    // Get election details
    const electionDoc = await db.collection('elections').doc(electionId).get();
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    const election = { id: electionId, ...electionDoc.data() };
    
    // Get candidates for this election
    const candidatesSnapshot = await db.collection('candidates').where('electionId', '==', electionId).get();
    const candidates = [];
    candidatesSnapshot.forEach(doc => {
      candidates.push({ id: doc.id, ...doc.data() });
    });
    
    // Get total votes cast
    const votesSnapshot = await db.collection('votes').where('electionId', '==', electionId).get();
    const totalVotes = votesSnapshot.size;
    
    // Get unique voters who voted
    const votedVotersSnapshot = await db.collection('voted_voters').where('electionId', '==', electionId).get();
    const uniqueVoters = votedVotersSnapshot.size;
    
    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${election.title.replace(/[^a-zA-Z0-9]/g, '_')}_report.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add content to PDF
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
      doc.text(`   Votes: ${candidate.votes || 0} (${percentage}%)`);
      doc.text(`   Manifesto: ${candidate.manifesto || 'N/A'}`);
      doc.moveDown();
    });
    
    // Footer
    doc.fontSize(10).font('Helvetica').text('Generated by Votick Voting System', { align: 'center' });
    
    doc.end();
  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate PDF report' });
  }
});

module.exports = router;
