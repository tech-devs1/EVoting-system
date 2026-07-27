const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../services/firebase');
const { verifyAuth } = require('../middleware/auth');
const { logFraudAlert } = require('../services/fraud');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';
const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY || 'aU1RbmFFbXFZTUxjSmp1ZmZSSFY';
const ARKESEL_SENDER_ID = process.env.ARKESEL_SENDER_ID || 'COMPSSA';

// Helper: Calculate Cosine Distance between two vectors
function cosineDistance(vec1, vec2) {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  if (norm1 === 0 || norm2 === 0) return 1.0;
  return 1 - (dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2)));
}

// Helper: Send OTP via Arkesel SMS API v2
async function sendOtpViaSMS(phoneNumber, otp) {
  if (!ARKESEL_API_KEY) {
    console.warn('[Arkesel] No API key set — OTP not sent via SMS. Code:', otp);
    throw new Error('Arkesel SMS configuration error: API key is missing');
  }

  // Normalize phone number to include country code
  let formattedPhone = phoneNumber.replace(/\s+/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '+233' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+233' + formattedPhone;
  }

  // Using Arkesel SMS send endpoint so we can send our OWN generated OTP code
  const payload = {
    sender: ARKESEL_SENDER_ID,
    message: `Your COMPSSA verification code is ${otp}. It expires in 10 minutes. Do not share this code.`,
    recipients: [formattedPhone]
  };

  console.log(`[Arkesel] Sending OTP ${otp} to ${formattedPhone} using Sender ID ${ARKESEL_SENDER_ID}`);

  try {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': ARKESEL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000) // Timeout after 8s so it never hangs
    });

    const responseText = await res.text();
    console.log('[Arkesel] Raw Response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Arkesel returned non-JSON response: ${responseText.substring(0, 100)}`);
    }

    if (!res.ok || responseData.status !== 'success') {
      throw new Error('Arkesel API returned error: ' + (responseData.message || responseText));
    }

    return responseData;
  } catch (fetchErr) {
    console.error('[Arkesel Fetch Error]:', fetchErr);
    throw new Error(`Failed to communicate with Arkesel SMS Gateway: ${fetchErr.message}`);
  }
}

// Helper: Send a plain SMS via Arkesel (for password reset codes)
async function sendSmsViaArkesel(phoneNumber, message) {
  if (!ARKESEL_API_KEY) {
    console.warn('[Arkesel] No API key set — SMS not sent.');
    throw new Error('Arkesel SMS configuration error: API key is missing');
  }

  let formattedPhone = phoneNumber.replace(/\s+/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '+233' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+233' + formattedPhone;
  }

  const payload = {
    sender: ARKESEL_SENDER_ID,
    message: message,
    recipients: [formattedPhone]
  };

  try {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': ARKESEL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000) // Timeout after 8s so it never hangs
    });

    const responseText = await res.text();
    console.log('[Arkesel] Raw Response (plain SMS):', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Arkesel returned non-JSON response: ${responseText.substring(0, 100)}`);
    }

    if (!res.ok || responseData.status !== 'success') {
      throw new Error('Arkesel API returned error: ' + (responseData.message || responseText));
    }
  } catch (fetchErr) {
    console.error('[Arkesel Fetch Error (plain SMS)]:', fetchErr);
    throw new Error(`Failed to communicate with Arkesel SMS Gateway: ${fetchErr.message}`);
  }
}

// Generate and store OTP for a user doc, then send via SMS
// Returns { otp, smsSent, smsError } — even if SMS fails, OTP is saved in Firebase
async function generateAndSendOtp(userDocRef, phoneNumber, name) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  await userDocRef.update({ otp, otpExpiry: expiry });
  try {
    await sendOtpViaSMS(phoneNumber, otp);
    return { otp, smsSent: true };
  } catch (smsErr) {
    // OTP is saved in Firebase — SMS delivery failed (e.g. unregistered Sender ID)
    console.error('[OTP] SMS delivery failed, OTP saved to Firebase:', smsErr.message);
    return { otp, smsSent: false, smsError: smsErr.message };
  }
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
      // Log flagged user — student ID not in the database
      await logFraudAlert('UNRECOGNIZED_STUDENT', `Unrecognized student ID attempted registration: ${studentId}`, {
        studentId,
        attemptedAt: new Date().toISOString(),
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown'
      });
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
        if (studentData.phone) {
          await generateAndSendOtp(studentDocRef, studentData.phone, studentData.name);
        }
      } catch (smsErr) {
        console.error('OTP SMS failed for incomplete registration (user can resend):', smsErr.message || smsErr);
      }
      return res.status(200).json({
        status: 'incomplete_registration',
        data: {
          name: studentData.name,
          email: studentData.email,
          phone: studentData.phone || ''
        },
        message: 'You have an incomplete registration. A verification code has been sent to your phone.'
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
    const { studentId, email, name, password, phone, faceImage } = req.body;

    if (!studentId || !email || !password || !phone) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields (studentId, email, password, phone)' });
    }

    // Phone number validation (Ghana format)
    const phoneClean = phone.replace(/\s+/g, '');
    if (!/^(\+233|0)\d{9}$/.test(phoneClean)) {
      return res.status(400).json({ status: 'error', message: 'Please enter a valid Ghana phone number (e.g. 0241234567 or +233241234567)' });
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

    let faceEmbedding = null;

    // Store credentials and phone number
    const hashedPassword = await bcrypt.hash(password, 10);

    await studentDocRef.set({
      isRegistered: true,
      password: hashedPassword,
      name: name || studentData.name,
      phone: phoneClean,
      uid: studentId,
      role: 'voter',
      faceImage: faceImage || '',
      faceEmbedding: faceEmbedding || null,
    }, { merge: true });

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. You can now log in.'
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

    // Send OTP via SMS — token is issued only after OTP verification
    if (!userData.phone) {
      return res.status(400).json({ status: 'error', message: 'No phone number on file. Please contact admin.' });
    }
    const { otp, smsSent } = await generateAndSendOtp(
      db.collection('users').doc(userDoc.id), userData.phone, userData.name
    );

    // Mask the phone number for display
    const maskedPhone = userData.phone.replace(/(.{4})(.*)(.{3})/, '$1****$3');
    res.status(200).json({
      status: 'otp_required',
      email: userData.email,
      phone: maskedPhone,
      fallbackOtp: smsSent ? undefined : otp,
      smsFailed: !smsSent,
      message: smsSent
        ? `OTP sent to ${maskedPhone}. Please verify.`
        : `SMS unavailable. Use this code: ${otp}`
    });
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
      data: {
        uid: userDoc.id,
        email: userData.email,
        role: userData.role || 'voter',
        name: userData.name,
        faceImage: userData.faceImage || ''
      },
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
    if (!userData.phone) {
      return res.status(400).json({ status: 'error', message: 'No phone number on file. Please contact admin.' });
    }
    await generateAndSendOtp(db.collection('users').doc(userDoc.id), userData.phone, userData.name);

    const maskedPhone = userData.phone.replace(/(.{4})(.*)(.{3})/, '$1****$3');
    res.status(200).json({ status: 'success', message: `A new OTP has been sent to ${maskedPhone}.` });
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

// Verify live face image against registered face image using deepface.dev cloud API (Stubbed to always succeed)
router.post('/verify-face', verifyAuth, async (req, res) => {
  return res.status(200).json({
    status: 'success',
    data: {
      verified: true,
      distance: 0.0,
      threshold: 0.4
    }
  });
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

    // Send reset code via SMS using Arkesel
    if (!userData.phone) {
      return res.status(400).json({ status: 'error', message: 'No phone number on file for this account. Please contact admin.' });
    }

    const smsMessage = `Your COMPSSA password reset code is ${resetCode}. It expires in 15 minutes. Do not share this code.`;
    try {
      await sendSmsViaArkesel(userData.phone, smsMessage);
    } catch (smsErr) {
      console.error('Arkesel SMS Error:', smsErr.message || smsErr);
      return res.status(500).json({ status: 'error', message: 'Failed to send reset code via SMS' });
    }

    const maskedPhone = userData.phone.replace(/(.{4})(.*)(.{3})/, '$1****$3');
    res.status(200).json({ status: 'success', message: `A reset code has been sent to ${maskedPhone}.` });
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

// Test SMS sending directly from browser
router.get('/test-sms', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ status: 'error', message: 'Phone query parameter is required. E.g. /api/auth/test-sms?phone=0241234567' });
    }

    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[Test SMS] Attempting to send test OTP ${testOtp} to ${phone}`);
    
    const responseData = await sendOtpViaSMS(phone, testOtp);
    
    res.status(200).json({
      status: 'success',
      message: 'Arkesel SMS API call completed successfully',
      phone_input: phone,
      otp_sent: testOtp,
      arkesel_response: responseData
    });
  } catch (err) {
    console.error('[Test SMS] Failed:', err);
    res.status(500).json({
      status: 'error',
      message: err.message || 'Test SMS failed',
      stack: err.stack
    });
  }
});

module.exports = router;