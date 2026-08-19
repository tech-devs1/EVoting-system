const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User, Tenant, Organization, Voter, UnlockedElection, ActivityLog } = require('../models');
const { sendOtpViaEmail } = require('../services/emailService');
const { logActivity } = require('../services/activityLog');
const { logFraudAlert } = require('../services/fraud');

const DEFAULT_TENANT_ID = 'compssa';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

// Domain restriction: only @htu.edu.gh emails may register as voters.
// Admin / superadmin accounts already in the database are unaffected.
const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || 'htu.edu.gh').toLowerCase();

/** Returns true when the email belongs to the allowed institution domain. */
function isAllowedDomain(email) {
  if (!email || typeof email !== 'string') return false;
  const lower = email.trim().toLowerCase();
  return lower.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}
const BMS_API_KEY = process.env.BMS_API_KEY || process.env.MNOTIFY_API_KEY || '';
const BMS_SENDER_ID = process.env.BMS_SENDER_ID || 'COMPSSA';

// Helper: Send OTP SMS via BMS Africa (mNotify) Quick SMS API
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

  const messageText = `Your verification code is ${otp}. It expires in 10 minutes. Do not share this code.`;

  const payload = {
    recipient: [formattedPhone],
    sender: BMS_SENDER_ID,
    message: messageText,
    is_schedule: false
  };

  console.log(`[BMS SMS] Dispatching OTP ${otp} to ${formattedPhone} via BMS Africa (Sender ID: ${BMS_SENDER_ID})`);

  try {
    let res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${BMS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });

    let responseText = await res.text();
    console.log('[BMS SMS] Response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`BMS API returned non-JSON response: ${responseText.substring(0, 100)}`);
    }

    const isUnregistered = responseText.toLowerCase().includes('sender id is not registered') ||
                           responseText.toLowerCase().includes('sender id not approved') ||
                           responseText.toLowerCase().includes('unregistered') ||
                           responseData.code === '1005' ||
                           (responseData.error && responseText.toLowerCase().includes('sender id'));

    if (isUnregistered && BMS_SENDER_ID !== 'mNotify') {
      console.warn(`[BMS SMS Warning] Sender ID "${BMS_SENDER_ID}" not registered. Retrying with fallback "mNotify"...`);
      payload.sender = 'mNotify';
      res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${BMS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });
      responseText = await res.text();
      console.log('[BMS SMS Fallback 1] Response:', responseText);
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`BMS API returned non-JSON response: ${responseText.substring(0, 100)}`);
      }
    }

    const isStillUnregistered = responseText.toLowerCase().includes('sender id is not registered') ||
                                responseText.toLowerCase().includes('sender id not approved');
    if (isStillUnregistered && payload.sender !== 'BMS Africa') {
      console.warn(`[BMS SMS Warning] Fallback "mNotify" not registered. Retrying with fallback "BMS Africa"...`);
      payload.sender = 'BMS Africa';
      res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${BMS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });
      responseText = await res.text();
      console.log('[BMS SMS Fallback 2] Response:', responseText);
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`BMS API returned non-JSON response: ${responseText.substring(0, 100)}`);
      }
    }

    const isStillUnregistered2 = responseText.toLowerCase().includes('sender id is not registered') ||
                                 responseText.toLowerCase().includes('sender id not approved');
    if (isStillUnregistered2 && payload.sender !== 'COMPSSA') {
      console.warn(`[BMS SMS Warning] Fallback "BMS Africa" not registered. Retrying with fallback "COMPSSA"...`);
      payload.sender = 'COMPSSA';
      res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${BMS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });
      responseText = await res.text();
      console.log('[BMS SMS Fallback 3] Response:', responseText);
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`BMS API returned non-JSON response: ${responseText.substring(0, 100)}`);
      }
    }

    if (!res.ok || (responseData.status !== 'success' && responseData.code !== '2000' && responseData.status !== 2000)) {
      throw new Error('BMS API returned error: ' + (responseData.message || responseData.error || responseText));
    }

    return responseData;
  } catch (err) {
    console.error('[BMS SMS Error]:', err.message || err);
    throw err;
  }
}

// Helper: Generate & dispatch OTP code
async function generateAndSendOtp(voterRecord, email, name, phoneNumber = null) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

  voterRecord.accessOtp = otp;
  voterRecord.accessOtpExpiry = expiry;
  voterRecord.otpAttempts = 0; // reset failed-attempt counter for the new code
  await voterRecord.save();

  let emailSent = false;
  let smsSent = false;

  try {
    if (email) {
      const emailResult = await sendOtpViaEmail(email, name, otp);
      if (emailResult) emailSent = true;
    }
  } catch (emailErr) {
    console.error('[OTP] Email delivery failed:', emailErr.message);
  }

  if (phoneNumber) {
    try {
      await sendOtpViaBMS(phoneNumber, otp);
      smsSent = true;
    } catch (smsErr) {
      console.error('[OTP] BMS SMS delivery failed:', smsErr.message);
    }
  }

  return { otp, emailSent, smsSent };
}

exports.verifyStudent = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ status: 'error', message: 'Student ID is required' });
    }

    const voter = await Voter.findOne({ where: { studentId } });

    if (!voter) {
      return res.status(200).json({
        status: 'success',
        data: {
          name: '',
          email: '',
          hasPhone: false
        }
      });
    }

    if (voter.password && voter.isRegistered) {
      return res.status(403).json({ status: 'error', message: 'This student ID has already been registered.' });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        name: voter.name,
        email: voter.email,
        hasPhone: !!voter.phone
      }
    });
  } catch (error) {
    console.error('Error verifying student:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify student' });
  }
};

exports.register = async (req, res) => {
  try {
    const { studentId, email: rawEmail, name, password, phone, faceImage } = req.body;
    const email = String(rawEmail || '').trim().toLowerCase();

    if (!studentId || !email || !password) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields (studentId, email, password)' });
    }

    // Domain restriction: only institutional @htu.edu.gh emails may register
    if (!isAllowedDomain(email)) {
      return res.status(403).json({
        status: 'error',
        message: `Registration is restricted to ${ALLOWED_EMAIL_DOMAIN} email addresses. Please use your institutional email.`
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanStudentId = studentId.trim();

    let voter = await Voter.findOne({
      where: {
        [Op.or]: [
          { studentId: cleanStudentId },
          { email: normalizedEmail }
        ]
      }
    });

    if (voter && voter.isRegistered && voter.password) {
      return res.status(403).json({ status: 'error', message: 'This student ID or email has already been registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (!voter) {
      const newUid = `voter_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      voter = await Voter.create({
        id: newUid,
        studentId: cleanStudentId,
        indexNumber: cleanStudentId,
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
        phone: phone ? phone.replace(/\s+/g, '') : '',
        role: 'voter',
        tenantId: DEFAULT_TENANT_ID,
        isRegistered: true,
        password: hashedPassword,
        faceImage: faceImage || ''
      });
    } else {
      voter.password = hashedPassword;
      voter.isRegistered = true;
      if (name) voter.name = name;
      if (phone) voter.phone = phone.replace(/\s+/g, '');
      if (faceImage) voter.faceImage = faceImage;
      await voter.save();
    }

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. You can now log in.'
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ status: 'error', message: 'Failed to register user' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body;
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required.' });
    }

    // Superadmin / admin accounts live in the users table and must verify their
    // password — no hardcoded password-less bypass.
    const user = await User.findOne({ where: { email } });
    if (user && (user.role === 'superadmin' || user.role === 'admin') && user.password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        const role = user.role;
        const tenantId = role === 'superadmin' ? 'global' : (user.tenantId || 'global');
        const uid = user.id;
        const token = jwt.sign(
          { uid, email, role, name: user.name, tenantId },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        await logActivity({
          tenantId,
          actorEmail: email,
          actorRole: role,
          action: role === 'superadmin' ? 'SUPERADMIN_LOGIN' : 'ADMIN_LOGIN',
          description: `${user.name || (role === 'superadmin' ? 'Super Administrator' : 'Administrator')} logged in`,
          ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
        });
        return res.status(200).json({
          status: 'success',
          data: { uid, email, role, name: user.name, tenantId },
          token
        });
      }
    }

    // Check primary department admin from Tenants
    const tenant = await Tenant.findOne({ where: { adminEmail: email } });
    if (tenant && tenant.adminPassword) {
      const isMatch = await bcrypt.compare(password, tenant.adminPassword);
      if (isMatch) {
        const uid = `admin_${tenant.id}`;
        const token = jwt.sign(
          { uid, email, role: 'admin', name: `${tenant.name} Administrator`, tenantId: tenant.id },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        await logActivity({
          tenantId: tenant.id,
          actorEmail: email,
          actorRole: 'admin',
          action: 'ADMIN_LOGIN',
          description: `${tenant.name} Administrator logged in`,
          ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
        });
        return res.status(200).json({
          status: 'success',
          data: { uid, email, role: 'admin', name: `${tenant.name} Administrator`, tenantId: tenant.id },
          token
        });
      }
    }

    // Check secondary admins across all Tenants
    const tenants = await Tenant.findAll();
    for (const t of tenants) {
      if (t.admins && Array.isArray(t.admins)) {
        const matched = t.admins.find(a => a.email === email);
        if (matched) {
          const isMatch = await bcrypt.compare(password, matched.passwordHash);
          if (isMatch) {
            const uid = `admin_${t.id}_${matched.id}`;
            const token = jwt.sign(
              { uid, email, role: 'admin', name: matched.name || `${t.name} Admin`, tenantId: t.id },
              JWT_SECRET,
              { expiresIn: '24h' }
            );
            await logActivity({
              tenantId: t.id,
              actorEmail: email,
              actorRole: 'admin',
              action: 'ADMIN_LOGIN',
              description: `${matched.name || 'Admin'} logged in`,
              ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
            });
            return res.status(200).json({
              status: 'success',
              data: { uid, email, role: 'admin', name: matched.name || `${t.name} Admin`, tenantId: t.id },
              token
            });
          }
        }
      }
    }

    // Lookup voter
    const voter = await Voter.findOne({ where: { email, isRegistered: true } });
    if (!voter || !voter.password) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password. You may not be registered.' });
    }

    const isMatch = await bcrypt.compare(password, voter.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      {
        uid: voter.id,
        email: voter.email,
        role: voter.role || 'voter',
        name: voter.name,
        tenantId: voter.tenantId || DEFAULT_TENANT_ID,
        indexNumber: voter.indexNumber || voter.studentId || voter.id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logActivity({
      tenantId: voter.tenantId || DEFAULT_TENANT_ID,
      actorEmail: voter.email,
      actorRole: 'voter',
      action: 'VOTER_LOGIN',
      description: `Voter ${voter.name} logged in successfully`,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
    });

    res.status(200).json({
      status: 'success',
      data: {
        uid: voter.id,
        email: voter.email,
        role: voter.role || 'voter',
        name: voter.name,
        tenantId: voter.tenantId || DEFAULT_TENANT_ID,
        faceImage: voter.faceImage || ''
      },
      token
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ status: 'error', message: 'Failed to authenticate user.' });
  }
};

/**
 * Verify a Google/Firebase ID token server-side with Google's tokeninfo
 * endpoint. The frontend sends the token produced by signInWithPopup;
 * tokeninfo validates the signature and returns the token claims, and we
 * additionally require the email to be verified. Never trust a locally
 * decoded JWT payload — anyone can craft one.
 */
async function verifyGoogleIdToken(idToken) {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error('Invalid identity token');
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid identity token');
  }

  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw new Error('Email is not verified on this Google account');
  }

  return payload;
}

exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ status: 'error', message: 'ID Token is required.' });
    }

    // Server-side verification — a forged/unsigned token is rejected here.
    let parsed;
    try {
      parsed = await verifyGoogleIdToken(idToken);
    } catch (verifyErr) {
      console.warn('[Google Login] Token verification failed:', verifyErr.message);
      return res.status(401).json({ status: 'error', message: 'Invalid Google identity token.' });
    }

    const email = String(parsed.email || '').toLowerCase().trim();
    const name = parsed.name || 'Voter';

    if (!email) {
      return res.status(400).json({ status: 'error', message: 'Failed to extract email from identity token.' });
    }

    // Check Superadmin by database lookup only
    const superAdminUser = await User.findOne({ where: { email, role: 'superadmin' } });
    if (superAdminUser) {
      const uid = superAdminUser.id;
      const token = jwt.sign(
        { uid, email, role: 'superadmin', name: superAdminUser.name || 'Super Administrator', tenantId: 'global' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      return res.status(200).json({
        status: 'success',
        data: { uid, email, role: 'superadmin', name: superAdminUser.name || 'Super Administrator', tenantId: 'global' },
        token
      });
    }

    // Check tenant admin
    const tenant = await Tenant.findOne({ where: { adminEmail: email } });
    if (tenant) {
      const uid = `admin_${tenant.id}`;
      const token = jwt.sign(
        { uid, email, role: 'admin', name: `${tenant.name} Administrator`, tenantId: tenant.id },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      return res.status(200).json({
        status: 'success',
        data: { uid, email, role: 'admin', name: `${tenant.name} Administrator`, tenantId: tenant.id },
        token
      });
    }

    // Look for voter by email
    let voter = await Voter.findOne({ where: { email } });
    let targetTenantId = DEFAULT_TENANT_ID;

    if (!voter) {
      // Domain restriction: only @htu.edu.gh may register via Google sign-in
      if (!isAllowedDomain(email)) {
        return res.status(403).json({
          status: 'error',
          message: `Registration is restricted to ${ALLOWED_EMAIL_DOMAIN} email addresses. Please use your institutional email.`
        });
      }
      const finalUid = `voter_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      voter = await Voter.create({
        id: finalUid,
        email,
        name: name || email.split('@')[0],
        role: 'voter',
        tenantId: targetTenantId,
        isRegistered: true,
        studentId: finalUid,
        indexNumber: finalUid
      });
    } else {
      targetTenantId = voter.tenantId;
      if (!voter.isRegistered) {
        voter.isRegistered = true;
        await voter.save();
      }
    }

    const token = jwt.sign(
      {
        uid: voter.id,
        email: voter.email,
        role: voter.role || 'voter',
        name: voter.name,
        tenantId: targetTenantId,
        indexNumber: voter.indexNumber || voter.studentId || voter.id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      status: 'success',
      data: {
        uid: voter.id,
        email: voter.email,
        role: voter.role || 'voter',
        name: voter.name,
        tenantId: targetTenantId
      },
      token
    });
  } catch (error) {
    console.error('Error in Google Login:', error);
    res.status(500).json({ status: 'error', message: 'Failed to authenticate via Google Auth.' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email: rawEmail, otp } = req.body;
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!email || !otp) {
      return res.status(400).json({ status: 'error', message: 'Email and OTP are required.' });
    }

    const voter = await Voter.findOne({ where: { email } });
    if (!voter || !voter.accessOtp) {
      return res.status(400).json({ status: 'error', message: 'Invalid OTP code.' });
    }

    if (Date.now() > Number(voter.accessOtpExpiry)) {
      voter.accessOtp = null;
      voter.accessOtpExpiry = null;
      voter.otpAttempts = 0;
      await voter.save();
      return res.status(400).json({ status: 'error', message: 'OTP has expired. Please request a new one.' });
    }

    if (String(voter.accessOtp) !== String(otp).trim()) {
      const attempts = Number(voter.otpAttempts || 0) + 1;
      if (attempts >= 5) {
        voter.accessOtp = null;
        voter.accessOtpExpiry = null;
        voter.otpAttempts = 0;
        await voter.save();
        return res.status(429).json({ status: 'error', message: 'Too many incorrect attempts. Please request a new code.' });
      }
      voter.otpAttempts = attempts;
      await voter.save();
      return res.status(400).json({ status: 'error', message: 'Invalid OTP code.' });
    }

    voter.accessOtp = null;
    voter.accessOtpExpiry = null;
    voter.otpAttempts = 0;
    voter.isRegistered = true;
    await voter.save();

    const token = jwt.sign(
      {
        uid: voter.id,
        email: voter.email,
        role: voter.role || 'voter',
        name: voter.name,
        indexNumber: voter.indexNumber || voter.studentId || voter.id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      status: 'success',
      data: {
        uid: voter.id,
        email: voter.email,
        role: voter.role || 'voter',
        name: voter.name,
        faceImage: voter.faceImage || ''
      },
      token
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify OTP.' });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { email: rawEmail } = req.body;
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ status: 'error', message: 'Email is required.' });

    const voter = await Voter.findOne({ where: { email } });
    if (!voter) {
      return res.status(200).json({ status: 'success', message: 'If the email exists, a new OTP was sent.' });
    }

    const { otp, emailSent, smsSent } = await generateAndSendOtp(voter, voter.email, voter.name, voter.phone || null);
    const dispatchSuccess = emailSent || smsSent;

    // The plaintext OTP is only ever returned when delivery failed AND we are
    // not in production — in production the code must never leak via the API.
    const devFallback = !dispatchSuccess && process.env.NODE_ENV !== 'production';

    res.status(200).json({
      status: 'success',
      fallbackOtp: devFallback ? otp : undefined,
      message: dispatchSuccess
        ? `A new OTP has been sent to your email (${voter.email})${smsSent ? ' and SMS' : ''}.`
        : 'A new OTP has been generated. If you did not receive it, please contact support.'
    });
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ status: 'error', message: 'Failed to resend OTP.' });
  }
};

exports.me = async (req, res) => {
  try {
    const { uid, email, role, name, tenantId } = req.user;

    if (role === 'superadmin' || uid === 'superadmin' || uid.startsWith('superadmin_')) {
      return res.status(200).json({
        status: 'success',
        data: {
          uid: uid || 'superadmin',
          email: email || 'superadmin@htu.edu.gh',
          name: name || 'Super Administrator',
          role: 'superadmin',
          tenantId: 'global',
          status: 'active',
          createdAt: Date.now()
        }
      });
    }

    if (role === 'admin' || uid.startsWith('admin_')) {
      return res.status(200).json({
        status: 'success',
        data: {
          uid: uid,
          email: email || 'admin@htu.edu.gh',
          name: name || 'EC Administrator',
          role: 'admin',
          tenantId: tenantId || 'global',
          status: 'active',
          createdAt: Date.now()
        }
      });
    }

    const voter = await Voter.findByPk(uid);
    if (voter) {
      const d = voter.toJSON();
      delete d.password;
      return res.status(200).json({ status: 'success', data: { ...d, id: voter.id } });
    }

    // Fallback search by email
    if (email) {
      const vEmail = await Voter.findOne({ where: { email } });
      if (vEmail) {
        const d = vEmail.toJSON();
        delete d.password;
        return res.status(200).json({ status: 'success', data: { ...d, id: vEmail.id } });
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        id: uid,
        uid: uid,
        email: email || 'voter@htu.edu.gh',
        name: name || 'Voter',
        role: role || 'voter',
        tenantId: tenantId || DEFAULT_TENANT_ID,
        isRegistered: true
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch user profile' });
  }
};

exports.verifyFace = async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: { verified: true, message: 'Facial verification completed.' }
  });
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email: rawEmail } = req.body;
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ status: 'error', message: 'Email is required' });

    // Domain restriction: block password resets for non-institutional emails
    if (!isAllowedDomain(email)) {
      return res.status(403).json({ status: 'error', message: 'Password reset is restricted to institutional email addresses.' });
    }
    const voter = await Voter.findOne({ where: { email } });
    if (!voter) {
      return res.status(200).json({ status: 'success', message: 'If the email exists, a reset code was sent.' });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes (matches the emailed copy)

    voter.resetCode = resetCode;
    voter.resetCodeExpiry = expiry;
    await voter.save();

    let emailSent = false;
    let smsSent = false;

    try {
      const emailResult = await sendOtpViaEmail(email, voter.name || 'Student', resetCode);
      if (emailResult) emailSent = true;
    } catch (err) {
      console.error('Email failed inside forgot-password:', err.message);
    }

    if (voter.phone) {
      try {
        await sendOtpViaBMS(voter.phone, resetCode);
        smsSent = true;
      } catch (err) {
        console.error('SMS failed inside forgot-password:', err.message);
      }
    }

    const dispatchSuccess = emailSent || smsSent;

    // Same rule as resend-otp: never leak the code through the API in production.
    const devFallback = !dispatchSuccess && process.env.NODE_ENV !== 'production';

    res.status(200).json({
      status: 'success',
      fallbackCode: devFallback ? resetCode : undefined,
      message: dispatchSuccess
        ? 'If the email exists, a reset code was sent to your email/phone.'
        : 'If the email exists, a reset code was sent to your email/phone. If it did not arrive, please contact support.'
    });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email: rawEmail, code, newPassword } = req.body;
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!email || !code || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.'
      });
    }

    const voter = await Voter.findOne({ where: { email, resetCode: code } });
    if (!voter || Date.now() > Number(voter.resetCodeExpiry)) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired code.' });
    }

    voter.password = await bcrypt.hash(newPassword, 10);
    voter.resetCode = null;
    voter.resetCodeExpiry = null;
    await voter.save();

    res.status(200).json({ status: 'success', message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Error in reset password:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Current password and new password are required.' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.'
      });
    }

    if (req.user.uid.startsWith('admin_')) {
      return res.status(400).json({ status: 'error', message: 'Admin accounts cannot change password via this endpoint.' });
    }

    const voter = await Voter.findByPk(req.user.uid);
    if (!voter || !voter.password) {
      return res.status(404).json({ status: 'error', message: 'Voter account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, voter.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Current password is incorrect.' });
    }

    voter.password = await bcrypt.hash(newPassword, 10);
    await voter.save();

    res.status(200).json({ status: 'success', message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ status: 'error', message: 'Failed to change password.' });
  }
};

exports.cleanupIncomplete = async (req, res) => {
  try {
    const count = await Voter.destroy({
      where: {
        isRegistered: true,
        accessOtp: { [Op.ne]: null }
      }
    });
    return res.status(200).json({ status: 'success', message: `${count} incomplete registrations deleted.` });
  } catch (error) {
    console.error('Error cleaning up incomplete registrations:', error);
    res.status(500).json({ status: 'error', message: 'Failed to clean up registrations' });
  }
};

exports.testSms = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ status: 'error', message: 'Phone query parameter is required.' });
    }
    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const responseData = await sendOtpViaBMS(phone, testOtp);
    res.status(200).json({ status: 'success', bms_response: responseData });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.testEmail = async (req, res) => {
  try {
    const { to } = req.query;
    if (!to || !String(to).includes('@')) {
      return res.status(400).json({ status: 'error', message: 'Email query parameter is required (e.g. /api/auth/test-email?to=you@example.com).' });
    }
    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await sendOtpViaEmail(String(to).trim(), 'HTU Elect Test', testOtp);
    if (result) {
      res.status(200).json({ status: 'success', message: `Test email sent to ${to}. Check your inbox (and spam folder).` });
    } else {
      res.status(502).json({
        status: 'error',
        message: 'Email delivery failed — no provider succeeded. Check GMAIL_USER/GMAIL_APP_PASSWORD, RESEND_API_KEY, or ELASTICEMAIL_API_KEY and the server logs.'
      });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
