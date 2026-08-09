const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { migrateDefaultTenant } = require('./services/migrateDefaultTenant');
migrateDefaultTenant().catch(err => console.warn('[Migration Warning]:', err?.message || err));

const app = express();
const PORT = process.env.PORT || 5000;

const { authLimiter, voteLimiter } = require('./middleware/rateLimiter');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/elections', require('./routes/elections'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/votes', voteLimiter, require('./routes/votes'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/imagekit', require('./routes/imagekit'));
app.use('/api/tenants', require('./routes/tenants'));

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
 
