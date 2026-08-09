# 🗳️ COMPSSA Secure Electronic Voting System – Future Fixes & Enhancements

This document outlines the priority fixes, architectural improvements, and pending features that should be implemented to achieve 100% security, high performance, and high availability for HTU elections.

---

## 🚀 Immediate / High Priority Fixes

- [ ] **Uncomment and Configure Live Biometrics Verification**
  - **Location:** `backend/routes/auth.js` -> `router.post('/verify-face')`
  - **Details:** Swap the development placeholder mock `{ verified: true }` with a live call to `https://api.deepface.dev/verify`. Protect the API key via environment variables. Add face crop/alignment in the frontend webcam capture to guarantee optimal recognition quality.

- [ ] **Enforce Backend API Rate-Limiting**
  - **Details:** Install and configure `express-rate-limit` on the public auth and vote routes. This prevents brute-force login attempts and spam voting requests, improving security and protecting server resources from DDOS.

- [ ] **Add Transaction Retries with Exponential Backoff**
  - **Location:** `backend/routes/votes.js` -> `/cast`
  - **Details:** If the database transaction throws a resource busy/contention error under extreme voting bursts, implement a brief recursive backoff (e.g., 100ms, 200ms, 400ms) inside the backend to retry the vote registration automatically before raising a 429 error to the voter.

---

## 🛠 Intermediate / Architectural Upgrades

- [ ] **Transition from NoSQL (Firestore) to MySQL (RDBMS)**
  - **Details:** Follow the blueprint in `IMPLEMENTATION_REPORT.md` to migrate all tables to MySQL on cPanel. Relational schemas with proper transactional boundaries completely eliminate document-write contention hotspots.

- [ ] **Dual-Channel OTP Service Fallbacks**
  - **Location:** `backend/routes/auth.js` -> `generateAndSendOtp`
  - **Details:** Current delivery sends to both email and phone simultaneously. Optimize this to send SMS as primary and automatically fall back to email OTP if the SMS gateway returns an error (or vice-versa), reducing communication costs while keeping registration frictionless.

- [ ] **Strict Input Validation & Sanitization**
  - **Details:** Add strict Joi or Zod schemas in the backend Express routes (especially voter CSV import and candidate profile creations) to sanitize and prevent XSS or SQL injection vectors before database commits.

---

## 📈 Long-Term Scalability & UX Enhancements

- [ ] **Distributed Write Sharding (For NoSQL/Firestore)**
  - **Details:** If staying on Firestore, implement the sharded counter pattern for candidate document vote counts (e.g., 5-10 sub-document shards per candidate) to scale past Firestore's limit of 1 write/sec per document.

- [ ] **Real-Time WebSockets Results Broadcasting**
  - **Details:** Integrate Socket.io or Firestore real-time snapshots in the admin results page, so the candidate charts update smoothly without requiring manual refreshes or constant REST polling.

- [ ] **Offline-First PWA Synchronization**
  - **Details:** Configure the service worker in `frontend/next.config.js` to cache candidate profiles and manifestos locally on the voter's phone. Support offline drafting, but prevent offline ballot casting (ballots must always be cast online with live biometrics).
