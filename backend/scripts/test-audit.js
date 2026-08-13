const { verifyElectionIntegrity } = require('../services/audit');
const { sequelize, Vote } = require('../models');

async function testAudit() {
  console.log('Testing Audit Sequential verification with Sequelize models...');
  
  // Wipe and sync database
  await sequelize.sync({ force: true });

  // Create chain
  await Vote.create({
    id: 'v1',
    electionId: 'el_1',
    voterId: 'voter_1',
    positionId: 'pos_1',
    candidateId: 'cand_1',
    encryptedHash: 'hash_1',
    blockIndex: 1,
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: Date.now()
  });

  await Vote.create({
    id: 'v2',
    electionId: 'el_1',
    voterId: 'voter_2',
    positionId: 'pos_1',
    candidateId: 'cand_2',
    encryptedHash: 'hash_2',
    blockIndex: 2,
    prevHash: 'hash_1',
    timestamp: Date.now()
  });

  const res = await verifyElectionIntegrity('el_1');
  console.log('Result:', res);
  if (res.valid) {
    console.log('Audit ledger sequence test successful!');
    process.exit(0);
  } else {
    console.error('Audit sequence check failed!');
    process.exit(1);
  }
}

testAudit();
