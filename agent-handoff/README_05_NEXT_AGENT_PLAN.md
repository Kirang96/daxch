# Next Agent Execution Plan

**Status as of 2026-06-30:** Application code and infra templates for go-live are complete. The next agent should focus on **deploying and certifying** with real credentials, not rebuilding core features.

## Phase 0: Confirm Local Baseline (Quick)

1. Start backend, worker, beat, frontend per `README_03_RUN_AND_VERIFY.md`.
2. Run `pytest backend/tests` and `npm run build` (with dev server stopped).
3. Confirm UI renders with styles and auth flow works via debug magic link.

Exit criteria: local stack healthy, no build/test failures.

## Phase 1: Staging Deployment (Highest Priority)

1. Provision AWS resources:
   - ECR repos for backend and frontend images
   - Fill `infrastructure/terraform.tfvars` from example (domain, certs, secrets, images)
   - `terraform apply` for staging
2. Configure GitHub environment secrets for staging deploy workflow.
3. Push to `develop` branch or trigger `deploy-staging.yml` manually.
4. Verify deploy pipeline:
   - Images pushed to ECR
   - Alembic `upgrade head` succeeded
   - All 4 ECS services running and healthy

Exit criteria: staging URL serves styled frontend + `/health` returns ok.

## Phase 2: Integration Certification in Staging

Run the staging validation checklist from `docs/runbook.md`:

1. **SES** — magic-link email delivery to real inbox
2. **Upstox** — OAuth connect, live quote, optional test order
3. **OpenAI** — recommendation and monitoring decision with real key
4. **Razorpay** — checkout redirect, webhook activation, invoice record
5. **FCM** — register device token, receive push on agent decision
6. **End-to-end user** — signup → broker → holding → agent → notification → settings

Exit criteria: every integration has a successful staging trace documented.

## Phase 3: Production Cutover

1. Configure production GitHub secrets and `terraform.tfvars`.
2. Deploy via release tag or `deploy-production.yml`.
3. Execute preflight gates from `docs/runbook.md`:
   - Migrations at head
   - ECS services healthy
   - Webhook signatures verified
   - Smoke tests green
4. Run 60-minute hypercare window (API errors, ECS restarts, webhook failures).

Exit criteria: `docs/go-live-checklist.md` items checked off.

## Phase 4: Post-Launch Improvements (Lower Priority)

Pick up items from `README_02_PENDING.md` as needed:
- Expanded test coverage and Playwright E2E
- Load testing and alarm wiring to on-call
- Account deletion implementation
- Zerodha broker support

## Suggested Immediate Next Task

**Deploy to staging and run Phase 2 integration certification.** This is the critical path — all application code for real-user flows is in place; what remains is proving it works with live provider credentials on AWS.

## Key Files for Reference

| Area | Path |
|------|------|
| Runbook | `docs/runbook.md` |
| Go-live checklist | `docs/go-live-checklist.md` |
| Compliance | `docs/compliance.md` |
| Security checklist | `docs/security-checklist.md` |
| Deploy staging | `.github/workflows/deploy-staging.yml` |
| Deploy production | `.github/workflows/deploy-production.yml` |
| Terraform vars example | `infrastructure/terraform.tfvars.example` |
| Production config | `backend/app/core/config.py` |
| Latest migration | `backend/alembic/versions/0003_launch_hardening.py` |
