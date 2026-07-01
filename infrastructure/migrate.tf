resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/ecs/${local.name_prefix}-migrate"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name_prefix}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "migrate"
      image     = var.backend_image
      essential = true
      command   = ["alembic", "-c", "backend/alembic.ini", "upgrade", "head"]
      environment = concat(local.base_env, [
        {
          name  = "PYTHONPATH"
          value = "/app"
        }
      ])
      secrets = local.secret_env
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.migrate.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
  tags = local.tags
}
