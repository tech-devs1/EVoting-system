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
    const electionsSnap = await newTenantRef.collection('elections').get();
    const isFreshDb = !newTenantSnap.exists || electionsSnap.empty;

    if (isFreshDb) {
      console.log(`[Migration] Fresh database / empty elections detected. Seeding tenant and mock collections...`);

      // Auto-seed for development/testing environments when a fresh database is initialized
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Migration] Auto-seeding mock voter rolls and election stats for development fallback store...');
        const tenantRef = db.collection('tenants').doc(newTenantId);
        const hashedAdminPassword = await bcrypt.hash('admin080', 10);

        // 1. Seed tenant
        await tenantRef.set({
          name: 'COMPSSA',
          adminEmail: 'admin@htu.edu.gh',
          adminPassword: hashedAdminPassword,
          createdAt: Date.now()
        });

        // 2. Seed some voters (total 10, with 6 registered and 4 having voted)
        const voterRollsRef = tenantRef.collection('voter_rolls');
        const votedVotersRef = tenantRef.collection('voted_voters');
        const votesRef = tenantRef.collection('votes');

        const hashedVoterPassword = await bcrypt.hash('Voter@123', 10);

        for (let i = 1; i <= 10; i++) {
          const isReg = i <= 6;
          await voterRollsRef.doc(`voter-00${i}`).set({
            isRegistered: isReg,
            password: isReg ? hashedVoterPassword : '',
            name: `Playwright Voter ${i}`,
            email: `voter${i}@htu.edu.gh`,
            phone: `024000000${i}`,
            studentId: `voter-00${i}`,
            role: 'voter',
            createdAt: Date.now()
          });
        }

        // 3. Seed active election
        const electionsRef = tenantRef.collection('elections');
        const electionId = 'playwright_election_2026';
        await electionsRef.doc(electionId).set({
          title: 'HTU COMPSSA Executive Council Elections 2026',
          description: 'Dynamic voting for the 2026/2027 executive body.',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 3600 * 1000).toISOString(),
          status: 'active',
          category: 'Executive',
          type: 'src',
          showResults: true,
          createdAt: Date.now()
        });

        // 4. Seed some candidates
        const candidatesRef = tenantRef.collection('candidates');
        const candidates = [
          { id: 'cand_1', name: 'Alice Gifty', votes: 42, noVotes: 0, position: 'President', ballotNumber: '1' },
          { id: 'cand_2', name: 'Emmanuel Kofi', votes: 28, noVotes: 0, position: 'President', ballotNumber: '2' },
          { id: 'cand_3', name: 'Sampson Kwame', votes: 15, noVotes: 0, position: 'General Secretary', ballotNumber: '1' }
        ];

        for (const cand of candidates) {
          await candidatesRef.doc(cand.id).set({
            electionId,
            name: cand.name,
            position: cand.position,
            manifesto: `${cand.name}'s Manifesto`,
            votes: cand.votes,
            noVotes: cand.noVotes,
            isIndependent: false,
            ballotNumber: cand.ballotNumber,
            photoUrl: '',
            createdAt: Date.now()
          });

          // Also cast some votes to reflect in stats count
          for (let v = 0; v < cand.votes; v++) {
            await votesRef.add({
              electionId,
              candidateId: cand.id,
              position: cand.position,
              voterId: `voter-cast-${v}`,
              timestamp: Date.now()
            });
          }
        }

        // Mark 4 unique voters as voted in voted_voters
        for (let u = 1; u <= 4; u++) {
          await votedVotersRef.doc(`voter-00${u}_${electionId}`).set({
            voterId: `voter-00${u}`,
            electionId,
            timestamp: Date.now(),
            auditTxId: `audit-tx-00${u}`
          });
        }
        console.log('[Migration] Auto-seeding complete! COMPSSA tenant is ready.');
      }
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
