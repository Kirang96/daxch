resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name_prefix}-backend"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${local.name_prefix}-frontend"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name_prefix}-worker"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "beat" {
  name              = "/ecs/${local.name_prefix}-beat"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = local.tags
}

locals {
  backend_env = merge(var.backend_env_vars, { ENVIRONMENT = var.environment })

  base_env = [
    for key, value in local.backend_env : {
      name  = key
      value = value
    }
  ]

  secret_env = [
    {
      name      = "DATABASE_URL"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::"
    },
    {
      name      = "REDIS_URL"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:REDIS_URL::"
    },
    {
      name      = "CELERY_BROKER_URL"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:CELERY_BROKER_URL::"
    },
    {
      name      = "CELERY_RESULT_BACKEND"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:CELERY_RESULT_BACKEND::"
    },
    {
      name      = "SECRET_KEY"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:SECRET_KEY::"
    },
    {
      name      = "OPENAI_API_KEY"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:OPENAI_API_KEY::"
    },
    {
      name      = "UPSTOX_CLIENT_ID"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:UPSTOX_CLIENT_ID::"
    },
    {
      name      = "UPSTOX_CLIENT_SECRET"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:UPSTOX_CLIENT_SECRET::"
    },
    {
      name      = "FIVEPAISA_APP_KEY"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:FIVEPAISA_APP_KEY::"
    },
    {
      name      = "FIVEPAISA_ENCRYPTION_KEY"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:FIVEPAISA_ENCRYPTION_KEY::"
    },
    {
      name      = "FIVEPAISA_USER_ID"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:FIVEPAISA_USER_ID::"
    },
    {
      name      = "RAZORPAY_KEY_ID"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:RAZORPAY_KEY_ID::"
    },
    {
      name      = "RAZORPAY_KEY_SECRET"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:RAZORPAY_KEY_SECRET::"
    },
    {
      name      = "RAZORPAY_WEBHOOK_SECRET"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:RAZORPAY_WEBHOOK_SECRET::"
    },
    {
      name      = "RAZORPAY_PLAN_STARTER_ID"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:RAZORPAY_PLAN_STARTER_ID::"
    },
    {
      name      = "RAZORPAY_PLAN_PRO_ID"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:RAZORPAY_PLAN_PRO_ID::"
    },
    {
      name      = "RAZORPAY_PLAN_ULTRA_ID"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:RAZORPAY_PLAN_ULTRA_ID::"
    },
    {
      name      = "TAVILY_API_KEY"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:TAVILY_API_KEY::"
    },
    {
      name      = "NEWS_API_KEY"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:NEWS_API_KEY::"
    },
    {
      name      = "SES_FROM_EMAIL"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:SES_FROM_EMAIL::"
    },
    {
      name      = "FCM_CREDENTIALS_JSON"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:FCM_CREDENTIALS_JSON::"
    },
    {
      name      = "FERNET_KEY"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:FERNET_KEY::"
    },
    {
      name      = "GOOGLE_CLIENT_ID"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:GOOGLE_CLIENT_ID::"
    },
    {
      name      = "GOOGLE_CLIENT_SECRET"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:GOOGLE_CLIENT_SECRET::"
    },
    {
      name      = "GOOGLE_REDIRECT_URI"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:GOOGLE_REDIRECT_URI::"
    },
  ]
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = var.backend_image
      essential = true
      portMappings = [
        {
          containerPort = var.container_port_backend
          hostPort      = var.container_port_backend
          protocol      = "tcp"
        }
      ]
      command     = ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", tostring(var.container_port_backend)]
      environment = local.base_env
      secrets     = local.secret_env
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.backend.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
  tags = local.tags
}

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${local.name_prefix}-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "frontend"
      image     = var.frontend_image
      essential = true
      portMappings = [
        {
          containerPort = var.container_port_frontend
          hostPort      = var.container_port_frontend
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "NEXT_PUBLIC_API_BASE_URL"
          value = "/api/v1"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.frontend.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
  tags = local.tags
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions = jsonencode([
    {
      name        = "worker"
      image       = var.worker_image
      essential   = true
      command     = ["celery", "-A", "backend.app.agents.celery_app.celery_app", "worker", "--loglevel=info"]
      environment = local.base_env
      secrets     = local.secret_env
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.worker.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
  tags = local.tags
}

resource "aws_ecs_task_definition" "beat" {
  family                   = "${local.name_prefix}-beat"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions = jsonencode([
    {
      name        = "beat"
      image       = var.beat_image
      essential   = true
      command     = ["celery", "-A", "backend.app.agents.celery_app.celery_app", "beat", "--loglevel=info"]
      environment = local.base_env
      secrets     = local.secret_env
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.beat.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
  tags = local.tags
}

resource "aws_ecs_service" "frontend" {
  name                               = "${local.name_prefix}-frontend"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.frontend.arn
  desired_count                      = var.desired_count_frontend
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100
  health_check_grace_period_seconds  = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = var.container_port_frontend
  }
  depends_on = [aws_lb_listener.http]
  tags       = local.tags
}

resource "aws_ecs_service" "backend" {
  name                               = "${local.name_prefix}-backend"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.backend.arn
  desired_count                      = var.desired_count_backend
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = var.container_port_backend
  }
  depends_on = [aws_lb_listener.http]
  tags       = local.tags
}

resource "aws_ecs_service" "worker" {
  name            = "${local.name_prefix}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.desired_count_worker
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }
  tags = local.tags
}

resource "aws_ecs_service" "beat" {
  name            = "${local.name_prefix}-beat"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.beat.arn
  desired_count   = var.desired_count_beat
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }
  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "backend_high_cpu" {
  alarm_name          = "${local.name_prefix}-backend-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Backend CPU is consistently high."
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }
  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "frontend_high_cpu" {
  alarm_name          = "${local.name_prefix}-frontend-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Frontend CPU is consistently high."
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.frontend.name
  }
  tags = local.tags
}

