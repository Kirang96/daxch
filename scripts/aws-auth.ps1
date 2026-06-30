function Get-AwsOutputText {
    param($Output)
    if ($null -eq $Output) {
        return ""
    }
    return (($Output | ForEach-Object {
            if ($_ -is [System.Management.Automation.ErrorRecord]) {
                $_.ToString()
            } else {
                $_.ToString()
            }
        }) -join "`n").Trim()
}

function Invoke-AwsCli {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$AwsArgs)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & aws @AwsArgs 2>&1
        return [PSCustomObject]@{
            ExitCode = $LASTEXITCODE
            Output   = Get-AwsOutputText $output
        }
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Set-AwsCredentialsFromExport {
    param([string]$ExportOutput)
    foreach ($line in ($ExportOutput -split "`n")) {
        $line = $line.Trim()
        if ($line -match '^export\s+([^=]+)=(.*)$') {
            Set-Item -Path "env:$($matches[1])" -Value $matches[2].Trim('"')
        }
    }
}

function Import-AwsLoginCredentials {
    # Stale exported keys break `aws login` sessions — clear them first.
    foreach ($name in @("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_CREDENTIAL_EXPIRATION", "AWS_PROFILE")) {
        Remove-Item "env:$name" -ErrorAction SilentlyContinue
    }

    $profiles = @("default", "gv26") | Select-Object -Unique

    foreach ($profile in $profiles) {
        $sts = Invoke-AwsCli --profile $profile sts get-caller-identity --output json
        if ($sts.ExitCode -ne 0 -or -not $sts.Output) {
            continue
        }

        $account = (ConvertFrom-Json $sts.Output).Account
        $export = Invoke-AwsCli --profile $profile configure export-credentials --format env
        if ($export.ExitCode -eq 0 -and $export.Output -match "AWS_ACCESS_KEY_ID") {
            Set-AwsCredentialsFromExport $export.Output
            Write-Host "AWS account: $account (exported session for Terraform)" -ForegroundColor Green
            return
        }

        throw @"
AWS CLI is logged in (profile: $profile) but Terraform needs exported session keys.
Run:
  aws login
  aws configure export-credentials --profile $profile --format env
Then re-run your deploy script in the same terminal.
CLI error: $($export.Output)
"@
    }

    throw @"
AWS not authenticated or session expired.
Run in this terminal:
  aws login
Then re-run your deploy script.
"@
}
