# Daxch Go-Live Checklist

## Integration Readiness

- SES sender identity verified and magic-link emails delivered in staging.
- Razorpay plan IDs and webhook secret configured for staging and production.
- FCM credentials valid; push delivery validated on iOS and Android.
- Upstox OAuth callback and order placement validated with sandbox/live account.

## Application Readiness

- All production secrets set in AWS Secrets Manager.
- No simulated integration paths active in production configuration.
- Frontend and backend smoke tests pass.
- Subscription lifecycle tested: create, activate, charge, cancel, and pause.

## Infrastructure Readiness

- Terraform apply successful for staging.
- ECS services healthy (frontend, backend, worker, beat).
- RDS backups and monitoring enabled.
- Redis connectivity verified from all ECS services.

## Security and Compliance

- CORS origins restricted to production domains.
- Token encryption key configured and rotated policy documented.
- Audit trails captured for every AI decision and order attempt.
- Legal disclaimers visible across auth, dashboard, and recommendation surfaces.

## Release Validation

- Load test passed at agreed baseline.
- Alerting wired for API latency, job failures, queue backlog, and 5xx spikes.
- Rollback plan tested.
- Incident runbook shared with on-call owners.

