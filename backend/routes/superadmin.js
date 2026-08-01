const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const { db } = require('../services/firebase');
const { verifyAuth, requireSuperAdmin } = require('../middleware/auth');

// Protect all superadmin routes
router.use(verifyAuth, requireSuperAdmin);

// Initialize default COMPSSA tenant doc if it doesn't exist
async function initDefaultTenant() {
  try {
    const tenantRef = db.collection('tenants').doc('default_tenant');
    const doc = await tenantRef.get();
    if (!doc.exists) {
      console.log('[Superadmin] Initializing default COMPSSA tenant in Firestore...');
      const hashedAdminPassword = await bcrypt.hash('admin080', 10);
      await tenantRef.set({
        name: 'COMPSSA',
        domain: '',
        adminEmail: 'admin@htu.edu.gh',
        adminPassword: hashedAdminPassword,
        status: 'active',
        createdAt: Date.now()
      });
    }
  } catch (err) {
    console.error('[Superadmin] Failed to initialize default COMPSSA tenant:', err);
  }
}
initDefaultTenant();

// Create a new department (tenant)
router.post('/departments', async (req, res) => {
  try {
    const { name, domain, adminEmail, adminPassword } = req.body;
    
    if (!name || !adminEmail || !adminPassword) {
      return res.status(400).json({ status: 'error', message: 'Name, admin email, and admin password are required' });
    }

    // Check if a department with this email already exists
    const existingAdmins = await db.collection('tenants').where('adminEmail', '==', adminEmail).get();
    if (!existingAdmins.empty) {
      return res.status(400).json({ status: 'error', message: 'A department with this admin email already exists' });
    }

    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
    const tenantId = `dept_${Date.now()}`;
    const newTenant = {
      name,
      domain: domain || '',
      adminEmail,
      adminPassword: hashedAdminPassword,
      status: 'active',
      createdAt: Date.now()
    };

    await db.collection('tenants').doc(tenantId).set(newTenant);

    res.status(201).json({ 
      status: 'success', 
      message: 'Department created successfully',
      data: {
        id: tenantId,
        name: newTenant.name,
        domain: newTenant.domain,
        adminEmail: newTenant.adminEmail,
        status: newTenant.status
      }
    });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create department' });
  }
});

// List all departments (tenants)
router.get('/departments', async (req, res) => {
  try {
    const snapshot = await db.collection('tenants').get();
    
    // Process tenants and their stats
    const departments = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data();
      
      // Get counts (simplified for overview)
      let electionsCount = 0;
      let votersCount = 0;
      
      try {
        const electionsSnap = await db.collection('tenants').doc(doc.id).collection('elections').count().get();
        electionsCount = electionsSnap.data().count;
        
        const votersSnap = await db.collection('tenants').doc(doc.id).collection('voter_rolls').count().get();
        votersCount = votersSnap.data().count;
      } catch (err) {
        console.warn(`Could not fetch counts for tenant ${doc.id}:`, err.message);
      }
      
      return {
        id: doc.id,
        name: data.name || (doc.id === 'default_tenant' ? 'COMPSSA' : 'Unknown'),
        domain: data.domain || '',
        adminEmail: data.adminEmail || (doc.id === 'default_tenant' ? 'admin@htu.edu.gh' : 'N/A'),
        status: data.status || 'active',
        createdAt: data.createdAt || null,
        electionsCount,
        votersCount
      };
    }));
    
    // Sort default_tenant (COMPSSA) first
    departments.sort((a, b) => {
      if (a.id === 'default_tenant') return -1;
      if (b.id === 'default_tenant') return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    res.status(200).json({
      status: 'success',
      data: departments
    });
  } catch (error) {
    console.error('Error listing departments:', error);
    res.status(500).json({ status: 'error', message: 'Failed to list departments' });
  }
});
// Get overall system stats
router.get('/stats', async (req, res) => {
  try {
    const tenantsSnap = await db.collection('tenants').get();
    const departments = tenantsSnap.size;
    
    let totalElections = 0;
    let totalVoters = 0;
    
    for (const doc of tenantsSnap.docs) {
      try {
        const elSnap = await db.collection('tenants').doc(doc.id).collection('elections').count().get();
        totalElections += elSnap.data().count;
        
        const voterSnap = await db.collection('tenants').doc(doc.id).collection('voter_rolls').count().get();
        totalVoters += voterSnap.data().count;
      } catch (err) {
        // ignore
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        departments,
        elections: totalElections,
        voters: totalVoters
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch stats' });
  }
});

// Update department name and/or admin password
router.patch('/departments/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenantRef = db.collection('tenants').doc(tenantId);
    const snap = await tenantRef.get();
    if (!snap.exists) {
      return res.status(404).json({ status: 'error', message: 'Department not found' });
    }

    const updates = {};
    const { name, adminPassword } = req.body;

    if (name && name.trim()) {
      updates.name = name.trim();
    }

    if (adminPassword && adminPassword.trim()) {
      updates.adminPassword = await bcrypt.hash(adminPassword.trim(), 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ status: 'error', message: 'No changes provided' });
    }

    await tenantRef.update(updates);
    res.status(200).json({ status: 'success', message: 'Department updated successfully' });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update department' });
  }
});

// Delete a department (tenant) and all its sub-collections
router.delete('/departments/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenantRef = db.collection('tenants').doc(tenantId);
    const snap = await tenantRef.get();
    if (!snap.exists) {
      return res.status(404).json({ status: 'error', message: 'Department not found' });
    }

    // Delete sub-collections: elections, candidates, voter_rolls
    const subCollections = ['elections', 'candidates', 'voter_rolls'];
    for (const col of subCollections) {
      const colSnap = await tenantRef.collection(col).get();
      const batch = db.batch();
      colSnap.docs.forEach(doc => batch.delete(doc.ref));
      if (!colSnap.empty) await batch.commit();
    }

    // Delete the tenant document itself
    await tenantRef.delete();

    res.status(200).json({ status: 'success', message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete department' });
  }
});

// ─── AUDIT LOG ENDPOINTS ───────────────────────────────────────────────

// Fetch audit logs — global or per-department
// GET /superadmin/audit?tenantId=xxx&limit=200
router.get('/audit', async (req, res) => {
  try {
    const { tenantId, limit: limitStr } = req.query;
    const limit = Math.min(parseInt(limitStr) || 200, 500);

    let logs = [];

    if (tenantId && tenantId !== 'all') {
      // Tenant-scoped logs
      const snap = await db.collection('tenants').doc(tenantId).collection('activity_logs')
        .orderBy('timestamp', 'desc').limit(limit).get();
      snap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
    } else {
      // Global logs across all tenants
      const snap = await db.collection('global_activity_logs')
        .orderBy('timestamp', 'desc').limit(limit).get();
      snap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
    }

    res.status(200).json({ status: 'success', data: logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch audit logs' });
  }
});

// Helper: generate PDF from log entries
function buildAuditPDF(res, title, subtitle, logs) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="audit_${Date.now()}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(18).font('Helvetica-Bold').text('VaaS Audit Report', { align: 'center' });
  doc.fontSize(13).font('Helvetica').text(title, { align: 'center' });
  doc.fontSize(9).fillColor('#666').text(subtitle, { align: 'center' });
  doc.moveDown(0.5);
  doc.strokeColor('#2563eb').lineWidth(1.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.8);

  if (logs.length === 0) {
    doc.fontSize(11).fillColor('#888').text('No audit entries found for this period.', { align: 'center' });
  } else {
    // Column widths
    const colX = { time: 40, action: 165, actor: 285, description: 380 };
    const rowHeight = 18;

    // Table header
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e3a5f');
    doc.text('TIME', colX.time, doc.y, { continued: false });
    const headerY = doc.y - rowHeight;
    doc.text('ACTION', colX.action, headerY);
    doc.text('ACTOR', colX.actor, headerY);
    doc.text('DESCRIPTION', colX.description, headerY);
    doc.moveDown(0.3);
    doc.strokeColor('#ccc').lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);

    // Rows
    doc.font('Helvetica').fontSize(8);
    const actionColors = {
      VOTER_LOGIN: '#1d4ed8', ADMIN_LOGIN: '#7c3aed', CSV_UPLOAD: '#15803d',
      VOTE_CAST: '#0369a1', ELECTION_CREATED: '#92400e', DEFAULT: '#374151'
    };

    logs.forEach((log, i) => {
      if (doc.y > 760) { doc.addPage(); }
      const y = doc.y;
      const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(40, y - 2, 515, rowHeight).fill(bg).fillColor(actionColors[log.action] || actionColors.DEFAULT);

      const timeStr = new Date(log.timestamp || Date.now()).toLocaleString('en-GB', { hour12: false });
      doc.text(timeStr, colX.time, y, { width: 120 });
      doc.text(log.action || '-', colX.action, y, { width: 115 });
      doc.fillColor('#374151');
      doc.text(log.actorEmail || '-', colX.actor, y, { width: 90 });
      doc.text(log.description || '-', colX.description, y, { width: 175 });
      doc.moveDown(0.05);
    });
  }

  doc.moveDown(1);
  doc.fontSize(8).fillColor('#999').text(`Generated: ${new Date().toLocaleString()} | Total records: ${logs.length}`, { align: 'right' });
  doc.end();
}

// Download PDF — global audit
router.get('/audit/pdf', async (req, res) => {
  try {
    const snap = await db.collection('global_activity_logs')
      .orderBy('timestamp', 'desc').limit(500).get();
    const logs = [];
    snap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));

    const tenantsSnap = await db.collection('tenants').get();
    const deptCount = tenantsSnap.size;

    buildAuditPDF(res,
      'Global System Audit Report',
      `All Departments (${deptCount}) | ${new Date().toDateString()}`,
      logs
    );
  } catch (error) {
    console.error('Error generating global audit PDF:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate PDF' });
  }
});

// Download PDF — per department
router.get('/audit/pdf/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    const tenantName = tenantDoc.exists
      ? (tenantDoc.data().name || tenantId)
      : (tenantId === 'default_tenant' ? 'COMPSSA' : tenantId);

    const snap = await db.collection('tenants').doc(tenantId).collection('activity_logs')
      .orderBy('timestamp', 'desc').limit(500).get();
    const logs = [];
    snap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));

    buildAuditPDF(res,
      `${tenantName} — Department Audit Report`,
      `Tenant ID: ${tenantId} | ${new Date().toDateString()}`,
      logs
    );
  } catch (error) {
    console.error('Error generating dept audit PDF:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate PDF' });
  }
});

module.exports = router;
