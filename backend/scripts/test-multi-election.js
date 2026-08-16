require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Voter, Election, Tenant, VotedVoter, sequelize } = require('../models');
const { uploadCsv, sendInvitations, sendBroadcastMessage, getEligibleElections, requestAccessOtp } = require('../controllers/electionController');

async function testMultiElectionAndTenant() {
  console.log('🧪 Testing Multi-Election and Multi-Tenant Roster Uploads & Email Dispatch...');

  const election1Id = `el_tenant1_${Date.now()}`;
  const election2Id = `el_tenant2_${Date.now() + 1}`;
  const tenant1 = 'compssa';
  const tenant2 = `tnt_${Date.now()}`;
  const testEmail = 'issakasaddick14@gmail.com';

  try {
    // Ensure tenants exist
    await Tenant.findOrCreate({
      where: { id: tenant1 },
      defaults: { name: 'COMPSSA Department', brandColor: '#2563eb' }
    });

    await Tenant.findOrCreate({
      where: { id: tenant2 },
      defaults: { name: 'Faculty of Engineering', brandColor: '#10b981' }
    });

    // 1. Create two elections across two tenants
    const election1 = await Election.create({
      id: election1Id,
      tenantId: tenant1,
      title: 'COMPSSA Presidential Election',
      startDate: new Date(Date.now() - 3600000).toISOString(),
      endDate: new Date(Date.now() + 3600000).toISOString(),
      status: 'active'
    });

    const election2 = await Election.create({
      id: election2Id,
      tenantId: tenant2,
      title: 'Engineering Faculty Election',
      startDate: new Date(Date.now() - 3600000).toISOString(),
      endDate: new Date(Date.now() + 3600000).toISOString(),
      status: 'active'
    });

    console.log('✅ Created Election 1:', election1.id, 'under tenant:', tenant1);
    console.log('✅ Created Election 2:', election2.id, 'under tenant:', tenant2);

    // 2. Upload CSV for Election 1
    const reqCsv1 = {
      params: { id: election1Id },
      user: { tenantId: tenant1, email: 'admin@compssa.edu.gh', role: 'admin' },
      body: { members: [{ indexNumber: '1001', name: 'Issaka Saddick', email: testEmail }] }
    };

    let csv1Res = null;
    await uploadCsv(reqCsv1, { status: () => ({ json: (d) => { csv1Res = d; return d; } }) });
    console.log('✅ CSV Upload Election 1:', csv1Res);

    // 3. Upload CSV for Election 2 (same user email!)
    const reqCsv2 = {
      params: { id: election2Id },
      user: { tenantId: tenant2, email: 'admin@eng.edu.gh', role: 'admin' },
      body: { members: [{ indexNumber: '1001', name: 'Issaka Saddick', email: testEmail }] }
    };

    let csv2Res = null;
    await uploadCsv(reqCsv2, { status: () => ({ json: (d) => { csv2Res = d; return d; } }) });
    console.log('✅ CSV Upload Election 2:', csv2Res);

    // 4. Verify distinct roster entries exist for both elections!
    const rosters = await Voter.findAll({ where: { email: testEmail } });
    console.log(`✅ Found ${rosters.length} distinct roster records for ${testEmail}:`, rosters.map(r => ({ id: r.id, electionId: r.electionId, tenantId: r.tenantId })));

    if (rosters.length < 2) {
      throw new Error('Voter was overwritten instead of creating distinct roster entries for both elections!');
    }

    // 5. Test getEligibleElections for this voter
    let eligibleRes = null;
    const reqEligible = { user: { uid: 'vtr_user_1', email: testEmail, indexNumber: '1001', role: 'voter' } };
    await getEligibleElections(reqEligible, { status: () => ({ json: (d) => { eligibleRes = d; return d; } }) });

    const eligibleIds = eligibleRes.data.map(e => e.id);
    console.log('✅ Voter eligible elections:', eligibleIds);

    if (!eligibleIds.includes(election1Id) || !eligibleIds.includes(election2Id)) {
      throw new Error('Voter does not see both elections in eligible elections list!');
    }

    // 6. Send Invitations for Election 1
    let inv1Res = null;
    const reqInv1 = { params: { id: election1Id }, user: { tenantId: tenant1, email: 'admin@compssa.edu.gh' }, body: { recipientFilter: 'all' } };
    await sendInvitations(reqInv1, { status: () => ({ json: (d) => { inv1Res = d; return d; } }) });
    console.log('✅ Send Invitations Election 1:', inv1Res);

    // 7. Send Broadcast for Election 2
    let brd2Res = null;
    const reqBrd2 = {
      params: { id: election2Id },
      user: { tenantId: tenant2, email: 'admin@eng.edu.gh' },
      body: { channel: 'email', recipientFilter: 'all', subject: 'Engineering Election Notice', body: 'Hello {{voter_name}}, please vote in {{election_title}}.' }
    };
    await sendBroadcastMessage(reqBrd2, { status: () => ({ json: (d) => { brd2Res = d; return d; } }) });
    console.log('✅ Send Broadcast Election 2:', brd2Res);

    // Clean up
    await Voter.destroy({ where: { email: testEmail } });
    await Election.destroy({ where: { id: [election1Id, election2Id] } });
    await Tenant.destroy({ where: { id: tenant2 } });
    console.log('✅ Cleaned up test data.');
    console.log('🎉 Multi-Election and Multi-Tenant tests passed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Multi-Election test failed with error:', err);
    process.exit(1);
  }
}

testMultiElectionAndTenant();
