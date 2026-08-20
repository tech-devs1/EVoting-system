const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load the monorepo root .env first (lower priority), then the backend/.env / cwd .env.
// Root .env is a dev convenience (e.g. SMTP_* credentials); backend/.env wins on conflicts.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const { syncDatabase, Election } = require('./models');
const cache = require('./services/cache');

syncDatabase().catch(err => console.warn('[Database Sync Warning]:', err?.message || err));

// Background Scheduler: Periodically check and update election statuses (every 30s)
function runElectionScheduler() {
  setInterval(async () => {
    try {
      const now = Date.now();
      const elections = await Election.findAll();
      let updatedAny = false;

      for (const election of elections) {
        const startTime = election.startDate ? new Date(election.startDate).getTime() : 0;
        const endTime = election.endDate ? new Date(election.endDate).getTime() : Infinity;

        let targetStatus = election.status;

        if (election.status === 'draft') {
          // Draft elections with dates set: auto-transition to scheduled when startDate is set
          if (election.startDate && election.endDate) {
            if (now < startTime) {
              targetStatus = 'scheduled';
            } else if (now >= startTime && now <= endTime) {
              targetStatus = 'active';
            }
          }
        } else if (now < startTime) {
          targetStatus = 'scheduled';
        } else if (now >= startTime && now <= endTime) {
          targetStatus = 'active';
        } else {
          targetStatus = 'completed';
        }

        if (election.status !== targetStatus) {
          await election.update({ status: targetStatus });
          updatedAny = true;
          console.log(`[Election Scheduler] Auto-updated election "${election.title}" (${election.id}) status to "${targetStatus}".`);
        }
      }

      if (updatedAny) {
        cache.invalidatePrefix('elections:');
        cache.invalidatePrefix('admin:');
      }
    } catch (err) {
      console.error('[Election Scheduler Error]:', err.message);
    }
  }, 30000);
}

runElectionScheduler();

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
