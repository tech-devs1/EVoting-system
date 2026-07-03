# 🗳️ Votick – Secure Electronic Voting System

A full-stack, PWA-ready electronic voting platform built for HTU. Features real-time vote tracking, fraud monitoring, admin dashboards, candidate image uploads via ImageKit, and Firebase-backed authentication and data storage.

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Running Locally](#-running-locally)
- [Installing the App (PWA)](#-installing-the-app-pwa)
- [How to use the app](#-registering-account-and-voting)
- [Live App](#-live-app)

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **Styling** | Vanilla CSS with CSS variables |
| **Charts** | Chart.js + react-chartjs-2 |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **PWA** | @ducanh2912/next-pwa |
| **Backend** | Node.js, Express 5 |
| **Database** | Firebase Firestore |
| **Auth** | Firebase Auth + JWT |
| **Image Uploads** | ImageKit |
| **Email** | EmailJS |
| **Deployment** | Vercel |

---

## 📁 Project Structure

```text
EVoting-system/
├── backend/                  # Express API server
│   ├── routes/               # API route handlers
│   │   ├── auth.js           # Login, register, JWT
│   │   ├── elections.js      # CRUD for elections + PDF export
│   │   ├── candidates.js     # Candidate management
│   │   ├── votes.js          # Voting logic + fraud detection
│   │   ├── admin.js          # Dashboard stats, fraud alerts
│   │   └── imagekit.js       # ImageKit auth token endpoint
│   ├── services/
│   │   ├── firebase.js       # Firebase Admin SDK init
│   │   ├── fraud.js          # Fraud alert logging
│   │   └── audit.js          # Election integrity verification
│   ├── middleware/
│   │   └── auth.js           # JWT verify + admin guard
│   ├── server.js             # Express app entry point
│   ├── .env                  # Local environment variables (DO NOT COMMIT)
│   └── package.json
│
├── frontend/                 # Next.js application
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── page.tsx      # Landing / splash screen
│   │   │   ├── login/        # Voter login
│   │   │   ├── register/     # Voter registration
│   │   │   ├── vote/         # Voting interface
│   │   │   └── admin/        # Admin panel
│   │   │       ├── dashboard/    # KPI cards + live candidate chart
│   │   │       ├── elections/    # Election management
│   │   │       ├── elections/[id]/candidates/  # Candidate management
│   │   │       ├── results/      # Real-time vote results
│   │   │       └── fraud/        # Duplicate vote monitor
│   │   ├── lib/
│   │   │   └── api.ts        # Typed API request helper
│   │   └── styles/           # Global CSS + page-specific styles
│   ├── public/               # Static assets (icons, manifest)
│   ├── next.config.js        # Next.js + PWA configuration
│   └── package.json
│
└── vercel.json               # Vercel monorepo build config
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

### 4. A modern web browser
- **Chrome** (recommended for local PWA testing)
- **Firefox**, **Edge**, or **Safari** also work

---

## 🚀 Running Locally

### Step 1 — Clone the repository

```bash
git clone https://github.com/tech-devs1/EVoting-system.git
cd EVoting-system
```

### Step 2 — Set up the Backend
cd into the folder you cloned the repo in:
```bash
cd backend
npm install
```

Start the backend server:
```bash
npm start
```
The backend will run at **http://localhost:5000**

Verify it's working:
`GET http://localhost:5000/api/health`

---

### Step 3 — Set up the Frontend

Open a **new terminal window** and run:
cd into the folder you cloned the repo in:
```bash
cd frontend
npm install
```

Start the frontend dev server:
```bash
npm run dev
```

The frontend will run at **http://localhost:3000**

### Step 4 — You're ready!

| URL | Purpose |
|---|---|
| http://localhost:3000 | Voter-facing app (register, vote) |
| http://localhost:3000/admin/dashboard | Admin panel |
| http://localhost:5000/api/health | Backend health check |

**Default Admin Access:**  
- **Admin email**: `admin@htu.edu.gh`
- **Admin password**: `admin080`

---

## 🌐 Live App
The live app is available at: [votick.vercel.app](https://votick.vercel.app)

---

## 📱 Installing the App (PWA)

Votick is a **Progressive Web App (PWA)** — it can be installed on any device for a native app-like experience.

### Android (Chrome)

1. Open the live app URL in **Google Chrome**
2. Tap the **"Install App"** button on the landing screen
3. Tap **Install** to confirm
4. > If the install prompt doesn't appear, open Chrome menu (⋮) → **Add to Home screen**
5. The app icon appears on your home screen

### iOS (Safari)

1. Open the live app URL in **Safari** (must be Safari — Chrome on iOS does not support PWA install)
2. Tap the **"Install App"** button on the landing screen
3. Follow the on-screen instructions:
   - Tap the **Share button** (□↑) at the bottom of Safari
   - Scroll down and tap **"Add to Home Screen"**
   - Tap **"Add"** to confirm
4. The Votick icon appears on your home screen

### Desktop (Chrome / Edge)

1. Open the live app in Chrome or Edge
2. Look for the **install icon (⊕)** in the right side of the address bar
3. Click it and confirm installation
4. Votick opens as a standalone app window

---

## 📋 Registering Account and Voting

We used our class list in the database for now.

### First Time Registration

1. Open the app, and click **Register Account**.
2. Enter your index number. The system fetches your ID in the database and postfixes it with HTU email standard (`@htu.edu.gh`).
3. Set your password following the requirements.
4. You will be sent an OTP via email (check spam if not found) to verify.
5. You will be redirected to login and verify OTP again.
6. If elections are available, you can view them, read manifestos, and vote for your preferred candidate.

### Already Registered

1. Login with your credentials.
2. If elections are available, you can view them, read manifestos, and vote for your preferred candidate.

---

*Built with ❤️ by the Techdevstudios team.*
