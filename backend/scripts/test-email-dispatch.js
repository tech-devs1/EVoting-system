require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Voter, Election, VotedVoter, sequelize } = require('../models');
const { uploadCsv, sendInvitations, sendBroadcastMessage } = require('../controllers/electionController');

async function testEmailDispatchAndRoster() {
  console.log('🧪 Testing CSV Upload, Voter Association, Invitations, and Broadcast Messaging...');

  const testElectionId = `test_el_${Date.now()}`;
  const testTenantId = 'compssa';

  try {
    // 1. Create a dummy election
    const election = await Election.create({
      id: testElectionId,
      tenantId: testTenantId,
      title: 'Test Email Dispatch Election',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600000).toISOString(),
      status: 'active'
    });

    console.log('✅ Created test election:', election.id);

    // 2. Simulate CSV Upload
    const mockReqCsv = {
      params: { id: testElectionId },
      user: { tenantId: testTenantId, email: 'admin@htu.edu.gh', role: 'admin' },
      body: {
        members: [
          {
            indexNumber: '100200300',
            name: 'Test Voter 1',
            email: 'issakasaddick14@gmail.com',
            phone: '0240000000'
          }
        ]
      }
    };

    let csvResData = null;
    const mockResCsv = {
      status: (code) => ({
        json: (data) => { csvResData = data; return data; }
      })
    };

    await uploadCsv(mockReqCsv, mockResCsv);
    console.log('✅ CSV Upload result:', csvResData);

    // Verify voter record in DB
    const createdVoter = await Voter.findOne({ where: { electionId: testElectionId, email: 'issakasaddick14@gmail.com' } });
    if (!createdVoter) {
      throw new Error('Voter record was not updated with electionId during CSV upload!');
    }
    console.log('✅ Voter record correctly associated with election:', createdVoter.id, 'electionId:', createdVoter.electionId);

    // 3. Test sendInvitations
    const mockReqInv = {
      params: { id: testElectionId },
      user: { tenantId: testTenantId, email: 'admin@htu.edu.gh' },
      body: { recipientFilter: 'all' }
    };

    let invResData = null;
    const mockResInv = {
      status: (code) => ({
        json: (data) => { invResData = data; return data; }
      })
    };

    await sendInvitations(mockReqInv, mockResInv);
    console.log('✅ Send Invitations result:', invResData);

    // 4. Test sendBroadcastMessage
    const mockReqBrd = {
      params: { id: testElectionId },
      user: { tenantId: testTenantId, email: 'admin@htu.edu.gh' },
      body: {
        channel: 'email',
        recipientFilter: 'all',
        subject: 'Test Broadcast Subject',
        body: 'Hello {{voter_name}}, this is a test broadcast.'
      }
    };

    let brdResData = null;
    const mockResBrd = {
      status: (code) => ({
        json: (data) => { brdResData = data; return data; }
      })
    };

    await sendBroadcastMessage(mockReqBrd, mockResBrd);
    console.log('✅ Send Broadcast result:', brdResData);

    // Clean up
    await Voter.destroy({ where: { email: 'issakasaddick14@gmail.com', electionId: testElectionId } });
    await Election.destroy({ where: { id: testElectionId } });
    console.log('✅ Cleaned up test data.');
    console.log('🎉 All tests passed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

testEmailDispatchAndRoster();
