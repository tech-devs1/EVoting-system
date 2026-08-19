/**
 * Migration Script: Move voter_rolls from tenants/{id}/voter_rolls → users/{id}/voter_rolls
 * Fast batch version — no per-doc existence check.
 * 
 * Run this once with: node migrate-voter-rolls.js
 */

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');
dotenv.config();

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, '');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function migrate() {
  console.log('🚀 Starting voter_rolls migration: tenants → users collection...\n');

  const tenantsSnap = await db.collection('tenants').get();
  if (tenantsSnap.empty) {
    console.log('No tenants found. Nothing to migrate.');
    return;
  }

  let totalMigrated = 0;

  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    console.log(`\n📂 Processing tenant: ${tenantId}`);

    const sourceSnap = await db.collection('tenants').doc(tenantId).collection('voter_rolls').get();

    if (sourceSnap.empty) {
      console.log(`  ⚠️  No voter_rolls found — skipping.`);
      continue;
    }

    console.log(`  📋 Found ${sourceSnap.size} records. Writing to users/${tenantId}/voter_rolls ...`);

    const destRef = db.collection('users').doc(tenantId).collection('voter_rolls');

    // Firestore batch write — 500 docs max per batch
    const BATCH_SIZE = 499;
    let batch = db.batch();
    let opCount = 0;
    let batchNum = 1;

    for (const doc of sourceSnap.docs) {
      batch.set(destRef.doc(doc.id), doc.data(), { merge: true });
      opCount++;
      totalMigrated++;

      if (opCount === BATCH_SIZE) {
        await batch.commit();
        console.log(`    ✅ Batch ${batchNum} committed (${opCount} records)`);
        batch = db.batch();
        opCount = 0;
        batchNum++;
      }
    }

    if (opCount > 0) {
      await batch.commit();
      console.log(`    ✅ Batch ${batchNum} committed (${opCount} records)`);
    }

    console.log(`  ✅ Done for ${tenantId}: migrated ${sourceSnap.size} records.`);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(`✅ Migration complete! Total records migrated: ${totalMigrated}`);
  console.log('   Old data in tenants/{id}/voter_rolls is kept as backup.');
  console.log('   You can delete it from Firebase Console once verified.');
  console.log('═══════════════════════════════════════════════\n');
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
