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
    const tenantId = req.user.tenantId;

    const elections = await Election.findAll({ where: { tenantId } });
    const electionIds = elections.map(e => e.id);

    const totalElections = elections.length;
    const totalCandidates = await Candidate.count({ where: { electionId: { [Op.in]: electionIds } } });
    const totalVoters = await Voter.count({ where: { tenantId, electionId: { [Op.in]: electionIds } } });
    const totalVotesCast = await VotedVoter.count({ where: { electionId: { [Op.in]: electionIds } } });

    res.status(200).json({
      status: 'success',
      data: {
        statistics: {
          totalElections,
          totalCandidates,
          totalVoters,
          totalVotesCast,
          voterTurnout: totalVoters > 0 ? ((totalVotesCast / totalVoters) * 100).toFixed(1) + '%' : '0%'
        },
        elections: elections.map(e => {
          const item = e.toJSON();
          return {
            id: item.id,
            title: item.title,
            status: item.status,
            startDate: item.startDate,
            endDate: item.endDate
          };
        })
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard full stats:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch dashboard details' });
  }
};
