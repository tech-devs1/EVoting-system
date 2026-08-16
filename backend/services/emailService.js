const nodemailer = require('nodemailer');

// ── Configuration ────────────────────────────────────────────────────────────
// Email delivery is fully env-var driven. No credentials are hardcoded in the
// repo. Elastic Email is the PRIMARY provider (paid plan: 50,000 emails/month
// for $20). The other providers are fallbacks that only activate when Elastic
// Email is unavailable or its quota is exhausted.
//
//   1. Elastic Email SMTP   — SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS  (PRIMARY)
//      e.g. smtp.elasticemail.com:2525 (the credentials you configured)
//   2. Elastic Email REST   — ELASTICEMAIL_API_KEY                     (PRIMARY)
//      Used when SMTP fails for a non-quota reason (blocked port etc.)
//   3. Gmail SMTP (465 SSL) — GMAIL_USER/GMAIL_APP_PASSWORD            (FALLBACK)
//   4. Gmail SMTP (587)     — same Gmail credentials                   (FALLBACK)
//   5. EmailJS REST         — EMAILJS_SERVICE_ID/TEMPLATE_ID/PUBLIC_KEY (FALLBACK)
//   6. Resend REST          — RESEND_API_KEY                            (FALLBACK)
//
// ── Quota failover ───────────────────────────────────────────────────────────
// When Elastic Email reports that its sending quota is exhausted (SMTP error or
// REST 402/429), a circuit breaker marks Elastic as "out of quota" for a
// cooldown window (default 60 min, configurable via
// ELASTICEMAIL_QUOTA_COOLDOWN_MINUTES). During that window Elastic is skipped
// entirely and delivery goes straight to the fallback providers, so a 2,000+
// email/day blast never burns 10s timeouts against a provider that is known to
// be over its limit. After the cooldown the chain retries Elastic automatically
// (in case you topped up or the monthly counter reset).

const gmailUser = (process.env.GMAIL_USER || '').trim();
const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

// Elastic Email SMTP (primary). These are the SMTP_HOST/SMTP_PORT/SMTP_USER/
// SMTP_PASS values — for Elastic Email that is smtp.elasticemail.com:2525.
const smtpHost = (process.env.SMTP_HOST || '').trim();
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = (process.env.SMTP_USER || '').trim();
const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

// Optional branded sender for the REST providers, e.g.
//   EMAIL_FROM='\"HTU Elect\" <no-reply@htu.edu.gh>'
// SMTP sends from the authenticated account.
const EMAIL_FROM = process.env.EMAIL_FROM
  ? process.env.EMAIL_FROM.trim()
  : (gmailUser ? `"HTU ELECT" <${gmailUser}>` : null);

// Resend only sends from addresses on a domain verified in the Resend dashboard
// (Settings → Domains), or from its built-in onboarding@resend.dev test sender
// (which only delivers to the account owner's inbox). It rejects arbitrary
// addresses like the Elastic sender in EMAIL_FROM, so Resend gets its own sender.
const RESEND_FROM = process.env.RESEND_FROM
  ? process.env.RESEND_FROM.trim()
  : 'HTU Elect <onboarding@resend.dev>';

const smtpConfigured = !!(smtpHost && smtpUser && smtpPass);
const gmailConfigured = !!(gmailUser && gmailPass);
const restConfigured = !!(process.env.RESEND_API_KEY || process.env.ELASTICEMAIL_API_KEY || (process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY));

if (!smtpConfigured && !gmailConfigured && !restConfigured) {
  console.warn(
    '[Email Service] No email provider configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS ' +
    '(Elastic Email SMTP — primary), or GMAIL_USER/GMAIL_APP_PASSWORD (Gmail SMTP), or ' +
    'RESEND_API_KEY / ELASTICEMAIL_API_KEY (REST). Delivery will fail until one is set.'
  );
}

// ── Quota circuit breaker (Elastic Email) ────────────────────────────────────
const QUOTA_COOLDOWN_MS = (parseInt(process.env.ELASTICEMAIL_QUOTA_COOLDOWN_MINUTES || '60', 10) || 60) * 60 * 1000;
let elasticQuotaExhaustedUntil = 0;
let elasticCooldownLoggedAt = 0;

/** True while Elastic Email is on quota cooldown. */
function elasticQuotaBlocked() {
  return Date.now() < elasticQuotaExhaustedUntil;
}

/** Detect provider "quota / limit / billing" errors (SMTP text or REST status). */
function isQuotaError(message, status) {
  if (status === 402 || status === 429) return true;
  if (!message) return false;
  const text = String(message).toLowerCase();
  return /quota|daily.{0,24}limit|monthly.{0,24}limit|limit.{0,24}(exceed|reach|expired)|exceed.{0,24}(limit|quota)|insufficient.{0,24}(fund|balance|credit)|billing|suspended|out of (credit|emails)|too many requests/.test(text);
}

/** Flip the Elastic Email circuit breaker on after a quota error. */
function markElasticQuotaExhausted(reason) {
  elasticQuotaExhaustedUntil = Date.now() + QUOTA_COOLDOWN_MS;
  console.warn(
    `[Email Service] ⚠️ ELASTIC EMAIL QUOTA EXHAUSTED (${reason || 'unknown'}). ` +
    `Falling back to Gmail/EmailJS/Resend for the next ${Math.round(QUOTA_COOLDOWN_MS / 60000)} minutes. ` +
    'Top up Elastic Email or wait for the monthly reset — the chain retries it automatically.'
  );
}

function elasticCooldownStatus() {
  const remaining = Math.max(0, Math.round((elasticQuotaExhaustedUntil - Date.now()) / 60000));
  return `cooldown active (${remaining} min remaining)`;
}

// ── SMTP Transporters ────────────────────────────────────────────────────────
// 1. Elastic Email SMTP — PRIMARY
const elasticSmtpTransport = smtpConfigured
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

// 2. Gmail SMTP (Port 465 SSL) — FALLBACK
const gmailTransporter = gmailConfigured
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    })
  : null;

// 3. Gmail SMTP (Port 587 STARTTLS) — FALLBACK
const gmailFallbackTransporter = gmailConfigured
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: gmailUser, pass: gmailPass },
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
 * Dispatch an HTML / text email with multi-provider fallbacks.
 * Elastic Email is primary; Gmail / EmailJS / Resend only engage when Elastic
 * fails or its quota is exhausted.
 * Resolves with the provider response on success, or null when every
 * configured provider failed.
 */
async function sendEmailNotification(to, subject, text, html) {
  if (!to || !to.trim() || !to.includes('@')) {
    console.warn('[Email Service Warning] Invalid recipient email address provided:', to);
    return null;
  }

  const htmlBody = html || defaultHtml(subject, text);
  const elasticFrom = smtpUser ? `"HTU ELECT" <${smtpUser}>` : null;

  // ── PRIMARY: Elastic Email ─────────────────────────────────────────────
  const quotaBlocked = elasticQuotaBlocked();

  // Log the cooldown skip once per cooldown window (not once per email, so a
  // 2,000-recipient broadcast doesn't spam 2,000 identical warning lines).
  if (quotaBlocked && Date.now() > elasticCooldownLoggedAt) {
    elasticCooldownLoggedAt = Date.now();
    console.warn(`[Email Service] Elastic Email on quota cooldown (${elasticCooldownStatus()}) — using fallback providers.`);
  }

  // Attempt 1: Elastic Email SMTP
  if (elasticSmtpTransport && !quotaBlocked) {
    try {
      const info = await elasticSmtpTransport.sendMail({
        from: elasticFrom,
        to,
        subject,
        text,
        html: htmlBody
      });
      console.log('[Elastic Email SMTP] Email dispatched to', to, 'Message ID:', info.messageId);
      return { ...info, provider: 'elastic-smtp' };
    } catch (err) {
      if (isQuotaError(err.message)) {
        markElasticQuotaExhausted(err.message);
        return sendEmailNotification(to, subject, text, html); // retry once on fallbacks
      }
      console.warn('[Elastic Email SMTP Error]:', err.message || err);
    }
  }

  // Attempt 2: Elastic Email REST API (still primary; only after SMTP failed
  // for a non-quota reason, or when SMTP was never configured)
  const elasticApiKey = process.env.ELASTICEMAIL_API_KEY;
  if (elasticApiKey && !quotaBlocked) {
    try {
      const res = await fetch('https://api.elasticemail.com/v4/emails/transactional', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ElasticEmail-ApiKey': elasticApiKey
        },
        body: JSON.stringify({
          Recipients: { To: [to] },
          Content: {
            From: EMAIL_FROM || smtpUser || gmailUser || 'no-reply@htu.edu.gh',
            Subject: subject,
            Body: [
              { ContentType: 'HTML', Charset: 'UTF-8', Content: htmlBody }
            ],
            TextBody: text
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[Elastic Email API] Email dispatched successfully to', to, 'ID:', data?.transactionID || data?.messageID || JSON.stringify(data));
        return { ...data, provider: 'elastic-rest' };
      } else {
        const errText = await res.text();
        if (isQuotaError(errText, res.status)) {
          markElasticQuotaExhausted(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
          return sendEmailNotification(to, subject, text, html); // retry once on fallbacks
        }
        console.error('[Elastic Email API Error]:', errText);
      }
    } catch (elasticErr) {
      console.error('[Elastic Email API Exception]:', elasticErr.message || elasticErr);
    }
  }

  // ── FALLBACKS (engage when Elastic is unavailable or over quota) ────────
  const smtpFallbacks = [gmailTransporter, gmailFallbackTransporter].filter(Boolean);
  for (const transporter of smtpFallbacks) {
    try {
      const info = await transporter.sendMail({
        from: `"HTU ELECT" <${gmailUser}>`,
        to,
        subject,
        text,
        html: htmlBody
      });
      console.log('[Gmail SMTP Fallback] Email dispatched to', to, 'Message ID:', info.messageId);
      return { ...info, provider: 'gmail-smtp' };
    } catch (err) {
      console.warn('[Gmail SMTP Fallback Error]:', err.message || err);
    }
  }

  // Fallback: EmailJS REST API
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (serviceId && templateId && publicKey) {
    try {
      const payload = {
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_name: to.split('@')[0],
          to_email: to,
          subject,
          message: text
        }
      };
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        console.log('[EmailJS Fallback] Email dispatched successfully to', to);
        return { fallback: true, provider: 'emailjs' };
      } else {
        const errText = await res.text();
        console.error('[EmailJS Fallback Error]:', errText);
      }
    } catch (emailjsErr) {
      console.error('[EmailJS Fallback Error]:', emailjsErr.message);
    }
  }

  // Fallback: Resend REST API (bypasses blocked cloud SMTP ports)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to,
          subject,
          text,
          html: htmlBody
        })
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[Resend API] Email dispatched successfully to', to, 'ID:', data.id);
        return { ...data, provider: 'resend' };
      } else {
        const errText = await res.text();
        console.error('[Resend API Error]:', errText);
      }
    } catch (resendErr) {
      console.error('[Resend API Exception]:', resendErr.message || resendErr);
    }
  }

  return null;
}

/**
 * Dispatch OTP verification code via the configured providers.
 * @param {string} email recipient
 * @param {string} name recipient name
 * @param {string} otp 6-digit code
 * @param {number} expiryMinutes how long the code is valid (default 10)
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
  gmailTransporter,
  sendEmailNotification,
  sendOtpViaEmail,
  // Exposed for diagnostics / test scripts
  isQuotaError,
  elasticQuotaBlocked,
  markElasticQuotaExhausted
};
