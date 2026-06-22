const crypto = require('crypto');
const { db } = require('./firebase');

/**
 * Generates a SHA-256 hash for a given data string
 * @param {string} data 
 * @returns {string} SHA-256 hash
 */
function generateHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Creates an immutable audit log entry for a new vote.
 * Links the new vote to the previous vote hash to create a tamper-proof chain.
 * 
 * @param {Object} voteData The vote payload
 * @param {string} electionId The election ID
 * @returns {Promise<string>} The transaction/audit ID
 */
async function recordVoteAudit(voteData, electionId) {
  // 1. Get the last hash for this election to build the chain
  const auditRef = db.collection('audit_logs');
  
  // Since mock or firestore, we might not have a reliable orderBy, 
  // so we'll just get all and find the latest based on timestamp.
  const auditDocs = await auditRef.where('electionId', '==', electionId).get();
  
  let previousHash = 'GENESIS_HASH';
  let latestTimestamp = 0;

  if (!auditDocs.empty) {
    auditDocs.forEach(doc => {
      const data = doc.data();
      if (data.timestamp > latestTimestamp) {
        latestTimestamp = data.timestamp;
        previousHash = data.currentHash;
      }
    });
  }

  // 2. Prepare current data string
  const timestamp = Date.now();
  const dataString = JSON.stringify({
    electionId: voteData.electionId,
    candidateId: voteData.candidateId,
    timestamp: timestamp,
    // Note: Do NOT include voter ID to maintain anonymity!
  });

  // 3. Generate current hash: Hash(Data + PrevHash)
  const currentHash = generateHash(dataString + previousHash);

  // 4. Save to Audit Ledger
  const auditEntry = {
    electionId,
    timestamp,
    previousHash,
    currentHash,
    dataPayload: dataString
  };

  const newDoc = await auditRef.add(auditEntry);
  return newDoc.id;
}

/**
 * Verifies the integrity of the vote chain for a given election.
 * Returns true if valid, false if tampering detected.
 */
async function verifyElectionIntegrity(electionId) {
  const auditRef = db.collection('audit_logs');
  const auditDocs = await auditRef.where('electionId', '==', electionId).get();
  
  if (auditDocs.empty) return true; // Empty is valid

  // Sort by timestamp
  const logs = [];
  auditDocs.forEach(doc => logs.push(doc.data()));
  logs.sort((a, b) => a.timestamp - b.timestamp);

  let expectedPrevHash = 'GENESIS_HASH';

  for (const log of logs) {
    if (log.previousHash !== expectedPrevHash) {
      return { valid: false, message: 'Chain broken: previousHash mismatch', invalidLog: log };
    }

    const calculatedHash = generateHash(log.dataPayload + log.previousHash);
    if (calculatedHash !== log.currentHash) {
      return { valid: false, message: 'Data tampered: calculated hash mismatch', invalidLog: log };
    }

    expectedPrevHash = log.currentHash;
  }

  return { valid: true, message: 'Audit chain is cryptographically verified and intact.' };
}

module.exports = {
  recordVoteAudit,
  verifyElectionIntegrity,
  generateHash
};
