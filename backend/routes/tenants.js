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

// POST /api/tenants/branding - Update organization logo & branding settings
const { verifyAuth, requireAdmin } = require('../middleware/auth');

router.post('/branding', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = req.user.tenantId || DEFAULT_TENANT_ID;
    const { logoUrl, brandColor } = req.body;

    const updateData = {
      updatedAt: Date.now()
    };
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (brandColor !== undefined) updateData.brandColor = brandColor;

    await db.collection('tenants').doc(tenantId).set(updateData, { merge: true });
    await db.collection('organizations').doc(tenantId).set(updateData, { merge: true });

    res.status(200).json({
      status: 'success',
      message: 'Organization branding updated successfully.',
      data: { logoUrl, brandColor }
    });
  } catch (error) {
    console.error('Error updating tenant branding:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update organization branding.' });
  }
});

module.exports = router;
