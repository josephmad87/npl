from __future__ import annotations

import json
import re
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from pywebpush import WebPushException, webpush
from requests import Session

from app.core.config import Settings


def expo_push_token(value: str) -> bool:
    return re.fullmatch(r"Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{10,128}\]", value) is not None


def web_push_subscription(value: str) -> dict | None:
    """Permit subscriptions issued by browser push services."""
    try:
        subscription = json.loads(value)
        endpoint = subscription["endpoint"]
        keys = subscription["keys"]
        parsed = urlsplit(endpoint)
        host = parsed.hostname or ""
        allowed_host = (
            host == "fcm.googleapis.com"
            or host.endswith((".push.apple.com", ".push.services.mozilla.com", ".notify.windows.com"))
        )
        if (
            not allowed_host
            or parsed.scheme != "https"
            or parsed.port not in (None, 443)
            or parsed.username is not None
            or parsed.password is not None
            or not parsed.path.startswith("/")
            or parsed.fragment
            or not re.fullmatch(r"[A-Za-z0-9_-]{87}=?", keys["p256dh"])
            or not re.fullmatch(r"[A-Za-z0-9_-]{22}={0,2}", keys["auth"])
        ):
            return None
        return {"endpoint": endpoint, "keys": {"p256dh": keys["p256dh"], "auth": keys["auth"]}}
    except (AttributeError, KeyError, TypeError, ValueError):
        return None


class PushSession(Session):
    def request(self, *args, **kwargs):
        kwargs["allow_redirects"] = False
        return super().request(*args, **kwargs)


def send_expo_push(token: str, payload: dict, settings: Settings) -> bool:
    """Return false when a provider reports an expired registration."""
    if not expo_push_token(token):
        return False
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if settings.fan_expo_access_token:
        headers["Authorization"] = f"Bearer {settings.fan_expo_access_token}"
    message = {
        "to": token,
        "title": payload["title"],
        "body": payload["body"],
        "data": payload["data"],
        "channelId": "match-alerts",
        "ttl": 3600,
    }
    request = Request(
        "https://exp.host/--/api/v2/push/send",
        data=json.dumps(message).encode(),
        headers=headers,
        method="POST",
    )
    with urlopen(request, timeout=8) as response:
        ticket = json.load(response).get("data", {})
    if ticket.get("status") == "ok":
        return True
    code = ticket.get("details", {}).get("error")
    if code == "DeviceNotRegistered":
        return False
    raise RuntimeError("Expo push rejected the notification" + (f" ({code})" if code else ""))


def send_web_push(token: str, payload: dict, settings: Settings) -> bool:
    subscription = web_push_subscription(token)
    if subscription is None:
        return False
    try:
        with PushSession() as session:
            response = webpush(
                subscription,
                data=json.dumps(payload),
                vapid_private_key=settings.fan_web_push_private_key,
                vapid_claims={"sub": settings.fan_web_push_contact},
                ttl=3600,
                timeout=8,
                requests_session=session,
            )
        if 200 <= response.status_code < 300:
            return True
        raise RuntimeError("Browser push rejected the notification")
    except WebPushException as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in {404, 410}:
            return False
        raise RuntimeError(f"Browser push rejected the notification ({status or 'unknown status'})") from exc
