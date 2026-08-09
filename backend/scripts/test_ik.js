const crypto = require('crypto');
const fs = require('fs');

async function testUpload() {
  const publicKey = "public_IdMY8+9qGvRoDF3lZfo+avVLvpw=";
  const privateKey = "private_ZHI/MxM0e0u+xUuAigWOajpk6Xk=";
  const urlEndpoint = "https://ik.imagekit.io/sfau1s00d";

  const ImageKit = require('imagekit');
  const imagekit = new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint
  });

  try {
    const auth = imagekit.getAuthenticationParameters();
    console.log("Auth:", auth);

    // Create a tiny dummy image (1x1 pixel base64)
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    
    // Instead of using browser fetch, let's just use imagekit SDK to upload
    const result = await imagekit.upload({
      file: base64Image,
      fileName: 'test_image.png'
    });
    console.log("Upload result:", result);
  } catch (err) {
    console.error("Error:", err);
  }
}

testUpload();
