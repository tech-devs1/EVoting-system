const rateLimit = require('express-rate-limit');

// Limiter for authentication routes (login, register, OTP verification)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 'error',
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  }
});

// Limiter for voting operations (prevent spam ballot casting)
const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 vote requests per minute
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
  max: 100, // Limit each IP to 100 requests per minute
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
