# Staging Deployment Guide

Deploy target: **AWS ECS Fargate** in `ap-south-1`, triggered by push to `develop` on [Kirang96/daxch](https://github.com/Kirang96/daxch.git).

## Repository bootstrap (first time)

If the repo is not on GitHub yet:

```powershell
cd d:\projects\daxch
git config user.name "Kiran George"
git config user.email "kiran.geo96@gmail.com"
git init
git add .
git status   # confirm backend/.env and infrastructure/terraform.tfvars are NOT listed
git commit -m "Initial commit: Daxch app with AI units metering and AWS deploy infra"
git branch -M main
git remote add origin https://github.com/Kirang96/daxch.git
git push -u origin main
git checkout -b develop
git push -u origin develop
```

| Branch | Purpose |
|--------|---------|
| `main` | Stable; production via GitHub Release |
| `develop` | Staging deploy on every push |

Rotate any API keys that lived in local files before pushing if the repo is public.

## CI/CD overview

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `.github/workflows/ci.yml` | PR + push to `main`/`develop` | Tests and Terraform validate |
| `.github/workflows/deploy-staging.yml` | Push to `develop` | Build images, Terraform apply, ECS migrate, roll services |

## Prerequisites (one-time)

### 1. GitHub

- Push `main` and `develop` branches
- Enable Actions: Settings → Actions → General
- Create environment **`staging`**
- Add secrets (staging environment):

| Secret | Description |
|--------|-------------|
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN for GitHub OIDC |
| `ECR_BACKEND_REPOSITORY` | e.g. `123456789012.dkr.ecr.ap-south-1.amazonaws.com/daxch-backend` |
| `ECR_FRONTEND_REPOSITORY` | e.g. `123456789012.dkr.ecr.ap-south-1.amazonaws.com/daxch-frontend` |
| `DB_PASSWORD_STAGING` | RDS password (must match `db_password` in tfvars on first apply) |

`DATABASE_URL_STAGING` is **not** required; migrations run via an ECS task inside the VPC.

### 2. AWS

- **ECR:** create `daxch-backend` and `daxch-frontend` in `ap-south-1`
- **OIDC:** IAM role trusted by `repo:Kirang96/daxch:*` with ECR, ECS, Terraform, Secrets Manager permissions
- **(Recommended)** S3 + DynamoDB for Terraform state — copy [`infrastructure/backend.tf.example`](../infrastructure/backend.tf.example) to `backend.tf`

### 3. Terraform variables (never commit)

```bash
cp infrastructure/terraform.tfvars.example infrastructure/terraform.tfvars
# Or regenerate from local backend/.env:
python scripts/generate-staging-tfvars.py
```

Values copied from `.env` land in `infrastructure/terraform.tfvars`; generated `DB_PASSWORD_STAGING` is in `infrastructure/staging-secrets.local` (both gitignored).

**First bootstrap:** run `terraform apply` locally once with full `terraform.tfvars` (including `app_secrets` and `backend_env_vars`). CI only passes `db_password` and image URIs; secrets must already exist in Secrets Manager from the first apply.

### 3b. AWS one-time bootstrap (script)

After `aws login` (or SSO):

```powershell
.\scripts\aws-bootstrap-staging.ps1
```

Creates ECR repos, Terraform state bucket + lock table, GitHub OIDC deploy role, and prints GitHub secret values.

### 4. External providers

| Provider | Staging URL |
|----------|-------------|
| Razorpay webhook | `https://YOUR_DOMAIN/api/v1/subscriptions/webhook` |
| Upstox OAuth | `https://YOUR_DOMAIN/broker/callback` |
| Google OAuth (optional) | `https://YOUR_DOMAIN/auth/google/callback` |

Enable Razorpay events: subscription lifecycle + `payment.captured` (AI unit top-ups).

### 5. SES

Verify sender identity; set `SES_FROM_EMAIL` in `app_secrets`.

## Deploy flow

1. Merge to **`develop`**
2. GitHub Actions **Deploy Staging** runs:
   - Build & push Docker images to ECR
   - `terraform apply` (updates infra + task definitions)
   - **ECS migrate task** (`daxch-staging-migrate`) runs `alembic upgrade head` inside the VPC
   - Force new deployment on frontend, backend, worker, beat
3. Verify in AWS Console: all 4 ECS services healthy

## Smoke test

See [`runbook.md`](runbook.md):

1. `GET /health` → `{"status":"ok"}`
2. Magic-link signup (SES)
3. Upstox connect → quote → create agent
4. Razorpay test checkout → webhook → active plan
5. AI Units usage on dashboard / subscription
6. CloudWatch: worker + beat dispatch logs every ~60s

## Troubleshooting

| Issue | Check |
|-------|--------|
| Backend tasks crash-loop | CloudWatch `/ecs/daxch-staging-backend` — often missing secrets (Ultra plan ID, `SECRET_KEY`, etc.) |
| Migration task exit 1 | CloudWatch `/ecs/daxch-staging-migrate` |
| Terraform state conflicts | Use S3 remote state (`backend.tf.example`) |
| CORS errors | `CORS_ORIGINS` and `FRONTEND_BASE_URL` in `backend_env_vars` |

## AWS permission checklist

Your deploy role needs at minimum:

- `ecr:*` (push/pull)
- `ecs:RunTask`, `ecs:DescribeTasks`, `ecs:UpdateService`, `ecs:DescribeServices`
- Terraform-managed resources: VPC, RDS, ElastiCache, ALB, CloudFront, IAM, Secrets Manager, CloudWatch Logs

Verify: `aws sts get-caller-identity` and `aws ecr describe-repositories --region ap-south-1`
