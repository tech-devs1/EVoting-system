const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/elections', require('./routes/elections'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/votes', require('./routes/votes'));
app.use('/api/admin', require('./routes/admin'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'VoteTrust AI Backend is running', timestamp: new Date() });
});

// Diagnostic status endpoint to debug Vercel environment variables directly
app.get('/api/status', (req, res) => {
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
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
 
