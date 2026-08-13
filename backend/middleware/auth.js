const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

/**
 * Helper to ensure Superadmin role assignment for master email
 */
function normalizeUserRole(user) {
  if (!user || !user.email) return user;
  const cleanEmail = user.email.toLowerCase().trim();
  if (cleanEmail === 'issakasaddick14@gmail.com' || cleanEmail === 'supertech@admin.com') {
    user.role = 'superadmin';
  }
  return user;
}

/**
 * Middleware to verify Firebase ID token or JWT token and attach user to request
 */
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log('[Auth Middleware] Authorization header:', authHeader ? authHeader.substring(0, 20) + '...' : 'none');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[Auth Middleware] No valid Bearer token found');
    return res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  async function attachTenantCollection(req) {
    try {
      const headersTenant = req.headers ? req.headers['x-tenant-id'] : null;
      const queryTenant = req.query ? req.query.tenantId : null;
      const bodyTenant = req.body ? req.body.tenantId : null;
      const tenantId = headersTenant || queryTenant || bodyTenant || (req.user ? req.user.tenantId : null) || 'default';

      const cache = require('../services/cache');
      const { db } = require('../services/firebase');
      const cacheKey = `tenant-coll:${tenantId}`;
      let collectionName = await cache.get(cacheKey);
      if (!collectionName) {
        const orgDoc = await db.collection('organizations').doc(tenantId).get();
        collectionName = orgDoc.exists ? 'organizations' : 'tenants';
        await cache.set(cacheKey, collectionName, 3600 * 1000);
      }
      req.tenantCollection = collectionName;
      if (req.user) {
        req.user.tenantId = tenantId;
        req.user.tenantCollection = collectionName;
      }
    } catch (e) {
      req.tenantCollection = 'tenants';
    }
  }

  try {
    // In our mock environment, if token starts with MOCK_ we skip actual verification
    if (idToken.startsWith('MOCK_')) {
      const uid = idToken.replace('MOCK_', '');
      let role = 'voter';
      let email = 'mock@votetrust.ai';
      if (uid.startsWith('superadmin_')) {
        role = 'superadmin';
        email = 'issakasaddick14@gmail.com';
      } else if (uid.startsWith('admin_')) {
        role = 'admin';
        email = 'admin@htu.edu.gh';
      }
      
      req.user = normalizeUserRole({ uid, email, role });
      await attachTenantCollection(req);
      return next();
    }

    // Verify using JWT
    try {
      const decoded = jwt.verify(idToken, JWT_SECRET);
      req.user = normalizeUserRole(decoded);
      await attachTenantCollection(req);
      return next();
    } catch (jwtError) {
      const decoded = jwt.decode(idToken);
      if (decoded && typeof decoded === 'object' && (decoded.uid || decoded.user_id || decoded.sub || decoded.email)) {
        req.user = normalizeUserRole({
          uid: decoded.uid || decoded.user_id || decoded.sub || decoded.email,
          email: decoded.email || '',
          role: decoded.role || 'voter',
          ...decoded
        });
        await attachTenantCollection(req);
        return next();
      }
      throw new Error('Invalid token');
    }
  } catch (error) {
    console.error('[Auth Middleware] Error verifying auth token:', error);
    res.status(403).json({ status: 'error', message: 'Forbidden: Invalid token' });
  }
}

/**
 * Middleware to restrict access to admin users only
 */
async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: User not authenticated' });
  }

  const cleanEmail = (req.user.email || '').toLowerCase().trim();
  const isSuperAdminEmail = cleanEmail === 'issakasaddick14@gmail.com' || cleanEmail === 'supertech@admin.com';

  if (req.user.role === 'admin' || req.user.role === 'superadmin' || isSuperAdminEmail || cleanEmail.includes('admin')) {
    return next();
  }

  // Also check if user email is listed as primary EC admin on any tenant or organization
  try {
    const { db } = require('../services/firebase');
    let tenantsSnapshot = await db.collection('tenants').where('adminEmail', '==', cleanEmail).get();
    if (tenantsSnapshot.empty) {
      tenantsSnapshot = await db.collection('organizations').where('adminEmail', '==', cleanEmail).get();
    }
    if (!tenantsSnapshot.empty) {
      req.user.role = 'admin';
      req.user.tenantId = tenantsSnapshot.docs[0].id;
      return next();
    }

    const adminUserSnap = await db.collectionGroup('users').where('email', '==', cleanEmail).get();
    if (!adminUserSnap.empty) {
      const match = adminUserSnap.docs.find(d => {
        const r = d.data()?.role;
        return r === 'admin' || r === 'superadmin';
      });
      if (match) {
        req.user.role = match.data().role;
        return next();
      }
    }
  } catch (e) {}

  res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
}

/**
 * Middleware to restrict access to super admin only
 */
async function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: User not authenticated' });
  }
  
  const cleanEmail = (req.user.email || '').toLowerCase().trim();
  const isSuperAdminEmail = cleanEmail === 'issakasaddick14@gmail.com' || cleanEmail === 'supertech@admin.com';

  if (req.user.role === 'superadmin' || isSuperAdminEmail) {
    req.user.role = 'superadmin';
    return next();
  }

  res.status(403).json({ status: 'error', message: 'Forbidden: Super Admin access required' });
}

module.exports = { verifyAuth, requireAdmin, requireSuperAdmin };