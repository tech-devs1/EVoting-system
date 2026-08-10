const { db, DEFAULT_TENANT_ID } = require('../services/firebase');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('Seeding mock data for Playwright frontend verification...');
  try {
    const tenantRef = db.collection('tenants').doc(DEFAULT_TENANT_ID);
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

    console.log('✅ Mock data seeded perfectly for Playwright!');
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}

seed();
