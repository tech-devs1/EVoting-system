const { recordVoteAudit, verifyElectionIntegrity, generateHash } = require('./services/audit');
const { db } = require('./services/firebase');

async function runAuditTest() {
  console.log('--- Starting Audit Integrity Test ---');
  const mockElectionId = 'test-election-123';

  // 1. Clear any existing mock data for this election
  const oldDocs = await db.collection('audit_logs').where('electionId', '==', mockElectionId).get();
  for (const doc of oldDocs.docs) {
    await db.collection('audit_logs').doc(doc.id).delete();
  }

  // 2. Add some votes
  console.log('Recording vote 1...');
  await recordVoteAudit({ electionId: mockElectionId, candidateId: 'c-1' }, mockElectionId);
  
  console.log('Recording vote 2...');
  await recordVoteAudit({ electionId: mockElectionId, candidateId: 'c-2' }, mockElectionId);
  
  console.log('Recording vote 3...');
  await recordVoteAudit({ electionId: mockElectionId, candidateId: 'c-1' }, mockElectionId);

  // 3. Verify Integrity (Should be valid)
  console.log('Verifying integrity of intact chain...');
  const result1 = await verifyElectionIntegrity(mockElectionId);
  console.log('Intact Result:', result1);
  if (!result1.valid) {
    console.error('Test Failed: Expected intact chain to be valid.');
    process.exit(1);
  }

  // 4. Tamper with the data payload of the second vote
  console.log('Tampering with the ledger...');
  const auditDocs = await db.collection('audit_logs').where('electionId', '==', mockElectionId).get();
  let logs = [];
  auditDocs.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
  logs.sort((a, b) => a.timestamp - b.timestamp);
  
  // Tamper second log's payload to favor another candidate
  const targetLog = logs[1];
  const originalPayload = targetLog.dataPayload;
  const newPayload = originalPayload.replace('"candidateId":"c-2"', '"candidateId":"c-1"');
  await db.collection('audit_logs').doc(targetLog.id).update({ dataPayload: newPayload });

  // 5. Verify Integrity again (Should be invalid)
  console.log('Verifying integrity of tampered chain...');
  const result2 = await verifyElectionIntegrity(mockElectionId);
  console.log('Tampered Result:', result2);
  
  if (result2.valid) {
    console.error('Test Failed: Expected tampered chain to be invalid.');
    process.exit(1);
  }

  console.log('--- Audit Integrity Test Passed Successfully ---');
}

runAuditTest().catch(console.error);
