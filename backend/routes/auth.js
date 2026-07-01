const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../services/firebase');
const { verifyAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

// Shared helper: send OTP via EmailJS
async function sendOtpViaEmailJS(email, name, otp) {
  const payload = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    accessToken: process.env.EMAILJS_PRIVATE_KEY,
    template_params: {
      to_name: name || 'Student',
      to_email: email,
      reset_code: otp
    }
  };
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('EmailJS error: ' + err);
  }
}

// Generate and store OTP for a user doc, then email it
async function generateAndSendOtp(userDocRef, email, name) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  await userDocRef.update({ otp, otpExpiry: expiry });
  await sendOtpViaEmailJS(email, name, otp);
  return otp;
}

// Verify student ID and fetch details before registration
router.post('/verify-student', async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ status: 'error', message: 'Student ID is required' });
    }

    const studentDocRef = db.collection('users').doc(studentId);
    const studentDoc = await studentDocRef.get();

    if (!studentDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Student ID not found in school records.' });
    }

    const studentData = studentDoc.data();

    // Case 1: Fully registered (OTP verified) — reject
    if (studentData.isRegistered) {
      return res.status(403).json({ status: 'error', message: 'This student ID has already been registered.' });
    }

    // Case 2: Partial registration (has password but hasn't verified OTP yet)
    if (studentData.password) {
      // Try to send a new OTP so they can complete verification
      try {
        await generateAndSendOtp(studentDocRef, studentData.email, studentData.name);
      } catch (emailErr) {
        console.error('OTP email failed for incomplete registration (user can resend):', emailErr.message || emailErr);
      }
      return res.status(200).json({
        status: 'incomplete_registration',
        data: {
          name: studentData.name,
          email: studentData.email
        },
        message: 'You have an incomplete registration. A verification code has been sent to your email.'
      });
    }

    // Case 3: Fresh student — proceed to registration
    return res.status(200).json({
      status: 'success',
      data: {
        name: studentData.name,
        email: studentData.email
      }
    });
  } catch (error) {
    console.error('Error verifying student:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify student' });
  }
});

// Register a user securely
router.post('/register', async (req, res) => {
  try {
    const { studentId, email, name, password } = req.body;

    if (!studentId || !email || !password) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    // Password validation: minimum 8 chars, 1 uppercase, 1 lowercase, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.' 
      });
    }

    const studentDocRef = db.collection('users').doc(studentId);
    const studentDoc = await studentDocRef.get();

    if (!studentDoc.exists) {
      return res.status(403).json({ status: 'error', message: 'You are not a valid student in this school records.' });
    }

    const studentData = studentDoc.data();
    
    if (studentData.email !== email) {
      return res.status(403).json({ status: 'error', message: 'Email does not match our school records.' });
    }

    if (studentData.isRegistered) {
      return res.status(403).json({ status: 'error', message: 'This student ID has already registered an account to prevent cheating.' });
    }

    // Store credentials but do NOT mark as registered yet; require OTP verification first
    const hashedPassword = await bcrypt.hash(password, 10);

    await studentDocRef.set({
      isRegistered: false,
      password: hashedPassword,
      name: name || studentData.name,
      uid: studentId,
    }, { merge: true });

    // Attempt to send OTP — don't fail the entire registration if email fails
    let otpSent = true;
    try {
      await generateAndSendOtp(studentDocRef, studentData.email, studentData.name);
    } catch (emailErr) {
      console.error('OTP email failed during registration (user can resend):', emailErr.message || emailErr);
      otpSent = false;
    }

    // Always proceed to OTP step — user can use "Resend Code" if email didn't arrive
    res.status(201).json({
      status: 'otp_required',
      email: studentData.email,
      message: otpSent
        ? 'OTP sent to your school email. Please verify.'
        : 'Registration saved. We could not send the verification code right now — please use "Resend Code" on the next screen.'
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ status: 'error', message: 'Failed to register user' });
  }
});

// Login User
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required.' });
    }

    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    
    if (usersSnapshot.empty) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    if (!userData.isRegistered || !userData.password) {
      return res.status(401).json({ status: 'error', message: 'Account not registered. Please sign up first.' });
    }

    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
    }

    // Send OTP — token is issued only after OTP verification
    await generateAndSendOtp(db.collection('users').doc(userDoc.id), userData.email, userData.name);

    res.status(200).json({ status: 'otp_required', email: userData.email, message: 'OTP sent to your school email. Please verify.' });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ status: 'error', message: 'Failed to authenticate user.' });
  }
});

// Verify OTP and issue JWT token
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ status: 'error', message: 'Email and OTP are required.' });
    }

    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    if (usersSnapshot.empty) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    if (!userData.otp || userData.otp !== otp) {
      return res.status(400).json({ status: 'error', message: 'Invalid OTP code.' });
    }

    if (Date.now() > userData.otpExpiry) {
      return res.status(400).json({ status: 'error', message: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP and issue JWT token; mark user as registered
    const userRef = db.collection('users').doc(userDoc.id);
    await userRef.update({ otp: null, otpExpiry: null, isRegistered: true });

    const token = jwt.sign(
      { uid: userDoc.id, email: userData.email, role: userData.role || 'voter', name: userData.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      status: 'success',
      data: { uid: userDoc.id, email: userData.email, role: userData.role || 'voter', name: userData.name },
      token
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify OTP.' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: 'error', message: 'Email is required.' });

    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    if (usersSnapshot.empty) {
      return res.status(200).json({ status: 'success', message: 'If the email exists, a new OTP was sent.' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    await generateAndSendOtp(db.collection('users').doc(userDoc.id), userData.email, userData.name);

    res.status(200).json({ status: 'success', message: 'A new OTP has been sent to your email.' });
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to resend OTP.' });
  }
});

// Get Current User Profile
router.get('/me', verifyAuth, async (req, res) => {
  try {
    // Handle mock tokens (admin login)
    if (req.user.uid.startsWith('admin_')) {
      return res.status(200).json({
        status: 'success',
        data: {
          uid: req.user.uid,
          email: req.user.email || 'admin@htu.edu.gh',
          name: 'System Administrator',
          role: 'admin',
          status: 'active',
          createdAt: Date.now()
        }
      });
    }

    const uid = req.user.uid;
    const doc = await db.collection('users').doc(uid).get();

    if (!doc.exists) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const userData = doc.data();
    delete userData.password; // Don't send password hash back

    res.status(200).json({ status: 'success', data: userData });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch user profile' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: 'error', message: 'Email is required' });

    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    if (usersSnapshot.empty) {
      return res.status(200).json({ status: 'success', message: 'If the email exists, a reset code was sent.' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    // Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

    await db.collection('users').doc(userDoc.id).update({
      resetCode,
      resetCodeExpiry: expiry
    });

    // Send Email via EmailJS API
    const emailJsPayload = {
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      accessToken: process.env.EMAILJS_PRIVATE_KEY,
      template_params: {
        to_name: userData.name || 'Student',
        to_email: email,
        reset_code: resetCode
      }
    };

    const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailJsPayload)
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('EmailJS Error:', errText);
      return res.status(500).json({ status: 'error', message: 'Failed to send reset email' });
    }

    res.status(200).json({ status: 'success', message: 'If the email exists, a reset code was sent.' });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    // Password validation: minimum 8 chars, 1 uppercase, 1 lowercase, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.' 
      });
    }

    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    if (usersSnapshot.empty) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired code.' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    if (userData.resetCode !== code || Date.now() > userData.resetCodeExpiry) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired code.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password and invalidate code
    await db.collection('users').doc(userDoc.id).update({
      password: hashedPassword,
      resetCode: null,
      resetCodeExpiry: null
    });

    res.status(200).json({ status: 'success', message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Error in reset-password:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// Change Password (Authenticated)
router.post('/change-password', verifyAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Current password and new password are required.' });
    }

    // Password validation: minimum 8 chars, 1 uppercase, 1 lowercase, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.' 
      });
    }

    // Handle mock tokens (admin login)
    if (req.user.uid.startsWith('admin_')) {
      return res.status(400).json({ status: 'error', message: 'Admin accounts cannot change password via this endpoint.' });
    }

    const uid = req.user.uid;
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const userData = userDoc.data();

    if (!userData.password) {
      return res.status(400).json({ status: 'error', message: 'No password set for this account.' });
    }

    // Verify current password matches the stored password
    const isMatch = await bcrypt.compare(currentPassword, userData.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Current password is incorrect.' });
    }

    // Check if new password is same as current password
    const isSamePassword = await bcrypt.compare(newPassword, userData.password);
    if (isSamePassword) {
      return res.status(400).json({ status: 'error', message: 'New password cannot be the same as current password.' });
    }

    // Hash and update the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.collection('users').doc(uid).update({ password: hashedPassword });

    res.status(200).json({ status: 'success', message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ status: 'error', message: 'Failed to change password.' });
  }
});

router.delete('/cleanup-incomplete', async (req, res) => {
  try {
    // Find users marked as registered but still have pending OTP (registration not completed)
    const usersSnap = await db.collection('users')
      .where('isRegistered', '==', true)
      .where('otp', '!=', null)
      .get();
    if (usersSnap.empty) {
      return res.status(200).json({ status: 'success', message: 'No incomplete registrations found.' });
    }
    const batch = db.batch();
    usersSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    return res.status(200).json({ status: 'success', message: `${usersSnap.size} incomplete registrations deleted.` });
  } catch (error) {
    console.error('Error cleaning up incomplete registrations:', error);
    res.status(500).json({ status: 'error', message: 'Failed to clean up registrations' });
  }
});

module.exports = router;
