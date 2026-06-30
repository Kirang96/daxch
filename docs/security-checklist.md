# Security Checklist

- Encrypt broker access and refresh tokens at rest.
- Rotate secrets via AWS Secrets Manager.
- Enforce TLS termination with ACM and ALB.
- Apply rate limits and JWT auth to all private APIs.
- Keep decision execution idempotent using request IDs.
- Add structured audit events for all order state changes.
- Enable CloudWatch alarms and Sentry alerts for:
  - order failures
  - worker crashes
  - queue backlog
  - auth anomalies
- Restrict IAM roles by service and least privilege.
- Regularly run dependency scanning and container image scanning.

