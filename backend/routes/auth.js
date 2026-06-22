const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../services/firebase');
const { verifyAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

// Register a user securely
router.post('/register', async (req, res) => {
  try {
    const { studentId, email, name, password } = req.body;

    if (!studentId || !email || !password) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const studentDocRef = db.collection('users').doc(studentId);
    const studentDoc = await studentDocRef.get();

    if (!studentDoc.exists) {
      return res.status(403).json({ status: 'error', message: 'You are not a valid student in this school records.' });
    }

    const studentData = studentDoc.data();
    
    if (studentData.email !== email) {
      return res.status(403).json({ status: 'error', message: 'Email does not match our school records.' });
    }

    if (studentData.isRegistered) {
      return res.status(403).json({ status: 'error', message: 'This student ID has already registered an account to prevent cheating.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Using studentId as the UID
    await studentDocRef.update({
      isRegistered: true,
      password: hashedPassword,
      name: name || studentData.name, // update name if provided
      uid: studentId
    });

    // Generate JWT token
    const token = jwt.sign({ uid: studentId, email: studentData.email, role: studentData.role }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({ status: 'success', data: { uid: studentId, email: studentData.email }, token });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ status: 'error', message: 'Failed to register user' });
  }
});

// Login User
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required.' });
    }

    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    
    if (usersSnapshot.empty) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    if (!userData.isRegistered || !userData.password) {
      return res.status(401).json({ status: 'error', message: 'Account not registered. Please sign up first.' });
    }

    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ uid: userDoc.id, email: userData.email, role: userData.role }, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(200).json({ status: 'success', data: { uid: userDoc.id, email: userData.email, role: userData.role }, token });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ status: 'error', message: 'Failed to authenticate user.' });
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

    const userData = doc.data();
    delete userData.password; // Don't send password hash back

    res.status(200).json({ status: 'success', data: userData });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch user profile' });
  }
});

module.exports = router;
