# 🏢 cPanel Deployment Guide for HTU-Elect

This step-by-step guide explains how to deploy the **HTU-Elect Electronic Voting System** on a standard cPanel web hosting environment (e.g., cPanel Node.js Selector / Phusion Passenger).

---

## 📋 Recommended cPanel Architecture

- **Backend API (Node.js Express)**: Deployed using cPanel's **"Setup Node.js App"** feature (Phusion Passenger) under `/api` or a subdomain (`api.yourdomain.edu.gh`).
- **Frontend (Next.js PWA)**: Built as a production bundle or static export uploaded to `public_html/`.

---

## 🛠️ Step 1 — Prepare your Project Files

1. On your local machine, run the production build:
   ```bash
   npm run build
   ```
2. Create a zip file of the `backend/` directory for uploading to cPanel:
   - Include: `backend/server.js`, `backend/routes/`, `backend/services/`, `backend/middleware/`, `backend/package.json`.
   - Exclude: `node_modules/` (cPanel will install dependencies on the server).

---

## 🚀 Step 2 — Set up the Backend API on cPanel

### 1. Upload Backend Files
1. Log into your **cPanel Dashboard**.
2. Open **File Manager**.
3. Create a folder named `backend_app` outside `public_html` (e.g. `/home/username/backend_app`).
4. Upload your `backend.zip` file into `backend_app` and extract it.

### 2. Configure cPanel "Setup Node.js App"
1. In cPanel, search for and open **Setup Node.js App**.
2. Click **Create Application**.
3. Configure the fields:
   - **Node.js version**: Choose `18.x` or `20.x` (or highest available).
   - **Application mode**: Select `Production`.
   - **Application root**: `backend_app`
   - **Application URL**: `api` (or leave empty if using a subdomain like `api.yourdomain.edu.gh`).
   - **Application startup file**: `server.js`
4. Click **Create**.

### 3. Install Dependencies
1. Under **Setup Node.js App**, click the **Run npm install** button.
2. Alternatively, copy the virtual environment command shown at the top of the cPanel page (e.g., `source /home/username/nodevenv/backend_app/18/bin/activate`), open cPanel **Terminal**, paste the command, and run:
   ```bash
   npm install
   ```

### 4. Add Environment Variables in cPanel
1. In the **Setup Node.js App** configuration page, scroll to **Environment variables**.
2. Add the following key-value pairs:

| Variable | Example Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `JWT_SECRET` | `your_secure_jwt_secret_key` |
| `FIREBASE_PROJECT_ID` | `your_firebase_project_id` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | `"-----BEGIN PRIVATE KEY-----\nYourKey...\n-----END PRIVATE KEY-----\n"` |
| `EMAILJS_SERVICE_ID` | `your_emailjs_service_id` |
| `EMAILJS_TEMPLATE_ID` | `your_emailjs_template_id` |
| `EMAILJS_PUBLIC_KEY` | `your_emailjs_public_key` |
| `BMS_API_KEY` | `your_mnotify_bms_api_key` |
| `BMS_SENDER_ID` | `COMPSSA` |
| `IMAGEKIT_PUBLIC_KEY` | `your_imagekit_public_key` |
| `IMAGEKIT_PRIVATE_KEY` | `your_imagekit_private_key` |
| `IMAGEKIT_URL_ENDPOINT` | `your_imagekit_url_endpoint` |

3. Click **Save** and then click **Restart Application**.
4. Test the health endpoint: `https://yourdomain.edu.gh/api/health` — should return `{"status":"success","message":"VoteTrust AI Backend is running"}`.

---

## 🌐 Step 3 — Set up the Frontend on cPanel

### Option A: Next.js Standalone Build (Full PWA & Dynamic SSR)

1. Upload the `.next/standalone` folder content and `.next/static` to `public_html/`.
2. In cPanel **Setup Node.js App**, create a second Node.js app for the Frontend:
   - Application root: `frontend_app`
   - Application startup file: `server.js` (from `.next/standalone/server.js`)
   - Add Environment Variable: `BACKEND_URL` = `https://yourdomain.edu.gh/api`

### Option B: `.htaccess` Apache Reverse Proxy & SPA Router (Easiest & Fastest)

If your cPanel server supports Apache mod_rewrite / mod_proxy, create or update `.htaccess` inside `public_html/`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # 1. Route API requests to backend Express serverless/Passenger endpoint
  RewriteRule ^api/(.*)$ https://yourdomain.edu.gh:5000/api/$1 [P,L]

  # 2. Serve static files directly if they exist
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # 3. Fallback Next.js client-side routing to index.html
  RewriteRule ^ index.html [L]
</IfModule>
```

---

## 🔒 Step 4 — Enable SSL (HTTPS)

Electronic voting requires secure HTTPS connections for biometric capture and token security:
1. In cPanel, search for **AutoSSL** or **SSL/TLS Status**.
2. Click **Run AutoSSL** to issue free Let's Encrypt / cPanel SSL certificates for your domain and subdomains.
3. In cPanel **File Manager**, ensure `.htaccess` redirects HTTP to HTTPS:
   ```apache
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```

---

## ✅ Deployment Verification Checklist

- [ ] Backend health check responds at `https://yourdomain.edu.gh/api/health`
- [ ] Admin login functions at `https://yourdomain.edu.gh/login`
- [ ] Registration OTP email/SMS sends successfully
- [ ] Ballot casting returns SHA-256 audit transaction hash
- [ ] SSL HTTPS padlock icon is active in browser address bar
