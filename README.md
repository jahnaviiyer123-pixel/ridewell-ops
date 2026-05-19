# RideWell Ops – Local + Vercel Setup

## 1) Required environment variables (Backend / Vercel)

Set these in **Vercel → Project → Settings → Environment Variables** (Production + Preview), and also in `backend/.env` for local dev:

- `MONGO_URL` (your MongoDB connection string)
- `DB_NAME` (database name)
- `JWT_SECRET` (recommended: strong random string)
- `ADMIN_EMAIL` (optional; default `admin@ridewell.com`)
- `ADMIN_PASSWORD` (optional; default `admin123`)

## 2) Run locally (no “Something went wrong”)

In two terminals:

1. Backend (FastAPI):
   - `cd /Users/harsha/Desktop/new-operations-website--main/backend`
   - create `backend/.env` with the variables above
   - `pip install -r requirements.txt`
   - `uvicorn server:app --reload --port 8000`

2. Frontend (CRA):
   - `cd /Users/harsha/Desktop/new-operations-website--main/frontend`
   - `yarn install`
   - `yarn start`

The frontend proxies `/api/*` to `http://localhost:8000` via `frontend/package.json`.

## 3) Deploy to Vercel

- Push this repo to GitHub.
- Import into Vercel.
- Add the environment variables above.
- Deploy.
