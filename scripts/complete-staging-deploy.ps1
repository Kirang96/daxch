# Complete remaining staging deploy steps after partial terraform apply.
# Prerequisites: aws login (interactive), Docker optional (CI can build images).
#
# Usage:
#   aws login
#   .\scripts\complete-staging-deploy.ps1
#
# Optional:
#   .\scripts\complete-staging-deploy.ps1 -SkipUnlock
#   .\scripts\complete-staging-deploy.ps1 -SkipAlbUrlUpdate

param(
    [string]$LockId = "54dbcbea-abf2-3d6a-9e3e-fd0f6c4378ae",
    [switch]$SkipUnlock,
    [switch]$SkipAlbUrlUpdate
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$InfraDir = Join-Path $Root "infrastructure"
$TfvarsPath = Join-Path $InfraDir "terraform.tfvars"

function Get-TerraformExe {
    $candidates = @(
        (Get-Command terraform -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe\terraform.exe"
    )
    $exe = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if (-not $exe) {
        Write-Error "terraform not found. Install: winget install Hashicorp.Terraform"
    }
    return $exe
}

function Import-AwsLoginCredentials {
    $credLines = @(aws configure export-credentials --format env 2>$null)
    if ($LASTEXITCODE -ne 0) {
        Write-Error @"
AWS not authenticated or session expired.
Run in this terminal first:
  aws login
Then re-run:
  .\scripts\complete-staging-deploy.ps1
"@
    }
    foreach ($line in $credLines) {
        $line = $line.Trim()
        if ($line -match '^export\s+([^=]+)=(.*)$') {
            Set-Item -Path "env:$($matches[1])" -Value $matches[2].Trim('"')
        }
    }
    $id = aws sts get-caller-identity --query Account --output text
    Write-Host "AWS account: $id" -ForegroundColor Green
}

function Invoke-Terraform {
    param([string[]]$Args)
    Import-AwsLoginCredentials | Out-Null
    $terraform = Get-TerraformExe
    Push-Location $InfraDir
    try {
        & $terraform @Args
        if ($LASTEXITCODE -ne 0) {
            Write-Error "terraform $($Args -join ' ') failed (exit $LASTEXITCODE)"
        }
    } finally {
        Pop-Location
    }
}

function Update-TfvarsWithAlbUrl {
    param([string]$AlbDns)
    if (-not (Test-Path $TfvarsPath)) {
        Write-Error "Missing terraform.tfvars. Run: python scripts/generate-staging-tfvars.py"
    }
    $base = "http://$AlbDns"
    $content = Get-Content $TfvarsPath -Raw
    $content = $content -replace 'FRONTEND_BASE_URL\s*=\s*"[^"]*"', "FRONTEND_BASE_URL   = `"$base`""
    $content = $content -replace 'CORS_ORIGINS\s*=\s*"[^"]*"', "CORS_ORIGINS        = `"$base`""
    $content = $content -replace 'UPSTOX_REDIRECT_URI\s*=\s*"[^"]*"', "UPSTOX_REDIRECT_URI = `"$base/broker/callback`""
    Set-Content -Path $TfvarsPath -Value $content -Encoding utf8 -NoNewline
    Write-Host "Updated terraform.tfvars with ALB URL: $base" -ForegroundColor Green
}

Write-Host "=== Daxch staging deploy (resume) ===" -ForegroundColor Cyan
Import-AwsLoginCredentials

if (-not $SkipUnlock) {
    Write-Host "Releasing stale state lock (if any)..." -ForegroundColor Yellow
    $terraform = Get-TerraformExe
    Push-Location $InfraDir
    Import-AwsLoginCredentials | Out-Null
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $terraform force-unlock -force $LockId 2>&1 | Out-Null
    $ErrorActionPreference = $prev
    Pop-Location
}

$erroredState = Join-Path $InfraDir "errored.tfstate"
if (Test-Path $erroredState) {
    Write-Host "Found errored.tfstate from prior failed apply - pushing to remote state..." -ForegroundColor Yellow
    Invoke-Terraform @("state", "push", "errored.tfstate")
    Remove-Item $erroredState -Force
}

Write-Host "Terraform apply (finish RDS + secrets)..." -ForegroundColor Yellow
Invoke-Terraform @("apply", "-auto-approve")

Write-Host "Terraform outputs:" -ForegroundColor Yellow
Invoke-Terraform @("output")

if (-not $SkipAlbUrlUpdate) {
    $terraform = Get-TerraformExe
    Push-Location $InfraDir
    $albDns = (& $terraform output -raw alb_dns_name 2>$null).Trim()
    Pop-Location
    if ($albDns -and $albDns -notmatch "REPLACE") {
        Update-TfvarsWithAlbUrl -AlbDns $albDns
        Write-Host "Re-applying with ALB URLs in backend_env_vars..." -ForegroundColor Yellow
        Invoke-Terraform @("apply", "-auto-approve")
    }
}

Write-Host ""
Write-Host "=== Infrastructure ready ===" -ForegroundColor Green
Write-Host "Next: push to develop (or run Deploy Staging workflow) to build ECR images and roll ECS."
Write-Host 'Then open: http://ALB-DNS/health (see terraform output alb_dns_name)'
Write-Host "Configure Razorpay/Upstox callbacks when you have a custom domain."
Write-Host "Set SES_FROM_EMAIL in terraform.tfvars after SES verification."
