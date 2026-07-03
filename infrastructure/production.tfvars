# Non-secret production infrastructure config (used by CI deploy).
# Secrets, db_password, and images: infrastructure/terraform.production.tfvars (gitignored).

environment = "production"
vpc_cidr    = "10.40.0.0/16"

domain_name = "daxch.app"
# Request in us-east-1 (CloudFront). See docs/deploy-production.md § ACM certificate.
cloudfront_acm_certificate_arn = "arn:aws:acm:us-east-1:264711513534:certificate/5ed8ace6-e106-44de-9291-174a45b19c39"

backend_env_vars = {
  ENVIRONMENT            = "production"
  DEBUG                  = "false"
  ENABLE_DEMO_MODE       = "false"
  API_PREFIX             = "/api/v1"
  FRONTEND_BASE_URL      = "https://daxch.app"
  CORS_ORIGINS           = "https://daxch.app"
  AWS_REGION             = "ap-south-1"
  UPSTOX_REDIRECT_URI    = "https://daxch.app/broker/callback"
  FIVEPAISA_REDIRECT_URI = "https://daxch.app/broker/callback"
  FIVEPAISA_LOGIN_URL    = "https://openapi.5paisa.com/WebVendorLogin/VLogin/Index"
  ADMIN_EMAILS           = "hello.daxch@gmail.com"
}

desired_count_frontend = 2
desired_count_backend  = 2
desired_count_worker   = 1
desired_count_beat     = 1
