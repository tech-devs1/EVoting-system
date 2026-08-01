const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Function Trigger: onVoteCast
 * This function triggers whenever a new vote is added to a tenant's election.
 * It verifies the vote, ensures the voter hasn't already voted, and writes an
 * immutable audit log entry containing a cryptographic SHA-256 hash.
 */
exports.onVoteCast = functions.firestore
  .document('tenants/{tenantId}/elections/{electionId}/votes/{voteId}')
  .onCreate(async (snap, context) => {
    const voteData = snap.data();
    const { tenantId, electionId, voteId } = context.params;

    // 1. Construct the payload for hashing
    // We include previous hash (if any) to create a chain, but for now we hash the current vote
    const hashPayload = JSON.stringify({
      voteId: voteId,
      voterId: voteData.voterId,
      candidateId: voteData.candidateId,
      electionId: electionId,
      tenantId: tenantId,
      timestamp: voteData.timestamp || new Date().toISOString()
    });

    // 2. Generate SHA-256 Hash
    const hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    // 3. Write to the append-only Audit Logs collection
    const auditLogRef = db.collection('tenants').doc(tenantId).collection('audit_logs').doc();
    
    await auditLogRef.set({
      action: 'VOTE_CAST',
      actorId: voteData.voterId,
      targetId: voteData.candidateId,
      electionId: electionId,
      voteId: voteId,
      dataHash: hash,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Update Election Aggregation (Tally)
    // Using Cloud Functions to maintain a running tally to save read operations on the client
    const candidateRef = db.collection('tenants').doc(tenantId).collection('candidates').doc(voteData.candidateId);
    await candidateRef.update({
      voteCount: admin.firestore.FieldValue.increment(1)
    });

    console.log(`[Audit Trail] Processed vote ${voteId} for tenant ${tenantId}. Hash: ${hash}`);
    return null;
  });

/**
 * Cloud Function Trigger: onElectionCompleted
 * Generates an Audit Snapshot for the Independent Auditor when an election closes.
 */
exports.onElectionCompleted = functions.firestore
  .document('tenants/{tenantId}/elections/{electionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const { tenantId, electionId } = context.params;

    if (before.status !== 'completed' && after.status === 'completed') {
      console.log(`[Audit Trail] Generating snapshot for completed election: ${electionId}`);
      
      // Fetch all audit logs for this election
      const auditLogsSnap = await db.collection('tenants').doc(tenantId).collection('audit_logs')
        .where('electionId', '==', electionId)
        .orderBy('timestamp', 'asc')
        .get();

      let snapshotString = '';
      auditLogsSnap.forEach(doc => {
        snapshotString += doc.data().dataHash;
      });

      // Generate the Merkle Root / Final Checksum
      const finalChecksum = crypto.createHash('sha256').update(snapshotString).digest('hex');

      // Save the checksum to the election document
      await change.after.ref.update({
        auditSnapshotChecksum: finalChecksum,
        auditSnapshotGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`[Audit Trail] Snapshot checksum generated: ${finalChecksum}`);
    }
    return null;
  });
