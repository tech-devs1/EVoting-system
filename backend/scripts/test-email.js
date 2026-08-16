require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv').config();

const { sendEmailNotification } = require('../services/emailService');

const to = process.argv[2] || process.env.TEST_EMAIL_TO || 'issakasaddick14@gmail.com';

console.log('Testing email delivery via cPanel SMTP');
console.log('Recipient:', to);

async function run() {
  const result = await sendEmailNotification(
    to,
    'HTU Elect - Test Email',
    'This is a test email to verify the provider chain. If you received this, email delivery is working.'
  );
  if (result) {
    console.log('✅ Email delivered via provider:', result.provider, '(id:', result.messageId || result.id || 'n/a', ')');
  } else {
    console.error('❌ Email could not be delivered by any configured provider. Check the logs above for which provider errored.');
    process.exitCode = 1;
  }
}

run();
