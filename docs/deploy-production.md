# Production Deployment Guide

Deploy target: **AWS ECS Fargate** in `ap-south-1` at **https://daxch.app**, triggered by **GitHub Release** on `main` or manual workflow dispatch.

Staging reference: [deploy-staging.md](deploy-staging.md).

## Overview

| Item | Production |
|------|------------|
| Domain | `daxch.app` (apex); `www` → apex via Cloudflare redirect |
| DNS | Cloudflare (grey-cloud CNAME, same as staging) |
| Terraform state | `s3://daxch-terraform-state-264711513534/production/terraform.tfstate` |
| Secrets file | `infrastructure/terraform.production.tfvars` (gitignored) |
| Non-secret config | `infrastructure/production.tfvars` (committed) |
| ECS prefix | `daxch-production-*` |
| Razorpay | **Live** keys and plans |

## Prerequisites (one-time)

### 1. GitHub `production` environment secrets

| Secret | Description |
|--------|-------------|
| `AWS_DEPLOY_ROLE_ARN` | Same OIDC deploy role as staging |
| `ECR_BACKEND_REPOSITORY` | `264711513534.dkr.ecr.ap-south-1.amazonaws.com/daxch-backend` |
| `ECR_FRONTEND_REPOSITORY` | `264711513534.dkr.ecr.ap-south-1.amazonaws.com/daxch-frontend` |
| `DB_PASSWORD_PRODUCTION` | Strong password (not staging) |
| `TF_STATE_BUCKET` | `daxch-terraform-state-264711513534` |

### 2. ACM certificate (us-east-1)

CloudFront requires a certificate in **us-east-1**.

```powershell
aws login
.\scripts\request-production-acm-cert.ps1
```

1. Add the printed CNAME validation records in **Cloudflare** (DNS only, grey cloud).
2. Wait until certificate status is **ISSUED**:
   ```powershell
   aws acm describe-certificate --certificate-arn <ARN> --region us-east-1 --query Certificate.Status
   ```
3. Set `cloudfront_acm_certificate_arn` in [production.tfvars](../infrastructure/production.tfvars).

### 3. Live Razorpay

See [razorpay-production-setup.md](razorpay-production-setup.md).

### 4. Other providers

| Provider | Production callback / setting |
|----------|----------------------------|
| Upstox | `https://daxch.app/broker/callback` |
| Google OAuth | `https://daxch.app/auth/google/callback` |
| Razorpay webhook | `https://daxch.app/api/v1/subscriptions/webhook` |
| SES | Verify `daxch.app` or `no-reply@daxch.app` in ap-south-1 |
| FCM | Production Firebase service account JSON |

### 5. Production secrets file

```powershell
copy infrastructure\terraform.production.tfvars.example infrastructure\terraform.production.tfvars
```

Generate fresh keys (never reuse staging):

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Fill all `app_secrets` with **live** Razorpay keys (`rzp_live_*`), plan IDs, and provider credentials.

## First production stack (local)

```powershell
aws login
.\scripts\complete-production-deploy.ps1 -RestoreSecrets
```

This creates `daxch-production-*` (VPC `10.40.0.0/16`, RDS with deletion protection, ECS, CloudFront).

**Pre-DNS smoke test:** use `terraform output cloudfront_domain_name` — do not point `daxch.app` DNS until health checks pass.

## Cloudflare DNS cutover

After CloudFront is healthy with the ACM cert:

| Record | Type | Value |
|--------|------|-------|
| `@` (daxch.app) | CNAME | `terraform output -raw cloudfront_domain_name` |
| `www` | Redirect rule | `https://daxch.app/$1` (301) |

Use **DNS only** (grey cloud), matching staging.

**Pre-cutover checklist:**

- `curl https://daxch.app/health` → 200
- SSL certificate shows `daxch.app`
- `www.daxch.app` redirects to apex

## Ongoing deploys

1. Merge tested changes `develop` → `main`
2. Create a **GitHub Release** (tag e.g. `v1.0.0`) → runs [deploy-production.yml](../.github/workflows/deploy-production.yml)
3. Or: Actions → Deploy Production → Run workflow

CI builds images, applies Terraform with `production.tfvars`, runs migrations, rolls ECS.

## Updating secrets after first apply

CI does **not** overwrite Secrets Manager. After editing `terraform.production.tfvars`:

```powershell
aws login
.\scripts\restore-production-secrets.ps1
```

## Windows Terraform

```powershell
aws login
.\scripts\complete-production-deploy.ps1
```

If state lock is stuck:

```powershell
cd infrastructure
terraform force-unlock <lock-id>
```

## Smoke tests

See [go-live-checklist.md](go-live-checklist.md).

| Flow | Check |
|------|-------|
| Health | `GET /health` |
| Google sign-in | `/login` |
| Upstox | `/broker/callback` |
| Subscribe (live) | Razorpay checkout → active subscription |
| Webhook | Razorpay dashboard delivery success |
| Agent + AI | Create agent, run analysis |
| Magic link | SES email delivery |
| AI top-up | Live `payment.captured` webhook |

## Rollback

1. Re-run Deploy Production workflow on previous release tag, or
2. `aws ecs update-service --cluster daxch-production-cluster --service daxch-production-backend --force-new-deployment` with previous task definition revision

## Staging vs production

| | Staging | Production |
|---|---------|------------|
| Branch | `develop` (auto) | `main` + Release |
| Domain | `staging.daxch.app` | `daxch.app` |
| Razorpay | Test | Live |
| Secrets restore | `restore-staging-secrets.ps1` | `restore-production-secrets.ps1` |

Keep staging webhooks on test URLs only.
