# 🗳️ HTU-Elect – Secure Electronic Voting System

A full-stack, PWA-ready electronic voting platform built for HTU. Features real-time vote tracking, fraud monitoring, admin dashboards, candidate image uploads via ImageKit, rate-limited APIs, and Firebase-backed authentication and data storage.

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Running Locally](#-running-locally)
- [Installing the App (PWA)](#-installing-the-app-pwa)
- [Registering Account and Voting](#-registering-account-and-voting)
- [Monorepo Deployment Guide](docs/DEPLOYMENT.md)
- [cPanel Deployment Guide](docs/CPANEL_DEPLOYMENT.md)
- [Live App](#-live-app)

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **Styling** | Vanilla CSS Design System with CSS variables |
| **Charts** | Chart.js + react-chartjs-2 |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **PWA** | @ducanh2912/next-pwa |
| **Backend** | Node.js, Express 5, express-rate-limit |
| **Database** | Firebase Firestore |
| **Auth** | Firebase Auth + JWT |
| **Image Uploads** | ImageKit |
| **Email & SMS** | EmailJS + BMS Africa Quick SMS |
| **Deployment** | Vercel |

---

## 📁 Monorepo Project Structure

```text
HTU-Elect/
├── CPANEL_DEPLOYMENT.md          # Step-by-step cPanel Deployment Guide
├── docs/                         # Technical documentation, reports, CSV database templates
│   ├── DOCUMENTATION.md
│   ├── CPANEL_DEPLOYMENT.md
│   ├── DEPLOYMENT.md
│   ├── IMPLEMENTATION_REPORT.md
│   ├── TODO.md
│   ├── schema.sql                # Production MySQL Database Schema
│   ├── voters_export.csv         # Voter roster template CSV
│   └── voted_voters_export.csv   # Voted voters template CSV
├── backend/                      # Node.js/Express Sequelize Backend API
│   ├── controllers/              # Request controllers
│   ├── middleware/               # Auth, RateLimiter, Validation
│   ├── models/                   # Sequelize MySQL/SQLite models
│   ├── routes/                   # API endpoint route declarations
│   ├── services/                 # Business logic and external service integrations
│   ├── scripts/                  # Utility & testing scripts
│   ├── package.json
│   ├── schema.sql                # Production MySQL Database Schema
│   └── server.js
└── frontend/                     # Next.js App Router Frontend
    ├── public/                   # Public static assets & brand logos
    │   ├── assets/               # Standardized brand logos
    │   └── manifest.json
    ├── src/
    │   ├── app/                  # Next.js App Router pages
    │   ├── components/           # Shared modular UI components
    │   ├── context/              # AuthContext
    │   ├── lib/                  # API client config
    │   ├── styles/               # Global CSS/Tailwind configuration
    │   └── types/                # TypeScript interface definitions
    ├── next.config.mjs
    └── package.json
```

---

## ✅ Prerequisites

Install all of the following before running the project locally:

### 1. Node.js (v18 or higher)
- Download: [Node.js Downloads](https://nodejs.org/en/download)
- Verify: `node --version`

### 2. npm (comes with Node.js)
- Verify: `npm --version`

### 3. Git
- Download: [Git Downloads](https://git-scm.com/downloads)
- Verify: `git --version`

---

## 🚀 Running Locally

### Step 1 — Clone the repository

```bash
git clone https://github.com/tech-devs1/EVoting-system.git
cd EVoting-system
```

### Step 2 — Set up the Backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:
```env
PORT=5000
JWT_SECRET=your_jwt_secret
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY="your_firebase_private_key"

EMAILJS_SERVICE_ID=your_emailjs_service_id
EMAILJS_TEMPLATE_ID=your_emailjs_template_id
EMAILJS_PUBLIC_KEY=your_emailjs_public_key
EMAILJS_PRIVATE_KEY=your_emailjs_private_key

BMS_API_KEY=your_bms_mnotify_api_key
BMS_SENDER_ID=COMPSSA

IMAGEKIT_PUBLIC_KEY="your_imagekit_public_key"
IMAGEKIT_PRIVATE_KEY="your_imagekit_private_key"
IMAGEKIT_URL_ENDPOINT="your_imagekit_url_endpoint"
```

Start the backend server:
```bash
npm start
```
The backend will run at **http://localhost:5000**

---

### Step 3 — Set up the Frontend

Open a **new terminal window**:
```bash
cd frontend
npm install
npm run dev
```
The frontend will run at **http://localhost:3000**

---

## 📋 Registering Account and Voting

### First Time Registration

1. Open the app, and click **Register Account**.
2. Enter your student index number. The system fetches your record in the database.
3. Set your password following the complexity requirements.
4. An OTP verification code will be sent via email/SMS.
5. Once verified, log in to view active elections.

---

## 🔒 Security & Concurrency Design

- **API Rate Limiting:** Protected authentication (`/api/auth/*`) and voting (`/api/votes/cast`) routes against brute-force and DDOS.
- **Atomic Transactions with Exponential Backoff:** High-concurrency vote registration handles database contention automatically with jittered exponential retries.
- **Cryptographic Audit Log:** Every cast ballot generates an immutable SHA-256 audit transaction record.

---

*Built with ❤️ by the Techdevstudios team.*
