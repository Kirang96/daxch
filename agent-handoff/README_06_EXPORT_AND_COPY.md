# Export, Copy, and New-Machine Setup

Use this when moving the project to another machine. The repo may be shipped **without** local build artifacts — only source and env files.

## Stop All Servers First

Run from repo root before copying or archiving:

```bash
# Free frontend and API ports
lsof -ti :3000,:8000 | xargs kill -9 2>/dev/null || true

# Stop Daxch processes if still running
pkill -f "uvicorn backend.app.main" 2>/dev/null || true
pkill -f "celery -A backend.app.agents" 2>/dev/null || true
```

Verify nothing is listening:

```bash
lsof -ti :3000 || echo "port 3000 free"
lsof -ti :8000 || echo "port 8000 free"
```

Services to stop (4 terminals when running locally):

| Service | Port / role |
|---------|-------------|
| Next.js dev (`npm run dev`) | 3000 |
| FastAPI (`uvicorn backend.app.main`) | 8000 |
| Celery worker | background |
| Celery beat | background |

## What To Keep (Required for Copy)

Keep these — everything needed to rebuild and run on a new system:

```
backend/                  # Python source, Alembic, requirements, Dockerfile
frontend/                 # Next.js source (no node_modules/.next)
infrastructure/           # Terraform (no .terraform/)
.github/                  # CI/CD workflows
docs/                     # Runbook, checklists, compliance
agent-handoff/            # This onboarding pack
scripts/                  # Helper scripts
docker-compose.yml
Makefile
README.md
.gitignore
backend/.env              # Local secrets (KEEP — not in git)
frontend/.env.local       # Frontend API URL (KEEP — not in git)
```

Optional but useful: `backend/.env.example`, `frontend/.env.example`, `infrastructure/terraform.tfvars.example`.

## What To Remove Before Copy

Safe to delete — regenerated on the new machine:

| Path | Why |
|------|-----|
| `.venv/` | Python virtualenv — `pip install` recreates |
| `frontend/node_modules/` | `npm install` recreates |
| `frontend/.next/` | Next.js build cache — `npm run dev` recreates |
| `__pycache__/`, `*.pyc` | Python bytecode |
| `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/` | Tool caches |
| `infrastructure/.terraform/` | Terraform provider cache — `terraform init` recreates |
| `lovable-reference/` | UI design reference only; app is already built |
| `celerybeat-schedule.db` | Local Celery beat state |
| `*.log`, `.DS_Store` | Runtime / OS junk |
| `frontend/playwright-report/`, `test-results/`, `coverage/` | Test artifacts |

One-liner cleanup (from repo root):

```bash
rm -rf .venv frontend/node_modules frontend/.next .pytest_cache .mypy_cache .ruff_cache \
  htmlcov lovable-reference infrastructure/.terraform \
  frontend/playwright-report frontend/test-results frontend/coverage \
  celerybeat-schedule.db
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true
```

After cleanup the tree is roughly **~1 MB** (source only). Env files add a few hundred bytes.

**Do not delete:** `backend/.env` or `frontend/.env.local` unless you plan to reconfigure secrets manually on the new machine.

## Bootstrap on New Machine

Prerequisites on the target system: Python 3.12, Node 20, PostgreSQL 16, Redis.

```bash
# 1. Python backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# 2. Frontend
cd frontend && npm install && cd ..

# 3. Database
createdb daxch || true
PYTHONPATH=$PWD alembic -c backend/alembic.ini upgrade head

# 4. Start infra dependencies (macOS example)
brew services start postgresql@16
brew services start redis
```

If env files were **not** copied, recreate from templates:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit both files with correct DATABASE_URL, REDIS_URL, etc.
```

Then start all four services — see `README_03_RUN_AND_VERIFY.md` (Backend API, Celery worker, Celery beat, Frontend).

## Post-Copy Checklist

- [ ] `backend/.env` and `frontend/.env.local` present and URLs point to local Postgres/Redis
- [ ] `alembic upgrade head` succeeds
- [ ] `pytest backend/tests` passes
- [ ] Frontend loads with styles at `http://localhost:3000`
- [ ] `curl http://localhost:8000/health` returns `{"status":"ok"}`
