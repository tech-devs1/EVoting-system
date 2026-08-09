/**
 * Request Validation & Sanitization Middleware
 */

// Helper to sanitize text strings (strip HTML/script tags)
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>?/gm, '').trim();
}

// Helper to validate email structure
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper to normalize phone numbers
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  let cleaned = phone.replace(/[\s\-().+]/g, '');
  if (cleaned.startsWith('233')) {
    cleaned = '0' + cleaned.substring(3);
  }
  return cleaned;
}

// Validate Voter Registration Payload
function validateRegistration(req, res, next) {
  const { studentId, email, password, name, phone } = req.body;

  if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
    return res.status(400).json({ status: 'error', message: 'Valid Student ID is required.' });
  }

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ status: 'error', message: 'A valid email address is required.' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Password is required.' });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      status: 'error',
      message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.'
    });
  }

  // Sanitize inputs
  req.body.studentId = sanitizeString(studentId);
  req.body.email = email.trim().toLowerCase();
  if (name) req.body.name = sanitizeString(name);
  if (phone) req.body.phone = normalizePhone(phone);

  next();
}

// Validate Candidate Creation Payload
function validateCandidate(req, res, next) {
  const { name, electionId, manifesto, position } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ status: 'error', message: 'Candidate name is required.' });
  }

  if (!electionId || typeof electionId !== 'string' || !electionId.trim()) {
    return res.status(400).json({ status: 'error', message: 'Election ID is required.' });
  }

  req.body.name = sanitizeString(name);
  req.body.electionId = sanitizeString(electionId);
  if (manifesto) req.body.manifesto = sanitizeString(manifesto);
  if (position) req.body.position = sanitizeString(position);

  next();
}

// Validate Vote Casting Payload
function validateVoteCast(req, res, next) {
  const { electionId, candidateId } = req.body;

  if (!electionId || typeof electionId !== 'string' || !electionId.trim()) {
    return res.status(400).json({ status: 'error', message: 'Election ID is required.' });
  }

  if (!candidateId || typeof candidateId !== 'string' || !candidateId.trim()) {
    return res.status(400).json({ status: 'error', message: 'Candidate ID is required.' });
  }

  req.body.electionId = sanitizeString(electionId);
  req.body.candidateId = sanitizeString(candidateId);

  next();
}

module.exports = {
  sanitizeString,
  isValidEmail,
  normalizePhone,
  validateRegistration,
  validateCandidate,
  validateVoteCast
};
