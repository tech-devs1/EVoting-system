const { Tenant, Organization, User, OnboardingRequest } = require('../models');
const cache = require('../services/cache');

exports.getStats = async (req, res) => {
  try {
    const cacheKey = 'superadmin:stats';
    const stats = await cache.getOrSet(cacheKey, async () => {
      const totalDepartments = await Tenant.count();
      const totalUsers = await User.count();
      const totalRequests = await OnboardingRequest.count();

      return {
        totalDepartments,
        totalUsers,
        totalRequests
      };
    }, 15000);

    res.status(200).json({ status: 'success', data: stats });
  } catch (error) {
    console.error('Error fetching superadmin stats:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch superadmin statistics' });
  }
};

exports.getDepartments = async (req, res) => {
  try {
    const cacheKey = 'superadmin:departments';
    const departments = await cache.getOrSet(cacheKey, async () => {
      const tenants = await Tenant.findAll();
      return tenants.map(t => {
        const item = t.toJSON();
        return {
          id: item.id,
          name: item.name,
          acronym: item.acronym,
          domain: item.domain,
          adminEmail: item.adminEmail,
          status: item.status,
          createdAt: item.createdAt,
          brandColor: item.brandColor,
          logoUrl: item.logoUrl
        };
      });
    }, 15000);

    res.status(200).json({ status: 'success', data: departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch departments' });
  }
};

exports.getOnboardingRequests = async (req, res) => {
  try {
    const requests = await OnboardingRequest.findAll({ order: [['submittedAt', 'DESC']] });
    res.status(200).json({ status: 'success', data: requests });
  } catch (error) {
    console.error('Error fetching onboarding requests:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch onboarding requests' });
  }
};

exports.approveOnboardingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await OnboardingRequest.findByPk(id);
    if (!request) return res.status(404).json({ status: 'error', message: 'Request not found' });

    request.status = 'approved';
    await request.save();

    res.status(200).json({ status: 'success', message: 'Onboarding request approved' });
  } catch (error) {
    console.error('Error approving onboarding:', error);
    res.status(500).json({ status: 'error', message: 'Failed to approve onboarding request' });
  }
};

exports.rejectOnboardingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await OnboardingRequest.findByPk(id);
    if (!request) return res.status(404).json({ status: 'error', message: 'Request not found' });

    request.status = 'rejected';
    await request.save();

    res.status(200).json({ status: 'success', message: 'Onboarding request rejected' });
  } catch (error) {
    console.error('Error rejecting onboarding:', error);
    res.status(500).json({ status: 'error', message: 'Failed to reject onboarding request' });
  }
};
