const { db } = require('./firebase');
const bcrypt = require('bcryptjs');

/**
 * Automatically migrates all data from default_tenant to compssa
 * to treat COMPSSA as an added department with a custom tenant ID
 * while ensuring zero data loss for existing elections, voters, and votes.
 */
async function migrateDefaultTenant() {
  try {
    const oldTenantId = 'default_tenant';
    const newTenantId = 'compssa';

    const newTenantRef = db.collection('tenants').doc(newTenantId);
    const newTenantSnap = await newTenantRef.get();

    // If the new tenant already exists, we skip the migration
    if (newTenantSnap.exists) {
      console.log(`[Migration] Tenant '${newTenantId}' already exists. Skipping migration.`);
      return;
    }

    const oldTenantRef = db.collection('tenants').doc(oldTenantId);
    const oldTenantSnap = await oldTenantRef.get();

    if (!oldTenantSnap.exists) {
      console.log(`[Migration] Source '${oldTenantId}' does not exist. Initializing fresh '${newTenantId}' tenant.`);
      // Initialize fresh compssa tenant doc
      const hashedAdminPassword = await bcrypt.hash('admin080', 10);
      await newTenantRef.set({
        name: 'COMPSSA',
        domain: '',
        adminEmail: 'admin@htu.edu.gh',
        adminPassword: hashedAdminPassword,
        status: 'active',
        createdAt: Date.now()
      });
      return;
    }

    console.log(`[Migration] Starting COMPSSA migration from '${oldTenantId}' to '${newTenantId}'...`);

    // 1. Copy the tenant doc
    const oldData = oldTenantSnap.data();
    await newTenantRef.set({
      ...oldData,
      name: 'COMPSSA', // Rename "Default University" to "COMPSSA"
      createdAt: oldData.createdAt || Date.now()
    });
    console.log(`[Migration] Created tenant doc '${newTenantId}'.`);

    // 2. Collections to migrate
    const subCollections = [
      'elections',
      'candidates',
      'voter_rolls',
      'voted_voters',
      'votes',
      'audit_logs',
      'uploads',
      'activity_logs',
      'fraud_alerts'
    ];

    for (const colName of subCollections) {
      const oldColRef = oldTenantRef.collection(colName);
      const snap = await oldColRef.get();

      if (snap.empty) {
        console.log(`[Migration] Sub-collection '${colName}' is empty. Skipping.`);
        continue;
      }

      console.log(`[Migration] Copying ${snap.size} documents from sub-collection '${colName}'...`);
      const newColRef = newTenantRef.collection(colName);

      let batch = db.batch();
      let count = 0;

      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.tenantId === 'default_tenant') {
          data.tenantId = 'compssa';
        }
        if (data.tenantName === 'Default University' || data.tenantName === 'default_tenant') {
          data.tenantName = 'COMPSSA';
        }
        batch.set(newColRef.doc(doc.id), data);
        count++;

        if (count % 500 === 0) {
          await batch.commit();
          batch = db.batch();
        }
      }

      if (count % 500 !== 0) {
        await batch.commit();
      }

      console.log(`[Migration] Successfully copied ${count} documents for '${colName}'.`);
    }

    // 3. Fix global_activity_logs that are tied to default_tenant
    console.log(`[Migration] Scanning global_activity_logs for old default_tenant references...`);
    const globalLogsSnap = await db.collection('global_activity_logs').where('tenantId', '==', 'default_tenant').get();
    
    if (!globalLogsSnap.empty) {
      let batch = db.batch();
      let count = 0;
      
      for (const doc of globalLogsSnap.docs) {
        batch.update(doc.ref, {
          tenantId: 'compssa',
          tenantName: 'COMPSSA'
        });
        count++;
        
        if (count % 500 === 0) {
          await batch.commit();
          batch = db.batch();
        }
      }
      
      if (count % 500 !== 0) {
        await batch.commit();
      }
      console.log(`[Migration] Updated ${count} global activity logs to compssa.`);
    }

    console.log(`[Migration] Migration from '${oldTenantId}' to '${newTenantId}' completed successfully.`);
  } catch (err) {
    console.error('[Migration] Critical failure during COMPSSA migration:', err);
  }
}

module.exports = { migrateDefaultTenant };
