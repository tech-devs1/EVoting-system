// ImageKit dynamic auth controller
const ImageKit = require('imagekit');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/sfau1s00d'
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

exports.uploadImage = async (req, res) => {
  try {
    const { file, fileName } = req.body;
    if (!file) {
      return res.status(400).json({ status: 'error', message: 'File data or URL is required.' });
    }

    const result = await imagekit.upload({
      file,
      fileName: fileName || `cand_${Date.now()}.jpg`,
      folder: '/htu-elect/candidates'
    });

    res.status(200).json({
      status: 'success',
      data: {
        url: result.url,
        fileId: result.fileId,
        thumbnailUrl: result.thumbnailUrl
      }
    });
  } catch (error) {
    console.error('ImageKit upload error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to upload image to ImageKit' });
  }
};
