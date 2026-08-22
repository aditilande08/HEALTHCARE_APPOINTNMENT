# 100% Free Cloud Deployment Guide

This guide walks you through deploying the complete **Healthcare Appointment & Follow-up Manager** for **free** using standard industry free tiers (no credit card required).

---

## 🎯 Best 100% Free Tier Stack

| Layer | Free Platform | Free Limits | Notes |
|---|---|---|---|
| **Database** | **[Neon](https://neon.tech)** or **[Supabase](https://supabase.com)** | 0.5 GB Postgres storage, generous compute | Instant PostgreSQL connection string |
| **Backend API** | **[Render](https://render.com)** Web Service | 512 MB RAM, free web services | Automatically spins up on HTTP request |
| **Frontend** | **[Vercel](https://vercel.com)** | Unlimited deployments, global CDN | Fast builds, custom subdomains |

---

## 🚀 Option 1: Step-by-Step Free Cloud Deployment (Recommended)

### Step 1: Create Free PostgreSQL Database on Neon
1. Go to **[neon.tech](https://neon.tech)** and sign up (free with GitHub/Google).
2. Create a new project named `healthcare-db`.
3. Copy your PostgreSQL connection string (`DATABASE_URL`). It will look like:
   ```
   postgresql://username:password@ep-xyz.us-east-2.aws.neon.tech/healthcare_db?sslmode=require
   ```

---

### Step 2: Push Code to GitHub
Create a GitHub repository and push your project:
```bash
git init
git add .
git commit -m "feat: complete healthcare appointment and follow-up manager"
git branch -M main
git remote add origin https://github.com/<your-username>/healthcare-manager.git
git push -u origin main
```

---

### Step 3: Deploy Backend on Render (Free)
1. Sign up at **[render.com](https://render.com)**.
2. Click **New +** ➔ **Web Service**.
3. Connect your GitHub repository.
4. Set the following configuration:
   - **Name**: `healthcare-api`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx prisma db push && npm run db:seed && npm start`
   - **Instance Type**: `Free`
5. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(paste the Neon connection string from Step 1)*
   - `JWT_SECRET`: *(enter any random string e.g. `jwt_secret_render_production_99`)*
   - `JWT_REFRESH_SECRET`: *(enter any random string e.g. `jwt_refresh_render_production_99`)*
   - `FRONTEND_URL`: `*` *(or your Vercel URL once created)*
   - `OPENAI_API_KEY`: *(optional, e.g. `sk-...`)*
6. Click **Deploy Web Service**.
7. Copy your backend URL once live (e.g. `https://healthcare-api.onrender.com`).

---

### Step 4: Deploy Frontend on Vercel (Free)
1. Sign up at **[vercel.com](https://vercel.com)**.
2. Click **Add New...** ➔ **Project**.
3. Import your GitHub repository.
4. Set:
   - **Root Directory**: Click `Edit` and select `frontend`.
   - **Framework Preset**: `Vite` (auto-detected).
5. Expand **Environment Variables** and add:
   - `VITE_API_URL`: `https://healthcare-api.onrender.com/api` *(replace with your Render backend URL + `/api`)*
6. Click **Deploy**.

---

## ⚡ Option 2: 1-Click Render Blueprint (`render.yaml`)

If you want to host everything on Render:
1. Push this repository to GitHub.
2. Go to **[render.com](https://render.com)** ➔ **New +** ➔ **Blueprint**.
3. Select your repository. Render will parse [`render.yaml`](file:///C:/Users/aditi/.gemini/antigravity-ide/scratch/healthcare-app/render.yaml) and automatically provision:
   - Free Managed PostgreSQL Database
   - Free Node.js Backend API
   - Free Frontend Static Site

---

## 🐳 Option 3: Local / VPS Docker Compose (Self-Hosted)

To run the complete production stack locally or on any Linux VPS with one command:
```bash
docker compose up --build
```
- Frontend will be accessible at: `http://localhost:80`
- Backend API will be accessible at: `http://localhost:3000`
- PostgreSQL will be running on port `5432`

---

## 🔑 Default Seed Account
Once your database is pushed and seeded, log in to the admin portal with:
- **Email**: `admin@healthcare.com`
- **Password**: `AdminPass123!`
