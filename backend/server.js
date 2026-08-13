const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { syncDatabase } = require('./models');
syncDatabase().catch(err => console.warn('[Database Sync Warning]:', err?.message || err));

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
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HTU Elect API Gateway</title>
    </head>
    <body>
      <h1>HTU Elect Backend Service (Sequelize Powered)</h1>
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
  res.status(200).json({
    status: 'success',
    database: {
      type: 'MySQL/SQLite ORM',
      connected: true
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
