const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyAuth, requireAdmin } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many login attempts from this IP. Please try again after 15 minutes.' }
});

// Brute-force protection for the OTP verification / resend / reset flows.
// A 6-digit code has only 1M combinations, so without limiting an attacker
// could guess codes from one IP very quickly.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many verification attempts. Please try again after 15 minutes.' }
});

router.post('/verify-student', authController.verifyStudent);
router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/login-admin', loginLimiter, authController.login);
router.post('/google-login', authController.googleLogin);
router.post('/verify-otp', otpLimiter, authController.verifyOtp);
router.post('/resend-otp', otpLimiter, authController.resendOtp);
router.get('/me', verifyAuth, authController.me);
router.post('/verify-face', verifyAuth, authController.verifyFace);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/reset-password', otpLimiter, authController.resetPassword);
router.post('/change-password', verifyAuth, authController.changePassword);
// Admin-only maintenance/diagnostic endpoints (previously public — they could
// be abused to spam emails/SMS or delete voter rows).
router.delete('/cleanup-incomplete', verifyAuth, requireAdmin, authController.cleanupIncomplete);
router.get('/test-sms', verifyAuth, requireAdmin, authController.testSms);
router.get('/test-email', verifyAuth, requireAdmin, authController.testEmail);

module.exports = router;
