const { db } = require('./services/firebase');

async function checkEmbeddings() {
  try {
    const users = await db.collection('users').get();
    console.log(`Found ${users.size} users.`);
    users.forEach(doc => {
      const data = doc.data();
      console.log(`User ${doc.id}: isRegistered=${data.isRegistered}, hasFaceImage=${!!data.faceImage}, hasFaceEmbedding=${!!data.faceEmbedding}`);
    });
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

checkEmbeddings();
