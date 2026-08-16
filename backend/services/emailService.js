const nodemailer = require('nodemailer');

// ── cPanel SMTP Configuration ─────────────────────────────────────────
// Email delivery is configured strictly for cPanel SMTP.
// Configure environment variables:
//   SMTP_HOST (e.g. mail.yourdomain.edu.gh or localhost)
//   SMTP_PORT (e.g. 465 for SSL, 587 for STARTTLS)
//   SMTP_USER (e.g. admin@e-voting.htu.edu.gh)
//   SMTP_PASS (email password)
//   EMAIL_FROM (optional custom sender, e.g. "HTU Elect" <admin@e-voting.htu.edu.gh>)

const smtpHost = (process.env.SMTP_HOST || '').trim();
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = (process.env.SMTP_USER || '').trim();
const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

const EMAIL_FROM = process.env.EMAIL_FROM
  ? process.env.EMAIL_FROM.trim()
  : (smtpUser ? `"HTU ELECT" <${smtpUser}>` : '"HTU ELECT" <no-reply@htu.edu.gh>');

const smtpConfigured = !!(smtpHost && smtpUser && smtpPass);

if (!smtpConfigured) {
  console.warn(
    '[Email Service] cPanel SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in environment variables.'
  );
}

// cPanel SMTP Transporter
const smtpTransport = smtpConfigured
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    })
  : null;

function defaultHtml(subject, text) {
  return `<div style="font-family: sans-serif; padding: 20px;"><h2>${subject}</h2><p>${text}</p></div>`;
}

/**
 * Dispatch an HTML / text email via cPanel SMTP.
 */
async function sendEmailNotification(to, subject, text, html) {
  if (!to || !to.trim() || !to.includes('@')) {
    console.warn('[Email Service Warning] Invalid recipient email address provided:', to);
    return null;
  }

  if (!smtpTransport) {
    console.error('[Email Service Error] cPanel SMTP transporter is not configured.');
    return null;
  }

  const htmlBody = html || defaultHtml(subject, text);

  try {
    const info = await smtpTransport.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html: htmlBody
    });
    console.log('[cPanel SMTP] Email dispatched to', to, 'Message ID:', info.messageId);
    return { ...info, provider: 'cpanel-smtp' };
  } catch (err) {
    console.error('[cPanel SMTP Error]:', err.message || err);
    return null;
  }
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
  sendEmailNotification,
  sendOtpViaEmail
};
