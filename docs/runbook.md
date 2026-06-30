# Daxch On-Call Runbook

## Launch Preflight Gates

- Alembic head applied (`alembic current` equals latest revision).
- ECS services healthy: `frontend`, `backend`, `worker`, and `beat`.
- Broker OAuth callback URL and webhook URLs point to the current environment domain.
- Razorpay webhook signature verification passing on latest delivery attempt.
- Smoke checks green for login, broker connect, quote fetch, agent creation, and notifications.

## Key Dashboards

- ECS service health (frontend/backend/worker/beat)
- API latency and error rate
- Celery queue depth and task failures
- RDS CPU, connections, and storage
- Redis memory and evictions

## Common Incidents

### 1) Magic links not delivered
- Check SES suppression list and sender verification.
- Review backend logs for `EmailDeliveryError`.
- Verify `SES_FROM_EMAIL` and AWS IAM SES permissions.

### 2) Subscription webhook failures
- Validate `X-Razorpay-Signature` and webhook secret alignment.
- Confirm `subscription` entity payload has valid `id`.
- Confirm webhook idempotency table (`webhook_events`) is recording hashes.
- Reprocess failed webhook payload from Razorpay dashboard.

### 3) Agent decisions not executing
- Check Celery worker status and Redis broker connectivity.
- Verify beat scheduler is running and dispatching tasks.
- Confirm broker token refresh succeeded.

### 4) Push notifications not sent
- Validate FCM credentials JSON in secrets manager.
- Confirm device tokens are registered in `device_tokens`.
- Check Firebase delivery response failure count.

## Staging Validation Checklist

1. Request magic link for a new email and verify redirect to broker onboarding.
2. Complete Upstox OAuth and confirm `connected=true` in `/api/v1/broker/connection-status`.
3. Fetch live quote and create holding + monitor agent.
4. Confirm monitoring cycle creates decisions/notifications with live quote data.
5. Trigger Razorpay test checkout and verify webhook updates subscription state.
6. Register a push token via `/api/v1/notifications/devices` and verify push delivery.
7. Confirm settings/profile updates persist across reload.

## Production Cutover

1. Deploy tagged release via production workflow.
2. Verify migration step succeeded and all ECS services rolled out.
3. Execute smoke tests for first-user flow end-to-end.
4. Start 60-minute hypercare monitoring window:
   - API error rate and p95 latency
   - ECS task restarts
   - webhook failures
   - notification delivery failures

## Emergency Rollback

1. Scale down broken ECS service revision.
2. Redeploy previous stable image tag.
3. Roll back DB migration only if migration is backwards compatible.
4. Announce service status and estimated restoration timeline.

