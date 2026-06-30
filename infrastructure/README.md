# Daxch AWS Infrastructure

This Terraform stack provisions an all-AWS runtime for Daxch:

- VPC, public/private subnets, IGW, NAT, route tables
- Security groups for ALB, ECS tasks, RDS, and Redis
- ECS cluster + Fargate services for:
  - Next.js frontend
  - FastAPI backend
  - Celery worker
  - Celery beat scheduler
- ALB path-based routing (`/api/*` -> backend, default -> frontend)
- CloudFront distribution in front of ALB
- RDS PostgreSQL
- ElastiCache Redis
- Secrets Manager secret for app runtime payload
- IAM roles for ECS execution and task access
- CloudWatch log groups for all services

## Structure

- `main.tf`: provider and shared locals
- `variables.tf`: configurable inputs
- `network.tf`: VPC and subnet topology
- `security.tf`: SGs
- `data_services.tf`: RDS, Redis, Secrets
- `edge.tf`: ALB + CloudFront
- `iam.tf`: IAM roles and policies
- `ecs.tf`: task definitions and ECS services
- `outputs.tf`: deployment outputs

## Deploy

1. Install Terraform `>=1.8`.
2. Configure AWS credentials.
3. Copy and edit variables:
   - `cp terraform.tfvars.example terraform.tfvars`
4. Run:
   - `terraform init`
   - `terraform plan`
   - `terraform apply`

## Notes

- Use separate state/workspaces for `staging` and `production`.
- Set `db_password` securely (do not commit it).
- Provide real image URIs from your ECR pipeline.

