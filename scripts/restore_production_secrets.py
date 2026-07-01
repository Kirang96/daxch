"""Push app_secrets from infrastructure/terraform.production.tfvars into AWS Secrets Manager."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TFVARS = ROOT / "infrastructure" / "terraform.production.tfvars"
SECRET_ID = "daxch-production-app-secrets"
REGION = "ap-south-1"
CLUSTER = "daxch-production-cluster"
SERVICES = (
    "daxch-production-backend",
    "daxch-production-frontend",
    "daxch-production-worker",
    "daxch-production-beat",
)


def parse_app_secrets(text: str) -> dict[str, str]:
    match = re.search(r"app_secrets\s*=\s*\{([^}]*)\}", text, re.DOTALL)
    if not match:
        raise SystemExit("app_secrets block not found in terraform.production.tfvars")
    block = match.group(1)
    secrets: dict[str, str] = {}
    for line in block.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        item = re.match(r'([A-Z0-9_]+)\s*=\s*"(.*)"\s*$', line)
        if item:
            key, value = item.groups()
            secrets[key] = value.replace('\\"', '"').replace("\\\\", "\\")
    if not secrets:
        raise SystemExit("No app_secrets entries parsed from terraform.production.tfvars")
    return secrets


def aws_json(args: list[str]) -> dict:
    result = subprocess.run(
        ["aws", *args, "--region", REGION, "--output", "json"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        if "ExpiredToken" in detail or "Unable to locate credentials" in detail:
            raise SystemExit("AWS session expired. Run: aws login")
        raise SystemExit(f"aws {' '.join(args)} failed:\n{detail}")
    return json.loads(result.stdout or "{}")


def aws_run(args: list[str]) -> None:
    result = subprocess.run(["aws", *args, "--region", REGION], check=False)
    if result.returncode != 0:
        raise SystemExit(f"aws {' '.join(args)} failed (exit {result.returncode})")


def main() -> None:
    if not TFVARS.exists():
        raise SystemExit(
            f"Missing {TFVARS}. Copy infrastructure/terraform.production.tfvars.example and fill live secrets."
        )

    aws_json(["sts", "get-caller-identity"])

    local_secrets = parse_app_secrets(TFVARS.read_text(encoding="utf-8"))
    try:
        current = json.loads(
            aws_json(["secretsmanager", "get-secret-value", "--secret-id", SECRET_ID])["SecretString"]
        )
    except SystemExit as exc:
        if "ResourceNotFoundException" in str(exc):
            raise SystemExit(
                f"Secret {SECRET_ID} not found. Run complete-production-deploy.ps1 -RestoreSecrets first."
            ) from exc
        raise
    merged = {**current, **local_secrets}

    aws_run(
        [
            "secretsmanager",
            "put-secret-value",
            "--secret-id",
            SECRET_ID,
            "--secret-string",
            json.dumps(merged),
        ]
    )
    print(f"Updated {SECRET_ID} ({len(local_secrets)} keys from terraform.production.tfvars)")

    for service in SERVICES:
        print(f"Rolling ECS service: {service}")
        aws_run(
            [
                "ecs",
                "update-service",
                "--cluster",
                CLUSTER,
                "--service",
                service,
                "--force-new-deployment",
                "--no-cli-pager",
            ]
        )

    print("Done. Verify https://daxch.app/health")


if __name__ == "__main__":
    main()
