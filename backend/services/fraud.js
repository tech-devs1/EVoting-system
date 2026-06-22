const { db } = require('./firebase');

/**
 * Service to monitor voting activity for fraud and anomalies.
 * Examples of fraud rules:
 * 1. Multiple failed vote attempts (rate limiting)
 * 2. Unusually high volume of votes in short time
 * 3. Voting outside of permitted hours
 */

async function logFraudAlert(type, message, metadata = {}) {
  try {
    await db.collection('fraud_alerts').add({
      type,
      message,
      metadata,
      timestamp: Date.now(),
      status: 'unresolved'
    });
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
    const recentVotes = await db.collection('votes')
      .where('electionId', '==', electionId)
      // Note: Firestore requires composite index for this query, mocked for now
      .get();
      
    const recentCount = recentVotes.docs.filter(doc => doc.data().timestamp > oneMinuteAgo).length;

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
