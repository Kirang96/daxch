# Daxch

Daxch is an AI-assisted trading operations platform for Indian users. The app does not suggest which stock to pick. Users choose a ticker, define intent, and optionally assign an AI monitoring agent that can evaluate buy/sell/hold actions with compliance-safe audit logs.

## Monorepo Layout

- `backend/` FastAPI + Celery + PostgreSQL + Redis
- `frontend/` Next.js web app
- `infrastructure/` AWS infrastructure bootstrap templates

## Local Development

1. Copy environment templates:
   - `cp backend/.env.example backend/.env`
   - `cp frontend/.env.example frontend/.env.local`
2. Install dependencies:
   - backend: `python3.12 -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt`
   - frontend: `cd frontend && npm install`
3. Start local infra:
   - `brew services start postgresql@16`
   - `brew services start redis`
4. Start services:
   - backend: `source .venv/bin/activate && PYTHONPATH=$PWD uvicorn backend.app.main:app --env-file backend/.env`
   - worker: `source .venv/bin/activate && PYTHONPATH=$PWD celery -A backend.app.agents.celery_app.celery_app worker --loglevel=info`
   - beat: `source .venv/bin/activate && PYTHONPATH=$PWD celery -A backend.app.agents.celery_app.celery_app beat --loglevel=info`
   - frontend: `cd frontend && npm run dev`
5. Open:
   - Frontend: `http://localhost:3000`
   - Backend docs: `http://localhost:8000/docs`

## Compliance Notes

- User always chooses stock ticker.
- AI outputs are analysis signals, not investment advice.
- Every monitoring cycle and decision is captured in an immutable audit trail.

## Deployment

- Terraform stack is under `infrastructure/`.
- CI/CD workflows are under `.github/workflows/`.
- Use `deploy-staging.yml` from `develop` and `deploy-production.yml` from release tags.
- Guides: [docs/deploy-staging.md](docs/deploy-staging.md), [docs/deploy-production.md](docs/deploy-production.md)

