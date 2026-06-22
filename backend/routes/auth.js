const express = require('express');
const router = express.Router();
const { db, admin } = require('../services/firebase');
const { verifyAuth } = require('../middleware/auth');

// Register a user (Mock mapping of UID to User Data in Firestore)
router.post('/register', async (req, res) => {
  try {
    const { uid, email, name, role } = req.body; // In real life, uid comes from Firebase Client SDK

    if (!uid || !email) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const userData = {
      uid,
      email,
      name: name || '',
      role: role || 'voter', // admin or voter
      createdAt: Date.now(),
      status: 'active'
    };

    await db.collection('users').doc(uid).set(userData);
    res.status(201).json({ status: 'success', data: userData });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ status: 'error', message: 'Failed to register user' });
  }
});

// Get Current User Profile
router.get('/me', verifyAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const doc = await db.collection('users').doc(uid).get();

    if (!doc.exists) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    res.status(200).json({ status: 'success', data: doc.data() });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch user profile' });
  }
});

module.exports = router;
