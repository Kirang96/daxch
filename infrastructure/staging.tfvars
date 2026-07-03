# Non-secret staging infrastructure config (used by CI deploy).
# Secrets and db_password are passed separately at apply time.

domain_name                    = "staging.daxch.app"
cloudfront_acm_certificate_arn = "arn:aws:acm:us-east-1:264711513534:certificate/3641dae1-b4ae-489f-ab3d-d80a8e8b8e5b"

backend_env_vars = {
  ENVIRONMENT         = "staging"
  DEBUG               = "false"
  ENABLE_DEMO_MODE    = "false"
  API_PREFIX          = "/api/v1"
  FRONTEND_BASE_URL   = "https://staging.daxch.app"
  CORS_ORIGINS        = "https://staging.daxch.app"
  AWS_REGION          = "ap-south-1"
  UPSTOX_REDIRECT_URI = "https://staging.daxch.app/broker/callback"
  FIVEPAISA_REDIRECT_URI = "https://staging.daxch.app/broker/callback"
  ADMIN_EMAILS        = "hello.daxch@gmail.com"
}
