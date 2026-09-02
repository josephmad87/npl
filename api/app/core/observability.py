"""Optional production observability integrations."""

from __future__ import annotations

import sentry_sdk

from app.core.config import Settings


def configure_error_monitoring(settings: Settings) -> None:
    """Start Sentry only when a DSN is explicitly configured."""
    dsn = (settings.sentry_dsn or "").strip()
    if not dsn:
        return

    sentry_sdk.init(
        dsn=dsn,
        environment=settings.app_environment,
        release=settings.app_release,
        send_default_pii=False,
        traces_sample_rate=settings.sentry_traces_sample_rate,
    )
