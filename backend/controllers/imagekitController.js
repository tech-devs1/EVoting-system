// ImageKit dynamic auth controller
const ImageKit = require('imagekit');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'public_test_key',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'private_test_key',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/test'
});

exports.getAuthenticationParameters = (req, res) => {
  try {
    const result = imagekit.getAuthenticationParameters();
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    console.error('ImageKit auth error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate imagekit parameters' });
  }
};
