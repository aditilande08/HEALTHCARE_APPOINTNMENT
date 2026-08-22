# Deployment Guide

This guide describes how to deploy the Healthcare Appointment & Follow-up Manager using Neon for the database, Render for the backend, and Vercel for the frontend.

## 1. Database Setup (Neon)
1. Sign up on [neon.tech](https://neon.tech).
2. Create a new project called `healthcare-db`.
3. Copy the PostgreSQL connection string (`DATABASE_URL`).

## 2. Backend Deployment (Render)
1. Link your GitHub repository to [render.com](https://render.com).
2. Create a new Web Service with the following details:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx prisma db push && npm run db:seed && npm start`
3. Configure the environment variables in Render:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Your Neon Connection String)*
   - `JWT_SECRET`: *(Any secure random string)*
   - `JWT_REFRESH_SECRET`: *(Any secure random string)*
   - `FRONTEND_URL`: `*` *(Or your Vercel URL once created)*
   - `OPENAI_API_KEY`: *(Optional, for LLM features)*
4. Copy the live Web Service URL (e.g., `https://healthcare-api.onrender.com`).

## 3. Frontend Deployment (Vercel)
1. Import your repository into [vercel.com](https://vercel.com).
2. Set the following settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
3. Add the environment variables:
   - `VITE_API_URL`: `https://healthcare-api.onrender.com/api` *(Your Render backend URL followed by /api)*
4. Trigger the deployment.

---

## Default Admin Account
Once the seeding runs on database push, you can log in to the admin panel:
- **Email**: `admin@clinic.com`
- **Password**: `admin123456`
