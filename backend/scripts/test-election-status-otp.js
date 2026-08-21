const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { computeElectionStatus, parseDateUTC } = require('../services/electionStatus');
const { Election, Voter } = require('../models');

async function testElectionStatusAndOtp() {
  console.log('====================================================');
  console.log('🧪 TESTING ELECTION STATUS & ACCESS OTP DISPATCH');
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

  // Test 1: Date string parsing via parseDateUTC
  const now = Date.now();
  const pastISOString = new Date(now - 3600 * 1000).toISOString().slice(0, 19); // "YYYY-MM-DDTHH:mm:ss" without Z
  const futureISOString = new Date(now + 3600 * 1000).toISOString().slice(0, 19);

  const activeElectionMock = {
    title: '2026 COMPSSA EXECUTIVE ELECTION',
    status: 'scheduled', // DB status might say scheduled before auto-computation
    startDate: pastISOString,
    endDate: futureISOString
  };

  const computedStatus = computeElectionStatus(activeElectionMock);
  assert(computedStatus === 'active', 'ISO-like start date (1h ago) correctly evaluates as "active"');

  // Test 2: Scheduled election computation
  const futureStartISO = new Date(now + 3600 * 1000).toISOString().slice(0, 19);
  const futureEndISO = new Date(now + 7200 * 1000).toISOString().slice(0, 19);
  const scheduledElectionMock = {
    title: 'Upcoming Poll',
    status: 'scheduled',
    startDate: futureStartISO,
    endDate: futureEndISO
  };

  const scheduledStatus = computeElectionStatus(scheduledElectionMock);
  assert(scheduledStatus === 'scheduled', 'Future start date correctly evaluates as "scheduled"');

  // Test 3: Ended election computation
  const pastStartISO = new Date(now - 7200 * 1000).toISOString().slice(0, 19);
  const pastEndISO = new Date(now - 3600 * 1000).toISOString().slice(0, 19);
  const endedElectionMock = {
    title: 'Closed Poll',
    status: 'active',
    startDate: pastStartISO,
    endDate: pastEndISO
  };

  const endedStatus = computeElectionStatus(endedElectionMock);
  assert(endedStatus === 'ended', 'Past end date correctly evaluates as "ended"');

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

testElectionStatusAndOtp();
