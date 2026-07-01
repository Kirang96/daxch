"""Request ACM certificate for daxch.app in us-east-1 (CloudFront). Prints DNS validation records."""

from __future__ import annotations

import json
import subprocess
import sys

DOMAIN = "daxch.app"
REGION = "us-east-1"


def aws_json(args: list[str]) -> dict:
    result = subprocess.run(
        ["aws", *args, "--region", REGION, "--output", "json"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit((result.stderr or result.stdout).strip())
    return json.loads(result.stdout or "{}")


def main() -> None:
    print(f"Requesting ACM certificate for {DOMAIN} in {REGION}...")
    cert = aws_json(
        [
            "acm",
            "request-certificate",
            "--domain-name",
            DOMAIN,
            "--validation-method",
            "DNS",
        ]
    )
    arn = cert["CertificateArn"]
    print(f"\nCertificate ARN:\n{arn}\n")
    print("Add this ARN to infrastructure/production.tfvars as cloudfront_acm_certificate_arn\n")

    print("Fetching DNS validation records (may take a few seconds)...")
    import time

    records = []
    for _ in range(12):
        time.sleep(5)
        detail = aws_json(["acm", "describe-certificate", "--certificate-arn", arn])
        options = detail.get("Certificate", {}).get("DomainValidationOptions", [])
        records = [o for o in options if o.get("ResourceRecord")]
        if records:
            break

    if not records:
        print("Validation records not ready yet. Run:")
        print(f"  aws acm describe-certificate --certificate-arn {arn} --region us-east-1")
        return

    print("Add these CNAME records in Cloudflare (DNS only, grey cloud):\n")
    for opt in records:
        rec = opt["ResourceRecord"]
        print(f"  Name:  {rec['Name']}")
        print(f"  Type:  {rec['Type']}")
        print(f"  Value: {rec['Value']}")
        print()

    print("After status is ISSUED, update production.tfvars and run complete-production-deploy.ps1")


if __name__ == "__main__":
    main()
