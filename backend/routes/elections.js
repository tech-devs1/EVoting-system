const express = require('express');
const router = express.Router();
const { db, DEFAULT_TENANT_ID } = require('../services/firebase');

const getTenantId = (req) => {
  if (!req) return DEFAULT_TENANT_ID;
  const headersTenant = req.headers ? req.headers['x-tenant-id'] : null;
  const queryTenant = req.query ? req.query.tenantId : null;
  const bodyTenant = req.body ? req.body.tenantId : null;
  return headersTenant || queryTenant || bodyTenant || DEFAULT_TENANT_ID;
};
const getElectionsRef = (req) => {
  const tenantId = getTenantId(req);
  return db.collection('tenants').doc(tenantId).collection('elections');
};
const { verifyAuth, requireAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const cache = require('../services/cache');

// Get elections (optional status filter) - CACHED & WRITE OPTIMIZED
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const cacheKey = `elections:list:${status || 'all'}`;

    const elections = await cache.getOrSet(cacheKey, async () => {
      const electionsRef = getElectionsRef(req);
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
          dbUpdates.push(getElectionsRef(req).doc(doc.id).update({ status: 'completed' }));
        } else if (electionData.status === 'draft' && electionData.startDate && startTime <= now) {
          updatedStatus = 'active';
          dbUpdates.push(getElectionsRef(req).doc(doc.id).update({ status: 'active' }));
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
      const doc = await getElectionsRef(req).doc(electionId).get();
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
        await getElectionsRef(req).doc(doc.id).update({ status: 'completed' });
        // Invalidate caches
        cache.invalidatePrefix('elections:');
        cache.invalidatePrefix('admin:');
      } else if (electionData.status === 'draft' && electionData.startDate && startTime <= now) {
        updatedStatus = 'active';
        await getElectionsRef(req).doc(doc.id).update({ status: 'active' });
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

    const docRef = await getElectionsRef(req).add(newElection);

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
    const snapshot = await getElectionsRef(req).get();
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

        updates.push(getElectionsRef(req).doc(doc.id).update({ description: newDesc }));
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

    const electionDoc = await getElectionsRef(req).doc(req.params.id).get();
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
      await getElectionsRef(req).doc(req.params.id).update({ endDate });
    } else {
      // For draft/completed elections: update both start and end dates freely
      const updateData = { startDate, endDate };
      const now = Date.now();
      const newEndTime = new Date(endDate).getTime();
      
      // If it was completed but they just moved the end date to the future, auto-reactivate it!
      if (electionData.status === 'completed' && newEndTime > now) {
        updateData.status = 'active';
      }

      await getElectionsRef(req).doc(req.params.id).update(updateData);
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

    const electionDoc = await getElectionsRef(req).doc(req.params.id).get();
    if (!electionDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Election not found' });
    }
    if (electionDoc.data().status !== 'completed') {
      return res.status(400).json({ status: 'error', message: 'Only completed elections can be reactivated' });
    }

    // Atomically update endDate, reset startDate to now, and change status back to active
    const nowISO = new Date().toISOString();
    await getElectionsRef(req).doc(req.params.id).update({
      startDate: nowISO,
      endDate,
      status: 'active',
      reactivatedAt: nowISO
    });

    // Invalidate caches
    cache.invalidatePrefix('elections:');
    cache.invalidatePrefix('admin:');
    cache.invalidatePrefix('candidates:');

    res.status(200).json({ status: 'success', message: 'Election reactivated successfully with new time window' });
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

    await getElectionsRef(req).doc(req.params.id).update({ status });

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

    await getElectionsRef(req).doc(req.params.id).update({ showResults });

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
    await getElectionsRef(req).doc(electionId).delete();

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
      const electionDoc = await getElectionsRef(req).doc(electionId).get();
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
      const electionDoc = await getElectionsRef(req).doc(electionId).get();
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

// --- ELECTION ACCESS CONTROL VIA OTP (REPLACES BIOMETRIC PROCESS WITH IDENTITY VERIFICATION) ---

const BMS_API_KEY = process.env.BMS_API_KEY || process.env.MNOTIFY_API_KEY || '';
const BMS_SENDER_ID = process.env.BMS_SENDER_ID || 'COMPSSA';

// Helper: Send OTP via EmailJS REST API
async function sendOtpViaEmailJS(email, name, otp) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn('[EmailJS Warning] Missing EmailJS env variables. Code for', email, 'is:', otp);
    return;
  }

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    accessToken: privateKey,
    template_params: {
      to_name: name || 'Student',
      to_email: email,
      reset_code: otp,
      otp_code: otp,
      otp: otp
    }
  };

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[EmailJS Error]:', errText);
      throw new Error('EmailJS error: ' + errText);
    }
  } catch (err) {
    console.error('[EmailJS Failure]:', err.message || err);
    throw err;
  }
}

// Helper: Send OTP via BMS Africa (mNotify) Quick SMS API
async function sendOtpViaBMS(phoneNumber, otp) {
  if (!BMS_API_KEY) {
    console.warn('[BMS SMS Warning] No BMS_API_KEY configured — SMS not dispatched. Code for', phoneNumber, 'is:', otp);
    return;
  }

  let formattedPhone = phoneNumber.replace(/\s+/g, '');
  if (formattedPhone.startsWith('+233')) {
    formattedPhone = '0' + formattedPhone.substring(4);
  } else if (!formattedPhone.startsWith('0') && formattedPhone.length === 9) {
    formattedPhone = '0' + formattedPhone;
  }

  const payload = {
    recipient: [formattedPhone],
    sender: BMS_SENDER_ID,
    message: `Your COMPSSA verification code to unlock election access is ${otp}. It expires in 10 minutes.`,
    is_schedule: false
  };

  console.log(`[BMS SMS] Dispatching OTP ${otp} to ${formattedPhone} via BMS Africa`);

  try {
    const res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${BMS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });

    const responseText = await res.text();
    console.log('[BMS SMS] Response:', responseText);
  } catch (err) {
    console.error('[BMS SMS Error]:', err.message || err);
    throw err;
  }
}

// 1. Check if voter has already unlocked access to an election
router.get('/:id/access-status', verifyAuth, async (req, res) => {
  try {
    const electionId = req.params.id;
    const voterId = req.user.uid;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    const doc = await db.collection('tenants').doc(tenantId).collection('unlocked_elections').doc(`${voterId}_${electionId}`).get();
    res.status(200).json({
      status: 'success',
      data: {
        unlocked: doc.exists
      }
    });
  } catch (error) {
    console.error('Error checking access status:', error);
    res.status(500).json({ status: 'error', message: 'Failed to check access status.' });
  }
});

// 2. Request OTP to unlock access to an election
router.post('/:id/request-access-otp', verifyAuth, async (req, res) => {
  try {
    const electionId = req.params.id;
    const voterId = req.user.uid;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    // Fetch voter profile from voter_rolls to find contact details
    const voterRef = db.collection('tenants').doc(tenantId).collection('voter_rolls').doc(voterId);
    const voterDoc = await voterRef.get();
    if (!voterDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Voter profile not found.' });
    }
    const voterData = voterDoc.data();

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store in voter doc
    await voterRef.update({
      accessOtp: otp,
      accessOtpExpiry: expiry
    });

    let emailSent = false;
    let smsSent = false;

    // Dispatch via email
    if (voterData.email) {
      try {
        await sendOtpViaEmailJS(voterData.email, voterData.name, otp);
        emailSent = true;
      } catch (err) {
        console.error('[Access OTP] Email delivery failed:', err.message);
      }
    }

    // Dispatch via SMS
    if (voterData.phone) {
      try {
        await sendOtpViaBMS(voterData.phone, otp);
        smsSent = true;
      } catch (err) {
        console.error('[Access OTP] SMS delivery failed:', err.message);
      }
    }

    const dispatchSuccess = emailSent || smsSent;

    res.status(200).json({
      status: 'success',
      fallbackOtp: dispatchSuccess ? undefined : otp,
      message: dispatchSuccess
        ? `A verification code has been dispatched to your registered contact information.`
        : `A verification code was generated: ${otp}`
    });
  } catch (error) {
    console.error('Error requesting access OTP:', error);
    res.status(500).json({ status: 'error', message: 'Failed to request verification code.' });
  }
});

// 3. Verify OTP to unlock access to an election
router.post('/:id/verify-access-otp', verifyAuth, async (req, res) => {
  try {
    const electionId = req.params.id;
    const voterId = req.user.uid;
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ status: 'error', message: 'Verification code is required.' });
    }

    // Fetch voter profile
    const voterRef = db.collection('tenants').doc(tenantId).collection('voter_rolls').doc(voterId);
    const voterDoc = await voterRef.get();
    if (!voterDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Voter profile not found.' });
    }
    const voterData = voterDoc.data();

    // Validate OTP
    if (!voterData.accessOtp || voterData.accessOtp !== otp) {
      return res.status(400).json({ status: 'error', message: 'Invalid verification code.' });
    }

    if (Date.now() > voterData.accessOtpExpiry) {
      return res.status(400).json({ status: 'error', message: 'Verification code has expired. Please request a new one.' });
    }

    // Log the unlocked status for this user in this election
    await db.collection('tenants').doc(tenantId).collection('unlocked_elections').doc(`${voterId}_${electionId}`).set({
      voterId,
      electionId,
      verifiedAt: Date.now()
    });

    // Invalidate voter OTP fields
    await voterRef.update({
      accessOtp: null,
      accessOtpExpiry: null
    });

    res.status(200).json({
      status: 'success',
      message: 'Election unlocked successfully.'
    });
  } catch (error) {
    console.error('Error verifying access OTP:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify OTP.' });
  }
});

module.exports = router;