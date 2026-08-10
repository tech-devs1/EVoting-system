require('dotenv').config({ path: './backend/.env' });
const nodemailer = require('nodemailer');

const gmailUser = process.env.GMAIL_USER || 'issakasaddick14@gmail.com';
const envPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const gmailPass = envPass || 'gvdpedxakuwihtuq';

console.log('Testing Gmail SMTP credentials:');
console.log('GMAIL_USER:', gmailUser);
console.log('GMAIL_APP_PASSWORD length:', gmailPass.length);

async function testPrimary() {
  console.log('\n--- Attempting Port 465 (SSL) ---');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
    tls: { rejectUnauthorized: false }
  });
  try {
    const info = await transporter.sendMail({
      from: `"HTU ELECT" <${gmailUser}>`,
      to: 'issakasaddick14@gmail.com',
      subject: 'HTU Elect - Test OTP Email',
      text: 'This is a test email to verify Gmail SMTP configuration.'
    });
    console.log('✅ Port 465 SUCCESS! Message ID:', info.messageId);
    return true;
  } catch (err) {
    console.error('❌ Port 465 FAILED:', err.message);
    return false;
  }
}

async function testSecondary() {
  console.log('\n--- Attempting Port 587 (STARTTLS) ---');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: gmailUser, pass: gmailPass },
    tls: { rejectUnauthorized: false }
  });
  try {
    const info = await transporter.sendMail({
      from: `"HTU ELECT" <${gmailUser}>`,
      to: 'issakasaddick14@gmail.com',
      subject: 'HTU Elect - Test OTP Email (587)',
      text: 'This is a test email via Port 587.'
    });
    console.log('✅ Port 587 SUCCESS! Message ID:', info.messageId);
    return true;
  } catch (err) {
    console.error('❌ Port 587 FAILED:', err.message);
    return false;
  }
}

async function run() {
  const p = await testPrimary();
  if (!p) {
    await testSecondary();
  }
  process.exit(0);
}

run();
