const http = require('http');
const jwt = require('jsonwebtoken');
const { sequelize, Tenant, Election, Position, Candidate } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'htu-elect-secret-jwt-key-2025';

async function runFeatureVerificationTests() {
  console.log('🧪 Starting Verification Test for Newly Implemented Features...');

  const app = require('../server');
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Server listening on port ${port}`);

  const adminToken = jwt.sign(
    { id: 'usr_admin_test', email: 'admin@htu.edu.gh', role: 'admin', tenantId: 'htu-test' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const superadminToken = jwt.sign(
    { id: 'usr_superadmin_test', email: 'superadmin@htu.edu.gh', role: 'superadmin', tenantId: 'global' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Ensure test tenant exists
  await Tenant.findOrCreate({
    where: { id: 'htu-test' },
    defaults: { name: 'HTU Test Tenant', status: 'active', adminEmail: 'admin@htu.edu.gh' }
  });

  const testElectionId = `el_test_feat_${Date.now()}`;

  // 1. Create Test Election in DB
  await Election.create({
    id: testElectionId,
    tenantId: 'htu-test',
    title: '2026 Feature Verification Election',
    description: 'Test election for verifying position, candidates, invitations, PDF, and audit',
    status: 'active',
    startDate: new Date(Date.now() - 3600000).toISOString(),
    endDate: new Date(Date.now() + 86400000).toISOString()
  });
  console.log('✅ Created test election');

  // Helper request function
  async function request(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    const contentType = res.headers.get('content-type') || '';
    let body = null;
    if (contentType.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    return { status: res.status, headers: res.headers, body };
  }

  // 2. Test getPositions (Persistence)
  const posRes = await request(`/api/elections/${testElectionId}/positions`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('GET positions status:', posRes.status, 'Data count:', posRes.body.data?.length);
  if (posRes.status !== 200 || !Array.isArray(posRes.body.data) || posRes.body.data.length === 0) {
    throw new Error('getPositions failed or returned empty data');
  }

  // 3. Test Create Candidate
  const candRes = await request('/api/candidates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'John Doe Candidate',
      position: 'President',
      manifesto: 'Leading HTU forward',
      photoUrl: 'https://example.com/photo.jpg',
      electionId: testElectionId,
      ballotNumber: 1
    })
  });
  console.log('POST create candidate status:', candRes.status, 'Cand ID:', candRes.body.data?.id);
  if (candRes.status !== 201 || !candRes.body.data?.id) {
    throw new Error('createCandidate failed');
  }
  const candId = candRes.body.data.id;

  // 4. Test Update Candidate (PATCH)
  const updateCandRes = await request(`/api/candidates/${candId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'John Doe Updated',
      ballotNumber: 2
    })
  });
  console.log('PATCH update candidate status:', updateCandRes.status, 'Updated Name:', updateCandRes.body.data?.name);
  if (updateCandRes.status !== 200 || updateCandRes.body.data?.name !== 'John Doe Updated') {
    throw new Error('updateCandidate failed');
  }

  // 5. Test Send Invitations
  const inviteRes = await request(`/api/elections/${testElectionId}/send-invitations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ recipientFilter: 'all' })
  });
  console.log('POST send-invitations status:', inviteRes.status, 'Message:', inviteRes.body.message);
  if (inviteRes.status !== 200) {
    throw new Error('send-invitations endpoint failed');
  }

  // 6. Test Results PDF Generation
  const pdfRes = await request(`/api/elections/${testElectionId}/results/pdf`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('GET results/pdf status:', pdfRes.status, 'Content-Type:', pdfRes.headers.get('content-type'));
  if (pdfRes.status !== 200 || !pdfRes.headers.get('content-type')?.includes('application/pdf')) {
    throw new Error('results/pdf endpoint failed');
  }

  // 7. Test Audit Records
  const auditRes = await request(`/api/elections/${testElectionId}/audit-records`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('GET audit-records status:', auditRes.status, 'Data length:', auditRes.body.data?.length);
  if (auditRes.status !== 200 || !Array.isArray(auditRes.body.data)) {
    throw new Error('audit-records endpoint failed');
  }

  // 8. Test Superadmin Audit Logs
  const superAuditRes = await request('/api/superadmin/audit', {
    headers: { Authorization: `Bearer ${superadminToken}` }
  });
  console.log('GET superadmin/audit status:', superAuditRes.status, 'Data length:', superAuditRes.body.data?.length);
  if (superAuditRes.status !== 200 || !Array.isArray(superAuditRes.body.data)) {
    throw new Error('superadmin/audit endpoint failed');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL FEATURE VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');

  server.close();
  process.exit(0);
}

runFeatureVerificationTests().catch(err => {
  console.error('❌ Feature Verification Error:', err);
  process.exit(1);
});
