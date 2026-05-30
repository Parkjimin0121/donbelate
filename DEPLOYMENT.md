# Deployment Guide

This app can run without your PC by deploying:

- Frontend: Vercel
- Backend: Render Web Service
- Database: Render Postgres or another Postgres provider

## Backend on Render

1. Push this project to GitHub.
2. In Render, create a Postgres database.
3. Create a Web Service for the backend.
4. Use these settings:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables:
   - `DATABASE_URL`: the internal or external Postgres connection string from Render
   - `DATABASE_SSL`: `true`

The backend still uses `backend/data/db.json` locally when `DATABASE_URL` is not set.

## Frontend on Vercel

1. Import the GitHub project in Vercel.
2. Set the Root Directory to `frontend`.
3. Add environment variables:
   - `NEXT_PUBLIC_API_BASE_URL`: `/api-backend`
   - `BACKEND_URL`: your Render backend URL, for example `https://dontbelate-api.onrender.com`
   - `NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID`: optional, only if you want the real Naver map
4. Deploy.

The frontend proxies `/api-backend/*` to `BACKEND_URL`, so the browser only talks to the frontend domain.

## Important Notes

- Free Render Web Services can sleep after inactivity, so the first request may be slow.
- Do not rely on local files for deployed data. Use Postgres through `DATABASE_URL`.
- Quick tunnels such as Cloudflare Tunnel are good for short testing, but permanent use needs hosted services.
