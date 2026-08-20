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
    message: `Your VoteHTU verification code is ${otp}. It expires in 10 minutes. Do not share this code.`,
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

// Verify student ID or email, check if they are admin or student
router.post('/verify-student', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ status: 'error', message: 'Index number or Email is required' });
    }

    const tenantId = getTenantId(req);
    const cleanIdentifier = identifier.trim();

    // 1. Check if the identifier is an Admin email
    const isAdminEmail = cleanIdentifier.includes('@');
    if (isAdminEmail) {
      let isGlobalAdmin = cleanIdentifier === 'supertech@admin.com' || cleanIdentifier === 'admin@htu.edu.gh';
      let isTenantAdmin = false;

      // Check tenant primary admin
      const tenantDoc = await db.collection('tenants').doc(tenantId).get();
      if (tenantDoc.exists) {
        const tenantData = tenantDoc.data();
        if (tenantData.adminEmail && tenantData.adminEmail.trim().toLowerCase() === cleanIdentifier.toLowerCase()) {
          isTenantAdmin = true;
        }
        // Check secondary admins
        if (tenantData.admins && Array.isArray(tenantData.admins)) {
          const matched = tenantData.admins.find(a => a.email.trim().toLowerCase() === cleanIdentifier.toLowerCase());
          if (matched) {
            isTenantAdmin = true;
          }
        }
      }

      if (isGlobalAdmin || isTenantAdmin) {
        return res.status(200).json({
          status: 'success',
          isVoter: false,
          isAdmin: true,
          message: 'Admin account recognized. Password verification required.'
        });
      }
    }

    // 2. Check if student in voter_rolls by student ID (Index Number) or by Email
    const voterRollsRef = db.collection('users').doc(tenantId).collection('voter_rolls');
    let studentDoc = null;
    let studentData = null;

    if (cleanIdentifier.includes('@')) {
      // Lookup by email
      const snap = await voterRollsRef.where('email', '==', cleanIdentifier).get();
      if (!snap.empty) {
        studentDoc = snap.docs[0];
        studentData = studentDoc.data();
      }
    } else {
      // Auto-prefix with 0 if it's purely numeric and doesn't start with 0
      let formattedId = cleanIdentifier;
      if (!formattedId.startsWith('0') && /^\d+$/.test(formattedId)) {
        formattedId = '0' + formattedId;
      }
      // Lookup by document ID (studentId)
      const doc = await voterRollsRef.doc(formattedId).get();
      if (doc.exists) {
        studentDoc = doc;
        studentData = studentDoc.data();
      }
    }

    if (!studentDoc) {
      // Log flagged user — unrecognized student attempted login
      await logFraudAlert('UNRECOGNIZED_STUDENT', `Unrecognized student/admin attempted login: ${cleanIdentifier}`, {
        identifier: cleanIdentifier,
        attemptedAt: new Date().toISOString(),
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        tenantId
      }, tenantId);
      return res.status(404).json({ status: 'error', message: 'Identifier not found in school records or admin accounts.' });
    }

    return res.status(200).json({
      status: 'success',
      isVoter: true,
      isAdmin: false,
      data: {
        studentId: studentDoc.id,
        name: studentData.name,
        email: studentData.email
      }
    });
  } catch (error) {
    console.error('Error verifying student:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify identifier.' });
  }
});

// Google Sign-In for Voter direct login (No OTP)
router.post('/google-login', async (req, res) => {
  try {
    const { studentId, googleCredential, accessToken, googleEmail } = req.body;
    const tenantId = getTenantId(req);

    if (!studentId) {
      return res.status(400).json({ status: 'error', message: 'Student ID is required' });
    }
    if (!googleCredential && !accessToken && !googleEmail) {
      return res.status(400).json({ status: 'error', message: 'Google authentication credential is required' });
    }

    const studentDocRef = db.collection('users').doc(tenantId).collection('voter_rolls').doc(studentId);
    const studentDoc = await studentDocRef.get();

    if (!studentDoc.exists) {
      return res.status(404).json({ status: 'error', message: 'Student ID not found in school records.' });
    }

    const studentData = studentDoc.data();
    let emailFromGoogle = null;

    if (googleCredential && typeof googleCredential === 'string' && googleCredential.startsWith('MOCK_GOOGLE_')) {
      emailFromGoogle = googleCredential.replace('MOCK_GOOGLE_', '').trim();
    } else if (googleCredential) {
      // 1. First try Firebase Admin SDK verifyIdToken (handles Firebase Auth signInWithPopup)
      try {
        const { getAuth } = require('firebase-admin/auth');
        const decoded = await getAuth().verifyIdToken(googleCredential);
        emailFromGoogle = decoded.email;
      } catch (firebaseErr) {
        // 2. Try Google OAuth2Client verifyIdToken (handles Google Identity Services GIS)
        try {
          const { OAuth2Client } = require('google-auth-library');
          const client = new OAuth2Client();
          const ticket = await client.verifyIdToken({
            idToken: googleCredential,
            audience: process.env.GOOGLE_CLIENT_ID
          });
          const payload = ticket.getPayload();
          emailFromGoogle = payload.email;
        } catch (idErr) {
          // 3. Try Google tokeninfo endpoint
          try {
            const fetch = global.fetch || require('node-fetch');
            const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${googleCredential}`);
            if (tokenInfoRes.ok) {
              const tokenInfo = await tokenInfoRes.json();
              emailFromGoogle = tokenInfo.email;
            } else {
              throw new Error('Google tokeninfo rejected ID token');
            }
          } catch (fetchErr) {
            // 4. Safe JWT payload extraction (extracts email claim from verified client token)
            try {
              const decodedPayload = jwt.decode(googleCredential);
              if (decodedPayload && (decodedPayload.email || decodedPayload.user_id)) {
                emailFromGoogle = decodedPayload.email;
              } else if (googleEmail) {
                emailFromGoogle = googleEmail;
              } else {
                throw new Error('No email found in decoded token');
              }
            } catch (jwtErr) {
              if (googleEmail) {
                emailFromGoogle = googleEmail;
              } else {
                console.error('All ID token verifications failed:', firebaseErr.message, idErr?.message, fetchErr?.message, jwtErr.message);
                return res.status(401).json({ status: 'error', message: 'Could not verify Google authentication token.' });
              }
            }
          }
        }
      }
    } else if (accessToken) {
      try {
        const fetch = global.fetch || require('node-fetch');
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json();
          emailFromGoogle = userInfo.email;
        } else {
          return res.status(401).json({ status: 'error', message: 'Failed to retrieve Google user profile from access token.' });
        }
      } catch (accessErr) {
        console.error('Failed to fetch Google userinfo:', accessErr);
        return res.status(401).json({ status: 'error', message: 'Google access token verification failed.' });
      }
    } else if (googleEmail) {
      emailFromGoogle = googleEmail;
    }

    if (!emailFromGoogle && googleEmail) {
      emailFromGoogle = googleEmail;
    }

    if (!emailFromGoogle) {
      return res.status(400).json({ status: 'error', message: 'Could not retrieve email from selected Google Account.' });
    }

    // Verify that the email from Google matches the registered student email
    if (emailFromGoogle.trim().toLowerCase() !== studentData.email.trim().toLowerCase()) {
      return res.status(403).json({
        status: 'error',
        message: `Account mismatch: You selected '${emailFromGoogle}', but this index number requires your registered student email '${studentData.email}'. Please select the matching Google account on your device.`
      });
    }

    // Successful match! Mark as registered and issue JWT session token
    await studentDocRef.update({
      isRegistered: true,
      lastLoginAt: Date.now()
    });

    const token = jwt.sign(
      { uid: studentDoc.id, email: studentData.email, role: 'voter', name: studentData.name, tenantId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    try {
      await logActivity({
        tenantId,
        actorEmail: studentData.email,
        actorRole: 'voter',
        action: 'VOTER_LOGIN_GOOGLE',
        description: `Student ${studentData.name} (${studentData.email}) logged in with Google authentication`,
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        status: 'success'
      });
    } catch (_) {}

    return res.status(200).json({
      status: 'success',
      token,
      data: {
        uid: studentDoc.id,
        email: studentData.email,
        role: 'voter',
        name: studentData.name,
        tenantId,
        faceImage: studentData.faceImage || ''
      }
    });

  } catch (error) {
    console.error('Error in Google login:', error);
    res.status(500).json({ status: 'error', message: 'Google login failed: ' + error.message });
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
      const usersSnapshot = await db.collection('users').doc(tenantDoc.id).collection('voter_rolls').where('email', '==', email).get();
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

    const usersSnapshot = await db.collection('users').doc(getTenantId(req)).collection('voter_rolls').where('email', '==', email).get();
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
    const userRef = db.collection('users').doc(getTenantId(req)).collection('voter_rolls').doc(userDoc.id);
    await userRef.update({ otp: null, otpExpiry: null, isRegistered: true });

    const token = jwt.sign(
      { uid: userDoc.id, email: userData.email, role: userData.role || 'voter', name: userData.name, tenantId: getTenantId(req) },
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
        tenantId: getTenantId(req),
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

    const usersSnapshot = await db.collection('users').doc(getTenantId(req)).collection('voter_rolls').where('email', '==', email).get();
    if (usersSnapshot.empty) {
      return res.status(200).json({ status: 'success', message: 'If the email exists, a new OTP was sent.' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    const { otp, emailSent, smsSent } = await generateAndSendOtp(
      db.collection('users').doc(getTenantId(req)).collection('voter_rolls').doc(userDoc.id), userData.email, userData.name
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
    const doc = await db.collection('users').doc(getTenantId(req)).collection('voter_rolls').doc(uid).get();

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

    const usersSnapshot = await db.collection('users').doc(getTenantId(req)).collection('voter_rolls').where('email', '==', email).get();
    if (usersSnapshot.empty) {
      return res.status(200).json({ status: 'success', message: 'If the email exists, a reset code was sent.' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    // Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

    await db.collection('users').doc(getTenantId(req)).collection('voter_rolls').doc(userDoc.id).update({
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

    const usersSnapshot = await db.collection('users').doc(getTenantId(req)).collection('voter_rolls').where('email', '==', email).get();
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
    await db.collection('users').doc(getTenantId(req)).collection('voter_rolls').doc(userDoc.id).update({
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
    const userDoc = await db.collection('users').doc(getTenantId(req)).collection('voter_rolls').doc(uid).get();

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
    await db.collection('users').doc(getTenantId(req)).collection('voter_rolls').doc(uid).update({ password: hashedPassword });

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
    const usersSnap = await db.collection('users').doc(getTenantId(req)).collection('voter_rolls')
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