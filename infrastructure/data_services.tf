resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
  tags       = local.tags
}

resource "aws_db_instance" "postgres" {
  identifier              = "${local.name_prefix}-postgres"
  allocated_storage       = 30
  engine                  = "postgres"
  engine_version          = "16.14"
  instance_class          = "db.t4g.micro"
  db_name                 = var.db_name
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  publicly_accessible     = false
  backup_retention_period = 7
  storage_encrypted       = true
  skip_final_snapshot     = true
  deletion_protection     = var.environment == "production"

  tags = local.tags
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
  parameter_group_name = "default.redis7"
  port                 = 6379
  apply_immediately    = true
  tags                 = local.tags
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name_prefix}-app-secrets"
  recovery_window_in_days = 0
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(merge(var.app_secrets, {
    DATABASE_URL          = "postgresql+psycopg://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.address}:5432/${var.db_name}"
    REDIS_URL             = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379/0"
    CELERY_BROKER_URL     = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379/1"
    CELERY_RESULT_BACKEND = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379/2"
  }))

  # CI apply does not pass app_secrets; never overwrite secrets set by the initial local apply.
  lifecycle {
    ignore_changes = [secret_string]
  }
}

