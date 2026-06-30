# Daxch Agent Handoff

This folder is an onboarding pack for the next coding agent.

It explains:
- what has already been built,
- what is still pending before production launch,
- how to run and verify locally,
- where to find core architecture and integration touchpoints,
- and what to do next in priority order.

## Read First

1. `README_01_BUILT.md` - implemented scope and current capability.
2. `README_02_PENDING.md` - pending work and go-live blockers.
3. `README_03_RUN_AND_VERIFY.md` - local run steps and smoke test.
4. `README_04_ENV_AND_SECRETS.md` - required env variables and secret ownership.
5. `README_05_NEXT_AGENT_PLAN.md` - execution order for next delivery phases.
6. `README_06_EXPORT_AND_COPY.md` - stop servers, trim for copy, bootstrap on new machine.

## Repository Snapshot

- Backend: FastAPI + SQLAlchemy + Celery + Redis + PostgreSQL
- Frontend: Next.js 14 + TypeScript + Tailwind (dark glassmorphic UI)
- Infra: Terraform on AWS (ECS, ALB/CloudFront, RDS, ElastiCache, Secrets Manager)
- CI/CD: GitHub Actions (`ci.yml`, `deploy-staging.yml`, `deploy-production.yml`, `security-scan.yml`)
- Migrations: Alembic only (`0001` initial, `0002` feature wiring, `0003` launch hardening)

## Important Context

- **Go-live code path is implemented.** Application, infra templates, and deploy workflows are in place for a real-user launch with populated secrets.
- **Day-1 trade policy:** user-confirmed execution only (`auto_execute_on_timeout=false` by default).
- **Demo mode** is gated by `ENABLE_DEMO_MODE=true` and only allowed outside production. Production requires real credentials and rejects demo fallbacks.
- **Schema lifecycle:** `Base.metadata.create_all` was removed from startup. Use Alembic exclusively.
- **Local dev caveat:** do not run `npm run build` while `npm run dev` is running — it corrupts `.next` and causes unstyled pages. See troubleshooting in `README_03_RUN_AND_VERIFY.md`.
- **Copying to another machine:** stop all servers, remove build artifacts, keep `backend/.env` and `frontend/.env.local`. See `README_06_EXPORT_AND_COPY.md`.

## Last Updated

2026-06-30 — go-live implementation + export/copy handoff added.
