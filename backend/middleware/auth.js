const { admin } = require('../services/firebase');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

/**
 * Middleware to verify Firebase ID token or JWT token and attach user to request
 */
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log('[Auth Middleware] Authorization header:', authHeader ? authHeader.substring(0, 20) + '...' : 'none');
  console.log('[Auth Middleware] JWT_SECRET set:', !!process.env.JWT_SECRET);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[Auth Middleware] No valid Bearer token found');
    return res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  console.log('[Auth Middleware] Token:', idToken.substring(0, 30) + '...');

  try {
    // In our mock environment, if token starts with MOCK_ we skip actual verification
    if (idToken.startsWith('MOCK_')) {
      console.log('[Auth Middleware] Using MOCK token authentication');
      const uid = idToken.replace('MOCK_', '');
      const role = uid.startsWith('admin_') ? 'admin' : 'voter';
      req.user = { uid, email: role === 'admin' ? 'admin@htu.edu.gh' : 'mock@votetrust.ai', role };
      console.log('[Auth Middleware] MOCK user authenticated:', req.user);
      return next();
    }

    // Try to verify as Firebase ID token first
    try {
      console.log('[Auth Middleware] Attempting Firebase token verification');
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
      console.log('[Auth Middleware] Firebase token verified');
      return next();
    } catch (firebaseError) {
      console.log('[Auth Middleware] Firebase verification failed, trying JWT:', firebaseError.message);
      // If Firebase verification fails, try JWT verification
      try {
        const decoded = jwt.verify(idToken, JWT_SECRET);
        req.user = decoded;
        console.log('[Auth Middleware] JWT token verified');
        return next();
      } catch (jwtError) {
        console.error('[Auth Middleware] JWT verification failed:', jwtError.message);
        console.error('[Auth Middleware] JWT_SECRET used:', JWT_SECRET ? JWT_SECRET.substring(0, 5) + '...' : 'not set');
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
  
  // In a real application, check custom claims or a user document in Firestore
  if (req.user.role === 'admin' || req.user.email?.includes('admin')) {
    next();
  } else {
    res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
  }
}

module.exports = { verifyAuth, requireAdmin };
