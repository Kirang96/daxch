# Push app_secrets from infrastructure/terraform.tfvars into AWS Secrets Manager
# and restart ECS tasks so the backend picks up Razorpay (and other) credentials.
#
# Usage:
#   aws login
#   .\scripts\restore-staging-secrets.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

if (-not (Test-Path (Join-Path $Root "infrastructure\terraform.tfvars"))) {
    Write-Error "Missing infrastructure/terraform.tfvars."
}

. (Join-Path $PSScriptRoot "aws-auth.ps1")
Import-AwsLoginCredentials

python (Join-Path $PSScriptRoot "restore_staging_secrets.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
