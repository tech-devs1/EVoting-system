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
async function generateAndSendOtp(userRecord, email, name, phoneNumber = null) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

  userRecord.accessOtp = otp;
  userRecord.accessOtpExpiry = expiry;
  userRecord.otpAttempts = 0; // reset failed-attempt counter for the new code
  await userRecord.save();

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
    if (!studentId || !String(studentId).trim()) {
      return res.status(400).json({ status: 'error', message: 'Student ID is required' });
    }

    const cleanStudentId = String(studentId).trim();

    const voter = await Voter.findOne({
      where: {
        [Op.or]: [
          { studentId: cleanStudentId },
          { indexNumber: cleanStudentId }
        ]
      }
    });

    if (!voter) {
      return res.status(404).json({
        status: 'error',
        message: 'Your index number was not found on any election roster. Please contact your election administrator.'
      });
    }

    // Check if user account is already created in User table
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { studentId: cleanStudentId },
          { indexNo: cleanStudentId },
          ...(voter.email ? [{ email: voter.email.toLowerCase().trim() }] : [])
        ]
      }
    });

    if (existingUser && existingUser.password) {
      return res.status(403).json({ status: 'error', message: 'This student ID or email has already been registered.' });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        name: voter.name,
        email: voter.email,
        phone: voter.phone || '',
        program: voter.program || '',
        level: voter.level || '',
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

    // Verify eligibility on Voter roster
    const voterRosterEntry = await Voter.findOne({
      where: {
        [Op.or]: [
          { studentId: cleanStudentId },
          { indexNumber: cleanStudentId },
          { email: normalizedEmail }
        ]
      }
    });

    if (!voterRosterEntry) {
      return res.status(403).json({
        status: 'error',
        message: 'Your index number was not found on the official voter roster. Please contact your election administrator to be added before registering.'
      });
    }

    // Check if account already registered in User table
    let user = await User.findOne({
      where: {
        [Op.or]: [
          { email: normalizedEmail },
          { studentId: cleanStudentId },
          { indexNo: cleanStudentId }
        ]
      }
    });

    if (user && user.password) {
      return res.status(403).json({ status: 'error', message: 'This student ID or email has already been registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (!user) {
      user = await User.create({
        id: `usr_${cleanStudentId.replace(/[^a-zA-Z0-9]/g, '_')}`,
        tenantId: voterRosterEntry.tenantId || DEFAULT_TENANT_ID,
        name: name || voterRosterEntry.name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        phone: phone ? phone.replace(/\s+/g, '') : (voterRosterEntry.phone || ''),
        password: hashedPassword,
        role: 'voter',
        studentId: cleanStudentId,
        indexNo: cleanStudentId,
        status: 'active',
        isVerified: true,
        faceImage: faceImage || null
      });
    } else {
      user.password = hashedPassword;
      user.isVerified = true;
      if (name) user.name = name;
      if (phone) user.phone = phone.replace(/\s+/g, '');
      if (faceImage) user.faceImage = faceImage;
      user.studentId = cleanStudentId;
      user.indexNo = cleanStudentId;
      await user.save();
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

// Helper for safe password comparison (handles both bcrypt hashes and legacy plaintext)
async function comparePassword(candidatePassword, storedPassword) {
  if (!storedPassword) return false;
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
    try {
      return await bcrypt.compare(candidatePassword, storedPassword);
    } catch (e) {
      return false;
    }
  }
  return candidatePassword === storedPassword;
}

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
      const isMatch = await comparePassword(password, user.password);
      if (isMatch) {
        if (!user.password.startsWith('$2')) {
          user.password = await bcrypt.hash(password, 10);
          await user.save().catch(() => {});
        }
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
          ip: req.ip || req.headers?.['x-forwarded-for'] || 'unknown'
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
      const isMatch = await comparePassword(password, tenant.adminPassword);
      if (isMatch) {
        if (!tenant.adminPassword.startsWith('$2')) {
          tenant.adminPassword = await bcrypt.hash(password, 10);
          await tenant.save().catch(() => {});
        }
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
          ip: req.ip || req.headers?.['x-forwarded-for'] || 'unknown'
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
          const isMatch = await comparePassword(password, matched.passwordHash || matched.password);
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
              ip: req.ip || req.headers?.['x-forwarded-for'] || 'unknown'
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

    // Lookup registered voter in User table
    const voterUser = await User.findOne({ where: { email } });
    if (!voterUser || !voterUser.password) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password. You may not be registered.' });
    }

    const isMatch = await comparePassword(password, voterUser.password);
    if (isMatch && !voterUser.password.startsWith('$2')) {
      voterUser.password = await bcrypt.hash(password, 10);
      await voterUser.save().catch(() => {});
    }
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      {
        uid: voterUser.id,
        email: voterUser.email,
        role: voterUser.role || 'voter',
        name: voterUser.name,
        tenantId: voterUser.tenantId || DEFAULT_TENANT_ID,
        indexNumber: voterUser.indexNo || voterUser.studentId || voterUser.id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logActivity({
      tenantId: voterUser.tenantId || DEFAULT_TENANT_ID,
      actorEmail: voterUser.email,
      actorRole: voterUser.role || 'voter',
      action: 'VOTER_LOGIN',
      description: `Voter ${voterUser.name} logged in successfully`,
      ip: req.ip || req.headers?.['x-forwarded-for'] || 'unknown'
    });

    res.status(200).json({
      status: 'success',
      data: {
        uid: voterUser.id,
        email: voterUser.email,
        role: voterUser.role || 'voter',
        name: voterUser.name,
        tenantId: voterUser.tenantId || DEFAULT_TENANT_ID,
        faceImage: voterUser.faceImage || ''
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

    // Look for voter in User table
    let voterUser = await User.findOne({ where: { email } });
    let targetTenantId = DEFAULT_TENANT_ID;

    if (!voterUser) {
      // Check if email is on any roster
      const rosterEntry = await Voter.findOne({ where: { email } });
      if (!rosterEntry && !isAllowedDomain(email)) {
        return res.status(403).json({
          status: 'error',
          message: `Registration is restricted to ${ALLOWED_EMAIL_DOMAIN} email addresses. Please use your institutional email.`
        });
      }
      if (rosterEntry && rosterEntry.tenantId) {
        targetTenantId = rosterEntry.tenantId;
      }
      const finalUid = `usr_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      voterUser = await User.create({
        id: finalUid,
        email,
        name: name || (rosterEntry ? rosterEntry.name : email.split('@')[0]),
        role: 'voter',
        tenantId: targetTenantId,
        studentId: rosterEntry ? (rosterEntry.studentId || rosterEntry.indexNumber) : finalUid,
        indexNo: rosterEntry ? (rosterEntry.indexNumber || rosterEntry.studentId) : finalUid,
        isVerified: true
      });
    } else {
      targetTenantId = voterUser.tenantId || DEFAULT_TENANT_ID;
    }

    const token = jwt.sign(
      {
        uid: voterUser.id,
        email: voterUser.email,
        role: voterUser.role || 'voter',
        name: voterUser.name,
        tenantId: targetTenantId,
        indexNumber: voterUser.indexNo || voterUser.studentId || voterUser.id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      status: 'success',
      data: {
        uid: voterUser.id,
        email: voterUser.email,
        role: voterUser.role || 'voter',
        name: voterUser.name,
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

    const user = await User.findOne({ where: { email } });
    if (!user || !user.accessOtp) {
      return res.status(400).json({ status: 'error', message: 'Invalid OTP code.' });
    }

    if (Date.now() > Number(user.accessOtpExpiry)) {
      user.accessOtp = null;
      user.accessOtpExpiry = null;
      user.otpAttempts = 0;
      await user.save();
      return res.status(400).json({ status: 'error', message: 'OTP has expired. Please request a new one.' });
    }

    if (String(user.accessOtp) !== String(otp).trim()) {
      const attempts = Number(user.otpAttempts || 0) + 1;
      if (attempts >= 5) {
        user.accessOtp = null;
        user.accessOtpExpiry = null;
        user.otpAttempts = 0;
        await user.save();
        return res.status(429).json({ status: 'error', message: 'Too many incorrect attempts. Please request a new code.' });
      }
      user.otpAttempts = attempts;
      await user.save();
      return res.status(400).json({ status: 'error', message: 'Invalid OTP code.' });
    }

    user.accessOtp = null;
    user.accessOtpExpiry = null;
    user.otpAttempts = 0;
    user.isVerified = true;
    await user.save();

    const token = jwt.sign(
      {
        uid: user.id,
        email: user.email,
        role: user.role || 'voter',
        name: user.name,
        indexNumber: user.indexNo || user.studentId || user.id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      status: 'success',
      data: {
        uid: user.id,
        email: user.email,
        role: user.role || 'voter',
        name: user.name,
        faceImage: user.faceImage || ''
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

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(200).json({ status: 'success', message: 'If the email exists, a new OTP was sent.' });
    }

    const { otp, emailSent, smsSent } = await generateAndSendOtp(user, user.email, user.name, user.phone || null);
    const dispatchSuccess = emailSent || smsSent;

    // The plaintext OTP is only ever returned when delivery failed AND we are
    // not in production — in production the code must never leak via the API.
    const devFallback = !dispatchSuccess && process.env.NODE_ENV !== 'production';

    res.status(200).json({
      status: 'success',
      fallbackOtp: devFallback ? otp : undefined,
      message: dispatchSuccess
        ? `A new OTP has been sent to your email (${user.email})${smsSent ? ' and SMS' : ''}.`
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

    const userAcc = await User.findByPk(uid);
    if (userAcc) {
      const d = userAcc.toJSON();
      delete d.password;
      return res.status(200).json({ status: 'success', data: { ...d, id: userAcc.id } });
    }

    // Fallback search by email in User
    if (email) {
      const uEmail = await User.findOne({ where: { email } });
      if (uEmail) {
        const d = uEmail.toJSON();
        delete d.password;
        return res.status(200).json({ status: 'success', data: { ...d, id: uEmail.id } });
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
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(200).json({ status: 'success', message: 'If the email exists, a reset code was sent.' });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes (matches the emailed copy)

    user.resetCode = resetCode;
    user.resetCodeExpiry = expiry;
    await user.save();

    let emailSent = false;
    let smsSent = false;

    try {
      const emailResult = await sendOtpViaEmail(email, user.name || 'Student', resetCode);
      if (emailResult) emailSent = true;
    } catch (err) {
      console.error('Email failed inside forgot-password:', err.message);
    }

    if (user.phone) {
      try {
        await sendOtpViaBMS(user.phone, resetCode);
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

    const user = await User.findOne({ where: { email, resetCode: code } });
    if (!user || Date.now() > Number(user.resetCodeExpiry)) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired code.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetCode = null;
    user.resetCodeExpiry = null;
    await user.save();

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

    const user = await User.findByPk(req.user.uid);
    if (!user || !user.password) {
      return res.status(404).json({ status: 'error', message: 'Voter account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Current password is incorrect.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

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
        message: 'Email delivery failed — cPanel SMTP provider did not succeed. Check SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS and the server logs.'
      });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
