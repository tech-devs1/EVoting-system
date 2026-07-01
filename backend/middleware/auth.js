const { admin } = require('../services/firebase');
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

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // In our mock environment, if token starts with MOCK_ we skip actual verification
    if (idToken.startsWith('MOCK_')) {
      req.user = { uid: idToken.replace('MOCK_', ''), email: 'mock@votetrust.ai', role: 'voter' };
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
        console.error('JWT verification failed:', jwtError);
        throw new Error('Invalid token');
      }
    }
  } catch (error) {
    console.error('Error verifying auth token:', error);
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
