# Environment And Secrets Reference

This file is for implementation context only. Do not commit real secrets.

## Backend Env Baseline

Template source: `backend/.env.example`

### Core runtime
| Variable | Purpose |
|----------|---------|
| `ENVIRONMENT` | `development` / `staging` / `production` |
| `DEBUG` | Must be `false` in production |
| `ENABLE_DEMO_MODE` | Allow demo fallbacks when integrations missing (must be `false` in production) |
| `API_PREFIX` | Default `/api/v1` |
| `FRONTEND_BASE_URL` | Used for magic-link redirects |
| `CORS_ORIGINS` | Comma-separated allowed origins (required in production) |
| `SECRET_KEY` | JWT signing key (min 32 chars, non-default in production) |
| `FERNET_KEY` | Encrypts broker tokens at rest |

### Data and queues
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `postgresql+psycopg://user:pass@host:5432/daxch` |
| `REDIS_URL` | Redis for rate limiting |
| `CELERY_BROKER_URL` | Celery message broker |
| `CELERY_RESULT_BACKEND` | Celery result backend |

### AI
| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Required when demo mode disabled |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |

### Broker
| Variable | Purpose |
|----------|---------|
| `UPSTOX_CLIENT_ID` | Upstox OAuth app ID |
| `UPSTOX_CLIENT_SECRET` | Upstox OAuth secret |
| `UPSTOX_REDIRECT_URI` | Must match Upstox app config (e.g. `http://localhost:3000/broker/callback`) |
| `UPSTOX_BASE_URL` | Default `https://api.upstox.com/v2` |

### Payments
| Variable | Purpose |
|----------|---------|
| `RAZORPAY_KEY_ID` | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature verification |
| `RAZORPAY_PLAN_STARTER_ID` | Razorpay plan ID for ₹499 tier |
| `RAZORPAY_PLAN_PRO_ID` | Razorpay plan ID for ₹999 tier |
| `RAZORPAY_PLAN_ULTRA_ID` | Razorpay plan ID for ₹2,499 tier |
| `TAVILY_API_KEY` | Tavily web search (analysis; optional in dev, recommended in staging/prod) |
| `NEWS_API_KEY` | NewsAPI (analysis; optional but recommended) |

### Notifications and email
| Variable | Purpose |
|----------|---------|
| `AWS_REGION` | e.g. `ap-south-1` |
| `SES_FROM_EMAIL` | Verified SES sender |
| `FCM_CREDENTIALS_JSON` | Firebase service account JSON (string) |

## Frontend Env Baseline

Template source: `frontend/.env.example`

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | API base URL. Local: `http://localhost:8000/api/v1`. Production/ECS: `/api/v1` (same-origin via ALB) |

## Production Validation Behavior

`backend/app/core/config.py` enforces on startup when `ENVIRONMENT=production`:
- All integration secrets present
- `DEBUG=false`
- `ENABLE_DEMO_MODE=false`
- `SECRET_KEY` is secure (not default, ≥32 chars)
- `FRONTEND_BASE_URL`, `CORS_ORIGINS`, `UPSTOX_REDIRECT_URI` set

Demo/fallback paths in Upstox, OpenAI analyst, and OpenAI monitor are blocked when demo mode is off.

## Secrets Manager Mapping (Infra)

Terraform injects secrets into ECS tasks via `app_secrets` in `infrastructure/terraform.tfvars`. See:
- `infrastructure/ecs.tf` — task definition secret env refs
- `infrastructure/terraform.tfvars.example` — template with `DEBUG=false`, `ENABLE_DEMO_MODE=false`

Non-secret env vars go in `backend_env_vars` (e.g. `FRONTEND_BASE_URL`, `CORS_ORIGINS`, `UPSTOX_REDIRECT_URI`).

## GitHub Actions Secrets (Deploy Workflows)

Required for `.github/workflows/deploy-staging.yml` and `deploy-production.yml`:

| Secret | Purpose |
|--------|---------|
| `AWS_DEPLOY_ROLE_ARN` | OIDC role for AWS access |
| `ECR_BACKEND_REPOSITORY` | ECR URI prefix for backend/worker/beat image |
| `ECR_FRONTEND_REPOSITORY` | ECR URI prefix for frontend image |
| `DB_PASSWORD_STAGING` | RDS password (Terraform var) |
| `DB_PASSWORD_PRODUCTION` | RDS password (Terraform var) |

Migrations run via the **`daxch-{env}-migrate`** ECS task (private VPC), not from the GitHub runner. `DATABASE_URL_STAGING` / `DATABASE_URL_PRODUCTION` are no longer required in deploy workflows.

## Security Notes

- Never place real secrets in markdown files, source code, or git history.
- Keep `.env` and `.env.local` local only.
- Rotate credentials on any exposure.
- Broker access/refresh tokens are Fernet-encrypted in `broker_connections` table.
