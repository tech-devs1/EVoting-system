const { Election, Candidate, Voter, VotedVoter, Tenant, Position } = require('../models');
const { Op } = require('sequelize');

exports.getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const totalElections = await Election.count({ where: { tenantId } });
    const totalCandidates = await Candidate.count({ where: { electionId: { [Op.like]: 'el_%' } } });
    const totalVoters = await Voter.count({ where: { tenantId } });
    const totalVotes = await VotedVoter.count();

    res.status(200).json({
      status: 'success',
      data: {
        totalElections,
        totalCandidates,
        totalVoters,
        totalVotes
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch dashboard statistics' });
  }
};

exports.getDashboardFullStats = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'compssa';

    const elections = await Election.findAll({ where: { tenantId } });
    const electionIds = elections.map(e => e.id);

    const totalElections = elections.length;
    const activeElectionsCount = elections.filter(e => e.status === 'active').length;
    const totalCandidates = await Candidate.count({ where: { electionId: { [Op.in]: electionIds } } });
    const totalVoters = await Voter.count({ where: { tenantId } });
    const totalVotesCast = await VotedVoter.count({ where: { electionId: { [Op.in]: electionIds } } });

    // Build electionResults structure for frontend Admin Dashboard
    const electionResults = [];
    for (const el of elections) {
      const elItem = el.toJSON();
      const candidates = await Candidate.findAll({ where: { electionId: el.id } });
      const votesCount = await VotedVoter.count({ where: { electionId: el.id } });
      const votersCount = await Voter.count({ where: { electionId: el.id } });

      electionResults.push({
        election: {
          ...elItem,
          totalVoters: votersCount,
          voterCount: votersCount,
          totalVotesCast: votesCount
        },
        candidates: candidates.map(c => c.toJSON()),
        totalVotes: votesCount
      });
    }

    // Top candidates for live standings widget
    const topCandidatesRaw = await Candidate.findAll({
      where: { electionId: { [Op.in]: electionIds } },
      order: [['votes', 'DESC']],
      limit: 6
    });

    const topCandidates = topCandidatesRaw.map(c => ({
      name: c.name,
      votes: c.votes || 0
    }));

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalElections,
          totalCandidates,
          totalVoters,
          totalVotesCast,
          activeElectionsCount,
          uniqueVotersCount: totalVotesCast,
          voterTurnout: totalVoters > 0 ? ((totalVotesCast / totalVoters) * 100).toFixed(1) + '%' : '0%',
          topCandidates
        },
        electionResults,
        elections: elections.map(e => e.toJSON()),
        flaggedUsers: []
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard full stats:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch dashboard details' });
  }
};
