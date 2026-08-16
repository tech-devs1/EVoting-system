const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const app = require('../server');
const { sequelize } = require('../models');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING CPANEL STANDALONE BACKEND TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${testName}`);
      failed++;
    }
  }

  // 1. Database Connection & ORM Sync Verification
  console.log('1️⃣  Checking Database Connectivity & ORM Models...');
  try {
    await sequelize.authenticate();
    assert(true, 'Database connection authenticated successfully');
  } catch (err) {
    assert(false, `Database authentication failed: ${err.message}`);
  }

  // 2. Start In-Memory HTTP Server for Express App Test
  const http = require('http');
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`\n2️⃣  Testing API Endpoints on Standalone Server (${baseUrl})...`);

  // Helper for HTTP requests
  async function testRoute(routePath, method = 'GET', body = null) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${baseUrl}${routePath}`, options);
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }

  // Test /api root endpoint
  try {
    const res = await testRoute('/api');
    assert(res.status === 200 && res.json.status === 'success', 'GET /api responds with 200 success');
  } catch (err) {
    assert(false, `GET /api failed: ${err.message}`);
  }

  // Test /api/health
  try {
    const res = await testRoute('/api/health');
    assert(res.status === 200 && res.json.status === 'success', 'GET /api/health responds with 200 success');
  } catch (err) {
    assert(false, `GET /api/health failed: ${err.message}`);
  }

  // Test /api/status
  try {
    const res = await testRoute('/api/status');
    assert(res.status === 200 && res.json.status === 'success', 'GET /api/status responds with 200 success');
  } catch (err) {
    assert(false, `GET /api/status failed: ${err.message}`);
  }

  // 3. Test Email & Password Authentication Endpoints
  console.log('\n3️⃣  Testing Email & Password Authentication Flow...');

  // Signup test with invalid password format
  try {
    const res = await testRoute('/api/auth/register', 'POST', {
      studentId: '999999999',
      email: 'invalid_pass_test@htu.edu.gh',
      name: 'Test Student',
      password: 'weak'
    });
    assert(res.status === 400, 'POST /api/auth/register rejects weak password');
  } catch (err) {
    assert(false, `POST /api/auth/register password validation failed: ${err.message}`);
  }

  // Login test with invalid credentials
  try {
    const res = await testRoute('/api/auth/login', 'POST', {
      email: 'nonexistent_user_xyz@htu.edu.gh',
      password: 'Password123!'
    });
    assert(res.status === 401, 'POST /api/auth/login rejects invalid email/password');
  } catch (err) {
    assert(false, `POST /api/auth/login test failed: ${err.message}`);
  }

  // Non-registered email login test
  try {
    const res = await testRoute('/api/auth/login', 'POST', {
      email: 'issakasaddick14@gmail.com',
      password: 'any_password'
    });
    assert(res.status === 401 && res.json.status === 'error', 'POST /api/auth/login rejects unregistered superadmin email without DB account');
  } catch (err) {
    assert(false, `POST /api/auth/login Superadmin test failed: ${err.message}`);
  }

  server.close();

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
