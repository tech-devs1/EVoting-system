const express = require('express');
const router = express.Router();
const ImageKit = require('imagekit');
const { verifyAuth } = require('../middleware/auth');

// Initialize ImageKit with credentials from .env
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Provide authentication parameters for client-side upload
router.get('/auth', verifyAuth, (req, res) => {
  try {
    const result = imagekit.getAuthenticationParameters();
    res.status(200).json(result);
  } catch (error) {
    console.error('[ImageKit Auth Error]', error);
    res.status(500).json({ error: 'Failed to generate ImageKit auth parameters' });
  }
});

module.exports = router;
