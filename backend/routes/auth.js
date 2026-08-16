const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many login attempts from this IP. Please try again after 15 minutes.' }
});

router.post('/verify-student', authController.verifyStudent);
router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/login-admin', loginLimiter, authController.login);
router.post('/google-login', authController.googleLogin);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.get('/me', verifyAuth, authController.me);
router.post('/verify-face', verifyAuth, authController.verifyFace);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/change-password', verifyAuth, authController.changePassword);
router.delete('/cleanup-incomplete', authController.cleanupIncomplete);
router.get('/test-sms', authController.testSms);
router.get('/test-email', authController.testEmail);

module.exports = router;
