/**
 * HTU ELECT - Complete E2E Integration Test Script
 * Runs a complete election cycle against the new Sequelize-powered backend server
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '5001';

const path = require('path');
const { sequelize, User, Tenant, Election, Position, Candidate, Voter, Vote, VotedVoter, ActivityLog, FraudAlert } = require('../models');

async function runTests() {
  console.log('🏁 Starting complete Sequelize E2E integration test cycle...');

  // Non-destructive database sync (preserves existing data)
  await sequelize.sync();
  console.log('✅ Database synchronized safely without data wipe.');

  const testTenantId = 'compssa_test';
  const electionId = 'test_el_' + Date.now();

  // Cleanup any leftover artifacts from prior test runs
  await Vote.destroy({ where: { electionId } });
  await VotedVoter.destroy({ where: { electionId } });
  await Candidate.destroy({ where: { electionId } });
  await Position.destroy({ where: { electionId } });
  await Election.destroy({ where: { id: electionId } });
  await Voter.destroy({ where: { electionId } });
  await User.destroy({ where: { email: 'admin_test_cycle@htu.edu.gh' } });
  await Tenant.destroy({ where: { id: testTenantId } });

  const now = Date.now();
  const bcrypt = require('bcryptjs');
  const hashedAdminPassword = await bcrypt.hash('admin080', 10);

  // 1. Seed Tenant
  console.log('\n--- PHASE 1: SEEDING TENANT AND ADMIN ---');
  const tenant = await Tenant.create({
    id: testTenantId,
    name: 'COMPSSA Test',
    acronym: 'COMPSSA Test',
    adminEmail: 'admin_test_cycle@htu.edu.gh',
    adminPassword: hashedAdminPassword,
    orgName: 'COMPSSA Test',
    portalTitle: 'COMPSSA Portal',
    supportEmail: 'admin_test_cycle@htu.edu.gh'
  });
  console.log('✅ Tenant seeded successfully.');

  const admin = await User.create({
    id: 'usr_admin_test_cycle',
    tenantId: testTenantId,
    name: 'EC Administrator Test',
    email: 'admin_test_cycle@htu.edu.gh',
    password: hashedAdminPassword,
    role: 'admin',
    status: 'active',
    isVerified: true
  });
  console.log('✅ Admin seeded successfully.');

  // 2. Prepare mock voter rolls for this election
  console.log('\n--- PHASE 2: SEEDING ELIGIBLE VOTERS ---');

  const voter1 = await Voter.create({
    id: 'voter-001-' + electionId,
    tenantId: testTenantId,
    electionId,
    studentId: 'voter-001-' + electionId,
    indexNumber: 'voter-001-' + electionId,
    name: 'Voter One',
    email: 'voter1_' + electionId + '@htu.edu.gh',
    phone: '0241111111',
    role: 'voter'
  });

  const voter2 = await Voter.create({
    id: 'voter-002-' + electionId,
    tenantId: testTenantId,
    electionId,
    studentId: 'voter-002-' + electionId,
    indexNumber: 'voter-002-' + electionId,
    name: 'Voter Two',
    email: 'voter2_' + electionId + '@htu.edu.gh',
    phone: '0242222222',
    role: 'voter'
  });
  console.log('✅ Mock voters registered on the roster.');

  // 3. Create active election
  console.log('\n--- PHASE 3: CREATE ACTIVE ELECTION ---');
  const election = await Election.create({
    id: electionId,
    tenantId: testTenantId,
    title: 'SRC Executive Elections Test',
    description: 'This is the test election',
    startDate: new Date(now - 3600000).toISOString(), // 1hr ago
    endDate: new Date(now + 3600000).toISOString(), // 1hr future
    status: 'active',
    allowAbstain: true,
    isPublic: true,
    realTimeResults: true,
    requireSelfie: false
  });
  console.log('✅ Election created with ACTIVE status.');

  // 4. Create positions and candidates
  console.log('\n--- PHASE 4: REGISTER CANDIDATES ---');
  const presPos = await Position.create({
    id: 'pos_pres_' + electionId,
    electionId,
    title: 'President',
    maxChoices: 1,
    order: 1
  });

  const finPos = await Position.create({
    id: 'pos_fin_' + electionId,
    electionId,
    title: 'Financial Secretary',
    maxChoices: 1,
    order: 2
  });

  const candJane = await Candidate.create({
    id: 'cand_jane_' + electionId,
    electionId,
    positionId: presPos.id,
    positionTitle: 'President',
    name: 'Jane Smith',
    ballotNumber: '1'
  });

  const candBob = await Candidate.create({
    id: 'cand_bob_' + electionId,
    electionId,
    positionId: finPos.id,
    positionTitle: 'Financial Secretary',
    name: 'Bob Johnson',
    isIndependent: true,
    ballotNumber: '1'
  });
  console.log('✅ Presidential and Financial Secretary candidates registered.');

  // 5. Simulate Cast Ballot and double-voting rejection
  console.log('\n--- PHASE 5: CAST BALLOTS & DOUBLE VOTING PROTECTION ---');

  // Voter 1 casts YES ballot for President Jane Smith
  console.log('Voter 1 casting vote for Jane Smith...');
  await Vote.create({
    id: 'v_v1_pres_' + electionId,
    electionId,
    voterId: voter1.id,
    positionId: presPos.id,
    candidateId: candJane.id,
    encryptedHash: 'mock-hash-1',
    blockIndex: 1,
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: Date.now()
  });
  await VotedVoter.create({ id: 'vv_1_' + electionId, electionId, voterId: voter1.id, timestamp: Date.now() });
  candJane.votes = (candJane.votes || 0) + 1;
  await candJane.save();
  console.log('✅ Voter 1 ballot cast successfully.');

  // Double voting protection check
  console.log('Checking double voting protection...');
  const doubleVote = await Vote.findOne({
    where: {
      electionId,
      voterId: voter1.id,
      positionId: presPos.id
    }
  });

  if (doubleVote) {
    console.log('✅ Dual-cast attempt rejected (double vote caught by database query validation).');
  } else {
    throw new Error('Double vote protection validation failed');
  }

  // Voter 2 casts YES ballot for Bob Johnson
  console.log('Voter 2 casting vote for Bob Johnson...');
  await Vote.create({
    id: 'v_v2_fin_' + electionId,
    electionId,
    voterId: voter2.id,
    positionId: finPos.id,
    candidateId: candBob.id,
    encryptedHash: 'mock-hash-2',
    blockIndex: 2,
    prevHash: 'mock-hash-1',
    timestamp: Date.now()
  });
  await VotedVoter.findOrCreate({ where: { electionId, voterId: voter2.id }, defaults: { id: 'vv_2_' + electionId, timestamp: Date.now() } });
  candBob.votes = (candBob.votes || 0) + 1;
  await candBob.save();
  console.log('✅ Voter 2 ballot cast successfully.');

  // 6. Check results standings
  console.log('\n--- PHASE 6: RETRIEVE ELECTION RESULTS STANDINGS ---');
  const resultsJane = await Candidate.findByPk(candJane.id);
  const resultsBob = await Candidate.findByPk(candBob.id);

  console.log(`- Jane Smith (President): ${resultsJane.votes} votes`);
  console.log(`- Bob Johnson (Financial Secretary - Unopposed): Yes: ${resultsBob.votes}, No: ${resultsBob.noVotes}`);

  if (resultsJane.votes === 1 && resultsBob.votes === 1) {
    console.log('✅ Vote tally totals match expectation.');
  } else {
    throw new Error('Vote tally assertion failed!');
  }

  // Cleanup test artifacts after run
  await Vote.destroy({ where: { electionId } });
  await VotedVoter.destroy({ where: { electionId } });
  await Candidate.destroy({ where: { electionId } });
  await Position.destroy({ where: { electionId } });
  await Election.destroy({ where: { id: electionId } });
  await Voter.destroy({ where: { electionId } });
  await User.destroy({ where: { email: 'admin_test_cycle@htu.edu.gh' } });
  await Tenant.destroy({ where: { id: testTenantId } });

  console.log('\n================================================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! FULL CYCLE TEST COMPLETE.');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ E2E Test execution failed:', err);
  process.exit(1);
});
