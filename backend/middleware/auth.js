const jwt = require('jsonwebtoken');

// JWT_SECRET must be set in production. The fallback below is only a local-dev
// convenience — it is public knowledge (it lives in this repo), so anyone could
// forge tokens if a production deployment ran with it. Fail fast instead.
const DEV_FALLBACK_SECRET = 'fallback-secret-key-for-development';
const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;

if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEV_FALLBACK_SECRET) {
  console.error(
    '⚠️  [Auth] Refusing to start in production: JWT_SECRET is not configured.\n' +
    '    Set a strong JWT_SECRET in the cPanel Node.js app environment variables\n' +
    '    (or .env) before deploying. Without it, authentication tokens can be forged.'
  );
  process.exit(1);
}

/**
 * Resolve the tenant scope from the request (header > query > body > token).
 * The frontend sends `x-tenant-id` when operating inside a tenant console.
 */
function resolveTenantId(req, user) {
  const headerTenant = req.headers ? req.headers['x-tenant-id'] : null;
  const queryTenant = req.query ? req.query.tenantId : null;
  const bodyTenant = req.body ? req.body.tenantId : null;
  return (
    headerTenant ||
    queryTenant ||
    bodyTenant ||
    (user && user.tenantId) ||
    null
  );
}

/**
 * Middleware to verify the JWT issued by our own login endpoints and attach
 * the user to the request. Only tokens signed with JWT_SECRET are accepted —
 * there is deliberately no "MOCK_" bypass and no unsigned-token fallback.
 */
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || typeof decoded !== 'object' || !decoded.uid) {
      throw new Error('Invalid token payload');
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      role: decoded.role || 'voter',
      name: decoded.name || '',
      tenantId: resolveTenantId(req, decoded),
      indexNumber: decoded.indexNumber || decoded.studentId || ''
    };
    return next();
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
  }
}

/**
 * Middleware to restrict access to admin users only. The role comes from the
 * verified JWT — email strings are never used to infer privileges.
 */
async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: User not authenticated' });
  }
  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
}

/**
 * Middleware to restrict access to super admin only.
 */
async function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: User not authenticated' });
  }
  if (req.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ status: 'error', message: 'Forbidden: Super Admin access required' });
}

module.exports = { verifyAuth, requireAdmin, requireSuperAdmin };
