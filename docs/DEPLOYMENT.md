# 🚀 Monorepo Deployment Guide for HTU-Elect

This guide explains how to deploy the HTU-Elect Monorepo effortlessly to **Vercel** (or Render, Railway, Firebase App Hosting).

---

## 🎯 Deployment Options

### Option A: Single Vercel Project (Unified Monorepo Deployment) — RECOMMENDED

You can deploy both the Next.js frontend and Express backend together in **one single Vercel project**.

#### How it works:
1. The root `vercel.json` and root `package.json` build `frontend/` using npm workspaces.
2. Serverless API requests (`/api/*`) are handled via the root `/api/index.js` bridge into `backend/server.js`.

#### Vercel Dashboard Setup:
1. Import your GitHub repository into Vercel.
2. Leave **Root Directory** as `./` (root).
3. Vercel automatically detects `vercel.json` settings:
   - Build Command: `npm run build`
   - Output Directory: `frontend/.next`
4. Add your **Environment Variables** in Vercel Project Settings:
   - `JWT_SECRET`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `BMS_API_KEY`
   - `IMAGEKIT_PUBLIC_KEY`
   - `IMAGEKIT_PRIVATE_KEY`
   - `IMAGEKIT_URL_ENDPOINT`
5. Click **Deploy**.

---

### Option B: Separate Vercel Projects (Frontend & Backend Split)

If you prefer to host Frontend and Backend as two separate Vercel projects:

#### Project 1: Frontend (`HTU-Elect-Frontend`)
1. Import repository on Vercel.
2. Set **Root Directory** to `frontend`.
3. Add Environment Variable:
   - `BACKEND_URL` = `https://your-backend-project.vercel.app`
4. Click **Deploy**.

#### Project 2: Backend (`HTU-Elect-Backend`)
1. Import repository on Vercel.
2. Set **Root Directory** to `backend`.
3. Add Environment Variables (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, etc.).
4. Click **Deploy**.

---

### Option C: cPanel Hosting Deployment (Setup Node.js App)

For university / traditional web hosting environments using cPanel:
- Refer to the dedicated [cPanel Deployment Guide](file:///home/agent47/Desktop/Work/HTU-Elect/docs/CPANEL_DEPLOYMENT.md) for step-by-step instructions on setting up Phusion Passenger Node.js API + Next.js build on cPanel.

---

## 🔑 Required Environment Variables Checklist

Ensure these variables are set in your deployment environment settings:

```env
PORT=5000
JWT_SECRET=your_super_secret_jwt_key
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyHere\n-----END PRIVATE KEY-----\n"

EMAILJS_SERVICE_ID=your_emailjs_service_id
EMAILJS_TEMPLATE_ID=your_emailjs_template_id
EMAILJS_PUBLIC_KEY=your_emailjs_public_key
EMAILJS_PRIVATE_KEY=your_emailjs_private_key

BMS_API_KEY=your_mnotify_bms_api_key
BMS_SENDER_ID=COMPSSA

IMAGEKIT_PUBLIC_KEY="your_imagekit_public_key"
IMAGEKIT_PRIVATE_KEY="your_imagekit_private_key"
IMAGEKIT_URL_ENDPOINT="your_imagekit_url_endpoint"
```
