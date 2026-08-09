# EVoting System - Project Documentation

## 1. Project Overview
The EVoting system is a secure, web-based electronic voting platform designed for school or university environments. It enforces strict identity verification through Student IDs, Email OTPs, and advanced Facial Verification to prevent duplicate accounts and ensure the integrity of the voting process.

## 2. Technology Stack

### Frontend
- **Framework:** Next.js (React)
- **Styling:** Tailwind CSS, Framer Motion (for animations)
- **Icons:** Lucide React
- **Charts:** Chart.js & react-chartjs-2
- **PWA Support:** `@ducanh2912/next-pwa` for mobile installability and offline caching

### Backend
- **Runtime & Framework:** Node.js, Express.js
- **Database:** Firebase Firestore (`firebase-admin`)
- **Authentication:** JSON Web Tokens (JWT), bcryptjs for password hashing
- **PDF Generation:** `pdfkit` for exporting election reports
- **Face Verification:** Integrated with `deepface.dev` managed API

## 3. Core Features

### Voter Registration & Authentication
1. **Student ID & Email Check:** Validates against pre-existing school records in Firestore.
2. **Password Policy:** Enforces strong passwords (min 8 chars, 1 uppercase, 1 lowercase, 1 special).
3. **Face Capture & Embedding:** Captures a base64 image from the user's webcam. Sends the image to `api.deepface.dev/represent` to generate a 512-dimensional vector embedding.
4. **Duplicate Face Prevention:** The backend fetches all existing facial embeddings from registered users and calculates the **Cosine Distance**. If the distance is `<= 0.40`, the system blocks the registration to prevent cheating.
5. **OTP Verification:** Sends a one-time password via EmailJS. Only upon successful verification is the account marked as `isRegistered: true`.

### Voting Process
- Voters can browse active elections in their department.
- **Pre-vote Verification:** Before casting a vote, the user must pass a live facial verification check. The live capture is sent to the backend and verified against their stored `faceImage` via the `deepface.dev/verify` endpoint.
- **Vote Integrity:** A ledger (`voted_voters` collection) tracks who has voted in which election to prevent double-voting.

### Admin Dashboard
- **Election Management:** Create, edit, and delete elections. Define candidates and their manifestos.
- **Analytics & Results:** View live voting analytics with doughnut charts and bar graphs.
- **Reporting:** Export election results to PDF.

## 4. API & Integration Details

### DeepFace.dev Integration
- **`POST /represent`**: Used during registration. Extracts the mathematical embedding of the face to allow for efficient 1:N local database searches for duplicates using Cosine Similarity.
- **`POST /verify`**: Used during the voting confirmation step. Performs a 1:1 match between the freshly captured face and the user's registered face.

### EmailJS
- Used as a serverless email provider to dispatch OTP codes to the voter's school email address.

## 5. Security Measures
- **No Stored Plaintext Passwords:** All passwords are hashed using `bcrypt` (salt rounds: 10).
- **Stateless Sessions:** User sessions are managed via JWTs stored securely on the client.
- **Route Protection:** Next.js middleware and backend Express middleware restrict access to admin pages and voting endpoints.

## 6. Development & Deployment
- The project is split into a `frontend` and `backend` directory.
- Start the backend: `cd backend && npm start`
- Start the frontend: `cd frontend && npm run dev`
- The system is configured for seamless deployment on platforms like Vercel (Frontend) and Render/Heroku (Backend).
