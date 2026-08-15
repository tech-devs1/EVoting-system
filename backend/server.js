const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { syncDatabase } = require('./models');
syncDatabase().catch(err => console.warn('[Database Sync Warning]:', err?.message || err));

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy for cPanel / Phusion Passenger / Cloudflare
app.set('trust proxy', 1);

const { authLimiter, voteLimiter } = require('./middleware/rateLimiter');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── Base & Health Routes (Prevents 404 on /api) ──────────────────────────────

// Handler for root API path
const rootHandler = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'HTU Elect API Gateway is running on cPanel',
    timestamp: new Date()
  });
};

app.get('/api', rootHandler);

// Health check endpoint
const healthHandler = (req, res) => {
  res.status(200).json({ status: 'success', message: 'VoteTrust AI Backend is running', timestamp: new Date() });
};

app.get('/api/health', healthHandler);

// Diagnostic status endpoint
const statusHandler = (req, res) => {
  res.status(200).json({
    status: 'success',
    database: {
      type: 'MySQL/SQLite ORM',
      connected: true
    }
  });
};

app.get('/api/status', statusHandler);

// ─── API Sub-Routes ────────────────────────────────────────────────────────────

const authRoutes = require('./routes/auth');
const electionRoutes = require('./routes/elections');
const candidateRoutes = require('./routes/candidates');
const voteRoutes = require('./routes/votes');
const adminRoutes = require('./routes/admin');
const superadminRoutes = require('./routes/superadmin');
const imagekitRoutes = require('./routes/imagekit');
const tenantRoutes = require('./routes/tenants');

app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/elections', '/elections'], electionRoutes);
app.use(['/api/candidates', '/candidates'], candidateRoutes);
app.use(['/api/votes', '/votes'], voteLimiter, voteRoutes);
app.use(['/api/admin', '/admin'], adminRoutes);
app.use(['/api/superadmin', '/superadmin'], superadminRoutes);
app.use(['/api/imagekit', '/imagekit'], imagekitRoutes);
app.use(['/api/tenants', '/tenants'], tenantRoutes);

// Basic Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});

// ─── Passenger / Server Listener Setup ─────────────────────────────────────────

if (typeof(PhusionPassenger) !== 'undefined') {
  // Bind to Phusion Passenger on cPanel
  app.listen('passenger');
} else if (process.env.VERCEL) {
  // Executing as a Vercel Serverless Function - export app only
} else {
  // Local development / Standalone mode
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
