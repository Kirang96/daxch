# Complete production deploy: Terraform apply, optional secrets restore, ECS roll.
#
# Prerequisites:
#   aws login
#   infrastructure/terraform.production.tfvars (from terraform.production.tfvars.example)
#   infrastructure/production.tfvars cloudfront_acm_certificate_arn set after ACM validation
#
# Usage:
#   aws login
#   .\scripts\complete-production-deploy.ps1
#   .\scripts\complete-production-deploy.ps1 -RestoreSecrets

param(
    [string]$LockId = "",
    [switch]$SkipUnlock,
    [switch]$RestoreSecrets,
    [switch]$SkipEcsDeploy
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$InfraDir = Join-Path $Root "infrastructure"
$TfvarsPath = Join-Path $InfraDir "terraform.production.tfvars"
$EnvTfvarsPath = Join-Path $InfraDir "production.tfvars"
$StateKey = "production/terraform.tfstate"
$DefaultBucket = "daxch-terraform-state-264711513534"
. (Join-Path $PSScriptRoot "aws-auth.ps1")

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

function Get-TerraformVarFileArgs {
    $files = @()
    if (Test-Path $EnvTfvarsPath) { $files += "-var-file=production.tfvars" }
    if (Test-Path $TfvarsPath) { $files += "-var-file=terraform.production.tfvars" }
    return $files
}

function Invoke-Terraform {
    param([string[]]$TerraformArgs)
    Import-AwsLoginCredentials | Out-Null
    $terraform = Get-TerraformExe
    Push-Location $InfraDir
    try {
        $cmd = $TerraformArgs | Select-Object -First 1
        $extra = if ($cmd -in @("apply", "plan", "destroy")) { Get-TerraformVarFileArgs } else { @() }
        & $terraform @($extra + $TerraformArgs)
        if ($LASTEXITCODE -ne 0) {
            Write-Error "terraform $($TerraformArgs -join ' ') failed (exit $LASTEXITCODE)"
        }
    } finally {
        Pop-Location
    }
}

function Ensure-TerraformBackend {
    $backendTf = Join-Path $InfraDir "backend.tf"
    $content = ""
    if (Test-Path $backendTf) {
        $content = Get-Content $backendTf -Raw
    }
    $bucket = if ($content -match 'bucket\s*=\s*"([^"]+)"') { $Matches[1] } else { $DefaultBucket }
    $region = if ($content -match 'region\s*=\s*"([^"]+)"') { $Matches[1] } else { "ap-south-1" }
    @"
terraform {
  backend "s3" {
    bucket       = "$bucket"
    key          = "$StateKey"
    region       = "$region"
    use_lockfile = true
    encrypt      = true
  }
}
"@ | Set-Content -Path $backendTf -Encoding utf8 -NoNewline
    Write-Host "Terraform backend: s3://$bucket/$StateKey" -ForegroundColor Yellow
    Invoke-Terraform @("init", "-reconfigure")
}

function Get-ProductionDomain {
    if (-not (Test-Path $EnvTfvarsPath)) { return "" }
    $content = Get-Content $EnvTfvarsPath -Raw
    if ($content -match 'domain_name\s*=\s*"([^"]+)"') {
        return $Matches[1].Trim()
    }
    return ""
}

function Update-ProductionTfvarsUrls {
    param([string]$Domain)
    if (-not (Test-Path $TfvarsPath)) { return }
    $base = "https://$Domain"
    $content = Get-Content $TfvarsPath -Raw
    $content = $content -replace 'GOOGLE_REDIRECT_URI\s*=\s*"[^"]*"', "GOOGLE_REDIRECT_URI      = `"$base/auth/google/callback`""
    Set-Content -Path $TfvarsPath -Value $content -Encoding utf8 -NoNewline
    Write-Host "Updated terraform.production.tfvars GOOGLE_REDIRECT_URI for $Domain" -ForegroundColor Green
}

function Invoke-EcsRollingDeploy {
    param([string]$NamePrefix, [string]$Region)
    Import-AwsLoginCredentials | Out-Null
    $cluster = "${NamePrefix}-cluster"
    $services = @(
        "${NamePrefix}-backend",
        "${NamePrefix}-frontend",
        "${NamePrefix}-worker",
        "${NamePrefix}-beat"
    )
    foreach ($service in $services) {
        Write-Host "Forcing ECS rolling deployment: $service" -ForegroundColor Yellow
        aws ecs update-service `
            --cluster $cluster `
            --service $service `
            --force-new-deployment `
            --region $Region `
            --no-cli-pager | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "ecs update-service failed for $service (exit $LASTEXITCODE)"
        }
    }
}

if (-not (Test-Path $TfvarsPath)) {
    Write-Error "Missing $TfvarsPath. Copy infrastructure/terraform.production.tfvars.example"
}

Write-Host "=== Daxch production deploy ===" -ForegroundColor Cyan
Import-AwsLoginCredentials
Ensure-TerraformBackend

if (-not $SkipUnlock -and $LockId) {
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

$customDomain = Get-ProductionDomain
if ($customDomain) {
    Write-Host "Production domain: $customDomain" -ForegroundColor Green
    Update-ProductionTfvarsUrls -Domain $customDomain
}

Write-Host "Terraform apply (production stack)..." -ForegroundColor Yellow
if ($RestoreSecrets) {
    Write-Host "Restoring app secrets from terraform.production.tfvars..." -ForegroundColor Yellow
    Invoke-Terraform @("apply", "-auto-approve", '-replace=aws_secretsmanager_secret_version.app')
} else {
    Invoke-Terraform @("apply", "-auto-approve")
}

Write-Host "Terraform outputs:" -ForegroundColor Yellow
Invoke-Terraform @("output")

if (-not $SkipEcsDeploy) {
    $region = "ap-south-1"
    $namePrefix = "daxch-production"
    if (Test-Path $TfvarsPath) {
        $tfvarsContent = Get-Content $TfvarsPath -Raw
        $project = "daxch"
        $environment = "production"
        if ($tfvarsContent -match 'project_name\s*=\s*"([^"]+)"') { $project = $Matches[1] }
        if ($tfvarsContent -match 'environment\s*=\s*"([^"]+)"') { $environment = $Matches[1] }
        if ($tfvarsContent -match 'aws_region\s*=\s*"([^"]+)"') { $region = $Matches[1] }
        $namePrefix = "$project-$environment"
    }
    Invoke-EcsRollingDeploy -NamePrefix $namePrefix -Region $region
}

Write-Host ""
Write-Host "=== Production infrastructure ready ===" -ForegroundColor Green
if ($customDomain) {
    Write-Host "After DNS cutover:"
    Write-Host "  App:    https://$customDomain"
    Write-Host "  Health: https://$customDomain/health"
} else {
    Write-Host "Set domain_name in production.tfvars and re-apply before DNS cutover."
}
Write-Host "CloudFront URL: run terraform output cloudfront_domain_name (pre-DNS smoke test)"
