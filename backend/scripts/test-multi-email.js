const assert = require('assert');

// Mock environment for multi-account testing
process.env.SMTP_HOST = 'mail.htu.edu.gh';
process.env.SMTP_PORT = '587';
process.env.SMTP_MAX_PER_HOUR = '2';
process.env.SMTP_ACCOUNTS = JSON.stringify([
  { user: 'acc1@htu.edu.gh', pass: 'pass1', maxPerHour: 2 },
  { user: 'acc2@htu.edu.gh', pass: 'pass2', maxPerHour: 2 },
  { user: 'acc3@htu.edu.gh', pass: 'pass3', maxPerHour: 2 }
]);

const emailService = require('../services/emailService');

async function testMultiAccountPool() {
  console.log('--- Testing Multi-Account SMTP Configuration ---');

  // 1. Test parsing account configs
  const configs = emailService.parseAccountConfigs();
  console.log(`Parsed ${configs.length} accounts.`);
  assert.strictEqual(configs.length, 3, 'Should parse 3 account configurations');
  assert.strictEqual(configs[0].user, 'acc1@htu.edu.gh');
  assert.strictEqual(configs[0].from, '"HTU ELECT" <acc1@htu.edu.gh>');
  assert.strictEqual(configs[1].user, 'acc2@htu.edu.gh');
  assert.strictEqual(configs[2].user, 'acc3@htu.edu.gh');
  console.log('✅ Configuration parsing verified.');

  // 2. Test pool initialization
  assert.strictEqual(emailService.smtpPool.length, 3, 'Pool should contain 3 transporters');
  console.log('✅ Pool initialization verified.');

  // 3. Test mock send email with round robin and quota tracking
  console.log('\n--- Testing Round-Robin & Quota Tracking ---');

  // Mock transporter sendMail for each account in pool
  emailService.smtpPool.forEach((acc) => {
    acc.transporter.sendMail = async (options) => {
      // Simulate failover if password is fail
      if (options.from.includes('acc1') && acc.sentThisHour >= 1 && acc.simulateFail) {
        throw new Error('Simulated SMTP authentication error');
      }
      return { messageId: `msg_${acc.user}_${Date.now()}` };
    };
  });

  // Send email 1 -> should use acc1
  let res1 = await emailService.sendEmailNotification('voter1@htu.edu.gh', 'Test 1', 'Text 1');
  assert.strictEqual(res1.account, 'acc1@htu.edu.gh');
  console.log('Email 1 sent via:', res1.account);

  // Send email 2 -> should use acc2
  let res2 = await emailService.sendEmailNotification('voter2@htu.edu.gh', 'Test 2', 'Text 2');
  assert.strictEqual(res2.account, 'acc2@htu.edu.gh');
  console.log('Email 2 sent via:', res2.account);

  // Send email 3 -> should use acc3
  let res3 = await emailService.sendEmailNotification('voter3@htu.edu.gh', 'Test 3', 'Text 3');
  assert.strictEqual(res3.account, 'acc3@htu.edu.gh');
  console.log('Email 3 sent via:', res3.account);

  // Send email 4 -> should wrap back to acc1
  let res4 = await emailService.sendEmailNotification('voter4@htu.edu.gh', 'Test 4', 'Text 4');
  assert.strictEqual(res4.account, 'acc1@htu.edu.gh');
  console.log('Email 4 sent via:', res4.account);

  // Now acc1 has sent 2 emails (quota = 2). Active pool should exclude acc1.
  const activePool = emailService.getActivePoolAccounts();
  console.log(`Active pool size after acc1 reaches quota (2/2): ${activePool.length}`);
  assert.strictEqual(activePool.length, 2, 'Active pool should now have 2 accounts (acc2 & acc3)');

  // Send email 5 -> should use acc2 (since acc1 is quota-limited)
  let res5 = await emailService.sendEmailNotification('voter5@htu.edu.gh', 'Test 5', 'Text 5');
  assert.strictEqual(res5.account, 'acc2@htu.edu.gh');
  console.log('Email 5 sent via active pool:', res5.account);

  // 4. Test Automatic Failover
  console.log('\n--- Testing Automatic Failover ---');
  // Enable simulated fail on acc3
  const acc3Pool = emailService.smtpPool.find(a => a.user === 'acc3@htu.edu.gh');
  acc3Pool.transporter.sendMail = async () => {
    throw new Error('Connection timed out on acc3');
  };

  // Send email 6 -> round robin points to acc3, but acc3 fails, so it automatically fails over to acc2
  let res6 = await emailService.sendEmailNotification('voter6@htu.edu.gh', 'Test Failover', 'Text 6');
  assert.ok(res6, 'Email should succeed despite acc3 error');
  assert.notStrictEqual(res6.account, 'acc3@htu.edu.gh', 'Should not be acc3 since acc3 failed');
  console.log('Email 6 successfully failed over to:', res6.account);

  console.log('\n🎉 ALL MULTI-ACCOUNT EMAIL TESTS PASSED SUCCESSFULLY!');
}

testMultiAccountPool().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
