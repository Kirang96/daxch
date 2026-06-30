# What Is Built

## Product Scope Implemented

- Email magic-link authentication (login + signup).
- First-user onboarding: verify → broker onboarding → dashboard.
- Broker connection with Upstox OAuth callback and token refresh.
- Stock holding creation and monitoring agent assignment.
- AI-assisted recommendation and monitoring decision pipeline.
- User-confirmed trade execution (no auto-execute-by-timeout at launch).
- Subscription plans (Starter ₹499 / Pro ₹999) with Razorpay checkout URL + webhook idempotency.
- Push notification registration and dispatch (FCM) with in-app notification feed.
- Watchlist, research, settings, invoices, and agent detail views.
- Audit logging and compliance disclaimers.

## Backend Implemented

### API Surface

Routers under `backend/app/api`:
- `auth.py` — magic-link request/verify
- `broker.py` — Upstox OAuth, connection status, token refresh
- `stocks.py` — quotes (authenticated), recommendations, holdings, buy
- `agents.py` — CRUD, decisions, confirm/reject, pause/stop
- `subscriptions.py` — plans, create (returns checkout URL), current, invoices, webhook
- `notifications.py` — list, mark read, device token register/unregister, test push
- `watchlist.py` — CRUD
- `settings.py` — profile and preferences
- `research.py` — ticker research snapshot (quote + AI + recent decisions)

### Data Models (key tables)

Defined in `backend/app/models/entities.py`:
- Core: `users`, `broker_connections`, `stock_holdings`, `monitor_agents`, `agent_decisions`, `orders`, `audit_logs`, `subscriptions`
- Feature wiring: `watchlist_items`, `notification_events`, `user_settings`, `invoice_records`
- Launch hardening: `device_tokens`, `webhook_events`

### Agent Orchestration

- Celery app and schedules in `backend/app/agents/celery_app.py`
- Poll scheduling in `backend/app/agents/scheduler.py` (IST market window)
- Monitoring in `backend/app/agents/monitor_task.py`:
  - Fetches live broker quote before AI analysis (no synthetic LTP from entry price)
  - Creates notification events on hold/pending/skipped cycles
  - Auto-execute task exists but is disabled by default config at launch

### Integrations

- **OpenAI** — `backend/app/services/ai/analyst.py`, `monitor.py`
- **Upstox** — `backend/app/services/broker/upstox.py`:
  - Authenticated quotes with instrument-key resolution
  - Real order placement when credentials present
  - Demo paths only when `ENABLE_DEMO_MODE=true` and not production
- **Broker session** — `backend/app/services/broker/session.py` (token refresh helper)
- **Razorpay** — `backend/app/services/payment.py` (subscription create, webhook verify, checkout URL)
- **SES** — `backend/app/services/email_service.py`
- **FCM** — `backend/app/services/notification.py`
- **Notification events** — `backend/app/services/notification_events.py` (persist + async push dispatch)

### Production Safety Gates

- Strict production env validation in `backend/app/core/config.py`:
  - `DEBUG=false`, strong `SECRET_KEY`, required URLs/secrets
  - `ENABLE_DEMO_MODE=false` enforced in production
- No `create_all` on startup (`backend/app/main.py`) — Alembic-only schema
- CORS restricted to configured origins (no wildcard fallback)
- Razorpay webhook idempotency via `webhook_events` table (payload hash)
- Invoice id uniqueness enforced at DB index level

### Migrations

- `0001_initial_schema.py`
- `0002_feature_wiring_tables.py` — watchlist, notifications, settings, invoices
- `0003_launch_hardening.py` — device_tokens, webhook_events, invoice index hardening

### Tests Present

- `backend/tests/test_health.py`
- `backend/tests/test_auth_service.py`
- `backend/tests/test_scheduler.py`
- `backend/tests/test_payment_service.py`

## Frontend Implemented

### Routes

Pages in `frontend/src/app`:
- `/` — landing
- `/login`, `/signup` — magic-link auth
- `/auth/verify` — token verify; routes to broker onboarding if not connected
- `/onboarding/broker` — broker selection wizard
- `/dashboard` — portfolio summary, create holding, connect broker
- `/portfolio` — holdings with live quotes
- `/agents`, `/agents/new`, `/agents/[id]` — agent list, wizard, detail
- `/watchlist` — CRUD + promote to agent
- `/research` — ticker research snapshot
- `/notifications` — feed with filters and mark-read
- `/subscription` — plans, Razorpay checkout redirect, invoices
- `/settings` — profile, notifications, broker, security, API connections
- `/broker`, `/broker/callback` — broker connect flow
- `/billing` — redirect/legacy stub

### UI System

Dark glassmorphic fintech theme:
- `frontend/src/app/globals.css` — oklch color tokens, glass effects
- `frontend/src/components/daxch/primitives.tsx` — GlassCard, StatCard, Sparkline, AreaChart, Badge, Disclaimer
- `frontend/src/components/layout/app-shell.tsx` — sidebar nav with API-backed profile/plan/unread badge
- All major pages wired to real backend APIs (no static demo data on core screens)

## Infrastructure and Delivery Implemented

- Terraform stack under `infrastructure/` — VPC, RDS, ElastiCache, ECS (4 services), ALB, CloudFront, Secrets Manager, IAM
- ECS deployment circuit breakers, health grace periods, CPU alarms
- CloudFront API cache bypass for `/api/*`, separate ALB/CloudFront cert vars, optional Route53 alias
- Production Dockerfiles (no dev server/reload):
  - `backend/Dockerfile` — uvicorn without `--reload`
  - `frontend/Dockerfile` — multi-stage build, `next start`
- Deploy workflows build/push ECR images, run Alembic, force ECS rolling deployment:
  - `.github/workflows/deploy-staging.yml`
  - `.github/workflows/deploy-production.yml`
- Ops docs: `docs/runbook.md` (preflight gates, staging checklist, cutover, hypercare)
