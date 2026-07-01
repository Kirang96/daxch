"""Generate infrastructure/terraform.tfvars from backend/.env (gitignored output)."""

from __future__ import annotations

import secrets
from pathlib import Path

from cryptography.fernet import Fernet

ROOT = Path(__file__).resolve().parents[1]


def parse_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def main() -> None:
    env = parse_env(ROOT / "backend" / ".env")
    secret_key = secrets.token_urlsafe(48)
    fernet_key = Fernet.generate_key().decode()
    db_password = secrets.token_urlsafe(32)

    def pick(key: str, default: str = "") -> str:
        return env.get(key, default)

    fcm = pick("FCM_CREDENTIALS_JSON") or '{"type":"service_account"}'
    ses = pick("SES_FROM_EMAIL") or "no-reply@example.com"
    fcm_escaped = fcm.replace("\\", "\\\\").replace('"', '\\"')

    tfvars = f"""aws_region   = "ap-south-1"
environment  = "staging"
project_name = "daxch"
domain_name  = ""

# Set after first terraform apply (terraform output alb_dns_name), then re-apply:
# domain_name = "staging.yourdomain.com"
# alb_acm_certificate_arn = "arn:aws:acm:ap-south-1:ACCOUNT:certificate/..."
# route53_zone_id = "Z..."

backend_image  = "REPLACE_AFTER_ECR.dkr.ecr.ap-south-1.amazonaws.com/daxch-backend:latest"
frontend_image = "REPLACE_AFTER_ECR.dkr.ecr.ap-south-1.amazonaws.com/daxch-frontend:latest"
worker_image   = "REPLACE_AFTER_ECR.dkr.ecr.ap-south-1.amazonaws.com/daxch-backend:latest"
beat_image     = "REPLACE_AFTER_ECR.dkr.ecr.ap-south-1.amazonaws.com/daxch-backend:latest"

desired_count_frontend = 1
desired_count_backend  = 1
desired_count_worker   = 1
desired_count_beat     = 1

db_username = "daxch"
db_password = "{db_password}"
db_name     = "daxch"

backend_env_vars = {{
  ENVIRONMENT         = "staging"
  DEBUG               = "false"
  ENABLE_DEMO_MODE    = "false"
  API_PREFIX          = "/api/v1"
  FRONTEND_BASE_URL   = "http://REPLACE_AFTER_ALB_APPLY"
  CORS_ORIGINS        = "http://REPLACE_AFTER_ALB_APPLY"
  AWS_REGION          = "ap-south-1"
  UPSTOX_REDIRECT_URI = "http://REPLACE_AFTER_ALB_APPLY/broker/callback"
  GOOGLE_REDIRECT_URI = "http://REPLACE_AFTER_ALB_APPLY/auth/google/callback"
}}

app_secrets = {{
  SECRET_KEY               = "{secret_key}"
  FERNET_KEY               = "{fernet_key}"
  OPENAI_API_KEY           = "{pick("OPENAI_API_KEY")}"
  UPSTOX_CLIENT_ID         = "{pick("UPSTOX_CLIENT_ID")}"
  UPSTOX_CLIENT_SECRET     = "{pick("UPSTOX_CLIENT_SECRET")}"
  RAZORPAY_KEY_ID          = "{pick("RAZORPAY_KEY_ID")}"
  RAZORPAY_KEY_SECRET      = "{pick("RAZORPAY_KEY_SECRET")}"
  RAZORPAY_WEBHOOK_SECRET  = "{pick("RAZORPAY_WEBHOOK_SECRET")}"
  RAZORPAY_PLAN_STARTER_ID = "{pick("RAZORPAY_PLAN_STARTER_ID")}"
  RAZORPAY_PLAN_PRO_ID     = "{pick("RAZORPAY_PLAN_PRO_ID")}"
  RAZORPAY_PLAN_ULTRA_ID   = "{pick("RAZORPAY_PLAN_ULTRA_ID")}"
  TAVILY_API_KEY           = "{pick("TAVILY_API_KEY")}"
  NEWS_API_KEY             = "{pick("NEWS_API_KEY")}"
  SES_FROM_EMAIL           = "{ses}"
  FCM_CREDENTIALS_JSON     = "{fcm_escaped}"
  GOOGLE_CLIENT_ID         = "{pick("GOOGLE_CLIENT_ID")}"
  GOOGLE_CLIENT_SECRET     = "{pick("GOOGLE_CLIENT_SECRET")}"
}}
"""

    tfvars_path = ROOT / "infrastructure" / "terraform.tfvars"
    secrets_path = ROOT / "infrastructure" / "staging-secrets.local"
    tfvars_path.write_text(tfvars, encoding="utf-8")
    secrets_path.write_text(
        f"""# Staging deploy secrets (DO NOT COMMIT)
# Copy DB_PASSWORD_STAGING to GitHub staging environment secrets.

DB_PASSWORD_STAGING={db_password}

# After scripts/aws-bootstrap-staging.ps1, set GitHub secrets:
# AWS_DEPLOY_ROLE_ARN=<from script output>
# ECR_BACKEND_REPOSITORY=<account>.dkr.ecr.ap-south-1.amazonaws.com/daxch-backend
# ECR_FRONTEND_REPOSITORY=<account>.dkr.ecr.ap-south-1.amazonaws.com/daxch-frontend

# After first terraform apply, update terraform.tfvars:
# - FRONTEND_BASE_URL / CORS_ORIGINS / UPSTOX_REDIRECT_URI with ALB DNS (terraform output)
# - backend_image / frontend_image with ECR URIs
# - SES_FROM_EMAIL once domain verified in SES
# - RAZORPAY_WEBHOOK_SECRET once webhook configured in Razorpay dashboard
""",
        encoding="utf-8",
    )
    print(f"Wrote {tfvars_path.relative_to(ROOT)}")
    print(f"Wrote {secrets_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
