variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "staging"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "daxch"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.30.0.0/16"
}

variable "domain_name" {
  description = "Primary domain for app"
  type        = string
  default     = ""
}

variable "alb_acm_certificate_arn" {
  description = "ACM certificate ARN for ALB listener (same region as ALB)."
  type        = string
  default     = ""
}

variable "cloudfront_acm_certificate_arn" {
  description = "ACM certificate ARN for CloudFront (must be in us-east-1)."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 hosted zone id for optional app DNS record."
  type        = string
  default     = ""
}

variable "backend_image" {
  description = "Backend container image URI"
  type        = string
  default     = "public.ecr.aws/docker/library/python:3.12-slim"
}

variable "frontend_image" {
  description = "Frontend container image URI"
  type        = string
  default     = "public.ecr.aws/docker/library/node:20-alpine"
}

variable "worker_image" {
  description = "Worker container image URI"
  type        = string
  default     = "public.ecr.aws/docker/library/python:3.12-slim"
}

variable "beat_image" {
  description = "Beat container image URI"
  type        = string
  default     = "public.ecr.aws/docker/library/python:3.12-slim"
}

variable "desired_count_frontend" {
  type    = number
  default = 2
}

variable "desired_count_backend" {
  type    = number
  default = 2
}

variable "desired_count_worker" {
  type    = number
  default = 1
}

variable "desired_count_beat" {
  type    = number
  default = 1
}

variable "container_port_frontend" {
  type    = number
  default = 3000
}

variable "container_port_backend" {
  type    = number
  default = 8000
}

variable "db_username" {
  type    = string
  default = "daxch"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "db_name" {
  type    = string
  default = "daxch"
}

variable "backend_env_vars" {
  description = "Non-secret backend env vars"
  type        = map(string)
  default = {
    API_PREFIX = "/api/v1"
  }
}

variable "app_secrets" {
  description = "Sensitive app secrets stored in Secrets Manager JSON."
  type        = map(string)
  sensitive   = true
  default = {
    SECRET_KEY               = ""
    OPENAI_API_KEY           = ""
    UPSTOX_CLIENT_ID         = ""
    UPSTOX_CLIENT_SECRET     = ""
    RAZORPAY_KEY_ID          = ""
    RAZORPAY_KEY_SECRET      = ""
    RAZORPAY_WEBHOOK_SECRET  = ""
    RAZORPAY_PLAN_STARTER_ID = ""
    RAZORPAY_PLAN_PRO_ID     = ""
    RAZORPAY_PLAN_ULTRA_ID   = ""
    TAVILY_API_KEY           = ""
    NEWS_API_KEY             = ""
    SES_FROM_EMAIL           = ""
    FCM_CREDENTIALS_JSON     = ""
    FERNET_KEY               = ""
  }
}

