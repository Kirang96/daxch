# Run Terraform with credentials from `aws login` (Windows).
# Usage:
#   .\scripts\terraform-staging.ps1 apply
#   .\scripts\terraform-staging.ps1 force-unlock 54dbcbea-abf2-3d6a-9e3e-fd0f6c4378ae

param(
    [ValidateSet("init", "plan", "apply", "output", "force-unlock")]
    [string]$Command = "apply",
    [string]$LockId = ""
)

$ErrorActionPreference = "Stop"
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

$terraform = Get-TerraformExe
$infraDir = Join-Path $PSScriptRoot "..\infrastructure"
Push-Location $infraDir
Import-AwsLoginCredentials

switch ($Command) {
    "init" { & $terraform init }
    "plan" { & $terraform plan }
    "apply" { & $terraform apply -auto-approve }
    "output" { & $terraform output }
    "force-unlock" {
        if (-not $LockId) {
            Write-Error "Usage: .\scripts\terraform-staging.ps1 force-unlock <lock-id>"
        }
        & $terraform force-unlock -force $LockId
    }
}

Pop-Location
