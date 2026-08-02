const { db } = require('./firebase');

/**
 * Service to monitor voting activity for fraud and anomalies.
 * Examples of fraud rules:
 * 1. Multiple failed vote attempts (rate limiting)
 * 2. Unusually high volume of votes in short time
 * 3. Voting outside of permitted hours
 */

async function logFraudAlert(type, message, metadata = {}, tenantId = null) {
  try {
    const targetTenantId = tenantId || metadata.tenantId || 'compssa';
    const entry = {
      type,
      message,
      metadata,
      tenantId: targetTenantId,
      timestamp: Date.now(),
      status: 'unresolved'
    };

    // Write to global fraud_alerts
    await db.collection('fraud_alerts').add(entry);

    // Also write to tenant sub-collection if tenantId is available
    if (targetTenantId) {
      await db.collection('tenants').doc(targetTenantId).collection('fraud_alerts').add(entry);
    }

    console.warn(`[FRAUD ALERT] ${type}: ${message}`);
  } catch (error) {
    console.error('Failed to log fraud alert', error);
  }
}

/**
 * Simple rate limiting / anomaly detection
 * (In a production system, use Redis or robust time-series DB)
 */
async function checkVoteAnomaly(electionId) {
  // E.g., check if > 1000 votes in the last minute
  const oneMinuteAgo = Date.now() - 60000;
  
  try {
    const recentCountSnap = await db.collection('votes')
      .where('electionId', '==', electionId)
      .where('timestamp', '>', oneMinuteAgo)
      .count()
      .get();
      
    const recentCount = recentCountSnap.data().count;

    if (recentCount > 1000) {
      await logFraudAlert('HIGH_VOLUME_ANOMALY', `Unusual voting volume detected for election ${electionId}`, { count: recentCount });
    }
  } catch (err) {
    console.error('Fraud check failed', err);
  }
}

module.exports = {
  logFraudAlert,
  checkVoteAnomaly
};
