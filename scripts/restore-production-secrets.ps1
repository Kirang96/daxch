# Push app_secrets from infrastructure/terraform.production.tfvars into AWS Secrets Manager
# and restart ECS tasks.
#
# Usage:
#   aws login
#   .\scripts\restore-production-secrets.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$TfvarsPath = Join-Path $Root "infrastructure\terraform.production.tfvars"

if (-not (Test-Path $TfvarsPath)) {
    Write-Error "Missing infrastructure/terraform.production.tfvars. Copy from terraform.production.tfvars.example"
}

. (Join-Path $PSScriptRoot "aws-auth.ps1")
Import-AwsLoginCredentials

python (Join-Path $PSScriptRoot "restore_production_secrets.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
