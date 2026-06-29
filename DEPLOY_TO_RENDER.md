# Deploying to Render — Step by Step

No terminal. No technical knowledge needed. Follow each step in order.
Estimated time: 20–30 minutes.

---

## What you'll end up with

- A live URL for your API (e.g. `https://cefr-platform.onrender.com`)
- A live URL for your frontend (e.g. `https://cefr-frontend.onrender.com`)
- A real Postgres database hosted by Render
- Everything auto-updates whenever you change the code

---

## STEP 1 — Create a GitHub account (if you don't have one)

1. Go to **https://github.com**
2. Click **Sign up**
3. Choose the free plan
4. Verify your email

---

## STEP 2 — Upload the code to GitHub

1. Go to **https://github.com/new**
2. Repository name: `cefr-platform`
3. Set to **Private**
4. Click **Create repository**
5. On the next page, click **uploading an existing file**
6. Drag and drop the entire `cefr-platform` folder you downloaded
7. Scroll down, click **Commit changes**

Your code is now on GitHub. ✓

---

## STEP 3 — Create a Render account

1. Go to **https://render.com**
2. Click **Get Started for Free**
3. Sign up with your GitHub account (click "Continue with GitHub")
4. Authorize Render to access your GitHub

---

## STEP 4 — Create the Database

1. In Render dashboard, click **+ New** → **PostgreSQL**
2. Fill in:
   - **Name:** `cefr-database`
   - **Region:** Choose closest to your location
   - **Plan:** Free
3. Click **Create Database**
4. Wait about 2 minutes for it to be ready
5. Once ready, find the **Internal Database URL** — copy it and save it somewhere (Notepad is fine). It looks like:
   ```
   postgresql://user:password@host/dbname
   ```

---

## STEP 5 — Deploy the Backend (API)

1. Click **+ New** → **Web Service**
2. Click **Connect a repository** → select `cefr-platform`
3. Fill in:
   - **Name:** `cefr-api`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Scroll down to **Environment Variables** — click **Add Environment Variable** for each:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Paste the Internal Database URL from Step 4 |
   | `JWT_SECRET` | Type any long random string (e.g. `mySchoolPlatform2026secretKey99`) |
   | `ANTHROPIC_API_KEY` | Your Anthropic API key (from console.anthropic.com) |
   | `NODE_ENV` | `production` |

5. Click **Create Web Service**
6. Wait 3–5 minutes. You'll see a log stream — wait until you see:
   ```
   🎓 CEFR Platform running on port 10000
   ```
7. Your API URL will be shown at the top, e.g.: `https://cefr-api.onrender.com`

**Test it:** Open a new browser tab and go to `https://cefr-api.onrender.com/health` — you should see `{"ok":true}`. ✓

---

## STEP 6 — Deploy the Frontend

1. Click **+ New** → **Static Site**
2. Connect the same `cefr-platform` repository
3. Fill in:
   - **Name:** `cefr-frontend`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Add Environment Variable:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | Your API URL from Step 5 (e.g. `https://cefr-api.onrender.com`) |

5. Click **Create Static Site**
6. Wait 3–5 minutes
7. Your frontend URL will appear, e.g.: `https://cefr-frontend.onrender.com`

---

## STEP 7 — Create your first school

Open a new browser tab and go to:
```
https://cefr-api.onrender.com/health
```

Then run this one-time setup by going to:
```
https://cefr-api.onrender.com/setup
```

This creates your first school and admin account. Write down the credentials it gives you.

> **Note:** If you want to create more schools later, contact the platform admin (you).

---

## STEP 8 — Log in

1. Go to your frontend URL: `https://cefr-frontend.onrender.com`
2. Log in with the admin credentials from Step 7
3. Create teacher accounts from the admin dashboard
4. Teachers create student accounts from their dashboard

---

## You're live. 🎉

---

## Troubleshooting

**API shows "Service unavailable"**
→ Free tier services sleep after 15 minutes of inactivity. First visit after sleeping takes 30–60 seconds to wake up. Upgrade to the $7/month "Starter" plan to avoid this.

**"School not found" error on login**
→ The school slug isn't set up yet. Go back to Step 7.

**Database connection error in logs**
→ Double-check that `DATABASE_URL` is set correctly in the backend environment variables. Use the **Internal** URL, not the External one.

**Frontend shows blank page**
→ Check that `VITE_API_URL` is set correctly and does NOT have a trailing slash.

---

## Upgrading later

When you're ready to go beyond the free tier:
- Backend: $7/month (Starter) — no sleep, faster response
- Database: $7/month (Starter) — 1GB storage, daily backups
- Frontend: Free forever (static sites are always free on Render)

Total for a production school: ~$14/month.

---

## Adding a custom domain (optional)

1. In Render, open your frontend service
2. Click **Custom Domains** → **Add Custom Domain**
3. Enter your domain (e.g. `app.yourschool.com`)
4. Follow the DNS instructions Render gives you (add a CNAME record in your domain registrar)
5. Done — HTTPS is automatic

For the school subdomain routing (`demo.yourschool.com`), you'd add a wildcard DNS record: `*.yourschool.com → cefr-api.onrender.com`
