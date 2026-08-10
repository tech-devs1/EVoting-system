const rateLimit = require('express-rate-limit');

// Limiter for authentication routes (login, register, OTP verification)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // High capacity for shared campus NATs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many authentication attempts. Please wait a moment and try again.'
  }
});

// Limiter for voting operations (high throughput concurrent ballot casting)
const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5000, // High capacity for 1,000+ concurrent voters on campus Wi-Fi
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'High voting request rate detected. Please wait a few seconds before trying again.'
  }
});

// General limiter for general API queries
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10000, // High capacity for general API endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests. Please slow down.'
  }
});

module.exports = {
  authLimiter,
  voteLimiter,
  generalLimiter
};
