# 🚀 Render Deployment Guide

## Step 1 — Push to GitHub
Push this entire folder as a GitHub repo.

## Step 2 — Set up a MySQL Database (free options)
Render doesn't include free MySQL. Use one of these:
- **[PlanetScale](https://planetscale.com)** (recommended free tier)
- **[Aiven](https://aiven.io)** — free MySQL
- **[Railway](https://railway.app)** — MySQL add-on

Create a database named `welfare_system` and note down:
- Host, Port, User, Password

Then run the SQL files in `data/` to create the tables.

## Step 3 — Deploy on Render
1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render will auto-detect `render.yaml` and create 2 services

## Step 4 — Set Environment Variables

### Backend service (`digiverify-backend`):
| Key | Value |
|-----|-------|
| `DB_HOST` | your MySQL host |
| `DB_USER` | your MySQL user |
| `DB_PASSWORD` | your MySQL password |
| `DB_NAME` | `welfare_system` |
| `DB_PORT` | `3306` |

### Frontend service (`digiverify-frontend`):
| Key | Value |
|-----|-------|
| `VITE_API_BASE_URL` | `https://digiverify-backend.onrender.com` |

> ⚠️ Set `VITE_API_BASE_URL` **after** the backend is deployed so you have the actual URL. Then trigger a manual redeploy of the frontend.

## What was changed from original
- `requirements.txt` — removed `torch`, `transformers`, `streamlit` (not used in backend, 2GB+)
- `backend/app.py` — DB config now reads from env vars (`DB_HOST`, `DB_USER`, etc.)
- `backend/app.py` — `app.run()` now uses `$PORT` from Render
- `ReactFrontend/fund_tracker/src/api.js` — API base URL reads from `VITE_API_BASE_URL` env var
- Added `render.yaml`, `RENDER_DEPLOY.md`, `.env.example`
