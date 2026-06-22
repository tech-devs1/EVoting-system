const { admin } = require('../services/firebase');

/**
 * Middleware to verify Firebase ID token and attach user to request
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

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
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
