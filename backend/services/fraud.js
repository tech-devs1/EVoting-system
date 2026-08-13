const { FraudAlert } = require('../models');

async function logFraudAlert(type, details, additional = {}) {
  try {
    const id = `fr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await FraudAlert.create({
      id,
      electionId: additional.electionId || null,
      voterId: additional.voterId || null,
      severity: additional.severity || 'medium',
      type,
      details,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('[logFraudAlert Error]:', err.message);
  }
}

module.exports = { logFraudAlert };
