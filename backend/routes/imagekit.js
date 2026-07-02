const express = require('express');
const router = express.Router();
const ImageKit = require('imagekit');
const { verifyAuth } = require('../middleware/auth');

let imagekit = null;

function getImageKitInstance() {
  if (imagekit) return imagekit;

  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error('ImageKit environment variables are missing.');
  }

  imagekit = new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint,
  });

  return imagekit;
}

// Provide authentication parameters for client-side upload
router.get('/auth', verifyAuth, (req, res) => {
  try {
    const ik = getImageKitInstance();
    const result = ik.getAuthenticationParameters();
    res.status(200).json(result);
  } catch (error) {
    console.error('[ImageKit Auth Error]', error.message || error);
    res.status(500).json({ error: error.message || 'Failed to generate ImageKit auth parameters' });
  }
});

module.exports = router;
