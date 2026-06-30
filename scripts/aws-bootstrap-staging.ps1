# One-time AWS bootstrap for Daxch staging deploy.
# Prerequisites: aws CLI logged in (aws login / aws sso login / configured profile)
# Usage: .\scripts\aws-bootstrap-staging.ps1 [-Region ap-south-1] [-GitHubRepo Kirang96/daxch]

param(
    [string]$Region = "ap-south-1",
    [string]$GitHubRepo = "Kirang96/daxch"
)

$ErrorActionPreference = "Stop"

function Invoke-Aws {
    param(
        [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
        [string[]]$AwsArgs
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & aws @AwsArgs 2>&1
        $exitCode = $LASTEXITCODE
        return [PSCustomObject]@{
            ExitCode = $exitCode
            Output   = $output
        }
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Require-AwsIdentity {
    $result = Invoke-Aws sts get-caller-identity --output json
    if ($result.ExitCode -ne 0) {
        Write-Error "AWS CLI not authenticated. Run: aws login (or aws sso login) and retry.`n$($result.Output)"
    }
    return ($result.Output | Out-String | ConvertFrom-Json)
}

$identity = Require-AwsIdentity
$AccountId = $identity.Account
Write-Host "AWS Account: $AccountId"

$repos = @("daxch-backend", "daxch-frontend")
foreach ($repo in $repos) {
    $describe = Invoke-Aws ecr describe-repositories --repository-names $repo --region $Region --output json
    if ($describe.ExitCode -ne 0) {
        Write-Host "Creating ECR repository: $repo"
        $create = Invoke-Aws ecr create-repository --repository-name $repo --region $Region --image-scanning-configuration scanOnPush=true
        if ($create.ExitCode -ne 0) {
            Write-Error "Failed to create ECR repository '$repo':`n$($create.Output)"
        }
    } else {
        Write-Host "ECR repository exists: $repo"
    }
}

$StateBucket = "daxch-terraform-state-$AccountId"
$LockTable = "daxch-terraform-locks"

$bucketHead = Invoke-Aws s3api head-bucket --bucket $StateBucket
if ($bucketHead.ExitCode -ne 0) {
    Write-Host "Creating S3 state bucket: $StateBucket"
    if ($Region -eq "us-east-1") {
        $createBucket = Invoke-Aws s3api create-bucket --bucket $StateBucket --region $Region
    } else {
        $createBucket = Invoke-Aws s3api create-bucket --bucket $StateBucket --region $Region --create-bucket-configuration "LocationConstraint=$Region"
    }
    if ($createBucket.ExitCode -ne 0) {
        Write-Error "Failed to create S3 bucket '$StateBucket':`n$($createBucket.Output)"
    }
    Invoke-Aws s3api put-bucket-versioning --bucket $StateBucket --versioning-configuration Status=Enabled | Out-Null
    Invoke-Aws s3api put-bucket-encryption --bucket $StateBucket --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' | Out-Null
} else {
    Write-Host "S3 state bucket exists: $StateBucket"
}

$tableDescribe = Invoke-Aws dynamodb describe-table --table-name $LockTable --region $Region
if ($tableDescribe.ExitCode -ne 0) {
    Write-Host "Creating DynamoDB lock table: $LockTable"
    $createTable = Invoke-Aws dynamodb create-table `
        --table-name $LockTable `
        --attribute-definitions "AttributeName=LockID,AttributeType=S" `
        --key-schema "AttributeName=LockID,KeyType=HASH" `
        --billing-mode PAY_PER_REQUEST `
        --region $Region
    if ($createTable.ExitCode -ne 0) {
        Write-Error "Failed to create DynamoDB table '$LockTable':`n$($createTable.Output)"
    }
    Invoke-Aws dynamodb wait table-exists --table-name $LockTable --region $Region | Out-Null
} else {
    Write-Host "DynamoDB lock table exists: $LockTable"
}

$OidcProviderArn = "arn:aws:iam::${AccountId}:oidc-provider/token.actions.githubusercontent.com"
$providerList = Invoke-Aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?Arn=='$OidcProviderArn']" --output text
if ($providerList.ExitCode -ne 0 -or -not $providerList.Output) {
    Write-Host "Creating GitHub OIDC provider"
    $createProvider = Invoke-Aws iam create-open-id-connect-provider `
        --url https://token.actions.githubusercontent.com `
        --client-id-list sts.amazonaws.com `
        --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
    if ($createProvider.ExitCode -ne 0 -and ($createProvider.Output | Out-String) -notmatch "EntityAlreadyExists") {
        Write-Error "Failed to create GitHub OIDC provider:`n$($createProvider.Output)"
    }
} else {
    Write-Host "GitHub OIDC provider exists"
}

$RoleName = "daxch-github-deploy"
$TrustPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AccountId}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GitHubRepo}:*"
        }
      }
    }
  ]
}
"@

$roleGet = Invoke-Aws iam get-role --role-name $RoleName
if ($roleGet.ExitCode -ne 0) {
    Write-Host "Creating IAM role: $RoleName"
    $trustPath = Join-Path $env:TEMP "daxch-trust.json"
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($trustPath, $TrustPolicy, $utf8NoBom)
    $trustUri = "file://" + ($trustPath -replace "\\", "/")
    $createRole = Invoke-Aws iam create-role --role-name $RoleName --assume-role-policy-document $trustUri
    if ($createRole.ExitCode -ne 0) {
        Write-Error "Failed to create IAM role '$RoleName':`n$($createRole.Output)"
    }
    Invoke-Aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/PowerUserAccess | Out-Null
    Invoke-Aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/IAMFullAccess | Out-Null
} else {
    Write-Host "IAM role exists: $RoleName"
}

$RoleArn = "arn:aws:iam::${AccountId}:role/${RoleName}"
$BackendEcr = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/daxch-backend"
$FrontendEcr = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/daxch-frontend"

$BackendTf = Join-Path $PSScriptRoot "..\infrastructure\backend.tf"
$BackendExample = Join-Path $PSScriptRoot "..\infrastructure\backend.tf.example"
if (-not (Test-Path $BackendTf) -and (Test-Path $BackendExample)) {
    Write-Host "Creating infrastructure/backend.tf from example"
    (Get-Content $BackendExample) `
        -replace "daxch-terraform-state-ACCOUNT_ID", $StateBucket `
        | Set-Content $BackendTf -Encoding utf8
}

Write-Host ""
Write-Host "=== Bootstrap complete ===" -ForegroundColor Green
Write-Host "GitHub staging secrets to set:"
Write-Host "  AWS_DEPLOY_ROLE_ARN       = $RoleArn"
Write-Host "  ECR_BACKEND_REPOSITORY    = $BackendEcr"
Write-Host "  ECR_FRONTEND_REPOSITORY = $FrontendEcr"
Write-Host "  DB_PASSWORD_STAGING       = (see infrastructure/staging-secrets.local)"
Write-Host ""
Write-Host "Terraform remote state:"
Write-Host "  S3 bucket: $StateBucket"
Write-Host "  DynamoDB:  $LockTable"
Write-Host ""
Write-Host "Next: cd infrastructure; terraform init; terraform apply"
