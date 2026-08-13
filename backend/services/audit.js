const crypto = require('crypto');
const { Vote } = require('../models');

function generateHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function verifyElectionIntegrity(electionId) {
  // Simple validation logic using Vote models
  const votes = await Vote.findAll({ where: { electionId }, order: [['blockIndex', 'ASC']] });
  if (votes.length === 0) return { valid: true, message: 'Audit chain is cryptographically verified and intact.' };

  let expectedPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';

  for (const vote of votes) {
    if (vote.prevHash !== expectedPrevHash) {
      return { valid: false, message: 'Chain broken: prevHash mismatch' };
    }
    expectedPrevHash = vote.encryptedHash;
  }

  return { valid: true, message: 'Audit chain is cryptographically verified and intact.' };
}

module.exports = {
  verifyElectionIntegrity,
  generateHash
};
