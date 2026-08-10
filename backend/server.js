const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { migrateDefaultTenant } = require('./services/migrateDefaultTenant');
migrateDefaultTenant().catch(err => console.warn('[Migration Warning]:', err?.message || err));

const app = express();
const PORT = process.env.PORT || 5000;

// Trust Railway/Vercel reverse proxy so rate limiters use real client IPs
app.set('trust proxy', 1);

const { authLimiter, voteLimiter } = require('./middleware/rateLimiter');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/elections', require('./routes/elections'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/votes', voteLimiter, require('./routes/votes'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/imagekit', require('./routes/imagekit'));
app.use('/api/tenants', require('./routes/tenants'));

// Root landing page for backend server on Railway
app.get('/', (req, res) => {
  const { isMySQLConnected } = require('./services/mysql');
  const dbConnected = isMySQLConnected();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HTU Elect API Gateway</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1.5rem; box-sizing: border-box; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 2.5rem; max-width: 500px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); text-align: center; }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; margin-bottom: 1.5rem; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
        .pulse { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 10px #4ade80; }
        h1 { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.5rem 0; letter-spacing: -0.02em; }
        p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin: 0 0 1.5rem 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; text-align: left; margin-bottom: 1.5rem; }
        .stat { background: #0f172a; padding: 0.85rem; border-radius: 10px; border: 1px solid #334155; }
        .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; display: block; margin-bottom: 2px; }
        .stat-val { font-size: 0.9rem; font-weight: 700; color: #e2e8f0; }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 0.75rem 1rem; border-radius: 10px; font-size: 0.9rem; font-weight: 600; text-decoration: none; background: #2563eb; color: #ffffff; transition: background 0.2s; box-sizing: border-box; }
        .btn:hover { background: #1d4ed8; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge"><div class="pulse"></div> API Gateway Operational</div>
        <h1>HTU Elect Backend Service</h1>
        <p>Production API Server powered by Node.js, Express & MySQL on Railway.</p>
        <div class="grid">
          <div class="stat">
            <span class="stat-label">Database</span>
            <span class="stat-val">${dbConnected ? '🐬 MySQL Active' : '⚡ In-Memory/Mock'}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Server Time</span>
            <span class="stat-val">${new Date().toISOString().substring(11, 19)} UTC</span>
          </div>
        </div>
        <a href="/api/status" class="btn">View API Diagnostics JSON ➔</a>
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'VoteTrust AI Backend is running', timestamp: new Date() });
});

// Diagnostic status endpoint to debug environment & database status directly
app.get('/api/status', (req, res) => {
  const { isMySQLConnected } = require('./services/mysql');
  const hasMysqlUrl = !!(process.env.MYSQL_URL || process.env.DATABASE_URL);
  const hasMysqlHost = !!process.env.MYSQL_HOST;

  res.status(200).json({
    status: 'success',
    database: {
      type: hasMysqlUrl || hasMysqlHost ? 'MySQL' : 'Firestore/Mock',
      mysqlConnected: isMySQLConnected(),
      hasMysqlUrl,
      hasMysqlHost
    },
    env: {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'not-set',
      NODE_ENV: process.env.NODE_ENV || 'not-set'
    }
  });
});

// Basic Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});

if (require.main === module || process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
 
