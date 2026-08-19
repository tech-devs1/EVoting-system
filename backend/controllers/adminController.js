const { Election, Candidate, Voter, VotedVoter, Vote, Tenant, Position } = require('../models');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');

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
    const headerTenant = req.headers['x-tenant-id'];
    const tenantId = req.user?.tenantId || headerTenant || 'compssa';

    // Find all elections for tenant or if admin is superadmin/global
    let whereClause = {};
    if (req.user?.role !== 'superadmin' && tenantId !== 'global') {
      whereClause = { tenantId };
    }
    const elections = await Election.findAll({ where: whereClause });
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

/**
 * Detailed analytics for the /admin/analytics page: participation per
 * election (bar chart), ballots-per-hour (line chart) and a per-election
 * performance summary table.
 */
exports.getAnalytics = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'compssa';
    const whereClause = {};
    if (req.user?.role !== 'superadmin' && tenantId !== 'global') {
      whereClause.tenantId = tenantId;
    }
    const elections = await Election.findAll({ where: whereClause });

    // Per-election performance summary
    const performanceSummary = [];
    for (const el of elections) {
      const total = await Voter.count({ where: { electionId: el.id } });
      const cast = await VotedVoter.count({ where: { electionId: el.id } });
      performanceSummary.push({
        name: el.title,
        total,
        cast,
        rate: total > 0 ? ((cast / total) * 100).toFixed(1) + '%' : '0%',
        status: el.status
      });
    }

    // Participation by election (bar chart)
    const labels = elections.map(e => (e.title.length > 18 ? e.title.slice(0, 18) + '…' : e.title));
    const percentages = elections.map(el => {
      const summary = performanceSummary.find(s => s.name === el.title);
      return summary && summary.total > 0 ? Number(summary.rate.replace('%', '')) : 0;
    });
    const departmentParticipation = {
      labels,
      datasets: [{ label: 'Turnout %', data: percentages, backgroundColor: '#2563eb', borderRadius: 6 }]
    };

    // Peak voting times: bucket ballots cast by hour of day (line chart)
    const electionIds = elections.map(e => e.id);
    const votes = electionIds.length
      ? await Vote.findAll({ where: { electionId: { [Op.in]: electionIds } }, attributes: ['timestamp'] })
      : [];
    const hourCounts = new Array(24).fill(0);
    votes.forEach(v => {
      const hour = new Date(Number(v.timestamp)).getHours();
      if (!isNaN(hour) && hour >= 0 && hour < 24) hourCounts[hour] += 1;
    });
    const peakVotingTimes = {
      labels: Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`),
      datasets: [{
        label: 'Ballots cast',
        data: hourCounts,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.12)',
        fill: true,
        tension: 0.3
      }]
    };

    res.status(200).json({
      status: 'success',
      data: { departmentParticipation, peakVotingTimes, performanceSummary }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch analytics' });
  }
};

/**
 * Export analytics as CSV (or a simple PDF) for the /admin/export/:format page.
 */
exports.exportAnalytics = async (req, res) => {
  try {
    const format = String(req.params.format || 'csv').toLowerCase();
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'compssa';
    const whereClause = {};
    if (req.user?.role !== 'superadmin' && tenantId !== 'global') {
      whereClause.tenantId = tenantId;
    }
    const elections = await Election.findAll({ where: whereClause });

    const rows = [];
    for (const el of elections) {
      const total = await Voter.count({ where: { electionId: el.id } });
      const cast = await VotedVoter.count({ where: { electionId: el.id } });
      rows.push({
        election: el.title,
        status: el.status,
        totalVoters: total,
        votesCast: cast,
        turnout: total > 0 ? ((cast / total) * 100).toFixed(2) + '%' : '0%'
      });
    }

    const csv = 'Election,Status,Total Voters,Votes Cast,Turnout\n' +
      rows.map(r => `"${r.election}","${r.status}",${r.totalVoters},${r.votesCast},"${r.turnout}"`).join('\n');

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const filename = `HTU_Elect_Analytics_${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);
      doc.fillColor('#1E3A8A').fontSize(16).font('Helvetica-Bold').text('HTU ELECT ELECTION ANALYTICS', { align: 'center' });
      doc.moveDown(0.8);
      rows.forEach(r => {
        doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text(r.election);
        doc.fillColor('#475569').fontSize(9).font('Helvetica')
          .text(`Status: ${r.status}  |  Voters: ${r.totalVoters}  |  Cast: ${r.votesCast}  |  Turnout: ${r.turnout}`);
        doc.moveDown(0.4);
      });
      doc.end();
      return;
    }

    // csv / excel both stream a CSV (Excel opens it natively).
    res.setHeader('Content-Type', format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="htu_elect_analytics_${Date.now()}.${format === 'excel' ? 'xls' : 'csv'}"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({ status: 'error', message: 'Failed to export analytics' });
  }
};
