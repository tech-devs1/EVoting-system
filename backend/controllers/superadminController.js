const { Tenant, Organization, User, Election, Voter, OnboardingRequest } = require('../models');
const bcrypt = require('bcryptjs');
const cache = require('../services/cache');

exports.getStats = async (req, res) => {
  try {
    const cacheKey = 'superadmin:stats';
    const stats = await cache.getOrSet(cacheKey, async () => {
      const { Voter } = require('../models');
      const totalDepartments = await Tenant.count();
      const totalElections = await Election.count();
      const totalVoters = await Voter.count();
      const totalRequests = await OnboardingRequest.count();

      return {
        departments: totalDepartments,
        elections: totalElections,
        voters: totalVoters,
        totalDepartments,
        totalVoters,
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
      return Promise.all(tenants.map(async t => {
        const item = t.toJSON();
        const secondaryAdmins = item.admins || [];
        const [electionsCount, votersCount] = await Promise.all([
          Election.count({ where: { tenantId: t.id } }),
          Voter.count({ where: { tenantId: t.id } })
        ]);
        return {
          id: item.id,
          name: item.name,
          acronym: item.acronym,
          domain: item.domain,
          adminEmail: item.adminEmail,
          status: item.status,
          createdAt: item.createdAt,
          brandColor: item.brandColor,
          logoUrl: item.logoUrl,
          electionsCount,
          votersCount,
          adminsCount: secondaryAdmins.length + 1 // primary admin + secondaries
        };
      }));
    }, 15000);

    res.status(200).json({ status: 'success', data: departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch departments' });
  }
};

// ── Department Admin Management ───────────────────────────────────────────────

exports.getDepartmentAdmins = async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'Department not found' });

    const item = tenant.toJSON();
    const secondaryAdmins = (item.admins || []).map(a => ({
      id: a.id,
      name: a.name || '',
      email: a.email || '',
      isPrimary: false,
      createdAt: a.createdAt || null
    }));

    const primary = {
      id: 'primary',
      name: `${item.name} Administrator`,
      email: item.adminEmail || '',
      isPrimary: true,
      createdAt: null
    };

    res.status(200).json({ status: 'success', data: [primary, ...secondaryAdmins] });
  } catch (error) {
    console.error('Error fetching department admins:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch department admins' });
  }
};

exports.addDepartmentAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ status: 'error', message: 'Name, email and password are required.' });
    }

    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'Department not found' });

    const normalizedEmail = String(email).toLowerCase().trim();
    const secondaryAdmins = tenant.admins || [];
    if (secondaryAdmins.some(a => a.email === normalizedEmail)) {
      return res.status(400).json({ status: 'error', message: 'This email is already an admin for this department.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = {
      id: `adm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: hashedPassword,
      createdAt: Date.now()
    };

    secondaryAdmins.push(newAdmin);
    tenant.admins = secondaryAdmins;
    await tenant.save();

    // Mirror into the users table so the new admin can sign in via /auth/login.
    await User.upsert({
      id: `usr_admin_${tenant.id}_${newAdmin.id}`,
      tenantId: tenant.id,
      name: newAdmin.name,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      isVerified: true
    });

    cache.invalidatePrefix('superadmin:');

    res.status(201).json({ status: 'success', data: newAdmin, message: 'Admin added successfully.' });
  } catch (error) {
    console.error('Error adding department admin:', error);
    res.status(500).json({ status: 'error', message: 'Failed to add department admin' });
  }
};

exports.updateDepartmentAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { name, password } = req.body;

    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'Department not found' });

    const secondaryAdmins = tenant.admins || [];
    const admin = secondaryAdmins.find(a => a.id === adminId);
    if (!admin) return res.status(404).json({ status: 'error', message: 'Admin not found' });

    if (name) admin.name = String(name).trim();
    if (password) {
      admin.passwordHash = await bcrypt.hash(password, 10);
    }
    tenant.admins = secondaryAdmins;
    await tenant.save();

    // Keep the users table in sync (password + name).
    const user = await User.findOne({ where: { email: admin.email, tenantId: tenant.id } });
    if (user) {
      if (name) user.name = admin.name;
      if (password) user.password = admin.passwordHash;
      await user.save();
    }

    cache.invalidatePrefix('superadmin:');

    res.status(200).json({ status: 'success', message: 'Admin updated successfully.' });
  } catch (error) {
    console.error('Error updating department admin:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update department admin' });
  }
};

exports.removeDepartmentAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'Department not found' });

    const secondaryAdmins = tenant.admins || [];
    const admin = secondaryAdmins.find(a => a.id === adminId);
    if (!admin) return res.status(404).json({ status: 'error', message: 'Admin not found' });

    tenant.admins = secondaryAdmins.filter(a => a.id !== adminId);
    await tenant.save();

    // Remove the mirrored users-table row (same email + tenant).
    await User.destroy({ where: { email: admin.email, tenantId: tenant.id } });

    cache.invalidatePrefix('superadmin:');

    res.status(200).json({ status: 'success', message: 'Admin removed successfully.' });
  } catch (error) {
    console.error('Error removing department admin:', error);
    res.status(500).json({ status: 'error', message: 'Failed to remove department admin' });
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

exports.getAuditLogs = async (req, res) => {
  try {
    const { tenantId } = req.query;
    const { ActivityLog, Tenant } = require('../models');

    const where = {};
    if (tenantId && tenantId !== 'all') {
      where.tenantId = tenantId;
    }

    const logs = await ActivityLog.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: 100
    });

    const tenants = await Tenant.findAll();
    const tenantMap = new Map(tenants.map(t => [t.id, t.name]));

    const formattedLogs = logs.map(l => {
      const item = l.toJSON();
      const ts = Number(item.timestamp) || Date.now();
      return {
        id: item.id || `act_${ts}`,
        tenantId: item.tenantId || 'global',
        tenantName: tenantMap.get(item.tenantId) || item.tenantId || 'Global System',
        actorEmail: item.actorEmail || 'System Admin',
        actorRole: item.actorRole || 'admin',
        action: item.action || 'ACTION',
        description: item.description || '',
        status: item.status || 'success',
        ip: item.ip || '127.0.0.1',
        timestamp: ts,
        createdAt: new Date(ts).toISOString()
      };
    });

    res.status(200).json({ status: 'success', data: formattedLogs });
  } catch (error) {
    console.error('Error fetching superadmin audit logs:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch audit logs' });
  }
};

exports.downloadAuditPDF = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const PDFDocument = require('pdfkit');
    const { ActivityLog, Tenant } = require('../models');

    const where = {};
    if (tenantId && tenantId !== 'all') {
      where.tenantId = tenantId;
    }

    const logs = await ActivityLog.findAll({ where, order: [['timestamp', 'DESC']], limit: 150 });
    const tenantObj = tenantId ? await Tenant.findByPk(tenantId) : null;
    const deptName = tenantObj ? tenantObj.name : 'All Departments (Global)';

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const filename = `${deptName.replace(/[^a-zA-Z0-9]/g, '_')}_Audit_Report.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fillColor('#1E3A8A').fontSize(16).font('Helvetica-Bold').text('HTU ELECT SYSTEM AUDIT REPORT', { align: 'center' });
    doc.fillColor('#64748B').fontSize(9).font('Helvetica').text(`Department Scope: ${deptName}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.8);

    if (logs.length === 0) {
      doc.fillColor('#64748B').fontSize(10).font('Helvetica-Oblique').text('No activity logs recorded for this scope.', { align: 'center' });
    } else {
      let y = doc.y;
      doc.rect(40, y, 515, 18).fill('#EFF6FF');
      doc.fillColor('#1D4ED8').fontSize(9).font('Helvetica-Bold');
      doc.text('Timestamp', 45, y + 4);
      doc.text('Actor', 150, y + 4);
      doc.text('Action', 270, y + 4);
      doc.text('Description', 360, y + 4);

      y += 20;

      logs.forEach(log => {
        if (y > 730) {
          doc.addPage();
          y = 50;
        }

        const logTs = Number(log.timestamp) || Date.now();
        doc.rect(40, y, 515, 20).fillAndStroke(y % 40 === 0 ? '#FFFFFF' : '#F8FAFC', '#F1F5F9');
        doc.fillColor('#0F172A').fontSize(8).font('Helvetica');
        doc.text(new Date(logTs).toLocaleString('en-GB', { hour12: false }), 45, y + 5);
        doc.text(log.actorEmail || 'System', 150, y + 5, { width: 110, height: 12 });
        doc.font('Helvetica-Bold').text(log.action || 'ACTION', 270, y + 5);
        doc.font('Helvetica').text(log.description || '', 360, y + 5, { width: 190, height: 12 });

        y += 20;
      });
    }

    doc.end();
  } catch (error) {
    console.error('Error generating superadmin audit PDF:', error);
    if (!res.headersSent) res.status(500).send('Failed to generate audit PDF');
  }
};

// ─── User Management ──────────────────────────────────────────────────────────

exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'phone', 'role', 'tenantId', 'status', 'isVerified', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json({ status: 'success', data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch users.' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, status } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    // Prevent superadmin from demoting themselves
    if (user.role === 'superadmin' && role && role !== 'superadmin') {
      return res.status(403).json({ status: 'error', message: 'Cannot change the role of a superadmin account.' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email.trim().toLowerCase();
    if (phone !== undefined) updates.phone = phone.trim();
    if (role !== undefined) updates.role = role;
    if (status !== undefined) updates.status = status;

    await user.update(updates);

    cache.invalidatePrefix('users:');

    res.status(200).json({ status: 'success', data: user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update user.' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    // Prevent deleting superadmin
    if (user.role === 'superadmin') {
      return res.status(403).json({ status: 'error', message: 'Cannot delete a superadmin account.' });
    }

    // Prevent self-deletion
    if (user.id === req.user.uid || user.email === req.user.email) {
      return res.status(403).json({ status: 'error', message: 'Cannot delete your own account.' });
    }

    await user.destroy();

    cache.invalidatePrefix('users:');

    res.status(200).json({ status: 'success', message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete user.' });
  }
};
