const { db } = require('./firebase');

/**
 * Writes a structured activity log entry to:
 *   - tenants/{tenantId}/activity_logs/{logId}   (tenant-scoped)
 *   - global_activity_logs/{logId}               (super admin global view)
 *
 * @param {Object} opts
 * @param {string} opts.tenantId    - The tenant/department identifier
 * @param {string} opts.tenantName  - Human-readable name of the department
 * @param {string} opts.actorEmail  - Email of the user performing the action
 * @param {string} opts.actorRole   - 'voter' | 'admin' | 'superadmin'
 * @param {string} opts.action      - Short action code (e.g. 'LOGIN', 'VOTE_CAST', 'CSV_UPLOAD')
 * @param {string} opts.description - Human-readable description
 * @param {string} [opts.ip]        - Request IP address (optional)
 * @param {string} [opts.status]    - 'success' | 'failure' (default: 'success')
 * @param {Object} [opts.meta]      - Any extra metadata to attach
 * @returns {Promise<void>}
 */
async function logActivity({ tenantId, tenantName, actorEmail, actorRole, action, description, ip, status = 'success', meta = {} }) {
  try {
    const timestamp = Date.now();
    const entry = {
      tenantId,
      tenantName: tenantName || tenantId,
      actorEmail: actorEmail || 'system',
      actorRole: actorRole || 'system',
      action,
      description,
      status,
      ip: ip || 'unknown',
      meta,
      timestamp,
      createdAt: new Date(timestamp).toISOString()
    };

    // Write to tenant-scoped sub-collection
    const tenantLogRef = db.collection('tenants').doc(tenantId).collection('activity_logs');
    await tenantLogRef.add(entry);

    // Also write to global collection for super admin overview
    const globalLogRef = db.collection('global_activity_logs');
    await globalLogRef.add(entry);
  } catch (err) {
    // Never crash the main request due to logging failure
    console.error('[ActivityLog] Failed to write log entry:', err.message);
  }
}

module.exports = { logActivity };
