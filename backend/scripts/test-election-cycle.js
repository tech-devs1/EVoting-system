/**
 * E2E Full Election Cycle Integration Test
 * Automates the creation of an election, candidates with fixed ballot positions (No. 1, No. 2, etc.),
 * voters login, OTP access-unlocking, casting votes (including Yes/No for unopposed candidates),
 * double-voting prevention, results tally checking, and cryptographic integrity chain audits.
 */

const { db, DEFAULT_TENANT_ID } = require('../services/firebase');
const bcrypt = require('bcryptjs');
const { verifyElectionIntegrity } = require('../services/audit');

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}/api`;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('================================================================');
  console.log('🚀 STARTING FULL ELECTION CYCLE INTEGRATION TEST (PORT 5001)');
  console.log('================================================================');

  let serverProcess;
  try {
    // 1. Start the server on port 5001 in background (handled by bash shell, but we can check if it responds)
    console.log('Checking health status of server...');
    let healthy = false;
    for (let i = 0; i < 10; i++) {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (res.ok) {
          healthy = true;
          break;
        }
      } catch (e) {
        // server not ready yet
      }
      await delay(1000);
    }

    if (!healthy) {
      throw new Error('Server on port 5001 is not running or not responding. Please make sure the backend server is running on port 5001.');
    }
    console.log('✅ Connected to running backend server!');

    // 2. Prepare mock voter rolls in database
    console.log('\n--- PHASE 1: PREPARING VOTER ROLLS ---');
    const voterRollsRef = db.collection('tenants').doc(DEFAULT_TENANT_ID).collection('voter_rolls');
    const hashedPassword = await bcrypt.hash('Voter@123', 10);

    const voter1Data = {
      isRegistered: true,
      password: hashedPassword,
      name: 'E2E Voter One',
      email: 'voter1@htu.edu.gh',
      phone: '0241111111',
      uid: 'voter-001',
      role: 'voter'
    };

    const voter2Data = {
      isRegistered: true,
      password: hashedPassword,
      name: 'E2E Voter Two',
      email: 'voter2@htu.edu.gh',
      phone: '0242222222',
      uid: 'voter-002',
      role: 'voter'
    };

    await voterRollsRef.doc('voter-001').set(voter1Data);
    await voterRollsRef.doc('voter-002').set(voter2Data);
    console.log('✅ Mock voter rolls initialized in DB for voter-001 and voter-002.');

    // 3. Admin Login
    console.log('\n--- PHASE 2: ADMIN AUTHENTICATION ---');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@htu.edu.gh', password: 'admin080' })
    });

    const adminLoginData = await adminLoginRes.json();
    if (adminLoginData.status !== 'success') {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginData)}`);
    }
    const adminToken = adminLoginData.token;
    console.log('✅ Admin logged in successfully.');

    // 4. Create a new Election with multiple positions
    console.log('\n--- PHASE 3: CREATE ELECTION (MULTIPLE POSITIONS) ---');
    const nowISO = new Date().toISOString();
    const futureISO = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour future

    const createElectionRes = await fetch(`${BASE_URL}/elections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'COMPSSA E2E Test Election 2026',
        startDate: nowISO,
        endDate: futureISO,
        type: 'src',
        department: 'computer_science',
        showResults: true
      })
    });

    const electionResult = await createElectionRes.json();
    if (electionResult.status !== 'success') {
      throw new Error(`Failed to create election: ${JSON.stringify(electionResult)}`);
    }
    const electionId = electionResult.data.id;
    console.log(`✅ Election created successfully. ID: ${electionId}`);

    // 5. Add candidates with positions and fixed ballot numbers (No. 1, No. 2...)
    console.log('\n--- PHASE 4: REGISTER CANDIDATES WITH ASSIGNED BALLOT NUMBERS ---');

    // Position 1: President (Multiple candidates)
    console.log('Adding Candidate 1 for President: John Doe (Ballot No. 2 - Out of order addition)...');
    const resCand1 = await fetch(`${BASE_URL}/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'John Doe',
        position: 'President',
        manifesto: 'John\'s Manifesto',
        electionId,
        isIndependent: false,
        ballotNumber: '2' // Out of order on purpose to test sorting
      })
    });
    const cand1Data = await resCand1.json();
    if (cand1Data.status !== 'success') {
      throw new Error(`Failed to add Candidate 1: ${JSON.stringify(cand1Data)}`);
    }
    const cand1Id = cand1Data.data.id;

    console.log('Adding Candidate 2 for President: Jane Smith (Ballot No. 1 - Added second but No. 1)...');
    const resCand2 = await fetch(`${BASE_URL}/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Jane Smith',
        position: 'President',
        manifesto: 'Jane\'s Manifesto',
        electionId,
        isIndependent: false,
        ballotNumber: '1'
      })
    });
    const cand2Data = await resCand2.json();
    if (cand2Data.status !== 'success') {
      throw new Error(`Failed to add Candidate 2: ${JSON.stringify(cand2Data)}`);
    }
    const cand2Id = cand2Data.data.id;

    // Position 2: Financial Secretary (Unopposed / Independent candidate)
    console.log('Adding Candidate 3 for Financial Secretary (Unopposed): Bob Johnson (Ballot No. 1)...');
    const resCand3 = await fetch(`${BASE_URL}/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Bob Johnson',
        position: 'Financial Secretary',
        manifesto: 'Bob\'s Manifesto',
        electionId,
        isIndependent: true,
        ballotNumber: '1'
      })
    });
    const cand3Data = await resCand3.json();
    if (cand3Data.status !== 'success') {
      throw new Error(`Failed to add Candidate 3: ${JSON.stringify(cand3Data)}`);
    }
    const cand3Id = cand3Data.data.id;

    // Fetch and check candidate sorting
    console.log('\nChecking candidate list sorting by ballotNumber...');
    const listCandRes = await fetch(`${BASE_URL}/candidates/election/${electionId}`);
    const listCandData = await listCandRes.json();
    if (listCandData.status !== 'success') {
      throw new Error(`Failed to fetch candidates: ${JSON.stringify(listCandData)}`);
    }

    const retrievedCandidates = listCandData.data;
    console.log(`Total Candidates Retrieved: ${retrievedCandidates.length}`);

    // Sort verification: President position should have Jane Smith (No.1) before John Doe (No.2)
    const presidents = retrievedCandidates.filter(c => c.position === 'President');
    if (presidents.length !== 2) {
      throw new Error(`Expected 2 presidents, found ${presidents.length}`);
    }

    console.log(`Presidential candidates returned in order:`);
    presidents.forEach((p, index) => {
      console.log(`  Rank ${index + 1}: Name: ${p.name}, Ballot No: ${p.ballotNumber}`);
    });

    if (presidents[0].id !== cand2Id || presidents[1].id !== cand1Id) {
      throw new Error('❌ Candidate list is NOT correctly sorted by ballotNumber!');
    }
    console.log('✅ Candidate sorting by ballotNumber verified successfully!');

    // Activate the election
    console.log('Activating election status...');
    const activateRes = await fetch(`${BASE_URL}/elections/${electionId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'active' })
    });
    const activateData = await activateRes.json();
    if (activateData.status !== 'success') {
      throw new Error(`Failed to activate election: ${JSON.stringify(activateData)}`);
    }
    console.log('✅ Election is now ACTIVE.');

    // 6. Voter 1 Login & Vote Flow
    console.log('\n--- PHASE 5: VOTER 1 LOGIN & CAST BALLOT (YES VOTE FOR UNOPPOSED) ---');
    const voter1LoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'voter1@htu.edu.gh', password: 'Voter@123' })
    });
    const voter1LoginData = await voter1LoginRes.json();
    if (voter1LoginData.status !== 'success') {
      throw new Error(`Voter 1 login failed: ${JSON.stringify(voter1LoginData)}`);
    }
    const voter1Token = voter1LoginData.token;
    console.log('✅ Voter 1 logged in successfully.');

    // Step A: Request OTP to unlock election access
    console.log('Voter 1 requesting access OTP...');
    const v1RequestOtpRes = await fetch(`${BASE_URL}/elections/${electionId}/request-access-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voter1Token}`
      }
    });
    const v1RequestOtpData = await v1RequestOtpRes.json();
    if (v1RequestOtpData.status !== 'success') {
      throw new Error(`Voter 1 OTP request failed: ${JSON.stringify(v1RequestOtpData)}`);
    }

    // Since we are testing programmatically, we retrieve the OTP from Firestore directly
    const voter1Doc = await voterRollsRef.doc('voter-001').get();
    const v1Otp = voter1Doc.data().accessOtp;
    console.log(`Retrieved OTP from DB for Voter 1: ${v1Otp}`);

    // Step B: Verify OTP to unlock election access
    console.log('Voter 1 verifying access OTP...');
    const v1VerifyOtpRes = await fetch(`${BASE_URL}/elections/${electionId}/verify-access-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voter1Token}`
      },
      body: JSON.stringify({ otp: v1Otp })
    });
    const v1VerifyOtpData = await v1VerifyOtpRes.json();
    if (v1VerifyOtpData.status !== 'success') {
      throw new Error(`Voter 1 OTP verification failed: ${JSON.stringify(v1VerifyOtpData)}`);
    }
    console.log('✅ Voter 1 successfully unlocked election access.');

    // Step C: Cast Vote for President (Jane Smith - No. 1)
    console.log('Voter 1 casting ballot for Jane Smith (No. 1)...');
    const v1Cast1Res = await fetch(`${BASE_URL}/votes/cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voter1Token}`
      },
      body: JSON.stringify({
        electionId,
        candidateId: cand2Id
      })
    });
    const v1Cast1Data = await v1Cast1Res.json();
    if (v1Cast1Data.status !== 'success') {
      throw new Error(`Voter 1 failed to vote for President: ${JSON.stringify(v1Cast1Data)}`);
    }
    console.log(`✅ Voter 1 vote cast for President. Audit Hash: ${v1Cast1Data.data.verificationId}`);

    // Step D: Cast YES Vote for Financial Secretary (Bob Johnson - Unopposed)
    console.log('Voter 1 casting YES ballot for unopposed Bob Johnson...');
    const v1Cast2Res = await fetch(`${BASE_URL}/votes/cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voter1Token}`
      },
      body: JSON.stringify({
        electionId,
        candidateId: `${cand3Id}:yes`
      })
    });
    const v1Cast2Data = await v1Cast2Res.json();
    if (v1Cast2Data.status !== 'success') {
      throw new Error(`Voter 1 failed to vote for Financial Secretary: ${JSON.stringify(v1Cast2Data)}`);
    }
    console.log(`✅ Voter 1 vote cast for Financial Secretary (Yes). Audit Hash: ${v1Cast2Data.data.verificationId}`);


    // 7. Voter 2 Login & Vote Flow
    console.log('\n--- PHASE 6: VOTER 2 LOGIN & CAST BALLOT (NO VOTE FOR UNOPPOSED) ---');
    const voter2LoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'voter2@htu.edu.gh', password: 'Voter@123' })
    });
    const voter2LoginData = await voter2LoginRes.json();
    if (voter2LoginData.status !== 'success') {
      throw new Error(`Voter 2 login failed: ${JSON.stringify(voter2LoginData)}`);
    }
    const voter2Token = voter2LoginData.token;
    console.log('✅ Voter 2 logged in successfully.');

    // Step A: Request OTP
    console.log('Voter 2 requesting access OTP...');
    const v2RequestOtpRes = await fetch(`${BASE_URL}/elections/${electionId}/request-access-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voter2Token}`
      }
    });
    const v2RequestOtpData = await v2RequestOtpRes.json();
    if (v2RequestOtpData.status !== 'success') {
      throw new Error(`Voter 2 OTP request failed: ${JSON.stringify(v2RequestOtpData)}`);
    }

    // Retrieve OTP from DB
    const voter2Doc = await voterRollsRef.doc('voter-002').get();
    const v2Otp = voter2Doc.data().accessOtp;
    console.log(`Retrieved OTP from DB for Voter 2: ${v2Otp}`);

    // Step B: Verify OTP
    console.log('Voter 2 verifying access OTP...');
    const v2VerifyOtpRes = await fetch(`${BASE_URL}/elections/${electionId}/verify-access-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voter2Token}`
      },
      body: JSON.stringify({ otp: v2Otp })
    });
    const v2VerifyOtpData = await v2VerifyOtpRes.json();
    if (v2VerifyOtpData.status !== 'success') {
      throw new Error(`Voter 2 OTP verification failed: ${JSON.stringify(v2VerifyOtpData)}`);
    }
    console.log('✅ Voter 2 successfully unlocked election access.');

    // Step C: Cast Vote for President (Jane Smith - No. 1)
    console.log('Voter 2 casting ballot for Jane Smith (No. 1)...');
    const v2Cast1Res = await fetch(`${BASE_URL}/votes/cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voter2Token}`
      },
      body: JSON.stringify({
        electionId,
        candidateId: cand2Id
      })
    });
    const v2Cast1Data = await v2Cast1Res.json();
    if (v2Cast1Data.status !== 'success') {
      throw new Error(`Voter 2 failed to vote for President: ${JSON.stringify(v2Cast1Data)}`);
    }
    console.log(`✅ Voter 2 vote cast for President. Audit Hash: ${v2Cast1Data.data.verificationId}`);

    // Step D: Cast NO Vote for Financial Secretary (Bob Johnson - Unopposed)
    console.log('Voter 2 casting NO ballot for unopposed Bob Johnson...');
    const v2Cast2Res = await fetch(`${BASE_URL}/votes/cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voter2Token}`
      },
      body: JSON.stringify({
        electionId,
        candidateId: `${cand3Id}:no`
      })
    });
    const v2Cast2Data = await v2Cast2Res.json();
    if (v2Cast2Data.status !== 'success') {
      throw new Error(`Voter 2 failed to vote for Financial Secretary: ${JSON.stringify(v2Cast2Data)}`);
    }
    console.log(`✅ Voter 2 vote cast for Financial Secretary (No). Audit Hash: ${v2Cast2Data.data.verificationId}`);


    // 8. Test Double Voting Protection
    console.log('\n--- PHASE 7: DUPLICATE VOTING PROTECTION ---');
    console.log('Voter 1 attempting to cast an illegal second ballot for President...');
    const doubleVoteRes = await fetch(`${BASE_URL}/votes/cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voter1Token}`
      },
      body: JSON.stringify({
        electionId,
        candidateId: cand1Id // John Doe
      })
    });
    const doubleVoteData = await doubleVoteRes.json();
    console.log('Server response to duplicate vote attempt:', doubleVoteData);
    if (doubleVoteRes.status === 200 || doubleVoteData.status === 'success') {
      throw new Error('❌ FAILED: Server accepted a double vote in the same position category!');
    }
    console.log('✅ Double voting was rejected as expected. Error Message:', doubleVoteData.message);


    // 9. Results and Report Verification
    console.log('\n--- PHASE 8: RETRIEVE ELECTION RESULTS & REPORTS ---');

    // Fetch live candidates again to check results
    console.log('Fetching live candidates results (Admin authorized)...');
    const resultsRes = await fetch(`${BASE_URL}/candidates/election/${electionId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const resultsData = await resultsRes.json();
    if (resultsData.status !== 'success') {
      throw new Error(`Failed to fetch results: ${JSON.stringify(resultsData)}`);
    }

    const liveCandidates = resultsData.data;
    const JaneSmithResult = liveCandidates.find(c => c.id === cand2Id);
    const JohnDoeResult = liveCandidates.find(c => c.id === cand1Id);
    const BobJohnsonResult = liveCandidates.find(c => c.id === cand3Id);

    console.log('🗳️ Results Tally:');
    console.log(`  - Jane Smith (President): ${JaneSmithResult.votes} votes`);
    console.log(`  - John Doe (President): ${JohnDoeResult.votes} votes`);
    console.log(`  - Bob Johnson (Financial Secretary - Unopposed): Yes: ${BobJohnsonResult.votes}, No: ${BobJohnsonResult.noVotes}`);

    if (JaneSmithResult.votes !== 2) {
      throw new Error(`Expected Jane Smith to have 2 votes, but had ${JaneSmithResult.votes}`);
    }
    if (JohnDoeResult.votes !== 0) {
      throw new Error(`Expected John Doe to have 0 votes, but had ${JohnDoeResult.votes}`);
    }
    if (BobJohnsonResult.votes !== 1 || BobJohnsonResult.noVotes !== 1) {
      throw new Error(`Expected Bob Johnson to have 1 Yes and 1 No, but had ${BobJohnsonResult.votes} Yes and ${BobJohnsonResult.noVotes} No`);
    }
    console.log('✅ Vote tallies and Yes/No options for unopposed candidates verified perfectly!');

    // Generate Election Report JSON
    console.log('Generating Election Report...');
    const reportRes = await fetch(`${BASE_URL}/elections/${electionId}/report`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const reportData = await reportRes.json();
    if (reportData.status !== 'success') {
      throw new Error(`Report generation failed: ${JSON.stringify(reportData)}`);
    }
    console.log('✅ Election report generated successfully.');


    // 10. Sequential Cryptographic Integrity Verification
    console.log('\n--- PHASE 9: CRYPTOGRAPHIC LEDGER AUDIT ---');
    console.log(`Auditing ledger sequential chain for election ${electionId}...`);
    const auditResult = await verifyElectionIntegrity(electionId);
    console.log('Ledger Audit Result:', auditResult);
    if (!auditResult.valid) {
      throw new Error('❌ E2E Chain Tampering Detected: Audit validation failed!');
    }
    console.log('✅ Audit chain sequential verification validated successfully!');


    // 11. Cleanup E2E Test data from DB
    console.log('\n--- PHASE 10: CLEANING UP E2E TEST DATA ---');

    // Delete candidates
    console.log('Deleting candidates...');
    await db.collection('tenants').doc(DEFAULT_TENANT_ID).collection('candidates').doc(cand1Id).delete();
    await db.collection('tenants').doc(DEFAULT_TENANT_ID).collection('candidates').doc(cand2Id).delete();
    await db.collection('tenants').doc(DEFAULT_TENANT_ID).collection('candidates').doc(cand3Id).delete();

    // Delete election
    console.log('Deleting election...');
    await db.collection('tenants').doc(DEFAULT_TENANT_ID).collection('elections').doc(electionId).delete();

    // Delete voter records
    console.log('Deleting voters...');
    await voterRollsRef.doc('voter-001').delete();
    await voterRollsRef.doc('voter-002').delete();

    // Delete any cast votes for this election
    console.log('Deleting votes...');
    const votesSnap = await db.collection('tenants').doc(DEFAULT_TENANT_ID).collection('votes').where('electionId', '==', electionId).get();
    for (const doc of votesSnap.docs) {
      await doc.ref.delete();
    }
    const votedSnap = await db.collection('tenants').doc(DEFAULT_TENANT_ID).collection('voted_voters').where('electionId', '==', electionId).get();
    for (const doc of votedSnap.docs) {
      await doc.ref.delete();
    }
    const unlockedSnap = await db.collection('tenants').doc(DEFAULT_TENANT_ID).collection('unlocked_elections').where('electionId', '==', electionId).get();
    for (const doc of unlockedSnap.docs) {
      await doc.ref.delete();
    }
    const auditLogsSnap = await db.collection('tenants').doc(DEFAULT_TENANT_ID).collection('audit_logs').where('electionId', '==', electionId).get();
    for (const doc of auditLogsSnap.docs) {
      await doc.ref.delete();
    }

    console.log('================================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! FULL CYCLE TEST COMPLETE.');
    console.log('================================================================');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

runTest();
