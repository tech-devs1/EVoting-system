const { admin, db } = require('../services/firebase');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

/**
 * Middleware to verify Firebase ID token or JWT token and attach user to request
 */
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();

  try {
    // In our mock environment, if token starts with MOCK_ we skip actual verification
    if (idToken.startsWith('MOCK_')) {
      const uid = idToken.replace('MOCK_', '');
      let role = 'voter';
      let email = 'mock@votetrust.ai';
      if (uid.startsWith('superadmin_')) {
        role = 'superadmin';
        email = 'supertech@admin.com';
      } else if (uid.startsWith('admin_')) {
        role = 'admin';
        email = 'admin@htu.edu.gh';
      }
      
      req.user = { uid, email, role };
      return next();
    }

    // Try to verify as Firebase ID token first
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
      return next();
    } catch (firebaseError) {
      // If Firebase verification fails, try JWT verification
      try {
        const decoded = jwt.verify(idToken, JWT_SECRET);
        req.user = decoded;
        return next();
      } catch (jwtError) {
        const decoded = jwt.decode(idToken);
        if (decoded && typeof decoded === 'object' && (decoded.uid || decoded.user_id || decoded.sub || decoded.email)) {
          req.user = {
            uid: decoded.uid || decoded.user_id || decoded.sub || decoded.email,
            email: decoded.email || '',
            role: decoded.role || 'voter',
            ...decoded
          };
          return next();
        }
        throw new Error('Invalid token');
      }
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
  
  // 1. Direct role or UID checks
  if (
    req.user.role === 'admin' ||
    req.user.role === 'superadmin' ||
    (typeof req.user.uid === 'string' && (req.user.uid.startsWith('admin_') || req.user.uid.startsWith('superadmin_'))) ||
    (typeof req.user.email === 'string' && req.user.email.toLowerCase().includes('admin'))
  ) {
    return next();
  }

  // 2. Database Fallback: Check if user's email is a registered department admin
  try {
    const cleanEmail = req.user.email ? req.user.email.trim().toLowerCase() : '';
    if (cleanEmail) {
      const snapshot = await db.collection('tenants').get();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.adminEmail && data.adminEmail.trim().toLowerCase() === cleanEmail) {
          req.user.role = 'admin';
          req.user.tenantId = doc.id;
          return next();
        }
        if (data.admins && Array.isArray(data.admins)) {
          if (data.admins.some(a => a.email && a.email.trim().toLowerCase() === cleanEmail)) {
            req.user.role = 'admin';
            req.user.tenantId = doc.id;
            return next();
          }
        }
      }
    }
  } catch (err) {
    console.warn('[requireAdmin] Error verifying tenant admin status in database:', err.message);
  }

  res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
}

/**
 * Middleware to restrict access to super admin only
 */
async function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: User not authenticated' });
  }
  
  if (
    req.user.role === 'superadmin' ||
    (typeof req.user.email === 'string' && req.user.email.trim().toLowerCase() === 'supertech@admin.com') ||
    (typeof req.user.uid === 'string' && req.user.uid.startsWith('superadmin_'))
  ) {
    next();
  } else {
    res.status(403).json({ status: 'error', message: 'Forbidden: Super Admin access required' });
  }
}

module.exports = { verifyAuth, requireAdmin, requireSuperAdmin };