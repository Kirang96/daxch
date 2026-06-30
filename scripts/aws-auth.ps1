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

function Import-AwsLoginCredentials {
    # Stale exported keys break `aws login` sessions — clear them first.
    foreach ($name in @("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_CREDENTIAL_EXPIRATION")) {
        Remove-Item "env:$name" -ErrorAction SilentlyContinue
    }

    $profiles = @()
    if ($env:AWS_PROFILE) {
        $profiles += $env:AWS_PROFILE
    }
    $profiles += @("default", "gv26")
    $profiles = $profiles | Select-Object -Unique

    foreach ($profile in $profiles) {
        $sts = Invoke-AwsCli --profile $profile sts get-caller-identity --output json
        if ($sts.ExitCode -eq 0 -and $sts.Output) {
            $env:AWS_PROFILE = $profile
            $account = (ConvertFrom-Json $sts.Output).Account
            Write-Host "AWS account: $account (profile: $profile)" -ForegroundColor Green
            return
        }
    }

    throw @"
AWS not authenticated or session expired.
Run in this terminal:
  aws login
Then re-run your deploy script.
"@
}
