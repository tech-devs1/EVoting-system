const { db, DEFAULT_TENANT_ID } = require('../services/firebase');
const cache = require('../services/cache');

async function seedLiveDemoData() {
  console.log('🌱 Seeding Live Realistic Demo Election & Candidate Tallies into Firestore Database...');

  const tenantRef = db.collection('tenants').doc(DEFAULT_TENANT_ID);
  const electionsRef = tenantRef.collection('elections');
  const candidatesRef = tenantRef.collection('candidates');

  const electionId = 'live-src-2026';
  const now = new Date();
  const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const endDate = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  // 1. Create Main SRC Live Election
  const electionData = {
    title: 'SRC Executive & Departmental Elections 2026',
    description: 'Official General Student Representative Council & Faculty Association Leadership Ballot for Ho Technical University.',
    category: 'Executive',
    status: 'active',
    startDate,
    endDate,
    createdBy: 'admin',
    showResults: true,
    otpRequired: true,
    totalVoters: 650,
    totalVotesCast: 560,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await electionsRef.doc(electionId).set(electionData, { merge: true });
  console.log('✅ Election record created/updated:', electionId);

  // 2. Create Candidate Profiles with Ballot Numbers & Votes
  const candidatesList = [
    {
      id: 'cand-pres-1',
      name: 'Jane Smith',
      position: 'President',
      ballotNumber: 1,
      votes: 342,
      manifesto: 'Transforming HTU campus connectivity, student advocacy, and academic support tools.',
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
      electionId
    },
    {
      id: 'cand-pres-2',
      name: 'John Doe',
      position: 'President',
      ballotNumber: 2,
      votes: 218,
      manifesto: 'Empowering student tech initiatives, sports facility upgrades, and welfare funds.',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      electionId
    },
    {
      id: 'cand-vp-1',
      name: 'Emmanuel Mensah',
      position: 'Vice President',
      ballotNumber: 1,
      votes: 410,
      manifesto: 'Strengthening departmental representation and internship networking partnerships.',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      electionId
    },
    {
      id: 'cand-vp-2',
      name: 'Kwame Addo',
      position: 'Vice President',
      ballotNumber: 2,
      votes: 150,
      manifesto: 'Fostering campus unity, entrepreneurship incubators, and student health programs.',
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
      electionId
    },
    {
      id: 'cand-gen-1',
      name: 'Abena Osei',
      position: 'General Secretary',
      ballotNumber: 1,
      isIndependent: true,
      votes: 512,
      noVotes: 48,
      manifesto: 'Digital transparency in SRC proceedings, rapid communications, and prompt updates.',
      photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
      electionId
    },
    {
      id: 'cand-fin-1',
      name: 'Kofi Darko',
      position: 'Financial Secretary',
      ballotNumber: 1,
      votes: 298,
      manifesto: 'Prudent financial accountability, open budget reporting, and student audit committees.',
      photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
      electionId
    },
    {
      id: 'cand-fin-2',
      name: 'Samuel Owusu',
      position: 'Financial Secretary',
      ballotNumber: 2,
      votes: 262,
      manifesto: 'Optimizing resource allocation for hall events, academic clubs, and welfare grants.',
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
      electionId
    }
  ];

  for (const cand of candidatesList) {
    await candidatesRef.doc(cand.id).set(cand, { merge: true });
  }
  console.log(`✅ ${candidatesList.length} candidates seeded with live tallies.`);

  // 3. Seed Voter Roster Sample
  const rosterRef = tenantRef.collection('elections').doc(electionId).collection('eligible_voters');
  const sampleVoters = [
    { indexNumber: '0123456789', fullName: 'Alice Johnson', email: 'alice@htu.edu.gh', phone: '0241234567', department: 'Computer Science' },
    { indexNumber: '0987654321', fullName: 'Bernard Kojo', email: 'bernard@htu.edu.gh', phone: '0247654321', department: 'Electrical Eng.' },
    { indexNumber: '0244556677', fullName: 'Clarice Addy', email: 'clarice@htu.edu.gh', phone: '0244556677', department: 'Business Admin' }
  ];

  for (const v of sampleVoters) {
    await rosterRef.doc(v.indexNumber).set(v, { merge: true });
  }

  // 4. Invalidate Cache
  cache.invalidatePrefix('elections:');
  cache.invalidatePrefix('admin:');
  cache.invalidatePrefix('candidates:');

  console.log('🎉 Live Demo Election & Candidate Tallies successfully seeded into database!');
}

seedLiveDemoData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
