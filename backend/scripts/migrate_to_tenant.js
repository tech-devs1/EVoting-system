require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
});

const db = getFirestore();
const DEFAULT_TENANT_ID = 'default_tenant';

const collectionsToMigrate = [
  { old: 'users', new: 'voter_rolls' },
  { old: 'elections', new: 'elections' },
  { old: 'candidates', new: 'candidates' },
  { old: 'votes', new: 'votes' },
  { old: 'voted_voters', new: 'voted_voters' },
  { old: 'fraud_alerts', new: 'fraud_alerts' },
  { old: 'uploads', new: 'uploads' },
];

async function migrateCollection(oldColName, newColName) {
  console.log(`Migrating '${oldColName}' to 'tenants/${DEFAULT_TENANT_ID}/${newColName}'...`);
  
  const oldRef = db.collection(oldColName);
  const newRef = db.collection('tenants').doc(DEFAULT_TENANT_ID).collection(newColName);
  
  const snapshot = await oldRef.get();
  
  if (snapshot.empty) {
    console.log(`No documents found in '${oldColName}'. Skipping.`);
    return;
  }
  
  let batch = db.batch();
  let count = 0;
  
  for (const doc of snapshot.docs) {
    batch.set(newRef.doc(doc.id), doc.data());
    // Note: We are doing a non-destructive migration. 
    // We do NOT delete the old documents yet to ensure zero data loss during testing.
    
    count++;
    
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`Committed ${count} documents...`);
      batch = db.batch(); // Start a new batch
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`Finished migrating ${count} documents for '${oldColName}'.`);
}

async function runMigration() {
  console.log('--- Starting Multi-Tenant Data Migration ---');
  
  // 1. Create the tenant document
  await db.collection('tenants').doc(DEFAULT_TENANT_ID).set({
    name: 'Default University',
    domain: 'default.edu',
    createdAt: new Date(),
    status: 'active'
  });
  console.log('Created Default Tenant document.');

  // 2. Migrate collections
  for (const col of collectionsToMigrate) {
    await migrateCollection(col.old, col.new);
  }
  
  console.log('--- Migration Completed Successfully ---');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
