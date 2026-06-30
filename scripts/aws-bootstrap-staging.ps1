# One-time AWS bootstrap for Daxch staging deploy.
# Prerequisites: aws CLI logged in (aws login / aws sso login / configured profile)
# Usage: .\scripts\aws-bootstrap-staging.ps1 [-Region ap-south-1] [-GitHubRepo Kirang96/daxch]

param(
    [string]$Region = "ap-south-1",
    [string]$GitHubRepo = "Kirang96/daxch"
)

$ErrorActionPreference = "Stop"

function Require-Aws {
    try {
        return aws sts get-caller-identity --output json | ConvertFrom-Json
    } catch {
        Write-Error "AWS CLI not authenticated. Run: aws login (or aws sso login) and retry."
    }
}

$identity = Require-Aws
$AccountId = $identity.Account
Write-Host "AWS Account: $AccountId"

$repos = @("daxch-backend", "daxch-frontend")
foreach ($repo in $repos) {
    $exists = aws ecr describe-repositories --repository-names $repo --region $Region 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Creating ECR repository: $repo"
        aws ecr create-repository --repository-name $repo --region $Region --image-scanning-configuration scanOnPush=true | Out-Null
    } else {
        Write-Host "ECR repository exists: $repo"
    }
}

$StateBucket = "daxch-terraform-state-$AccountId"
$LockTable = "daxch-terraform-locks"

$bucketExists = aws s3api head-bucket --bucket $StateBucket 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating S3 state bucket: $StateBucket"
    if ($Region -eq "us-east-1") {
        aws s3api create-bucket --bucket $StateBucket --region $Region | Out-Null
    } else {
        aws s3api create-bucket --bucket $StateBucket --region $Region --create-bucket-configuration LocationConstraint=$Region | Out-Null
    }
    aws s3api put-bucket-versioning --bucket $StateBucket --versioning-configuration Status=Enabled | Out-Null
    aws s3api put-bucket-encryption --bucket $StateBucket --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' | Out-Null
} else {
    Write-Host "S3 state bucket exists: $StateBucket"
}

$tableExists = aws dynamodb describe-table --table-name $LockTable --region $Region 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating DynamoDB lock table: $LockTable"
    aws dynamodb create-table `
        --table-name $LockTable `
        --attribute-definitions AttributeName=LockID,AttributeType=S `
        --key-schema AttributeName=LockID,KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --region $Region | Out-Null
    aws dynamodb wait table-exists --table-name $LockTable --region $Region
} else {
    Write-Host "DynamoDB lock table exists: $LockTable"
}

$OidcProviderArn = "arn:aws:iam::${AccountId}:oidc-provider/token.actions.githubusercontent.com"
$providerExists = aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?Arn=='$OidcProviderArn']" --output text
if (-not $providerExists) {
    Write-Host "Creating GitHub OIDC provider"
    aws iam create-open-id-connect-provider `
        --url https://token.actions.githubusercontent.com `
        --client-id-list sts.amazonaws.com `
        --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 | Out-Null
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

$roleExists = aws iam get-role --role-name $RoleName 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating IAM role: $RoleName"
    $TrustPolicy | Out-File -FilePath "$env:TEMP\daxch-trust.json" -Encoding utf8
    aws iam create-role --role-name $RoleName --assume-role-policy-document file://$env:TEMP\daxch-trust.json | Out-Null
    aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/PowerUserAccess | Out-Null
    aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/IAMFullAccess | Out-Null
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
        -replace 'daxch-terraform-state-ACCOUNT_ID', $StateBucket `
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
