const { admin } = require('../services/firebase');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

// Security Check: Warn if default secret is used in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('[AUTH WARNING] JWT_SECRET is not explicitly set in production environment!');
}

/**
 * Middleware to verify Firebase ID token or JWT token and attach user to request
 */
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: Malformed token header' });
  }

  try {
    // 1. Mock Token Handler (STRICTLY ALLOWED IN DEVELOPMENT/TEST ONLY)
    if (token.startsWith('MOCK_')) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Mock authentication disabled in production' });
      }

      const uid = token.replace('MOCK_', '');
      const role = uid.startsWith('admin_') ? 'admin' : 'voter';
      req.user = { 
        uid, 
        email: role === 'admin' ? 'admin@htu.edu.gh' : 'mock@votetrust.ai', 
        role 
      };
      return next();
    }

    // 2. Try verifying as standard Custom JWT first (Faster CPU check)
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (jwtErr) {
      // If JWT verification fails (e.g. wrong secret or expired), attempt Firebase ID Token verification
    }

    // 3. Try verifying as Firebase ID Token
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      return next();
    } catch (firebaseErr) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Invalid or expired token' });
    }

  } catch (error) {
    console.error('[Auth Middleware] Authentication error:', error.message);
    return res.status(500).json({ status: 'error', message: 'Internal server authentication error' });
  }
}

/**
 * Middleware to restrict access to admin users only
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: User not authenticated' });
  }

  // Check role claim or admin email pattern
  const isAdmin = req.user.role === 'admin' || (req.user.email && req.user.email.toLowerCase().includes('admin'));

  if (isAdmin) {
    return next();
  }

  return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
}

module.exports = { verifyAuth, requireAdmin };