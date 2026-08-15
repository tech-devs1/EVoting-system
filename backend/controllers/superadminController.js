const { Tenant, Organization, User, Election, OnboardingRequest } = require('../models');
const bcrypt = require('bcryptjs');
const cache = require('../services/cache');

exports.getStats = async (req, res) => {
  try {
    const cacheKey = 'superadmin:stats';
    const stats = await cache.getOrSet(cacheKey, async () => {
      const totalDepartments = await Tenant.count();
      const totalUsers = await User.count();
      const totalElections = await Election.count();
      const totalRequests = await OnboardingRequest.count();

      return {
        departments: totalDepartments,
        elections: totalElections,
        voters: totalUsers,
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

exports.createDepartment = async (req, res) => {
  try {
    const { name, acronym, domain, adminEmail, adminPassword, brandColor, logoUrl } = req.body;
    if (!name || !adminEmail) {
      return res.status(400).json({ status: 'error', message: 'Organization Name and Admin Email are required' });
    }

    // Auto-generate tenant ID if not supplied
    let tenantId = req.body.id;
    if (!tenantId) {
      tenantId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!tenantId) tenantId = `org_${Date.now()}`;
    }

    // Check if tenant ID already exists
    const existingTenant = await Tenant.findByPk(tenantId);
    if (existingTenant) {
      tenantId = `${tenantId}_${Date.now().toString().slice(-4)}`;
    }

    // Check if user with adminEmail already exists in system
    let existingUser = await User.findOne({ where: { email: adminEmail } });

    let hashedPassword = null;
    if (adminPassword) {
      hashedPassword = await bcrypt.hash(adminPassword, 10);
    } else if (!existingUser) {
      return res.status(400).json({ status: 'error', message: 'Password is required for new user onboarding' });
    }

    // Create Tenant
    const tenant = await Tenant.create({
      id: tenantId,
      name,
      acronym: acronym || '',
      domain: domain || '',
      adminEmail,
      adminPassword: hashedPassword || (existingUser ? existingUser.password : ''),
      logoUrl: logoUrl || '',
      brandColor: brandColor || '#2563eb',
      status: 'active',
      orgName: name,
      portalTitle: `${name} Portal`,
      supportEmail: adminEmail,
      supportPhone: '',
      address: '',
      ecName: '',
      ecTitle: ''
    });

    // Create Organization record
    await Organization.create({
      id: tenantId,
      name,
      acronym: acronym || '',
      domain: domain || '',
      logoUrl: logoUrl || '',
      brandColor: brandColor || '#2563eb',
      status: 'active'
    });

    // Handle User creation or role upgrade
    if (existingUser) {
      // Upgrade existing user to admin role for this organization
      existingUser.role = 'admin';
      existingUser.tenantId = tenantId;
      if (hashedPassword) {
        existingUser.password = hashedPassword;
      }
      await existingUser.save();
    } else {
      // Create new admin user
      await User.create({
        id: `usr_admin_${tenantId}`,
        tenantId: tenantId,
        name: `${name} Administrator`,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        status: 'active',
        isVerified: true
      });
    }

    cache.invalidatePrefix('superadmin:');

    res.status(201).json({
      status: 'success',
      data: tenant,
      message: existingUser
        ? `Organization onboarded. Existing user (${adminEmail}) was assigned as Administrator.`
        : `Organization onboarded and new admin user account created.`
    });
  } catch (error) {
    console.error('Error onboarding department:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to onboard organization' });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, adminPassword } = req.body;
    const tenant = await Tenant.findByPk(id);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'Department not found' });

    if (name) {
      tenant.name = name;
      const org = await Organization.findByPk(id);
      if (org) {
        org.name = name;
        await org.save();
      }
    }

    if (adminPassword) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      tenant.adminPassword = hashedPassword;
      // Update primary user password as well
      const user = await User.findOne({ where: { email: tenant.adminEmail } });
      if (user) {
        user.password = hashedPassword;
        await user.save();
      }
    }

    await tenant.save();
    cache.invalidatePrefix('superadmin:');

    res.status(200).json({ status: 'success', data: tenant, message: 'Department updated successfully' });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update department' });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findByPk(id);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'Department not found' });

    await tenant.destroy();

    const organization = await Organization.findByPk(id);
    if (organization) {
      await organization.destroy();
    }

    cache.invalidatePrefix('superadmin:');

    res.status(200).json({ status: 'success', message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete department' });
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
