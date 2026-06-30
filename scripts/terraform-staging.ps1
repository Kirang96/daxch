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

function Invoke-AwsCli {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$AwsArgs)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & aws @AwsArgs 2>&1
        return [PSCustomObject]@{
            ExitCode = $LASTEXITCODE
            Output   = ($output | Out-String).Trim()
        }
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Import-AwsLoginCredentials {
    $export = Invoke-AwsCli configure export-credentials --format env
    if ($export.ExitCode -ne 0) {
        $detail = if ($export.Output) { "`n$($export.Output)" } else { "" }
        throw "AWS not authenticated or session expired.$detail`nRun: aws login"
    }
    foreach ($line in ($export.Output -split "`n")) {
        $line = $line.Trim()
        if ($line -match '^export\s+([^=]+)=(.*)$') {
            Set-Item -Path "env:$($matches[1])" -Value $matches[2].Trim('"')
        }
    }
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
