const { Tenant, Organization, User } = require('../models');
const bcrypt = require('bcryptjs');
const cache = require('../services/cache');

// Strip credentials before returning a tenant over the API.
function sanitizeTenant(tenant) {
  if (!tenant) return tenant;
  const item = tenant.toJSON ? tenant.toJSON() : { ...tenant };
  delete item.adminPassword;
  delete item.mNotifyApiKey;
  return item;
}

// Resolve which tenant a signed-in admin belongs to (used by /tenants/branding).
async function resolveAdminTenant(req) {
  const claimedTenant = req.user?.tenantId;
  if (claimedTenant && claimedTenant !== 'global' && claimedTenant !== 'compssa') {
    const direct = await Tenant.findByPk(claimedTenant);
    if (direct) return direct;
  }
  if (req.user?.email) {
    const byAdminEmail = await Tenant.findOne({ where: { adminEmail: req.user.email } });
    if (byAdminEmail) return byAdminEmail;
    const tenants = await Tenant.findAll();
    for (const t of tenants) {
      const admins = t.admins || [];
      if (admins.some(a => a.email === req.user.email)) return t;
    }
  }
  return Tenant.findOne(); // fallback: first tenant
}

exports.getTenants = async (req, res) => {
  try {
    const list = await Tenant.findAll();
    res.status(200).json({ status: 'success', data: list.map(sanitizeTenant) });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch tenants' });
  }
};

exports.getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'Tenant not found' });
    res.status(200).json({ status: 'success', data: sanitizeTenant(tenant) });
  } catch (error) {
    console.error('Error fetching tenant details:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch tenant' });
  }
};

exports.getBranding = async (req, res) => {
  try {
    const tenant = await resolveAdminTenant(req);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'No tenant configuration found' });

    const item = tenant.toJSON();
    res.status(200).json({
      status: 'success',
      data: {
        logoUrl: item.logoUrl || '',
        brandColor: item.brandColor || '#2563eb',
        orgName: item.orgName || item.name || '',
        portalTitle: item.portalTitle || `${item.name || 'HTU Elect'} Portal`,
        supportEmail: item.supportEmail || item.adminEmail || '',
        supportPhone: item.supportPhone || '',
        address: item.address || '',
        ecName: item.ecName || '',
        ecTitle: item.ecTitle || '',
        smsSenderId: item.mNotifySenderId || 'COMPSSA'
      }
    });
  } catch (error) {
    console.error('Error fetching branding:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch branding' });
  }
};

exports.updateBranding = async (req, res) => {
  try {
    const tenant = await resolveAdminTenant(req);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'No tenant configuration found' });

    const {
      logoUrl, brandColor, orgName, portalTitle, supportEmail,
      supportPhone, address, ecName, ecTitle, smsSenderId
    } = req.body;

    const updates = {};
    if (logoUrl !== undefined) updates.logoUrl = String(logoUrl);
    if (brandColor !== undefined) updates.brandColor = String(brandColor);
    if (orgName !== undefined) updates.orgName = String(orgName);
    if (portalTitle !== undefined) updates.portalTitle = String(portalTitle);
    if (supportEmail !== undefined) updates.supportEmail = String(supportEmail);
    if (supportPhone !== undefined) updates.supportPhone = String(supportPhone);
    if (address !== undefined) updates.address = String(address);
    if (ecName !== undefined) updates.ecName = String(ecName);
    if (ecTitle !== undefined) updates.ecTitle = String(ecTitle);
    if (smsSenderId !== undefined) updates.mNotifySenderId = String(smsSenderId).slice(0, 11);

    await tenant.update(updates);
    cache.invalidatePrefix('superadmin:');

    res.status(200).json({ status: 'success', message: 'Organization settings updated successfully.' });
  } catch (error) {
    console.error('Error updating branding:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update branding' });
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
