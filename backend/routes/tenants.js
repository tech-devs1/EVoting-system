const express = require('express');
const router = express.Router();
const { db, DEFAULT_TENANT_ID } = require('../services/firebase');

// GET /api/tenants/public - Fetch public list of active organizations
router.get('/public', async (req, res) => {
  try {
    const snapshot = await db.collection('organizations').get();
    const tenants = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.status !== 'inactive') {
        tenants.push({
          id: doc.id,
          name: data.name || doc.id,
          acronym: data.acronym || doc.id.toUpperCase(),
          logoUrl: data.logoUrl || '/assets/logo.png',
          brandColor: data.brandColor || '#3b82f6',
          domain: data.domain || ''
        });
      }
    });

    res.status(200).json({ status: 'success', data: tenants });
  } catch (error) {
    console.error('Error fetching public tenants:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch organizations' });
  }
});

// POST /api/tenants/onboard-request - Public self-service organization onboarding request
router.post('/onboard-request', async (req, res) => {
  try {
    const { name, acronym, contactName, email, phone, expectedVoters, description } = req.body;

    if (!name || !email || !contactName) {
      return res.status(400).json({ status: 'error', message: 'Organization name, contact name, and email are required.' });
    }

    const requestPayload = {
      name,
      acronym: acronym || name.substring(0, 5).toUpperCase(),
      contactName,
      email: email.toLowerCase().trim(),
      phone: phone || '',
      expectedVoters: expectedVoters || 100,
      description: description || '',
      status: 'pending',
      submittedAt: Date.now()
    };

    const docRef = await db.collection('onboarding_requests').add(requestPayload);

    res.status(201).json({
      status: 'success',
      message: 'Onboarding request submitted successfully. Our team will review and contact you shortly.',
      requestId: docRef.id
    });
  } catch (error) {
    console.error('Error submitting onboarding request:', error);
    res.status(500).json({ status: 'error', message: 'Failed to submit onboarding request.' });
  }
});

const { verifyAuth, requireAdmin } = require('../middleware/auth');

// GET /api/tenants/branding - Fetch branding and institutional settings for the logged-in tenant/organization
router.get('/branding', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;

    let doc = await db.collection('tenants').doc(tenantId).get();
    let data = doc.exists ? doc.data() : null;

    if (!doc.exists) {
      doc = await db.collection('organizations').doc(tenantId).get();
      data = doc.exists ? doc.data() : null;
    }

    if (!data) {
      return res.status(200).json({
        status: 'success',
        data: {
          orgName: "Students' Representative Council (SRC)",
          portalTitle: "HTU Elect Portal",
          supportEmail: "info@htu.edu.gh",
          supportPhone: "+233 24 000 0000",
          address: "P.O. Box HP 35, Ho, Volta Region, Ghana",
          ecName: "Electoral Commissioner",
          ecTitle: "Ho Technical University Electoral Commission",
          systemMode: "passwordless_otp",
          logoUrl: "/assets/logo.png",
          brandColor: "#3b82f6",
          smsSenderId: "HTU-ELECT",
          enableSmsInvites: true
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        logoUrl: data.logoUrl || '/assets/logo.png',
        brandColor: data.brandColor || '#3b82f6',
        orgName: data.orgName || "Students' Representative Council (SRC)",
        portalTitle: data.portalTitle || 'HTU Elect Portal',
        supportEmail: data.supportEmail || 'info@htu.edu.gh',
        supportPhone: data.supportPhone || '+233 24 000 0000',
        address: data.address || 'P.O. Box HP 35, Ho, Volta Region, Ghana',
        ecName: data.ecName || 'Electoral Commissioner',
        ecTitle: data.ecTitle || 'Ho Technical University Electoral Commission',
        systemMode: data.systemMode || 'passwordless_otp',
        smsSenderId: data.smsSenderId || 'HTU-ELECT',
        enableSmsInvites: data.enableSmsInvites !== undefined ? data.enableSmsInvites : true
      }
    });
  } catch (error) {
    console.error('Error fetching tenant branding:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch organization settings.' });
  }
});

// POST /api/tenants/branding - Update organization logo & branding settings
router.post('/branding', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;
    const {
      logoUrl,
      brandColor,
      orgName,
      portalTitle,
      supportEmail,
      supportPhone,
      address,
      ecName,
      ecTitle,
      systemMode,
      smsSenderId,
      enableSmsInvites
    } = req.body;

    const updateData = {
      updatedAt: Date.now()
    };
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (brandColor !== undefined) updateData.brandColor = brandColor;
    if (orgName !== undefined) updateData.orgName = orgName;
    if (portalTitle !== undefined) updateData.portalTitle = portalTitle;
    if (supportEmail !== undefined) updateData.supportEmail = supportEmail;
    if (supportPhone !== undefined) updateData.supportPhone = supportPhone;
    if (address !== undefined) updateData.address = address;
    if (ecName !== undefined) updateData.ecName = ecName;
    if (ecTitle !== undefined) updateData.ecTitle = ecTitle;
    if (systemMode !== undefined) updateData.systemMode = systemMode;
    if (smsSenderId !== undefined) updateData.smsSenderId = smsSenderId;
    if (enableSmsInvites !== undefined) updateData.enableSmsInvites = enableSmsInvites;

    await db.collection('tenants').doc(tenantId).set(updateData, { merge: true });
    await db.collection('organizations').doc(tenantId).set(updateData, { merge: true });

    // Invalidate dashboard and analytics caches to reflect updated branding parameters instantly
    const cache = require('../services/cache');
    cache.invalidatePrefix(`admin:${tenantId}:`);

    res.status(200).json({
      status: 'success',
      message: 'Organization settings updated successfully.',
      data: updateData
    });
  } catch (error) {
    console.error('Error updating tenant branding:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update organization settings.' });
  }
});

module.exports = router;
