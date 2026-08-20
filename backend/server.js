const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

try {
  const { migrateDefaultTenant } = require('./services/migrateDefaultTenant');
  migrateDefaultTenant().catch(err => console.warn('[Migration] Warning during startup migration:', err.message));
} catch (migErr) {
  console.warn('[Migration] Could not initiate startup migration:', migErr.message);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const authRouter = require('./routes/auth');
const electionsRouter = require('./routes/elections');
const candidatesRouter = require('./routes/candidates');
const votesRouter = require('./routes/votes');
const adminRouter = require('./routes/admin');
const superadminRouter = require('./routes/superadmin');
const imagekitRouter = require('./routes/imagekit');

// Support both /api/* and /* for maximum compatibility across Vercel and local dev
app.use(['/api/auth', '/auth'], authRouter);
app.use(['/api/elections', '/elections'], electionsRouter);
app.use(['/api/candidates', '/candidates'], candidatesRouter);
app.use(['/api/votes', '/votes'], votesRouter);
app.use(['/api/admin', '/admin'], adminRouter);
app.use(['/api/superadmin', '/superadmin'], superadminRouter);
app.use(['/api/imagekit', '/imagekit'], imagekitRouter);

// Health check endpoint (support both /api/health and /health)
app.get(['/api/health', '/health'], (req, res) => {
  res.status(200).json({ status: 'success', message: 'VoteTrust AI Backend is running', timestamp: new Date() });
});

// Diagnostic status endpoint to debug Vercel environment variables directly
app.get(['/api/status', '/status'], (req, res) => {
  const hasProjId = !!process.env.FIREBASE_PROJECT_ID;
  const hasEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
  const hasKey = !!process.env.FIREBASE_PRIVATE_KEY;
  
  res.status(200).json({
    status: 'success',
    env: {
      FIREBASE_PROJECT_ID: hasProjId ? process.env.FIREBASE_PROJECT_ID : 'MISSING',
      FIREBASE_CLIENT_EMAIL: hasEmail ? process.env.FIREBASE_CLIENT_EMAIL : 'MISSING',
      FIREBASE_PRIVATE_KEY_EXISTS: hasKey,
      FIREBASE_PRIVATE_KEY_LENGTH: hasKey ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
      NODE_ENV: process.env.NODE_ENV || 'not-set'
    }
  });
});

// Basic Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({ status: 'error', message: err.message || 'Internal Server Error' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
 
