const { ActivityLog } = require('../models');

async function logActivity({ tenantId, actorEmail, actorRole, action, description, ip, status = 'success' }) {
  try {
    const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const logDesc = typeof description === 'object' ? JSON.stringify(description) : (description || action);
    await ActivityLog.create({
      id,
      tenantId: tenantId || 'global',
      actorEmail: actorEmail || 'unknown@htu.edu.gh',
      actorRole: actorRole || 'system',
      action,
      description: logDesc,
      ip: ip || '127.0.0.1',
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('[logActivity Error]:', err.message);
  }
}

module.exports = { logActivity };
