# 🏢 cPanel Deployment Guide for HTU-Elect

This step-by-step guide explains how to deploy the **HTU-Elect Electronic Voting System** on a standard cPanel web hosting environment (e.g., cPanel Node.js Selector / Phusion Passenger) using a **MySQL/MariaDB Database**.

---

## 📋 Recommended cPanel Architecture

- **Backend API (Node.js Express)**: Deployed using cPanel's **"Setup Node.js App"** feature (Phusion Passenger) under `/api` or a subdomain (`api.yourdomain.edu.gh`).
- **Frontend (Next.js App)**: Built as a production standalone bundle or static export uploaded to `public_html/`.

---

## 🛠️ Step 1 — Prepare your Project Files

1. On your local machine, run the production build:
   ```bash
   npm run build
   ```
2. Create a zip file of the `backend/` directory for uploading to cPanel:
   - **Include**: `backend/server.js`, `backend/routes/`, `backend/services/`, `backend/middleware/`, `backend/models/`, `backend/package.json`, `backend/schema.sql`.
   - **Exclude**: `node_modules/` and `.env` (cPanel will install dependencies and you will configure variables on the server).

---

## 🚀 Step 2 — Set up the MySQL Database on cPanel

Since HTU-Elect uses Sequelize ORM with MySQL:
1. Log into your **cPanel Dashboard**.
2. Go to **MySQL Database Wizard**.
3. Create a database named `yourusername_htu_elect`.
4. Create a database user and assign a strong, secure password.
5. Grant **All Privileges** to the user on the database.
6. Open **phpMyAdmin** from cPanel, select your database, and import the `schema.sql` file (found in the root/backend directory or the `docs/` directory) to initialize the tables.

---

## 🚀 Step 3 — Set up the Backend API on cPanel

### 1. Upload Backend Files
1. Open cPanel **File Manager**.
2. Create a folder named `backend_app` outside `public_html` (e.g. `/home/username/backend_app`).
3. Upload your `backend.zip` file into `backend_app` and extract it.

### 2. Configure cPanel "Setup Node.js App"
1. In cPanel, search for and open **Setup Node.js App**.
2. Click **Create Application**.
3. Configure the fields:
   - **Node.js version**: Choose `18.x`, `20.x`, or higher.
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
In the **Setup Node.js App** configuration page, scroll to **Environment variables** and add:

| Variable | Description / Example Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `JWT_SECRET` | `your_secure_jwt_secret_key` |
| `MYSQL_URL` (or `DATABASE_URL`) | Optional full connection string: `mysql://user:pass@host:3306/dbname` (overrides the individual vars) |
| `MYSQL_HOST` | `127.0.0.1` (or your cPanel MySQL host) |
| `MYSQL_PORT` | `3306` |
| `MYSQL_USER` | `yourusername_dbuser` |
| `MYSQL_PASSWORD` | `your_db_password` |
| `MYSQL_DATABASE` | `yourusername_htu_elect` |
| `SMTP_HOST` | **Primary** — Elastic Email SMTP host: `smtp.elasticemail.com` |
| `SMTP_PORT` | **Primary** — Elastic Email SMTP port: `2525` (use `465` for SSL) |
| `SMTP_USER` | **Primary** — Elastic Email SMTP username (your Elastic account email) |
| `SMTP_PASS` | **Primary** — Elastic Email SMTP password |
| `ELASTICEMAIL_API_KEY` | Elastic Email REST API key (used as the primary REST path when SMTP is blocked; supports the paid 50k/month plan) |
| `ELASTICEMAIL_QUOTA_COOLDOWN_MINUTES` | Optional — minutes to skip Elastic Email after a quota-exhaustion error (default `60`); the chain fails over to Gmail/EmailJS/Resend during that window |
| `EMAIL_FROM` | Optional branded sender for REST providers, e.g. `"HTU Elect" <no-reply@htu.edu.gh>` |
| `GMAIL_USER` | Optional Gmail SMTP fallback sender (e.g. `your-gmail-address@gmail.com`) |
| `GMAIL_APP_PASSWORD` | Optional Gmail app password (enable 2FA + app password) — fallback only |
| `EMAILJS_SERVICE_ID` | Optional EmailJS fallback (`service_id`) |
| `EMAILJS_TEMPLATE_ID` | Optional EmailJS fallback (`template_id`) |
| `EMAILJS_PUBLIC_KEY` | Optional EmailJS fallback (`user_id`/public key) |
| `EMAILJS_PRIVATE_KEY` | Optional EmailJS fallback (`accessToken`/private key) |
| `RESEND_API_KEY` | Optional `re_...` Resend API key (REST fallback) |
| `BMS_API_KEY` | `your_mnotify_bms_api_key` |
| `BMS_SENDER_ID` | `COMPSSA` (or approved sender ID) |
| `IMAGEKIT_PUBLIC_KEY` | `your_imagekit_public_key` |
| `IMAGEKIT_PRIVATE_KEY` | `your_imagekit_private_key` |
| `IMAGEKIT_URL_ENDPOINT` | `your_imagekit_url_endpoint` |

3. Click **Save** and click **Restart Application**.
4. Test the health endpoint: `https://yourdomain.edu.gh/api/health` — should return `{"status":"success","message":"VoteTrust AI Backend is running"}`.
5. Test email delivery (OTP / password-reset / invitation emails):
   ```bash
   curl "https://yourdomain.edu.gh/api/auth/test-email?to=you@example.com"
   ```
   The backend tries providers in order — **Elastic Email** (SMTP, then REST) → Gmail SMTP → EmailJS → Resend — and returns success as soon as one delivers. When Elastic Email reports its quota is exhausted, it is skipped automatically (circuit breaker, default 60 min) and delivery goes straight to the fallbacks, then Elastic is retried after the cooldown. If it fails, check the server logs for which provider errored.

> **Email provider chain:** No email credentials are hardcoded in the code. **Elastic Email is the primary provider** (paid plan: 50,000 emails/month for $20). With only `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` set (Elastic SMTP) or `ELASTICEMAIL_API_KEY`, everything routes through Elastic. Gmail SMTP, EmailJS and Resend are fallbacks that only engage when Elastic is down or over its quota. On cPanel, outbound SMTP ports are sometimes blocked — the REST path (`ELASTICEMAIL_API_KEY`) covers that case.

> **Volume (2,000+ emails/day):** Covered by Elastic Email's paid plan (50,000 emails/month for $20 ≈ 1,600+ emails/day comfortably; a 2,000-email day is ~4% of the monthly quota). For comparison: Gmail SMTP caps at 500/day, Resend's free tier at 100/day, EmailJS at 200/month — those are only quota-overflow fallbacks. For inbox placement at this volume, verify your own sending domain (e.g. `no-reply@htu.edu.gh`) with Elastic Email (SPF/DKIM) and set `EMAIL_FROM` to it. Invitations/broadcasts send with 10-way concurrency, so a 2,000-recipient blast completes in minutes rather than hours.

> **Email/password authentication:** Voters register and log in with their **email + password** (JWT). The `voters` table enforces a UNIQUE constraint on `email` (`uq_voter_email`), so one email can own exactly one account. On first boot the API auto-creates the `users` tables and seeds a default superadmin (`superadmin@htu.edu.gh`) and admin (`admin@htu.edu.gh`) — change these credentials before going live.

---

## 🌐 Step 4 — Set up the Frontend on cPanel

### Option A: Next.js Node.js Deployment (SSR Support)
1. In cPanel, create a new Node.js App for the frontend under the application root `frontend_app` pointing to the startup file **`server.js`** (the repo's custom Next.js server — it serves the `next build` output; do **not** use `.next/standalone/server.js`, the repo is not built in standalone mode).
2. Set `BACKEND_URL` = `http://127.0.0.1:5000` (pointing to your running backend app port).
3. Under the frontend app environment variables, set `PORT` (e.g., `3000`).

### Standalone Backend Testing
You can run standalone backend verification before deploying to cPanel:
```bash
npm test --prefix backend
```
This executes `backend/scripts/test-cpanel-backend.js` to verify database connection, `.env` loadings, Phusion Passenger hooks, `/api` prefix route registrations, and email/password authentication.

### Option B: Apache Reverse Proxy and SPA Routing (`.htaccess`)
If you build Next.js as a single-page application (using `output: 'export'` or a static export build), upload the contents of the `out` or build directory to `public_html/`.

Create/update your `.htaccess` inside `public_html/` to reverse proxy to the backend API:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # 1. Route API requests to backend Express server
  RewriteRule ^api/(.*)$ http://127.0.0.1:5000/api/$1 [P,L]

  # 2. Serve static files directly if they exist
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # 3. Fallback Next.js client-side routing to index.html
  RewriteRule ^ index.html [L]
</IfModule>
```

---

## 🔒 Step 5 — Enable SSL (HTTPS)

Electronic voting requires secure HTTPS connections for access OTP delivery and JWT token security:
1. In cPanel, search for **SSL/TLS Status**.
2. Click **Run AutoSSL** to issue a free SSL certificate for your domains and subdomains.
3. In cPanel **File Manager**, ensure your `.htaccess` redirects HTTP to HTTPS:
   ```apache
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```

---

## ✅ Deployment Verification Checklist

- [ ] Backend health check responds successfully.
- [ ] Admin dashboard functions.
- [ ] Roster is imported correctly from CSV in phpMyAdmin.
- [ ] Verification codes are correctly sent via SMS and Email.
- [ ] `/api/auth/test-email?to=...` delivers a test email (via Elastic Email, with Gmail/EmailJS/Resend fallbacks).
- [ ] SSL HTTPS padlock icon is active.
