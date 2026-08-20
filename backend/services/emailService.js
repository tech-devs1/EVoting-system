const nodemailer = require('nodemailer');

// ── cPanel Multi-Account SMTP Configuration & Pool Management ─────────
// Support single or multiple email accounts for round-robin dispatch,
// hourly quota management, and automatic retry / failover.
//
// Configuration via Environment Variables:
// 1. JSON Array in SMTP_ACCOUNTS:
//    SMTP_ACCOUNTS='[{"user":"a1@htu.edu.gh","pass":"p1"},{"user":"a2@htu.edu.gh","pass":"p2"}]'
// 2. Comma-separated strings in SMTP_USER / SMTP_PASS:
//    SMTP_USER="a1@htu.edu.gh,a2@htu.edu.gh,a3@htu.edu.gh"
//    SMTP_PASS="p1,p2,p3"
// 3. Single account fallback:
//    SMTP_USER="a1@htu.edu.gh", SMTP_PASS="p1"
// Shared default host/port:
//    SMTP_HOST (default e.g. mail.htu.edu.gh)
//    SMTP_PORT (default 587 or 465)
//    SMTP_MAX_PER_HOUR (default 150 per account)

const defaultHost = (process.env.SMTP_HOST || '').trim();
const defaultPort = parseInt(process.env.SMTP_PORT || '587', 10);
const maxPerHour = parseInt(process.env.SMTP_MAX_PER_HOUR || '150', 10);

function parseAccountConfigs() {
  const configs = [];

  // Option 1: Parse JSON array from SMTP_ACCOUNTS
  if (process.env.SMTP_ACCOUNTS && process.env.SMTP_ACCOUNTS.trim()) {
    try {
      const parsed = JSON.parse(process.env.SMTP_ACCOUNTS.trim());
      if (Array.isArray(parsed)) {
        parsed.forEach((acc) => {
          if (acc && acc.user && acc.pass) {
            configs.push({
              host: (acc.host || defaultHost).trim(),
              port: parseInt(acc.port || defaultPort, 10),
              user: acc.user.trim(),
              pass: String(acc.pass).replace(/\s+/g, ''),
              from: acc.from ? acc.from.trim() : `"HTU ELECT" <${acc.user.trim()}>`,
              maxPerHour: parseInt(acc.maxPerHour || maxPerHour, 10)
            });
          }
        });
      }
    } catch (e) {
      console.error('[Email Service] Failed to parse SMTP_ACCOUNTS JSON:', e.message);
    }
  }

  // Option 2 & 3: Parse comma-separated or single SMTP_USER and SMTP_PASS if configs is empty
  if (configs.length === 0) {
    const rawUsers = (process.env.SMTP_USER || '').split(',').map((u) => u.trim()).filter(Boolean);
    const rawPasses = (process.env.SMTP_PASS || '').split(',').map((p) => p.replace(/\s+/g, '')).filter(Boolean);

    if (rawUsers.length > 0 && defaultHost) {
      rawUsers.forEach((u, idx) => {
        const pass = rawPasses[idx] || rawPasses[0] || '';
        if (u && pass) {
          configs.push({
            host: defaultHost,
            port: defaultPort,
            user: u,
            pass,
            from: process.env.EMAIL_FROM ? process.env.EMAIL_FROM.trim() : `"HTU ELECT" <${u}>`,
            maxPerHour
          });
        }
      });
    }
  }

  return configs;
}

const accountConfigs = parseAccountConfigs();

if (accountConfigs.length === 0) {
  console.warn(
    '[Email Service] cPanel SMTP is not fully configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in environment variables.'
  );
}

// Initialize Transporters and Pool Tracking
const smtpPool = accountConfigs.map((cfg, index) => {
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });

  return {
    id: index + 1,
    user: cfg.user,
    from: cfg.from,
    transporter,
    maxPerHour: cfg.maxPerHour,
    sentThisHour: 0,
    hourResetTime: Date.now() + 3600000
  };
});

// Primary single transporter export for backward compatibility
const smtpTransport = smtpPool.length > 0 ? smtpPool[0].transporter : null;

let roundRobinIndex = 0;

/**
 * Filter pool accounts to find those that have not exceeded their hourly quota.
 * Automatically resets the count if the 1-hour window has elapsed.
 */
function getActivePoolAccounts() {
  const now = Date.now();
  return smtpPool.filter((account) => {
    if (now >= account.hourResetTime) {
      account.sentThisHour = 0;
      account.hourResetTime = now + 3600000;
    }
    return account.sentThisHour < account.maxPerHour;
  });
}

function defaultHtml(subject, text) {
  return `<div style="font-family: sans-serif; padding: 20px;"><h2>${subject}</h2><p>${text}</p></div>`;
}

/**
 * Dispatch an HTML / text email via cPanel SMTP with multi-account round-robin and failover.
 */
async function sendEmailNotification(to, subject, text, html) {
  if (!to || !to.trim() || !to.includes('@')) {
    console.warn('[Email Service Warning] Invalid recipient email address provided:', to);
    return null;
  }

  if (smtpPool.length === 0) {
    console.error('[Email Service Error] No cPanel SMTP transporters configured.');
    return null;
  }

  const activeAccounts = getActivePoolAccounts();
  const inactiveAccounts = smtpPool.filter((acc) => !activeAccounts.includes(acc));

  // Build priority order: active accounts first (round-robin ordered), then inactive accounts as emergency fallback
  let activeOrdered = activeAccounts;
  if (activeAccounts.length > 0) {
    const startIdx = roundRobinIndex % activeAccounts.length;
    roundRobinIndex = (roundRobinIndex + 1) % 1000000;
    activeOrdered = [
      ...activeAccounts.slice(startIdx),
      ...activeAccounts.slice(0, startIdx)
    ];
  }

  const candidateAccounts = [...activeOrdered, ...inactiveAccounts];

  if (activeAccounts.length === 0) {
    console.warn(
      '[Email Service Warning] All SMTP accounts have hit their hourly quota. Attempting send with full pool as fallback.'
    );
  }

  const htmlBody = html || defaultHtml(subject, text);

  // Try each candidate account in priority order (Failover Loop)
  for (let i = 0; i < candidateAccounts.length; i++) {
    const poolAccount = candidateAccounts[i];

    try {
      const info = await poolAccount.transporter.sendMail({
        from: poolAccount.from,
        to: to.trim(),
        subject,
        text,
        html: htmlBody
      });

      poolAccount.sentThisHour += 1;
      console.log(
        `[cPanel SMTP Pool] Email dispatched to ${to} via account [${poolAccount.user}] (${poolAccount.sentThisHour}/${poolAccount.maxPerHour} this hr). Message ID: ${info.messageId}`
      );
      return { ...info, provider: 'cpanel-smtp', account: poolAccount.user };
    } catch (err) {
      console.error(
        `[cPanel SMTP Pool Error] Account [${poolAccount.user}] failed to send email to ${to}:`,
        err.message || err
      );
      // Continue loop to failover to next candidate account
    }
  }

  console.error(`[Email Service Failure] Could not deliver email to ${to} after attempting all available SMTP accounts.`);
  return null;
}

/**
 * Dispatch OTP verification code via cPanel SMTP.
 */
async function sendOtpViaEmail(email, name, otp, expiryMinutes = 10) {
  const subject = 'HTU Elect - Your 6-Digit Voting Access Code';
  const text = `Hello ${name || 'Voter'},\n\nYour 6-digit access OTP for the voting portal is: ${otp}\n\nThis code will expire in ${expiryMinutes} minutes.\n\nThank you,\nHTU Elect Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #f4f6f9; border-radius: 8px;">
      <h2 style="color: #2563eb;">HTU Elect Voting Access Code</h2>
      <p>Hello <strong>${name || 'Voter'}</strong>,</p>
      <p>Use the following 6-digit verification code to unlock your voting ballot:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #10b981; padding: 16px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center; margin: 20px 0;">
        ${otp}
      </div>
      <p style="font-size: 13px; color: #6b7280;">This code is valid for ${expiryMinutes} minutes. If you did not request this, please ignore this email.</p>
    </div>
  `;

  return sendEmailNotification(email, subject, text, html);
}

module.exports = {
  smtpTransport,
  smtpPool,
  parseAccountConfigs,
  getActivePoolAccounts,
  sendEmailNotification,
  sendOtpViaEmail
};
