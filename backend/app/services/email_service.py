import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)


class EmailDeliveryError(RuntimeError):
    pass


class EmailService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.ses = boto3.client("ses", region_name=self.settings.aws_region)

    async def send_magic_link(self, email: str, magic_url: str) -> None:
        if not self.settings.ses_from_email:
            if self.settings.is_production:
                raise EmailDeliveryError("SES_FROM_EMAIL is required in production")
            logger.warning("Skipping SES send in non-production because SES_FROM_EMAIL is not configured")
            return

        subject = "Your Daxch sign-in link"
        html_body = (
            "<h2>Daxch sign-in</h2>"
            "<p>Click the secure link below to sign in. The link expires soon.</p>"
            f"<p><a href=\"{magic_url}\">{magic_url}</a></p>"
            "<p>If you did not request this, ignore this email.</p>"
        )
        text_body = (
            "Daxch sign-in\n\n"
            "Use the secure sign-in link below:\n"
            f"{magic_url}\n\n"
            "If you did not request this, ignore this email."
        )

        try:
            self.ses.send_email(
                Source=self.settings.ses_from_email,
                Destination={"ToAddresses": [email]},
                Message={
                    "Subject": {"Data": subject},
                    "Body": {
                        "Text": {"Data": text_body},
                        "Html": {"Data": html_body},
                    },
                },
            )
        except (BotoCoreError, ClientError) as exc:
            logger.exception("Failed to send magic link via SES")
            raise EmailDeliveryError("Failed to send sign-in email") from exc

