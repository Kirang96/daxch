# Request ACM certificate for daxch.app (us-east-1) and print Cloudflare validation CNAMEs.
#
# Usage:
#   aws login
#   .\scripts\request-production-acm-cert.ps1

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "aws-auth.ps1")
Import-AwsLoginCredentials
python (Join-Path $PSScriptRoot "request-production-acm-cert.py")
