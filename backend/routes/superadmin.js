const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../services/firebase');
const { verifyAuth, requireSuperAdmin } = require('../middleware/auth');

// Protect all superadmin routes
router.use(verifyAuth, requireSuperAdmin);

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

module.exports = router;
