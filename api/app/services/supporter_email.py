"""Delivery and link construction for supporter email verification."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from urllib.parse import urlencode

from app.core.config import Settings

logger = logging.getLogger(__name__)


class SupporterEmailDeliveryError(RuntimeError):
    """Raised when a configured verification email cannot be handed to SMTP."""


def supporter_verification_url(settings: Settings, token: str) -> str:
    base_url = settings.supporter_public_site_url.rstrip("/")
    return f"{base_url}/my-npl?{urlencode({'verify': token})}"


def send_supporter_verification_email(
    settings: Settings,
    *,
    recipient: str,
    display_name: str,
    token: str,
) -> bool:
    """Send a verification link, returning False only for local development without SMTP.

    Local previews intentionally avoid sending a real email. Deployed environments
    are validated at startup and therefore always require the complete SMTP setup.
    """

    if not settings.supporter_smtp_host:
        logger.info("Supporter verification email is not delivered locally for %s", recipient)
        return False

    message = EmailMessage()
    message["Subject"] = "Verify your NPL fan account"
    message["From"] = settings.supporter_email_from
    message["To"] = recipient
    link = supporter_verification_url(settings, token)
    message.set_content(
        f"Hello {display_name},\n\n"
        "Please verify your email address before signing in to watch NPL broadcasts.\n\n"
        f"Verify your email: {link}\n\n"
        "If you did not create this account, you can ignore this email."
    )

    try:
        with smtplib.SMTP(settings.supporter_smtp_host, settings.supporter_smtp_port, timeout=15) as smtp:
            if settings.supporter_smtp_use_tls:
                smtp.starttls()
            smtp.login(settings.supporter_smtp_username, settings.supporter_smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise SupporterEmailDeliveryError("Could not send the verification email.") from exc

    return True
