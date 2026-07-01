# Remove abandoned staging VPCs that block new environment deploys (VPC/EIP limits).
# Keeps vpc-01e512e6647fbfaba (live staging: RDS, ALB, ECS).
#
# Usage:
#   aws login
#   .\scripts\cleanup-orphaned-vpcs.ps1
#   .\scripts\cleanup-orphaned-vpcs.ps1 -VpcIds vpc-abc123

param(
    [string[]]$VpcIds = @(
        "vpc-08b500861dcbb3456",
        "vpc-055f122415baa865a",
        "vpc-01c390fcce076b326"
    ),
    [string]$Region = "ap-south-1",
    [string]$KeepVpcId = "vpc-01e512e6647fbfaba"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "aws-auth.ps1")
Import-AwsLoginCredentials | Out-Null

function Wait-NatGatewaysDeleted {
    param([string[]]$NatGatewayIds)
    if (-not $NatGatewayIds) { return }
    Write-Host "Waiting for NAT gateway deletion..." -ForegroundColor Yellow
    $deadline = (Get-Date).AddMinutes(10)
    while ((Get-Date) -lt $deadline) {
        $pending = @()
        foreach ($id in $NatGatewayIds) {
            $state = aws ec2 describe-nat-gateways --region $Region --nat-gateway-ids $id `
                --query "NatGateways[0].State" --output text 2>$null
            if ($state -and $state -ne "deleted") { $pending += $id }
        }
        if (-not $pending) { return }
        Start-Sleep -Seconds 15
    }
    throw "Timed out waiting for NAT gateways: $($NatGatewayIds -join ', ')"
}

function Remove-OrphanVpc {
    param([string]$VpcId)

    if ($VpcId -eq $KeepVpcId) {
        throw "Refusing to delete live staging VPC $KeepVpcId"
    }

    Write-Host "`n=== Deleting orphan VPC $VpcId ===" -ForegroundColor Cyan

    $natIds = aws ec2 describe-nat-gateways --region $Region `
        --filter "Name=vpc-id,Values=$VpcId" "Name=state,Values=available,pending,deleting" `
        --query "NatGateways[*].NatGatewayId" --output text
    if ($natIds) {
        foreach ($natId in ($natIds -split "\s+")) {
            if (-not $natId) { continue }
            Write-Host "Deleting NAT gateway $natId"
            aws ec2 delete-nat-gateway --region $Region --nat-gateway-id $natId | Out-Null
        }
        Wait-NatGatewaysDeleted -NatGatewayIds @($natIds -split "\s+" | Where-Object { $_ })
    }

    # Release unattached staging NAT EIPs left after NAT delete
    $allEips = aws ec2 describe-addresses --region $Region --output json | ConvertFrom-Json
    foreach ($eip in $allEips.Addresses) {
        if ($eip.AssociationId) { continue }
        $name = ($eip.Tags | Where-Object { $_.Key -eq "Name" }).Value
        if ($name -eq "daxch-staging-nat-eip") {
            Write-Host "Releasing unassociated EIP $($eip.PublicIp) ($($eip.AllocationId))"
            aws ec2 release-address --region $Region --allocation-id $eip.AllocationId | Out-Null
        }
    }

    $igwIds = aws ec2 describe-internet-gateways --region $Region `
        --filters "Name=attachment.vpc-id,Values=$VpcId" `
        --query "InternetGateways[*].InternetGatewayId" --output text
    foreach ($igwId in ($igwIds -split "\s+")) {
        if (-not $igwId) { continue }
        Write-Host "Detaching and deleting IGW $igwId"
        aws ec2 detach-internet-gateway --region $Region --internet-gateway-id $igwId --vpc-id $VpcId | Out-Null
        aws ec2 delete-internet-gateway --region $Region --internet-gateway-id $igwId | Out-Null
    }

    $rtData = aws ec2 describe-route-tables --region $Region `
        --filters "Name=vpc-id,Values=$VpcId" --output json | ConvertFrom-Json
    foreach ($rt in $rtData.RouteTables) {
        if ($rt.Associations | Where-Object { $_.Main -eq $true }) { continue }
        foreach ($assoc in $rt.Associations) {
            if ($assoc.RouteTableAssociationId) {
                Write-Host "Disassociating route table association $($assoc.RouteTableAssociationId)"
                $prev = $ErrorActionPreference
                $ErrorActionPreference = "Continue"
                aws ec2 disassociate-route-table --region $Region --association-id $assoc.RouteTableAssociationId 2>&1 | Out-Null
                $ErrorActionPreference = $prev
            }
        }
        Write-Host "Deleting route table $($rt.RouteTableId)"
        $prev = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        aws ec2 delete-route-table --region $Region --route-table-id $rt.RouteTableId 2>&1 | Out-Null
        $ErrorActionPreference = $prev
    }

    $subnetIds = aws ec2 describe-subnets --region $Region `
        --filters "Name=vpc-id,Values=$VpcId" `
        --query "Subnets[*].SubnetId" --output text
    foreach ($subnetId in ($subnetIds -split "\s+")) {
        if (-not $subnetId) { continue }
        Write-Host "Deleting subnet $subnetId"
        $prev = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        aws ec2 delete-subnet --region $Region --subnet-id $subnetId 2>&1 | Out-Null
        $ErrorActionPreference = $prev
    }

    for ($pass = 1; $pass -le 5; $pass++) {
        $sgIds = aws ec2 describe-security-groups --region $Region `
            --filters "Name=vpc-id,Values=$VpcId" `
            --query "SecurityGroups[?GroupName!='default'].GroupId" --output text
        if (-not $sgIds) { break }
        foreach ($sgId in ($sgIds -split "\s+")) {
            if (-not $sgId) { continue }
            Write-Host "Deleting security group $sgId (pass $pass)"
            $prev = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            aws ec2 delete-security-group --region $Region --group-id $sgId 2>&1 | Out-Null
            $ErrorActionPreference = $prev
        }
    }

    Write-Host "Deleting VPC $VpcId"
    aws ec2 delete-vpc --region $Region --vpc-id $VpcId | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to delete VPC $VpcId (dependencies may remain - re-run script after aws login)"
    }
    Write-Host "Deleted $VpcId" -ForegroundColor Green
}

Write-Host "=== Cleanup orphaned VPCs ($Region) ===" -ForegroundColor Cyan
Write-Host "Keeping live staging VPC: $KeepVpcId" -ForegroundColor Green

foreach ($vpcId in $VpcIds) {
    Remove-OrphanVpc -VpcId $vpcId
}

# Release any leftover unattached daxch staging NAT EIPs
$allEips = aws ec2 describe-addresses --region $Region --output json | ConvertFrom-Json
foreach ($eip in $allEips.Addresses) {
    if ($eip.AssociationId) { continue }
    $name = ($eip.Tags | Where-Object { $_.Key -eq "Name" }).Value
    if ($name -eq "daxch-staging-nat-eip") {
        Write-Host "Releasing leftover EIP $($eip.PublicIp)"
        aws ec2 release-address --region $Region --allocation-id $eip.AllocationId | Out-Null
    }
}

Write-Host "`n=== Done. Re-run complete-production-deploy.ps1 ===" -ForegroundColor Green
