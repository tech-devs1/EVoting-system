const { db } = require('./services/firebase');
require('dotenv').config();

async function migrate() {
  try {
    const usersSnap = await db.collection('users').get();
    
    let updatedCount = 0;
    
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      
      // We only care about accounts that have a faceImage but no faceEmbedding
      if (data.isRegistered === true && data.faceImage && !data.faceEmbedding) {
        console.log(`Generating embedding for user ${doc.id}...`);
        
        const deepfaceRes = await fetch('https://api.deepface.dev/represent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DEEPFACE_API_KEY}`
          },
          body: JSON.stringify({
            img: data.faceImage,
            model_name: 'Facenet'
          })
        });
        
        if (deepfaceRes.ok) {
          const result = await deepfaceRes.json();
          if (result && result.length > 0 && result[0].embedding) {
            await db.collection('users').doc(doc.id).update({
              faceEmbedding: result[0].embedding
            });
            console.log(`Successfully updated embedding for user ${doc.id}`);
            updatedCount++;
          }
        } else {
          console.error(`Failed to represent face for user ${doc.id}: ${await deepfaceRes.text()}`);
        }
      }
    }
    
    console.log(`Migration complete. Updated ${updatedCount} users.`);
  } catch (err) {
    console.error('Migration error:', err);
  }
  process.exit(0);
}

migrate();
