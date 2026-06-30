# What Is Pending

Application and infra **code** for go-live is implemented. Remaining work is primarily **operational**: configure real credentials, deploy to AWS, and validate end-to-end with live providers.

## 1) Deployment and Integration Certification (Primary Blockers)

These require real accounts, secrets, and a running AWS environment — not further local code.

### External Integrations
- [ ] SES: verify sender identity; confirm magic-link delivery in staging
- [ ] Razorpay: configure plan IDs + webhook secret; test checkout → webhook → plan activation
- [ ] FCM: validate push delivery with real device tokens via `/api/v1/notifications/devices`
- [ ] Upstox: validate OAuth callback, authenticated quotes, and order placement with sandbox/live account

### AWS Deployment
- [ ] Create ECR repositories and set GitHub secrets (`ECR_BACKEND_REPOSITORY`, `ECR_FRONTEND_REPOSITORY`, `DATABASE_URL_STAGING`, `DATABASE_URL_PRODUCTION`, `AWS_DEPLOY_ROLE_ARN`)
- [ ] Terraform apply for staging with real `terraform.tfvars` (certs, domain, secrets)
- [ ] Confirm all 4 ECS services healthy: frontend, backend, worker, beat
- [ ] Confirm Alembic migrations applied in staging/production DB
- [ ] Verify RDS backups/monitoring and Redis connectivity from all services

### End-to-End Validation (staging)
- [ ] New user: signup → magic link → broker onboarding → dashboard
- [ ] Connect Upstox → fetch live quote → create holding + agent
- [ ] Agent monitoring cycle produces decision + notification with live quote
- [ ] Subscription checkout + webhook updates plan tier
- [ ] Settings/profile persistence across reload

See `docs/go-live-checklist.md` and `docs/runbook.md` for full checklists.

## 2) Optional Hardening (Post-Launch or Parallel)

- Expand automated test coverage:
  - broker connect + token refresh + quote fetch
  - webhook idempotency (duplicate payload handling)
  - device token registration + push dispatch
  - user-confirmed decision execution path
- Add richer frontend E2E tests (Playwright) beyond page load
- Baseline load test and document capacity limits
- Wire CloudWatch alarms to on-call notification channel (SNS/PagerDuty)
- Implement account deletion flow (settings UI has placeholder)
- Zerodha broker integration (stub exists in `backend/app/services/broker/zerodha.py`)

## 3) Known Local Dev Gotchas

- **Unstyled UI:** stale/corrupted `.next` cache — see `README_03_RUN_AND_VERIFY.md`
- **Alembic conflicts:** if tables exist but revision is behind, inspect DB state before `stamp` vs `upgrade`
- **Quotes require broker connection:** `/stocks/quote` and research endpoints need a connected Upstox session (or demo mode with `ENABLE_DEMO_MODE=true` and no Upstox keys)

## 4) Intentionally Deferred

- Auto-execute on confirmation timeout (disabled at launch; code path exists for future enablement per agent)
- Google OAuth on login page (UI placeholder only; magic-link is the active auth method)
- Market summary widgets on dashboard (static display; not wired to live index data)
