const { Tenant, Organization, User } = require('../models');
const bcrypt = require('bcryptjs');
const cache = require('../services/cache');

exports.getTenants = async (req, res) => {
  try {
    const list = await Tenant.findAll();
    res.status(200).json({ status: 'success', data: list });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch tenants' });
  }
};

exports.getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'Tenant not found' });
    res.status(200).json({ status: 'success', data: tenant });
  } catch (error) {
    console.error('Error fetching tenant details:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch tenant' });
  }
};

exports.createTenant = async (req, res) => {
  try {
    const { id, name, acronym, domain, adminEmail, adminPassword, logoUrl, brandColor, status, orgName, portalTitle, supportEmail, supportPhone, address, ecName, ecTitle, mNotifyApiKey, mNotifySenderId } = req.body;
    if (!id || !name) return res.status(400).json({ status: 'error', message: 'id and name are required' });

    let hashedPassword = null;
    if (adminPassword) {
      hashedPassword = await bcrypt.hash(adminPassword, 10);
    }

    const tenant = await Tenant.create({
      id,
      name,
      acronym,
      domain,
      adminEmail,
      adminPassword: hashedPassword,
      logoUrl,
      brandColor,
      status: status || 'active',
      orgName: orgName || name,
      portalTitle: portalTitle || `${name} Portal`,
      supportEmail: supportEmail || adminEmail,
      supportPhone: supportPhone || '',
      address: address || '',
      ecName: ecName || '',
      ecTitle: ecTitle || '',
      mNotifyApiKey: mNotifyApiKey || '',
      mNotifySenderId: mNotifySenderId || 'mNotify'
    });

    // Also mirror to organizations table for dynamic schema integrity
    await Organization.create({
      id,
      name,
      acronym,
      domain,
      logoUrl,
      brandColor,
      status: status || 'active'
    });

    if (adminEmail && hashedPassword) {
      await User.upsert({
        id: `usr_admin_${id}`,
        tenantId: id,
        name: `${name} Administrator`,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        status: 'active',
        isVerified: true
      });
    }

    cache.invalidatePrefix('superadmin:');

    res.status(201).json({ status: 'success', data: tenant });
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create tenant' });
  }
};

exports.updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findByPk(id);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'Tenant not found' });

    await tenant.update(req.body);

    const organization = await Organization.findByPk(id);
    if (organization) {
      await organization.update({
        name: req.body.name || tenant.name,
        acronym: req.body.acronym || tenant.acronym,
        domain: req.body.domain || tenant.domain,
        logoUrl: req.body.logoUrl || tenant.logoUrl,
        brandColor: req.body.brandColor || tenant.brandColor,
        status: req.body.status || tenant.status
      });
    }

    cache.invalidatePrefix('superadmin:');

    res.status(200).json({ status: 'success', data: tenant });
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update tenant' });
  }
};

exports.deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findByPk(id);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'Tenant not found' });

    await tenant.destroy();

    const organization = await Organization.findByPk(id);
    if (organization) {
      await organization.destroy();
    }

    cache.invalidatePrefix('superadmin:');

    res.status(200).json({ status: 'success', message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete tenant' });
  }
};
