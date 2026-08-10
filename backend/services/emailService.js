const nodemailer = require('nodemailer');

const gmailUser = process.env.GMAIL_USER || 'issakasaddick14@gmail.com';
const envPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const gmailPass = envPass || 'gvdpedxakuwihtuq';

// Primary Transporter: Standard Gmail Service (uses Port 465 under the hood with SSL)
// This is extremely reliable on cloud hosts like Railway/cPanel where Port 25/587 may be blocked
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailUser,
    pass: gmailPass
  },
  tls: { rejectUnauthorized: false },
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 8000
});

// Secondary Fallback Transporter (Port 587 STARTTLS)
const fallbackTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: gmailUser,
    pass: gmailPass
  },
  tls: { rejectUnauthorized: false },
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 8000
});

/**
 * Dispatch an HTML / text email using Gmail SMTP with dual-port fallbacks
 */
async function sendEmailNotification(to, subject, text, html) {
  const mailOptions = {
    from: `"HTU ELECT" <${gmailUser}>`,
    to,
    subject,
    text,
    html: html || `<div style="font-family: sans-serif; padding: 20px;"><h2>${subject}</h2><p>${text}</p></div>`
  };

  // Attempt 1: Primary Gmail Service Transporter (Port 465 SSL)
  try {
    const info = await gmailTransporter.sendMail(mailOptions);
    console.log('[Gmail SMTP Primary SSL] Email dispatched to', to, 'Message ID:', info.messageId);
    return info;
  } catch (primaryErr) {
    console.warn('[Gmail SMTP Primary SSL Error]:', primaryErr.message || primaryErr);
  }

  // Attempt 2: Secondary Port 587 STARTTLS Transporter
  try {
    const info = await fallbackTransporter.sendMail(mailOptions);
    console.log('[Gmail SMTP Fallback 587] Email dispatched to', to, 'Message ID:', info.messageId);
    return info;
  } catch (fallbackErr) {
    console.error('[Gmail SMTP Fallback 587 Error]:', fallbackErr.message || fallbackErr);
  }

  // Attempt 3: Send via EmailJS REST API if configured
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
        return { fallback: true };
      }
    } catch (emailjsErr) {
      console.error('[EmailJS Fallback Error]:', emailjsErr.message);
    }
  }

  // Attempt 4: Send via Resend REST API if configured (bypasses blocked cloud SMTP ports)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      console.log('[Resend API] Attempting to dispatch email to', to);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: 'HTU Elect <onboarding@resend.dev>',
          to,
          subject,
          text,
          html: html || `<div style="font-family: sans-serif; padding: 20px;"><h2>${subject}</h2><p>${text}</p></div>`
        })
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[Resend API] Email dispatched successfully to', to, 'ID:', data.id);
        return data;
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
 * Dispatch OTP verification code via Gmail SMTP (with fallback)
 */
async function sendOtpViaEmail(email, name, otp) {
  const subject = 'HTU Elect - Your 6-Digit Voting Access Code';
  const text = `Hello ${name || 'Voter'},\n\nYour 6-digit access OTP for the voting portal is: ${otp}\n\nThis code will expire in 10 minutes.\n\nThank you,\nHTU Elect Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #f4f6f9; border-radius: 8px;">
      <h2 style="color: #2563eb;">HTU Elect Voting Access Code</h2>
      <p>Hello <strong>${name || 'Voter'}</strong>,</p>
      <p>Use the following 6-digit verification code to unlock your voting ballot:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #10b981; padding: 16px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center; margin: 20px 0;">
        ${otp}
      </div>
      <p style="font-size: 13px; color: #6b7280;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
    </div>
  `;

  return sendEmailNotification(email, subject, text, html);
}

module.exports = {
  gmailTransporter,
  sendEmailNotification,
  sendOtpViaEmail
};
