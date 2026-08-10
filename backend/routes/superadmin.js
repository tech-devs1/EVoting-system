const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const { db } = require('../services/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const { verifyAuth, requireSuperAdmin } = require('../middleware/auth');

// Protect all superadmin routes
router.use(verifyAuth, requireSuperAdmin);

// Create a new department (tenant)
router.post('/departments', async (req, res) => {
  try {
    const { name, domain, adminEmail, adminPassword } = req.body;
    
    if (!name || !adminEmail) {
      return res.status(400).json({ status: 'error', message: 'Organization name and EC admin email are required' });
    }

    const normalizedAdminEmail = adminEmail.toLowerCase().trim();

    // Check if a department with this email already exists
    let existingAdmins = await db.collection('tenants').where('adminEmail', '==', normalizedAdminEmail).get();
    if (existingAdmins.empty) {
      existingAdmins = await db.collection('organizations').where('adminEmail', '==', normalizedAdminEmail).get();
    }
    if (!existingAdmins.empty) {
      return res.status(400).json({ status: 'error', message: 'An organization with this EC admin email already exists' });
    }

    const hashedAdminPassword = adminPassword ? await bcrypt.hash(adminPassword, 10) : null;
    const tenantId = `dept_${Date.now()}`;
    const unifiedOrganization = {
      id: tenantId,
      name: name.trim(),
      acronym: name.trim().substring(0, 6).toUpperCase(),
      domain: domain || '',
      adminEmail: normalizedAdminEmail,
      adminPassword: hashedAdminPassword,
      status: 'active',
      createdAt: Date.now()
    };

    await db.collection('organizations').doc(tenantId).set(unifiedOrganization);
    await db.collection('tenants').doc(tenantId).set(unifiedOrganization);

    res.status(201).json({ 
      status: 'success', 
      message: 'Department created successfully',
      data: {
        id: tenantId,
        name: unifiedOrganization.name,
        domain: unifiedOrganization.domain,
        adminEmail: unifiedOrganization.adminEmail
      }
    });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create department' });
  }
});

// Helper to retrieve tenant/organization doc ref
async function getDepartmentDocRef(tenantId) {
  const tRef = db.collection('tenants').doc(tenantId);
  const tSnap = await tRef.get();
  if (tSnap.exists) return { ref: tRef, snap: tSnap };

  const oRef = db.collection('organizations').doc(tenantId);
  const oSnap = await oRef.get();
  if (oSnap.exists) return { ref: oRef, snap: oSnap };

  return null;
}

// List all departments (tenants & organizations combined)
router.get('/departments', async (req, res) => {
  try {
    const tenantsSnap = await db.collection('tenants').get();
    const orgsSnap = await db.collection('organizations').get();
    
    const docsMap = new Map();
    tenantsSnap.docs.forEach(doc => { if (doc.id !== 'default_tenant') docsMap.set(doc.id, doc); });
    orgsSnap.docs.forEach(doc => { if (doc.id !== 'default_tenant') docsMap.set(doc.id, doc); });

    const validDocs = Array.from(docsMap.values());
    const departments = await Promise.all(validDocs.map(async (doc) => {
      const data = doc.data();
      
      let electionsCount = 0;
      let votersCount = 0;
      
      try {
        let electionsSnap = await db.collection('tenants').doc(doc.id).collection('elections').count().get();
        electionsCount = electionsSnap.data().count;
        if (electionsCount === 0) {
          electionsSnap = await db.collection('organizations').doc(doc.id).collection('elections').count().get();
          electionsCount = electionsSnap.data().count;
        }

        let votersSnap = await db.collection('tenants').doc(doc.id).collection('voter_rolls').count().get();
        votersCount = votersSnap.data().count;
        if (votersCount === 0) {
          votersSnap = await db.collection('organizations').doc(doc.id).collection('voter_rolls').count().get();
          votersCount = votersSnap.data().count;
        }
      } catch (err) {
        console.warn(`Could not fetch counts for department ${doc.id}:`, err.message);
      }
      
      return {
        id: doc.id,
        name: data.name || doc.id,
        domain: data.domain || '',
        adminEmail: data.adminEmail || 'N/A',
        status: data.status || 'active',
        createdAt: data.createdAt || null,
        electionsCount,
        votersCount,
        adminsCount: 1 + (data.admins ? data.admins.length : 0)
      };
    }));
    
    departments.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

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
    const orgsSnap = await db.collection('organizations').get();
    
    const docsMap = new Map();
    tenantsSnap.docs.forEach(doc => { if (doc.id !== 'default_tenant') docsMap.set(doc.id, doc); });
    orgsSnap.docs.forEach(doc => { if (doc.id !== 'default_tenant') docsMap.set(doc.id, doc); });

    const validDocs = Array.from(docsMap.values());
    const departments = validDocs.length;
    
    let totalElections = 0;
    let totalVoters = 0;
    
    for (const doc of validDocs) {
      try {
        let elSnap = await db.collection('tenants').doc(doc.id).collection('elections').count().get();
        let elCount = elSnap.data().count;
        if (elCount === 0) {
          elSnap = await db.collection('organizations').doc(doc.id).collection('elections').count().get();
          elCount = elSnap.data().count;
        }
        totalElections += elCount;

        let voterSnap = await db.collection('tenants').doc(doc.id).collection('voter_rolls').count().get();
        let vCount = voterSnap.data().count;
        if (vCount === 0) {
          voterSnap = await db.collection('organizations').doc(doc.id).collection('voter_rolls').count().get();
          vCount = voterSnap.data().count;
        }
        totalVoters += vCount;
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

    const deptDoc = await getDepartmentDocRef(tenantId);
    if (!deptDoc) {
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

    await db.collection('tenants').doc(tenantId).update(updates).catch(() => {});
    await db.collection('organizations').doc(tenantId).update(updates).catch(() => {});

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

    const deptDoc = await getDepartmentDocRef(tenantId);
    if (!deptDoc) {
      return res.status(404).json({ status: 'error', message: 'Department not found' });
    }

    // Delete sub-collections from both tenants and organizations
    const subCollections = ['elections', 'candidates', 'voter_rolls'];
    for (const rootCol of ['tenants', 'organizations']) {
      const parentRef = db.collection(rootCol).doc(tenantId);
      for (const col of subCollections) {
        const colSnap = await parentRef.collection(col).get();
        if (!colSnap.empty) {
          const batch = db.batch();
          colSnap.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      }
      await parentRef.delete().catch(() => {});
    }

    res.status(200).json({ status: 'success', message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete department' });
  }
});

// ─── DEPARTMENT ADMIN MANAGEMENT ──────────────────────────────────────

// List all admins for a department
router.get('/departments/:tenantId/admins', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const deptDoc = await getDepartmentDocRef(tenantId);
    if (!deptDoc) {
      return res.status(404).json({ status: 'error', message: 'Department not found' });
    }
    const data = deptDoc.snap.data();
    const admins = [
      { id: 'primary', name: (data.name || 'Department') + ' Admin', email: data.adminEmail || 'N/A', isPrimary: true, createdAt: data.createdAt || null }
    ];
    if (data.admins && Array.isArray(data.admins)) {
      data.admins.forEach(a => {
        admins.push({ id: a.id, name: a.name, email: a.email, isPrimary: false, createdAt: a.createdAt || null });
      });
    }
    res.status(200).json({ status: 'success', data: admins });
  } catch (error) {
    console.error('Error listing department admins:', error);
    res.status(500).json({ status: 'error', message: 'Failed to list admins' });
  }
});

// Add a new admin to a department
router.post('/departments/:tenantId/admins', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ status: 'error', message: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
    }

    const deptDoc = await getDepartmentDocRef(tenantId);
    if (!deptDoc) {
      return res.status(404).json({ status: 'error', message: 'Department not found' });
    }
    const tenantData = deptDoc.snap.data();

    const adminId = `adm_${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const newAdmin = {
      id: adminId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      createdAt: Date.now()
    };

    await db.collection('tenants').doc(tenantId).update({ admins: FieldValue.arrayUnion(newAdmin) }).catch(() => {});
    await db.collection('organizations').doc(tenantId).update({ admins: FieldValue.arrayUnion(newAdmin) }).catch(() => {});

    res.status(201).json({
      status: 'success',
      message: 'Admin added successfully',
      data: { id: adminId, name: newAdmin.name, email: newAdmin.email, isPrimary: false, createdAt: newAdmin.createdAt }
    });
  } catch (error) {
    console.error('Error adding department admin:', error);
    res.status(500).json({ status: 'error', message: 'Failed to add admin' });
  }
});

// Update a department admin's name or password
router.patch('/departments/:tenantId/admins/:adminId', async (req, res) => {
  try {
    const { tenantId, adminId } = req.params;
    const { name, password } = req.body;

    const tenantRef = db.collection('tenants').doc(tenantId);
    const snap = await tenantRef.get();
    if (!snap.exists) {
      return res.status(404).json({ status: 'error', message: 'Department not found' });
    }
    const tenantData = snap.data();
    const admins = tenantData.admins || [];
    const idx = admins.findIndex(a => a.id === adminId);
    if (idx === -1) {
      return res.status(404).json({ status: 'error', message: 'Admin not found' });
    }

    if (name && name.trim()) admins[idx].name = name.trim();
    if (password && password.trim()) {
      if (password.length < 6) {
        return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
      }
      admins[idx].passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    await tenantRef.update({ admins });
    res.status(200).json({ status: 'success', message: 'Admin updated successfully' });
  } catch (error) {
    console.error('Error updating department admin:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update admin' });
  }
});

// Remove a department admin
router.delete('/departments/:tenantId/admins/:adminId', async (req, res) => {
  try {
    const { tenantId, adminId } = req.params;

    const tenantRef = db.collection('tenants').doc(tenantId);
    const snap = await tenantRef.get();
    if (!snap.exists) {
      return res.status(404).json({ status: 'error', message: 'Department not found' });
    }
    const tenantData = snap.data();
    const admins = (tenantData.admins || []).filter(a => a.id !== adminId);

    await tenantRef.update({ admins });
    res.status(200).json({ status: 'success', message: 'Admin removed successfully' });
  } catch (error) {
    console.error('Error removing department admin:', error);
    res.status(500).json({ status: 'error', message: 'Failed to remove admin' });
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
      VOTE_CAST: '#0369a1', ELECTION_CREATED: '#92400e',
      PASSWORD_CHANGE: '#dc2626', PASSWORD_CHANGED: '#e11d48',
      PASSWORD_RESET: '#ea580c', PASSWORD_RESET_REQUESTED: '#ca8a04',
      DEFAULT: '#374151'
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
    const tenantName = tenantDoc.exists ? (tenantDoc.data().name || tenantId) : tenantId;

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
