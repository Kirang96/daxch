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
#   .\scripts\complete-staging-deploy.ps1 -RestoreSecrets
#
# When domain_name is set in terraform.tfvars, ALB URL rewrites are skipped automatically.

param(
    [string]$LockId = "54dbcbea-abf2-3d6a-9e3e-fd0f6c4378ae",
    [switch]$SkipUnlock,
    [switch]$SkipAlbUrlUpdate,
    [switch]$RestoreSecrets,
    [switch]$SkipEcsDeploy
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$InfraDir = Join-Path $Root "infrastructure"
$TfvarsPath = Join-Path $InfraDir "terraform.tfvars"
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
    $stagingTfvars = Join-Path $InfraDir "staging.tfvars"
    if (Test-Path $stagingTfvars) {
        return @("-var-file=staging.tfvars")
    }
    return @()
}

function Invoke-Terraform {
    param([string[]]$TerraformArgs)
    Import-AwsLoginCredentials | Out-Null
    $terraform = Get-TerraformExe
    Push-Location $InfraDir
    try {
        $cmd = $TerraformArgs | Select-Object -First 1
        $extra = if ($cmd -in @("apply", "plan", "destroy")) { Get-TerraformVarFileArgs } else { @() }
        # -var-file must follow apply/plan/destroy (Terraform 1.x flag ordering)
        & $terraform @($TerraformArgs + $extra)
        if ($LASTEXITCODE -ne 0) {
            Write-Error "terraform $($TerraformArgs -join ' ') failed (exit $LASTEXITCODE)"
        }
    } finally {
        Pop-Location
    }
}

function Ensure-TerraformBackend {
    $backendTf = Join-Path $InfraDir "backend.tf"
    $backendExample = Join-Path $InfraDir "backend.tf.example"
    if (-not (Test-Path $backendTf)) {
        if (-not (Test-Path $backendExample)) {
            Write-Error "Missing infrastructure/backend.tf and backend.tf.example"
        }
        Copy-Item $backendExample $backendTf
        Write-Host "Created backend.tf from example" -ForegroundColor Yellow
    } else {
        $content = Get-Content $backendTf -Raw
        if ($content -match 'dynamodb_table') {
            Write-Host "Updating backend.tf to use S3 lockfile (matches CI)..." -ForegroundColor Yellow
            $bucket = if ($content -match 'bucket\s*=\s*"([^"]+)"') { $Matches[1] } else { "daxch-terraform-state-264711513534" }
            $key = if ($content -match 'key\s*=\s*"([^"]+)"') { $Matches[1] } else { "staging/terraform.tfstate" }
            $region = if ($content -match 'region\s*=\s*"([^"]+)"') { $Matches[1] } else { "ap-south-1" }
            @"
# Copy to backend.tf and fill in your bucket/table names before first shared apply.
# Create the S3 bucket and DynamoDB table once per AWS account (or per environment).

terraform {
  backend "s3" {
    bucket       = "$bucket"
    key          = "$key"
    region       = "$region"
    use_lockfile = true
    encrypt      = true
  }
}

# Production: use a separate key, e.g. key = "production/terraform.tfstate"
"@ | Set-Content -Path $backendTf -Encoding utf8 -NoNewline
        }
    }

    Write-Host "Reinitializing Terraform backend..." -ForegroundColor Yellow
    Invoke-Terraform @("init", "-reconfigure")
}

function Get-TfvarsDomainName {
    if (-not (Test-Path $TfvarsPath)) {
        return ""
    }
    $content = Get-Content $TfvarsPath -Raw
    if ($content -match 'domain_name\s*=\s*"([^"]+)"') {
        return $Matches[1].Trim()
    }
    return ""
}

function Update-TfvarsWithCustomDomain {
    param([string]$Domain)
    if (-not (Test-Path $TfvarsPath)) {
        Write-Error "Missing terraform.tfvars. Run: python scripts/generate-staging-tfvars.py"
    }
    $base = "https://$Domain"
    $content = Get-Content $TfvarsPath -Raw
    $content = $content -replace 'FRONTEND_BASE_URL\s*=\s*"[^"]*"', "FRONTEND_BASE_URL   = `"$base`""
    $content = $content -replace 'CORS_ORIGINS\s*=\s*"[^"]*"', "CORS_ORIGINS        = `"$base`""
    $content = $content -replace 'UPSTOX_REDIRECT_URI\s*=\s*"[^"]*"', "UPSTOX_REDIRECT_URI = `"$base/broker/callback`""
    $content = $content -replace 'GOOGLE_REDIRECT_URI\s*=\s*"[^"]*"', "GOOGLE_REDIRECT_URI      = `"$base/auth/google/callback`""
    Set-Content -Path $TfvarsPath -Value $content -Encoding utf8 -NoNewline
    Write-Host "Updated terraform.tfvars with custom domain: $base" -ForegroundColor Green
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
    $content = $content -replace 'GOOGLE_REDIRECT_URI\s*=\s*"[^"]*"', "GOOGLE_REDIRECT_URI = `"$base/auth/google/callback`""
    Set-Content -Path $TfvarsPath -Value $content -Encoding utf8 -NoNewline
    Write-Host "Updated terraform.tfvars with ALB URL: $base" -ForegroundColor Green
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

Write-Host "=== Daxch staging deploy (resume) ===" -ForegroundColor Cyan
Import-AwsLoginCredentials
Ensure-TerraformBackend

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

$customDomain = Get-TfvarsDomainName
if ($customDomain) {
    Write-Host "Custom domain configured: $customDomain" -ForegroundColor Green
    Update-TfvarsWithCustomDomain -Domain $customDomain
}

Write-Host "Terraform apply (finish RDS + secrets)..." -ForegroundColor Yellow
if ($RestoreSecrets) {
    Write-Host "Restoring app secrets from terraform.tfvars (one-time after CI wipe)..." -ForegroundColor Yellow
    Invoke-Terraform @("apply", "-auto-approve", '-replace=aws_secretsmanager_secret_version.app')
} else {
    Invoke-Terraform @("apply", "-auto-approve")
}

Write-Host "Terraform outputs:" -ForegroundColor Yellow
Invoke-Terraform @("output")

$shouldUpdateAlbUrls = (-not $SkipAlbUrlUpdate) -and (-not $customDomain)
if ($shouldUpdateAlbUrls) {
    $terraform = Get-TerraformExe
    Push-Location $InfraDir
    $albDns = (& $terraform output -raw alb_dns_name 2>$null).Trim()
    Pop-Location
    if ($albDns -and $albDns -notmatch "REPLACE") {
        Update-TfvarsWithAlbUrl -AlbDns $albDns
        Write-Host "Re-applying with ALB URLs in backend_env_vars..." -ForegroundColor Yellow
        Invoke-Terraform @("apply", "-auto-approve")
    }
} elseif ($customDomain) {
    Write-Host "Skipping ALB URL rewrite (domain_name is set)." -ForegroundColor Yellow
}

if (-not $SkipEcsDeploy) {
    $region = "ap-south-1"
    $namePrefix = "daxch-staging"
    if (Test-Path $TfvarsPath) {
        $tfvarsContent = Get-Content $TfvarsPath -Raw
        $project = "daxch"
        $environment = "staging"
        if ($tfvarsContent -match 'project_name\s*=\s*"([^"]+)"') {
            $project = $Matches[1]
        }
        if ($tfvarsContent -match 'environment\s*=\s*"([^"]+)"') {
            $environment = $Matches[1]
        }
        if ($tfvarsContent -match 'aws_region\s*=\s*"([^"]+)"') {
            $region = $Matches[1]
        }
        $namePrefix = "$project-$environment"
    }
    Invoke-EcsRollingDeploy -NamePrefix $namePrefix -Region $region
}

Write-Host ""
Write-Host "=== Infrastructure ready ===" -ForegroundColor Green
if ($customDomain) {
    Write-Host "App URL: https://$customDomain"
    Write-Host "Health:  https://$customDomain/health"
} else {
    Write-Host 'Then open: http://ALB-DNS/health (see terraform output alb_dns_name)'
}
