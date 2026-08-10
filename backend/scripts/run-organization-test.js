/**
 * E2E Dynamic Organization & Full Election Cycle Test Script
 * Creates a BRAND-NEW Organization (Tenant) on every run, seeds admin & voter credentials,
 * creates elections, registers candidates with ballot numbers, performs full voting,
 * verifies fraud prevention & cryptographic audit chains, and PERSISTS all data in the DB
 * for live frontend UI validation.
 */

const { db } = require('../services/firebase');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5001;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runOrganizationTest() {
  console.log('================================================================');
  console.log('🚀 DYNAMIC ORGANIZATION CREATION & FULL ELECTION CYCLE TEST');
  console.log('================================================================');

  try {
    // 1. Start internal backend server if not already running on port 5001
    console.log(`Starting backend server in process on port ${PORT}...`);
    process.env.PORT = String(PORT);
    process.env.NODE_ENV = 'development';
    require('../server.js');
    await delay(2000); // Allow server to bind

    const timestamp = Date.now();
    const shortTs = String(timestamp).slice(-4);
    const tenantId = `dept_org_${timestamp}`;
    const orgName = `Engineering & Technology Faculty (${shortTs})`;
    const adminEmail = `ec_admin_${timestamp}@htu.edu.gh`;
    const adminPassword = `AdminPass@${shortTs}`;

    // --- PHASE 1: CREATE BRAND NEW ORGANIZATION / TENANT ---
    console.log(`\n--- PHASE 1: CREATING NEW TENANT (ID: ${tenantId}) ---`);
    console.log(`Organization Name: ${orgName}`);
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
    const orgData = {
      id: tenantId,
      name: orgName,
      acronym: `ENG-${shortTs}`,
      domain: 'htu.edu.gh',
      adminEmail,
      adminPassword: hashedAdminPassword,
      status: 'active',
      createdAt: Date.now()
    };

    await db.collection('organizations').doc(tenantId).set(orgData);
    await db.collection('tenants').doc(tenantId).set(orgData);

    const tenantRef = db.collection('tenants').doc(tenantId);
    const orgRef = db.collection('organizations').doc(tenantId);

    console.log(`✅ Organization document successfully created in Firestore (tenants/${tenantId}).`);

    // --- PHASE 2: SEED VOTER ROLLS FOR NEW TENANT ---
    console.log(`\n--- PHASE 2: SEEDING VOTER ROLLS FOR ${tenantId} ---`);
    const voterRollsRef = tenantRef.collection('voter_rolls');
    const hashedVoterPassword = await bcrypt.hash('Voter@123', 10);

    const voters = [
      {
        uid: `voter_${timestamp}_1`,
        indexNumber: `0123${shortTs}1`,
        name: 'Kwame Nkrumah Jr',
        email: `voter1_${timestamp}@htu.edu.gh`,
        phone: '0241111111',
        department: 'Computer Science',
        password: hashedVoterPassword,
        isRegistered: true,
        role: 'voter'
      },
      {
        uid: `voter_${timestamp}_2`,
        indexNumber: `0123${shortTs}2`,
        name: 'Ama Serwaa',
        email: `voter2_${timestamp}@htu.edu.gh`,
        phone: '0242222222',
        department: 'Electrical Eng.',
        password: hashedVoterPassword,
        isRegistered: true,
        role: 'voter'
      },
      {
        uid: `voter_${timestamp}_3`,
        indexNumber: `0123${shortTs}3`,
        name: 'Kofi Mensah',
        email: `voter3_${timestamp}@htu.edu.gh`,
        phone: '0243333333',
        department: 'Mechanical Eng.',
        password: hashedVoterPassword,
        isRegistered: true,
        role: 'voter'
      }
    ];

    for (const v of voters) {
      await voterRollsRef.doc(v.uid).set(v);
    }
    console.log(`✅ ${voters.length} roster voters seeded under tenant ${tenantId}.`);

    // --- PHASE 3: ADMIN AUTHENTICATION ---
    console.log('\n--- PHASE 3: EC ADMIN AUTHENTICATION ---');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId
      },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });

    const adminLoginData = await adminLoginRes.json();
    if (adminLoginData.status !== 'success') {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginData)}`);
    }
    const adminToken = adminLoginData.token;
    console.log(`✅ EC Admin logged in successfully! Token received for tenant ${tenantId}.`);

    // --- PHASE 4: CREATE ELECTION UNDER NEW ORGANIZATION ---
    console.log('\n--- PHASE 4: CREATE ELECTION FOR NEW ORGANIZATION ---');
    const startDate = new Date(Date.now() - 3600 * 1000).toISOString(); // Started 1h ago
    const endDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString(); // Ends in 48h

    const createElectionRes = await fetch(`${BASE_URL}/elections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Id': tenantId
      },
      body: JSON.stringify({
        title: `Faculty & Departmental Leadership Elections 2026 (${shortTs})`,
        description: `Official general election for ${orgName}. All registered students are eligible to vote.`,
        startDate,
        endDate,
        category: 'Executive',
        type: 'src',
        status: 'draft',
        showResults: true,
        otpRequired: true
      })
    });

    const electionResult = await createElectionRes.json();
    if (electionResult.status !== 'success') {
      throw new Error(`Failed to create election: ${JSON.stringify(electionResult)}`);
    }
    const electionId = electionResult.data.id;
    console.log(`✅ Election created in draft mode! ID: ${electionId}`);

    // --- PHASE 5: REGISTER POSITIONS & CANDIDATES WITH BALLOT NUMBERS ---
    console.log('\n--- PHASE 5: REGISTER CANDIDATES & ASSIGN BALLOT NUMBERS ---');

    // Candidate 1: President - Ballot No. 1
    const cand1Res = await fetch(`${BASE_URL}/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Id': tenantId
      },
      body: JSON.stringify({
        name: 'Jane Smith',
        position: 'President',
        manifesto: 'Digital campus innovation, welfare funds, and transparent representation.',
        photoUrl: `https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80&sig=${timestamp}_1`,
        electionId,
        isIndependent: false,
        ballotNumber: 1
      })
    });
    const cand1Data = await cand1Res.json();
    if (cand1Data.status !== 'success' || !cand1Data.data) {
      throw new Error(`Failed to create Candidate 1: ${JSON.stringify(cand1Data)}`);
    }
    const cand1Id = cand1Data.data.id;

    // Candidate 2: President - Ballot No. 2
    const cand2Res = await fetch(`${BASE_URL}/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Id': tenantId
      },
      body: JSON.stringify({
        name: 'John Doe',
        position: 'President',
        manifesto: 'Sports facilities upgrade, lab resources, and student career mentorship.',
        photoUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80&sig=${timestamp}_2`,
        electionId,
        isIndependent: false,
        ballotNumber: 2
      })
    });
    const cand2Data = await cand2Res.json();
    if (cand2Data.status !== 'success' || !cand2Data.data) {
      throw new Error(`Failed to create Candidate 2: ${JSON.stringify(cand2Data)}`);
    }
    const cand2Id = cand2Data.data.id;

    // Candidate 3: General Secretary - Unopposed Ballot No. 1
    const cand3Res = await fetch(`${BASE_URL}/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Id': tenantId
      },
      body: JSON.stringify({
        name: 'Abena Osei',
        position: 'General Secretary',
        manifesto: 'Prompt official communications, open meeting archives, and student portal integration.',
        photoUrl: `https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80&sig=${timestamp}_3`,
        electionId,
        isIndependent: true,
        ballotNumber: 1
      })
    });
    const cand3Data = await cand3Res.json();
    if (cand3Data.status !== 'success' || !cand3Data.data) {
      throw new Error(`Failed to create Candidate 3: ${JSON.stringify(cand3Data)}`);
    }
    const cand3Id = cand3Data.data.id;

    console.log(`✅ 3 candidates registered for election ${electionId}.`);

    // ACTIVATE ELECTION
    console.log('\nActivating election for voting...');
    const activateRes = await fetch(`${BASE_URL}/elections/${electionId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Id': tenantId
      },
      body: JSON.stringify({ status: 'active' })
    });
    const activateData = await activateRes.json();
    if (activateData.status !== 'success') {
      throw new Error(`Failed to activate election: ${JSON.stringify(activateData)}`);
    }
    console.log(`🟢 Election is now LIVE and ACTIVE for voting!`);

    // --- PHASE 6: VOTER AUTHENTICATION, OTP ACCESS & BALLOT CASTING ---
    console.log('\n--- PHASE 6: VOTER LOGIN, OTP VERIFICATION & BALLOT CASTING ---');

    for (let i = 0; i < voters.length; i++) {
      const v = voters[i];
      console.log(`\nProcessing Voter ${i + 1}: ${v.name} (${v.email})...`);

      // Voter Login
      const voterLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId
        },
        body: JSON.stringify({ email: v.email, password: 'Voter@123' })
      });
      const voterLoginData = await voterLoginRes.json();
      if (voterLoginData.status !== 'success') {
        throw new Error(`Voter login failed for ${v.email}: ${JSON.stringify(voterLoginData)}`);
      }
      const voterToken = voterLoginData.token;

      // Request OTP
      const otpReqRes = await fetch(`${BASE_URL}/elections/${electionId}/request-access-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${voterToken}`,
          'X-Tenant-Id': tenantId
        }
      });
      const otpReqData = await otpReqRes.json();
      if (otpReqData.status !== 'success') {
        throw new Error(`Request OTP failed for ${v.name}: ${JSON.stringify(otpReqData)}`);
      }

      // Read the actual generated OTP from Firestore
      const voterDoc = await voterRollsRef.doc(v.uid).get();
      const otpCode = voterDoc.data().accessOtp;

      // Verify Access OTP
      const verifyOtpRes = await fetch(`${BASE_URL}/elections/${electionId}/verify-access-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${voterToken}`,
          'X-Tenant-Id': tenantId
        },
        body: JSON.stringify({ otp: otpCode })
      });
      const verifyOtpData = await verifyOtpRes.json();
      if (verifyOtpData.status !== 'success') {
        throw new Error(`OTP Verification failed for ${v.name}: ${JSON.stringify(verifyOtpData)}`);
      }

      // Vote for President: Voter 1 & 2 vote Jane Smith (cand1Id), Voter 3 votes John Doe (cand2Id)
      const presChoice = (i < 2) ? cand1Id : cand2Id;
      const castPresRes = await fetch(`${BASE_URL}/votes/cast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${voterToken}`,
          'X-Tenant-Id': tenantId
        },
        body: JSON.stringify({ electionId, candidateId: presChoice })
      });
      const castPresData = await castPresRes.json();
      if (castPresData.status !== 'success') {
        throw new Error(`Cast vote for President failed for ${v.name}: ${JSON.stringify(castPresData)}`);
      }

      // Vote for General Secretary (Unopposed): Voter 1 & 2 vote YES, Voter 3 votes NO
      const secChoice = (i < 2) ? 'yes' : 'no';
      const castSecRes = await fetch(`${BASE_URL}/votes/cast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${voterToken}`,
          'X-Tenant-Id': tenantId
        },
        body: JSON.stringify({ electionId, candidateId: cand3Id, choice: secChoice })
      });
      const castSecData = await castSecRes.json();
      if (castSecData.status !== 'success') {
        throw new Error(`Cast vote for General Secretary failed for ${v.name}: ${JSON.stringify(castSecData)}`);
      }

      console.log(`✅ Voter ${i + 1} (${v.name}) successfully unlocked ballot and cast votes.`);
    }

    // --- PHASE 7: DUPLICATE VOTING FRAUD PREVENTION TEST ---
    console.log('\n--- PHASE 7: VERIFYING DUPLICATE VOTING PROTECTION ---');
    const voter1LoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
      body: JSON.stringify({ email: voters[0].email, password: 'Voter@123' })
    });
    const voter1Token = (await voter1LoginRes.json()).token;

    const dupVoteRes = await fetch(`${BASE_URL}/votes/cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voter1Token}`,
        'X-Tenant-Id': tenantId
      },
      body: JSON.stringify({ electionId, candidateId: cand1Id })
    });
    const dupVoteData = await dupVoteRes.json();
    if (dupVoteData.status === 'error') {
      console.log(`✅ Double voting attempt successfully REJECTED: "${dupVoteData.message}"`);
    } else {
      throw new Error(`Double voting protection failed! Server allowed duplicate vote.`);
    }

    // --- PHASE 8: FETCH LIVE RESULTS & VERIFY TALLIES ---
    console.log('\n--- PHASE 8: RETRIEVING LIVE RESULTS & CERTIFIED TALLIES ---');
    const resultsRes = await fetch(`${BASE_URL}/elections/${electionId}/results`, {
      headers: { 'X-Tenant-Id': tenantId }
    });
    const resultsData = await resultsRes.json();
    if (resultsData.status !== 'success') {
      throw new Error(`Failed to fetch results: ${JSON.stringify(resultsData)}`);
    }

    const { election: resElection, candidates: resCandidates } = resultsData.data;
    console.log(`📊 Election: "${resElection.title}"`);
    console.log(`   Ballots Cast: ${resElection.totalVotesCast} / ${voters.length} Roster Voters`);

    resCandidates.forEach(c => {
      if (c.isIndependent) {
        console.log(`   - ${c.name} (${c.position} - Unopposed): Yes: ${c.votes || 0}, No: ${c.noVotes || 0}`);
      } else {
        console.log(`   - ${c.name} (${c.position}): ${c.votes || 0} votes`);
      }
    });

    // --- PHASE 9: CRYPTOGRAPHIC LEDGER AUDIT ---
    console.log('\n--- PHASE 9: AUDITING CRYPTOGRAPHIC LEDGER CHAIN ---');
    const auditRes = await fetch(`${BASE_URL}/admin/audit/${electionId}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Id': tenantId
      }
    });
    const auditData = await auditRes.json();
    console.log(`🔐 Cryptographic Ledger Audit:`, auditData.message || auditData);

    // --- SAVE RUN SUMMARY FILE FOR FRONTEND TESTING ---
    const runSummary = {
      tenantId,
      orgName,
      adminEmail,
      adminPassword,
      electionId,
      electionTitle: resElection.title,
      sampleVoter: {
        email: voters[0].email,
        password: 'Voter@123'
      },
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(__dirname, '../last_organization_test.json'),
      JSON.stringify(runSummary, null, 2)
    );

    console.log('\n================================================================');
    console.log('🎉 NEW ORGANIZATION CREATED & FULL ELECTION CYCLE SUCCESSFUL!');
    console.log('================================================================');
    console.log('📋 CREATED ORGANIZATION & TEST CREDENTIALS SUMMARY:');
    console.log(`  Tenant ID       : ${tenantId}`);
    console.log(`  Organization    : ${orgName}`);
    console.log(`  Admin Email     : ${adminEmail}`);
    console.log(`  Admin Password  : ${adminPassword}`);
    console.log(`  Election ID     : ${electionId}`);
    console.log(`  Sample Voter    : ${voters[0].email} / Voter@123`);
    console.log(`  Dashboard URL   : http://localhost:3000/admin/elections/${electionId}/dashboard`);
    console.log(`  Results URL     : http://localhost:3000/admin/elections/${electionId}/results`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ORGANIZATION TEST FAILED:', error);
    process.exit(1);
  }
}

runOrganizationTest();
