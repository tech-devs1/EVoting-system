# 🗳️ Votick – Secure Electronic Voting System

A full-stack, PWA-ready electronic voting platform built for HTU. Features real-time vote tracking, fraud monitoring, admin dashboards, candidate image uploads via ImageKit, and Firebase-backed authentication and data storage.

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Third-Party Services Setup](#-third-party-services-setup)
- [Running Locally](#-running-locally)
- [Environment Variables Reference](#-environment-variables-reference)
- [Deploying to Vercel (Live)](#-deploying-to-vercel-live)
- [Installing the App (PWA)](#-installing-the-app-pwa)
- [API Endpoints Overview](#-api-endpoints-overview)
- [Troubleshooting](#-troubleshooting)

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

```
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
- Download: https://nodejs.org/en/download
- Verify: `node --version`

### 2. npm (comes with Node.js)
- Verify: `npm --version`

### 3. Git
- Download: https://git-scm.com/downloads
- Verify: `git --version`

### 4. A modern web browser
- **Chrome** (recommended for local PWA testing)
- **Firefox**, **Edge**, or **Safari** also work

---

## 🔧 Third-Party Services Setup

You need accounts on three external services. They are all free-tier.

### 🔥 Firebase (Database + Auth)

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it (e.g. `voting-0`) → Continue
3. **Enable Firestore**:
   - Sidebar → Build → Firestore Database → Create database → Start in test mode
4. **Enable Authentication**:
   - Sidebar → Build → Authentication → Get started → Enable **Email/Password**
5. **Get Admin SDK credentials** (for the backend):
   - Project Settings (⚙️) → Service accounts → **Generate new private key**
   - Download the `.json` file — you'll need `project_id`, `client_email`, and `private_key`
6. **Get Frontend config** (for the frontend):
   - Project Settings (⚙️) → General → Your apps → Add app → Web (`</>`)
   - Copy the `firebaseConfig` object values

### 🖼️ ImageKit (Candidate Photo Uploads)

1. Sign up free at https://imagekit.io
2. Dashboard → Developer options → copy:
   - `Public Key`
   - `Private Key`
   - `URL Endpoint` (looks like `https://ik.imagekit.io/your_id`)

### 📧 EmailJS (Voter Notifications)

1. Sign up free at https://emailjs.com
2. Create a **Service** (connect your Gmail or other email) → note the `Service ID`
3. Create an **Email Template** → note the `Template ID`
4. Go to Account → API Keys → note your `Public Key` and `Private Key`

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

Create a `.env` file inside the `backend/` folder:

```bash
# backend/.env

PORT=5000
JWT_SECRET=your-strong-random-secret-here

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# EmailJS
EMAILJS_SERVICE_ID=service_xxxxxxx
EMAILJS_TEMPLATE_ID=template_xxxxxxx
EMAILJS_PUBLIC_KEY=your_emailjs_public_key
EMAILJS_PRIVATE_KEY=your_emailjs_private_key

# ImageKit
IMAGEKIT_PUBLIC_KEY=public_xxxxxxxxxxxxxxxxxxxxxxxx
IMAGEKIT_PRIVATE_KEY=private_xxxxxxxxxxxxxxxxxxxxxxxx
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
```

> ⚠️ **Important:** Never commit `.env` to Git. It is already in `.gitignore`.

Start the backend server:

```bash
npm run dev
```

The backend will run at **http://localhost:5000**

Verify it's working:
```
GET http://localhost:5000/api/health
```

---

### Step 3 — Set up the Frontend

Open a **new terminal window** and run:

```bash
cd frontend
npm install
```

Create a `.env.local` file inside the `frontend/` folder:

```bash
# frontend/.env.local

NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=public_xxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id

# Firebase client config (from Firebase console → Project Settings → Your Apps)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

Start the frontend dev server:

```bash
npm run dev
```

The frontend will run at **http://localhost:3000**

---

### Step 4 — You're ready!

| URL | Purpose |
|---|---|
| http://localhost:3000 | Voter-facing app (register, vote) |
| http://localhost:3000/admin/dashboard | Admin panel |
| http://localhost:5000/api/health | Backend health check |

**Default Admin Access:**  
Register a user, then manually set `isAdmin: true` on their Firestore user document via the Firebase console.

---

## 🔑 Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description | Required |
|---|---|---|
| `PORT` | Port the Express server listens on (default: 5000) | ✅ |
| `JWT_SECRET` | Secret key for signing JWT tokens | ✅ |
| `FIREBASE_PROJECT_ID` | Firebase project ID | ✅ |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | ✅ |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key | ✅ |
| `EMAILJS_SERVICE_ID` | EmailJS service ID | ✅ |
| `EMAILJS_TEMPLATE_ID` | EmailJS template ID | ✅ |
| `EMAILJS_PUBLIC_KEY` | EmailJS public API key | ✅ |
| `EMAILJS_PRIVATE_KEY` | EmailJS private API key | ✅ |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public key | ✅ |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private key | ✅ |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit URL endpoint | ✅ |

### Frontend (`frontend/.env.local`)

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL of the backend API | ✅ |
| `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY` | ImageKit public key (client-side upload) | ✅ |
| `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` | ImageKit URL endpoint | ✅ |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web app API key | ✅ |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | ✅ |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | ✅ |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | ✅ |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | ✅ |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | ✅ |

---

## ☁️ Deploying to Vercel (Live)

This repo is configured as a **Vercel monorepo** with both frontend and backend deploying from a single repository.

### Step 1 — Push to GitHub

```bash
git add -A
git commit -m "your commit message"
git push origin main
```

### Step 2 — Connect to Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repository (`EVoting-system`)
3. Vercel will auto-detect the `vercel.json` at the root

### Step 3 — Add Environment Variables in Vercel

Go to your project → **Settings** → **Environment Variables** and add **all** the variables from both `.env` and `.env.local`:

**Backend variables (no `NEXT_PUBLIC_` prefix):**
- `JWT_SECRET`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `EMAILJS_SERVICE_ID`
- `EMAILJS_TEMPLATE_ID`
- `EMAILJS_PUBLIC_KEY`
- `EMAILJS_PRIVATE_KEY`
- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `IMAGEKIT_URL_ENDPOINT`

**Frontend variables (with `NEXT_PUBLIC_` prefix):**
- `NEXT_PUBLIC_API_URL` → set to your Vercel deployment URL e.g. `https://evoting-system.vercel.app/api`
- `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`
- `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Step 4 — Deploy

- Vercel automatically deploys every time you push to `main`
- To trigger a manual redeploy: Vercel Dashboard → your project → **Deployments** tab → **Redeploy**

> 💡 **Tip:** After adding environment variables, always trigger a **new deployment** for them to take effect.

---

## 📱 Installing the App (PWA)

Votick is a **Progressive Web App (PWA)** — it can be installed on any device for a native app-like experience.

### Android (Chrome)

1. Open the live app URL in **Google Chrome**
2. Tap the **"Install App"** button on the landing screen
3. Chrome will show the native **"Add to Home screen"** install prompt
4. Tap **Install** to confirm
5. The app icon appears on your home screen

> If the install prompt doesn't appear, open Chrome menu (⋮) → **Add to Home screen**

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

## 📡 API Endpoints Overview

All endpoints are prefixed with `/api`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Server health check |
| `POST` | `/auth/register` | None | Register a new voter |
| `POST` | `/auth/login` | None | Login and receive JWT |
| `GET` | `/elections` | None | List all elections |
| `POST` | `/elections` | Admin | Create a new election |
| `PUT` | `/elections/:id` | Admin | Update an election |
| `DELETE` | `/elections/:id` | Admin | Delete an election |
| `GET` | `/elections/:id/results/pdf` | Admin | Download PDF results |
| `GET` | `/candidates/election/:id` | None | List candidates for election |
| `POST` | `/candidates` | Admin | Add a candidate |
| `DELETE` | `/candidates/:id` | Admin | Delete a candidate |
| `POST` | `/votes` | Voter | Cast a vote |
| `GET` | `/admin/dashboard` | Admin | KPI stats + top candidates |
| `GET` | `/admin/live-votes` | Admin | Live vote count + candidate standings |
| `GET` | `/admin/fraud-alerts` | Admin | Duplicate vote attempts |
| `GET` | `/imagekit/auth` | Voter | ImageKit upload auth token |

---

## 🩺 Troubleshooting

### Backend won't start
- Make sure `backend/.env` exists with all required variables
- Run `npm install` inside the `backend/` directory
- Check that port 5000 is not in use: `netstat -ano | findstr :5000` (Windows)

### Frontend can't reach the API
- Ensure `NEXT_PUBLIC_API_URL` in `frontend/.env.local` points to the correct backend URL
- Locally: `http://localhost:5000/api`
- On Vercel: `https://your-deployment.vercel.app/api`

### Candidate image upload fails
- Verify `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, and `IMAGEKIT_URL_ENDPOINT` are set in both backend `.env` and Vercel environment variables
- Check the browser console for the exact error message

### Firebase authentication errors
- Ensure the Firebase project has **Email/Password** authentication enabled
- Verify all `NEXT_PUBLIC_FIREBASE_*` variables are correctly set
- Make sure Firestore is in **production** or **test** mode (not locked down)

### Vercel deployment not reflecting latest changes
- Go to Vercel Dashboard → your project → **Deployments** → click **Redeploy** on the latest commit
- After adding/changing environment variables, a new deployment is always required

### "Module not found" errors on Vercel
- Run `npm install` locally, commit the `package-lock.json`, and push again

---

## 📄 License

This project is built for HTU academic purposes.

---

*Built with ❤️ by the HTU dev team.*
