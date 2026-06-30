# How To Run And Verify

> **Moving to another machine?** Stop servers and trim artifacts first — see `README_06_EXPORT_AND_COPY.md`.

## Local Prerequisites

- Python 3.12
- Node.js 20 + npm
- PostgreSQL 16
- Redis

## Local Setup

From repo root:

1. Copy env templates:
   - `cp backend/.env.example backend/.env`
   - `cp frontend/.env.example frontend/.env.local`
2. Create backend venv and install:
   - `python3.12 -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r backend/requirements.txt`
3. Install frontend dependencies:
   - `cd frontend && npm install && cd ..`
4. Create database and run migrations:
   - `createdb daxch || true`
   - `PYTHONPATH=$PWD alembic -c backend/alembic.ini upgrade head`

## Start Dependencies

- `brew services start postgresql@16`
- `brew services start redis`

## Start Application Services

Open separate terminals from repo root:

1. **Backend API:**
   ```bash
   source .venv/bin/activate
   uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload --env-file backend/.env
   ```
2. **Celery worker:**
   ```bash
   source .venv/bin/activate
   PYTHONPATH=$PWD celery -A backend.app.agents.celery_app.celery_app worker --loglevel=info
   ```
3. **Celery beat:**
   ```bash
   source .venv/bin/activate
   PYTHONPATH=$PWD celery -A backend.app.agents.celery_app.celery_app beat --loglevel=info
   ```
4. **Frontend:**
   ```bash
   cd frontend && npm run dev
   ```

## URLs

- Frontend: `http://localhost:3000`
- Backend docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`
- API base: `http://localhost:8000/api/v1`

## Smoke Test Checklist

### Auth and onboarding
1. Open `/signup`, enter email (+ optional name), submit magic-link request.
2. Use debug token link shown in dev mode (or check email if SES configured).
3. After verify, confirm redirect to `/onboarding/broker` if broker not connected.
4. Connect Upstox via `/broker` (requires Upstox keys in `.env`) or skip to dashboard.

### Core flows
5. Dashboard loads with API-backed profile/plan (not hardcoded names).
6. Fetch quote and create holding + agent from dashboard or `/agents/new`.
7. `/portfolio`, `/agents`, `/agents/[id]` show real data.
8. `/watchlist` — add/remove items.
9. `/research?ticker=RELIANCE` — research snapshot (needs broker + OpenAI or demo mode).
10. `/notifications` — list and mark read.
11. `/settings` — update profile/preferences.
12. `/subscription` — submit plan (redirects to Razorpay if keys configured).

### Backend quick checks
```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/subscriptions/plans
```

## Automated Verification

```bash
# Backend tests
source .venv/bin/activate && python -m pytest backend/tests

# Frontend build (stop dev server first!)
cd frontend && npm run build

# Terraform validate
cd infrastructure && terraform init -backend=false && terraform validate
```

## Troubleshooting

### Blank / unstyled UI

Usually a corrupted `.next` cache — often caused by running `npm run build` while `npm run dev` is active.

From `frontend/`:
```bash
# kill anything on port 3000
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
rm -rf .next
npm run dev
```
Then hard refresh browser (`Cmd+Shift+R`). Verify CSS returns 200:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/_next/static/css/app/layout.css
```

### "Connect Upstox before using market data"

Quote/research endpoints require a connected broker session. Connect via `/broker` or enable local demo mode:
```
ENABLE_DEMO_MODE=true
```
(with no Upstox client ID/secret set)

### Alembic migration errors

If tables already exist from a prior `create_all` or partial migration:
```bash
alembic -c backend/alembic.ini current   # check revision
alembic -c backend/alembic.ini history   # see chain
# Only if DB schema matches but revision is behind:
alembic -c backend/alembic.ini stamp head
```

### Docker Not Available

Use native local run (Postgres/Redis via Homebrew + commands above). Docker is optional for local dev.

## Stop All Servers

When shutting down or before copying the project elsewhere:

```bash
lsof -ti :3000,:8000 | xargs kill -9 2>/dev/null || true
pkill -f "uvicorn backend.app.main" 2>/dev/null || true
pkill -f "celery -A backend.app.agents" 2>/dev/null || true
```

Confirm ports are free, then proceed with export steps in `README_06_EXPORT_AND_COPY.md`.
