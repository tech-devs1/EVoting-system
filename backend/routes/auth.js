const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, DEFAULT_TENANT_ID } = require('../services/firebase');

const getTenantId = (req) => req.headers['x-tenant-id'] || req.query.tenantId || req.body.tenantId || DEFAULT_TENANT_ID;
const { verifyAuth } = require('../middleware/auth');
const { logFraudAlert } = require('../services/fraud');
const { logActivity } = require('../services/activityLog');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';
const BMS_API_KEY = process.env.BMS_API_KEY || process.env.MNOTIFY_API_KEY || '';
const BMS_SENDER_ID = process.env.BMS_SENDER_ID || 'COMPSSA';

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

// Helper: Send OTP via EmailJS REST API
async function sendOtpViaEmailJS(email, name, otp) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn('[EmailJS Warning] Missing EmailJS env variables (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY). Code for', email, 'is:', otp);
    return;
  }

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    accessToken: privateKey,
    template_params: {
      to_name: name || 'Student',
      to_email: email,
      reset_code: otp,
      otp_code: otp,
      otp: otp
    }
  };

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[EmailJS Error]:', errText);
      throw new Error('EmailJS error: ' + errText);
    }
  } catch (err) {
    console.error('[EmailJS Failure]:', err.message || err);
    throw err;
  }
}

// Helper: Send OTP via BMS Africa (mNotify) Quick SMS API
async function sendOtpViaBMS(phoneNumber, otp) {
  if (!BMS_API_KEY) {
    console.warn('[BMS SMS Warning] No BMS_API_KEY configured — SMS not dispatched. Code for', phoneNumber, 'is:', otp);
    return;
  }

  let formattedPhone = phoneNumber.replace(/\s+/g, '');
  if (formattedPhone.startsWith('+233')) {
    formattedPhone = '0' + formattedPhone.substring(4);
  } else if (!formattedPhone.startsWith('0') && formattedPhone.length === 9) {
    formattedPhone = '0' + formattedPhone;
  }

  const payload = {
    recipient: [formattedPhone],
    sender: BMS_SENDER_ID,
    message: `Your COMPSSA verification code is ${otp}. It expires in 10 minutes. Do not share this code.`,
    is_schedule: false
  };

  console.log(`[BMS SMS] Dispatching OTP ${otp} to ${formattedPhone} via BMS Africa (Sender ID: ${BMS_SENDER_ID})`);

  try {
    const res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${BMS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });

    const responseText = await res.text();
    console.log('[BMS SMS] Response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`BMS API returned non-JSON response: ${responseText.substring(0, 100)}`);
    }

    if (!res.ok || (responseData.status !== 'success' && responseData.code !== '2000' && responseData.status !== 2000)) {
      throw new Error('BMS API returned error: ' + (responseData.message || responseText));
    }

    return responseData;
  } catch (err) {
    console.error('[BMS SMS Error]:', err.message || err);
    throw err;
  }
}

// Generate and store OTP for a user doc, then send via EmailJS and BMS SMS (dual channel)
// Returns { otp, emailSent, smsSent } — even if delivery fails, OTP is saved in Firebase
async function generateAndSendOtp(userDocRef, email, name, phoneNumber = null) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  await userDocRef.update({ otp, otpExpiry: expiry });

  let emailSent = false;
  let smsSent = false;

  // 1. Send via EmailJS
  try {
    if (email) {
      await sendOtpViaEmailJS(email, name, otp);
      emailSent = true;
    }
  } catch (emailErr) {
    console.error('[OTP] Email delivery failed:', emailErr.message || emailErr);
  }

  // 2. Send via BMS Africa SMS (if phone number is provided)
  if (phoneNumber) {
    try {
      await sendOtpViaBMS(phoneNumber, otp);
      smsSent = true;
    } catch (smsErr) {
      console.error('[OTP] BMS SMS delivery failed:', smsErr.message || smsErr);
    }
  }

  return { otp, emailSent, smsSent };
}

// Public: list active departments for registration/login dropdown
router.get('/departments', async (req, res) => {
  try {
    const snapshot = await db.collection('tenants').where('status', '==', 'active').get();
    const departments = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      departments.push({ id: doc.id, name: data.name });
    });
    res.status(200).json({ status: 'success', data: departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch departments' });
  }
});

// Verify student ID and fetch details before registration
router.post('/verify-student', async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ status: 'error', message: 'Student ID is required' });
    }

    const studentDocRef = db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').doc(studentId);
    const studentDoc = await studentDocRef.get();

    if (!studentDoc.exists) {
      // Log flagged user — student ID not in the database
      await logFraudAlert('UNRECOGNIZED_STUDENT', `Unrecognized student ID attempted registration: ${studentId}`, {
        studentId,
        attemptedAt: new Date().toISOString(),
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        tenantId: getTenantId(req)
      }, getTenantId(req));
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
        await generateAndSendOtp(studentDocRef, studentData.email, studentData.name, studentData.phone || null);
      } catch (otpErr) {
        console.error('OTP delivery failed for incomplete registration (user can resend):', otpErr.message || otpErr);
      }
      return res.status(200).json({
        status: 'incomplete_registration',
        data: {
          name: studentData.name,
          email: studentData.email,
          phone: studentData.phone || ''
        },
        message: 'You have an incomplete registration. A verification code has been sent to your email.'
      });
    }

    // Case 3: Fresh student — proceed to registration
    return res.status(200).json({
      status: 'success',
      data: {
        name: studentData.name,
        email: studentData.email,
        hasPhone: !!(studentData.phone)
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

    if (!studentId || !email || !password) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields (studentId, email, password)' });
    }

    let phoneClean = null;
    if (phone) {
      phoneClean = phone.replace(/\s+/g, '');
    }

    // Password validation: minimum 8 chars, 1 uppercase, 1 lowercase, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.' 
      });
    }

    const studentDocRef = db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').doc(studentId);
    const studentDoc = await studentDocRef.get();

    if (!studentDoc.exists) {
      return res.status(403).json({ status: 'error', message: 'You are not a valid student in this school records.' });
    }

    const studentData = studentDoc.data();
    
    if (studentData.email !== email) {
      return res.status(403).json({ status: 'error', message: 'Email does not match our school records.' });
    }

    // Phone verification: if the CSV record has a phone on file, the student's input must match
    if (studentData.phone) {
      const normalize = (p) => p.replace(/[\s\-().+]/g, '');
      const recordPhone = normalize(studentData.phone);
      const inputPhone  = phone ? normalize(phone) : '';

      // Also allow matching with leading country code (e.g., 233 prefix vs 0 prefix)
      const toLocal = (p) => p.replace(/^233/, '0');

      if (!inputPhone) {
        return res.status(400).json({ status: 'error', message: 'A phone number is required for registration. Please provide your registered phone number.' });
      }
      if (toLocal(recordPhone) !== toLocal(inputPhone)) {
        return res.status(403).json({ status: 'error', message: 'The phone number provided does not match the one on school records. Please use the phone number registered with the school.' });
      }
    }

    if (studentData.isRegistered) {
      return res.status(403).json({ status: 'error', message: 'This student ID has already registered an account to prevent cheating.' });
    }

    let faceEmbedding = null;

    // Store credentials
    const hashedPassword = await bcrypt.hash(password, 10);

    await studentDocRef.set({
      isRegistered: true,
      password: hashedPassword,
      name: name || studentData.name,
      phone: phoneClean || studentData.phone || '',
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

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required.' });
    }

    // 1. Check COMPSSA (default_tenant) legacy fallback admin
    if (email === 'admin@htu.edu.gh') {
      if (password === 'admin080') {
        const uid = `admin_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const token = jwt.sign(
          { uid, email, role: 'admin', name: 'COMPSSA Administrator', tenantId: DEFAULT_TENANT_ID },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        await logActivity({
          tenantId: DEFAULT_TENANT_ID,
          tenantName: 'COMPSSA',
          actorEmail: email,
          actorRole: 'admin',
          action: 'ADMIN_LOGIN',
          description: 'COMPSSA Administrator logged into the admin dashboard',
          ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
          status: 'success'
        });
        return res.status(200).json({
          status: 'success',
          data: { uid, email, role: 'admin', name: 'COMPSSA Administrator', tenantId: DEFAULT_TENANT_ID },
          token
        });
      } else {
        return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
      }
    }

    // 2. Check other tenants for department admin
    const tenantsSnapshot = await db.collection('tenants').where('adminEmail', '==', email).get();
    if (!tenantsSnapshot.empty) {
      const tenantDoc = tenantsSnapshot.docs[0];
      const tenantData = tenantDoc.data();

      if (tenantData.adminPassword) {
        const isMatch = await bcrypt.compare(password, tenantData.adminPassword);
        if (isMatch) {
          const uid = `admin_${tenantDoc.id}`;
          const token = jwt.sign(
            { uid, email, role: 'admin', name: `${tenantData.name} Administrator`, tenantId: tenantDoc.id },
            JWT_SECRET,
            { expiresIn: '24h' }
          );
          await logActivity({
            tenantId: tenantDoc.id,
            tenantName: tenantData.name,
            actorEmail: email,
            actorRole: 'admin',
            action: 'ADMIN_LOGIN',
            description: `${tenantData.name} Administrator logged into the admin dashboard`,
            ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
            status: 'success'
          });
          return res.status(200).json({
            status: 'success',
            data: { uid, email, role: 'admin', name: `${tenantData.name} Administrator`, tenantId: tenantDoc.id },
            token
          });
        }
      }
      return res.status(401).json({ status: 'error', message: 'Invalid administrator credentials.' });
    }

    // 2b. Check secondary admins across all tenants
    const allTenantsForAdminCheck = await db.collection('tenants').get();
    for (const tDoc of allTenantsForAdminCheck.docs) {
      const tData = tDoc.data();
      if (tData.admins && Array.isArray(tData.admins)) {
        const matchedAdmin = tData.admins.find(a => a.email === email);
        if (matchedAdmin) {
          const isAdminMatch = await bcrypt.compare(password, matchedAdmin.passwordHash);
          if (isAdminMatch) {
            const uid = `admin_${tDoc.id}_${matchedAdmin.id}`;
            const token = jwt.sign(
              { uid, email, role: 'admin', name: matchedAdmin.name || `${tData.name} Admin`, tenantId: tDoc.id },
              JWT_SECRET,
              { expiresIn: '24h' }
            );
            await logActivity({
              tenantId: tDoc.id,
              tenantName: tData.name,
              actorEmail: email,
              actorRole: 'admin',
              action: 'ADMIN_LOGIN',
              description: `${matchedAdmin.name || 'Admin'} logged into the ${tData.name} admin dashboard`,
              ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
              status: 'success'
            });
            return res.status(200).json({
              status: 'success',
              data: { uid, email, role: 'admin', name: matchedAdmin.name || `${tData.name} Admin`, tenantId: tDoc.id },
              token
            });
          }
          return res.status(401).json({ status: 'error', message: 'Invalid administrator credentials.' });
        }
      }
    }

    // 3. Iterate through all tenants to find the voter
    const allTenantsSnapshot = await db.collection('tenants').get();
    let foundVoterDoc = null;
    let foundTenantId = null;

    for (const tenantDoc of allTenantsSnapshot.docs) {
      const usersSnapshot = await db.collection('tenants').doc(tenantDoc.id).collection('voter_rolls').where('email', '==', email).get();
      if (!usersSnapshot.empty) {
        foundVoterDoc = usersSnapshot.docs[0];
        foundTenantId = tenantDoc.id;
        break;
      }
    }
    
    if (!foundVoterDoc) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password. You may not be registered in any department.' });
    }

    const userData = foundVoterDoc.data();

    if (!userData.isRegistered || !userData.password) {
      return res.status(401).json({ status: 'error', message: 'Account not registered. Please sign up first.' });
    }

    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
    }

    // BYPASS OTP: Instantly issue JWT token and log user in
    const token = jwt.sign(
      { uid: foundVoterDoc.id, email: userData.email, role: userData.role || 'voter', name: userData.name, tenantId: foundTenantId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log successful voter login
    await logActivity({
      tenantId: foundTenantId,
      actorEmail: userData.email,
      actorRole: 'voter',
      action: 'VOTER_LOGIN',
      description: `Voter ${userData.name || userData.email} logged in successfully`,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      status: 'success'
    });

    res.status(200).json({
      status: 'success',
      data: {
        uid: foundVoterDoc.id,
        email: userData.email,
        role: userData.role || 'voter',
        name: userData.name,
        tenantId: foundTenantId,
        faceImage: userData.faceImage || ''
      },
      token
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ status: 'error', message: 'Failed to authenticate user.' });
  }
});

// Admin Login
router.post('/login-admin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required.' });
    }

    // COMPSSA (default_tenant) legacy fallback
    if (email === 'admin@htu.edu.gh' && password === 'admin080') {
      const uid = `admin_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const token = jwt.sign(
        { uid, email, role: 'admin', name: 'COMPSSA Administrator', tenantId: DEFAULT_TENANT_ID },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      await logActivity({
        tenantId: DEFAULT_TENANT_ID,
        tenantName: 'COMPSSA',
        actorEmail: email,
        actorRole: 'admin',
        action: 'ADMIN_LOGIN',
        description: 'COMPSSA Administrator logged into the admin dashboard',
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        status: 'success'
      });
      return res.status(200).json({
        status: 'success',
        data: { uid, email, role: 'admin', name: 'COMPSSA Administrator', tenantId: DEFAULT_TENANT_ID },
        token
      });
    }

    // Check other tenants for department admin (primary)
    const tenantsSnapshot = await db.collection('tenants').where('adminEmail', '==', email).get();
    if (!tenantsSnapshot.empty) {
      const tenantDoc = tenantsSnapshot.docs[0];
      const tenantData = tenantDoc.data();

      if (tenantData.adminPassword) {
        const isMatch = await bcrypt.compare(password, tenantData.adminPassword);
        if (isMatch) {
          const uid = `admin_${tenantDoc.id}`;
          const token = jwt.sign(
            { uid, email, role: 'admin', name: `${tenantData.name} Administrator`, tenantId: tenantDoc.id },
            JWT_SECRET,
            { expiresIn: '24h' }
          );
          await logActivity({
            tenantId: tenantDoc.id,
            tenantName: tenantData.name,
            actorEmail: email,
            actorRole: 'admin',
            action: 'ADMIN_LOGIN',
            description: `${tenantData.name} Administrator logged into the admin dashboard`,
            ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
            status: 'success'
          });
          return res.status(200).json({
            status: 'success',
            data: { uid, email, role: 'admin', name: `${tenantData.name} Administrator`, tenantId: tenantDoc.id },
            token
          });
        }
      }
      return res.status(401).json({ status: 'error', message: 'Invalid administrator credentials.' });
    }

    // Check secondary admins across all tenants
    const allTenantsForAdmin = await db.collection('tenants').get();
    for (const tDoc of allTenantsForAdmin.docs) {
      const tData = tDoc.data();
      if (tData.admins && Array.isArray(tData.admins)) {
        const matchedAdmin = tData.admins.find(a => a.email === email);
        if (matchedAdmin) {
          const isAdminMatch = await bcrypt.compare(password, matchedAdmin.passwordHash);
          if (isAdminMatch) {
            const uid = `admin_${tDoc.id}_${matchedAdmin.id}`;
            const token = jwt.sign(
              { uid, email, role: 'admin', name: matchedAdmin.name || `${tData.name} Admin`, tenantId: tDoc.id },
              JWT_SECRET,
              { expiresIn: '24h' }
            );
            await logActivity({
              tenantId: tDoc.id,
              tenantName: tData.name,
              actorEmail: email,
              actorRole: 'admin',
              action: 'ADMIN_LOGIN',
              description: `${matchedAdmin.name || 'Admin'} logged into the ${tData.name} admin dashboard`,
              ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
              status: 'success'
            });
            return res.status(200).json({
              status: 'success',
              data: { uid, email, role: 'admin', name: matchedAdmin.name || `${tData.name} Admin`, tenantId: tDoc.id },
              token
            });
          }
          return res.status(401).json({ status: 'error', message: 'Invalid administrator credentials.' });
        }
      }
    }

    return res.status(401).json({ status: 'error', message: 'Invalid administrator credentials.' });
  } catch (error) {
    console.error('Error logging in admin:', error);
    res.status(500).json({ status: 'error', message: 'Failed to authenticate admin.' });
  }
});

// Verify OTP and issue JWT token
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ status: 'error', message: 'Email and OTP are required.' });
    }

    const usersSnapshot = await db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').where('email', '==', email).get();
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
    const userRef = db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').doc(userDoc.id);
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

    const usersSnapshot = await db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').where('email', '==', email).get();
    if (usersSnapshot.empty) {
      return res.status(200).json({ status: 'success', message: 'If the email exists, a new OTP was sent.' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    const { otp, emailSent, smsSent } = await generateAndSendOtp(
      db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').doc(userDoc.id), userData.email, userData.name, userData.phone || null
    );

    const dispatchSuccess = emailSent || smsSent;

    res.status(200).json({
      status: 'success',
      fallbackOtp: dispatchSuccess ? undefined : otp,
      message: dispatchSuccess
        ? `A new OTP has been sent to your email (${userData.email})${smsSent ? ' and SMS' : ''}.`
        : `A new OTP was generated: ${otp}`
    });
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
    const doc = await db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').doc(uid).get();

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

    const usersSnapshot = await db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').where('email', '==', email).get();
    if (usersSnapshot.empty) {
      return res.status(200).json({ status: 'success', message: 'If the email exists, a reset code was sent.' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    // Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

    await db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').doc(userDoc.id).update({
      resetCode,
      resetCodeExpiry: expiry
    });

    // Dual-channel send: EmailJS + BMS Africa SMS
    try {
      await sendOtpViaEmailJS(email, userData.name || 'Student', resetCode);
    } catch (emailErr) {
      console.error('EmailJS Error in forgot-password:', emailErr.message || emailErr);
    }

    if (userData.phone) {
      try {
        await sendOtpViaBMS(userData.phone, resetCode);
      } catch (smsErr) {
        console.error('BMS SMS Error in forgot-password:', smsErr.message || smsErr);
      }
    }

    // Audit log
    try {
      await logActivity({
        tenantId: getTenantId(req),
        actorEmail: email,
        actorRole: 'voter',
        action: 'PASSWORD_RESET_REQUESTED',
        description: `Password reset code requested for ${email}`,
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        status: 'success'
      });
    } catch (_) {}

    res.status(200).json({ status: 'success', message: 'If the email exists, a reset code was sent to your email/phone.' });
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

    const usersSnapshot = await db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').where('email', '==', email).get();
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
    await db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').doc(userDoc.id).update({
      password: hashedPassword,
      resetCode: null,
      resetCodeExpiry: null
    });

    // Audit log
    try {
      await logActivity({
        tenantId: getTenantId(req),
        actorEmail: email,
        actorRole: 'voter',
        action: 'PASSWORD_RESET',
        description: `Password successfully reset for ${email}`,
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        status: 'success'
      });
    } catch (_) {}

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
    const userDoc = await db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').doc(uid).get();

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
    await db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls').doc(uid).update({ password: hashedPassword });

    // Audit log
    try {
      await logActivity({
        tenantId: getTenantId(req),
        actorEmail: req.user?.email || uid,
        actorRole: 'voter',
        action: 'PASSWORD_CHANGED',
        description: `Voter changed their password (${req.user?.email || uid})`,
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        status: 'success'
      });
    } catch (_) {}

    res.status(200).json({ status: 'success', message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ status: 'error', message: 'Failed to change password.' });
  }
});

router.delete('/cleanup-incomplete', async (req, res) => {
  try {
    // Find users marked as registered but still have pending OTP (registration not completed)
    const usersSnap = await db.collection('tenants').doc(getTenantId(req)).collection('voter_rolls')
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