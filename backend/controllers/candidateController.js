const { Candidate, Position } = require('../models');
const cache = require('../services/cache');

exports.getCandidates = async (req, res) => {
  try {
    const { electionId } = req.query;
    if (!electionId) {
      return res.status(400).json({ status: 'error', message: 'electionId is required' });
    }

    const cacheKey = `candidates:list:${electionId}`;
    const list = await cache.getOrSet(cacheKey, async () => {
      const candidates = await Candidate.findAll({ where: { electionId } });
      const sorted = candidates.map(c => {
        const item = c.toJSON();
        return {
          id: item.id,
          name: item.name,
          manifesto: item.manifesto || '',
          manifestoUrl: '',
          electionId: item.electionId,
          position: item.positionTitle,
          positionId: item.positionId,
          photoUrl: item.photoUrl || '',
          votes: item.votes || 0,
          noVotes: item.noVotes || 0,
          isIndependent: item.isIndependent || false,
          ballotNumber: item.ballotNumber,
          createdAt: item.createdAt
        };
      }).sort((a, b) => {
        const numA = a.ballotNumber !== undefined && a.ballotNumber !== null && a.ballotNumber !== '' ? Number(a.ballotNumber) : 999;
        const numB = b.ballotNumber !== undefined && b.ballotNumber !== null && b.ballotNumber !== '' ? Number(b.ballotNumber) : 999;
        if (numA !== numB) return numA - numB;
        return (a.name || '').localeCompare(b.name || '');
      });
      return sorted;
    }, 5000);

    res.status(200).json({ status: 'success', data: list });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch candidates' });
  }
};

exports.createCandidate = async (req, res) => {
  try {
    const { name, position, manifesto, photoUrl, electionId, isIndependent, ballotNumber } = req.body;
    if (!name || !position || !electionId) {
      return res.status(400).json({ status: 'error', message: 'name, position and electionId are required' });
    }

    // Try to find or create the position first
    let posRecord = await Position.findOne({ where: { electionId, title: position } });
    if (!posRecord) {
      const posId = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      posRecord = await Position.create({
        id: posId,
        electionId,
        title: position,
        maxChoices: 1
      });
    }

    const candId = `cand_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newCand = await Candidate.create({
      id: candId,
      electionId,
      positionId: posRecord.id,
      positionTitle: position,
      name,
      manifesto: manifesto || '',
      photoUrl: photoUrl || '',
      isIndependent: isIndependent === true,
      ballotNumber: ballotNumber ? String(ballotNumber) : undefined
    });

    cache.invalidatePrefix('candidates:');
    cache.invalidatePrefix('elections:');

    const formattedData = {
      ...newCand.toJSON(),
      position: newCand.positionTitle
    };

    res.status(201).json({ status: 'success', data: formattedData });
  } catch (error) {
    console.error('Error creating candidate:', error);
    res.status(500).json({ status: 'error', message: 'Failed to add candidate' });
  }
};

exports.updateCandidate = async (req, res) => {
  try {
    const candId = req.params.id;
    const { name, position, manifesto, photoUrl, ballotNumber, isIndependent } = req.body;

    const candidate = await Candidate.findByPk(candId);
    if (!candidate) {
      return res.status(404).json({ status: 'error', message: 'Candidate not found' });
    }

    if (name) candidate.name = name;
    if (manifesto !== undefined) candidate.manifesto = manifesto;
    if (photoUrl !== undefined) candidate.photoUrl = photoUrl;
    if (ballotNumber !== undefined) candidate.ballotNumber = String(ballotNumber);
    if (isIndependent !== undefined) candidate.isIndependent = Boolean(isIndependent);

    if (position && position !== candidate.positionTitle) {
      let posRecord = await Position.findOne({ where: { electionId: candidate.electionId, title: position } });
      if (!posRecord) {
        const posId = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        posRecord = await Position.create({
          id: posId,
          electionId: candidate.electionId,
          title: position,
          maxChoices: 1
        });
      }
      candidate.positionId = posRecord.id;
      candidate.positionTitle = position;
    }

    await candidate.save();
    cache.invalidatePrefix('candidates:');
    cache.invalidatePrefix('elections:');

    const formattedData = {
      ...candidate.toJSON(),
      position: candidate.positionTitle
    };

    res.status(200).json({ status: 'success', data: formattedData });
  } catch (error) {
    console.error('Error updating candidate:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update candidate' });
  }
};

exports.deleteCandidate = async (req, res) => {
  try {
    const candId = req.params.id;
    const candidate = await Candidate.findByPk(candId);
    if (!candidate) {
      return res.status(404).json({ status: 'error', message: 'Candidate not found' });
    }

    await candidate.destroy();
    cache.invalidatePrefix('candidates:');
    cache.invalidatePrefix('elections:');

    res.status(200).json({ status: 'success', message: 'Candidate deleted successfully' });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete candidate' });
  }
};
