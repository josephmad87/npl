"""Small in-process rate limiter for authentication and anonymous form endpoints."""

from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status

_attempts: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_lock = Lock()


def _client_key(request: Request) -> str:
    # Uvicorn's proxy-header handling normalises request.client when deployed
    # behind the trusted platform proxy. Do not trust arbitrary X-Forwarded-For.
    return request.client.host if request.client else "unknown"


def check_rate_limit(
    request: Request,
    *,
    scope: str,
    limit: int,
    window_seconds: int,
) -> None:
    now = monotonic()
    cutoff = now - window_seconds
    key = (scope, _client_key(request))

    with _lock:
        entries = _attempts[key]
        while entries and entries[0] <= cutoff:
            entries.popleft()

        if len(entries) >= limit:
            retry_after = max(1, int(window_seconds - (now - entries[0])))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "rate_limited", "message": "Too many requests. Please try again later."},
                headers={"Retry-After": str(retry_after)},
            )

        entries.append(now)

        if len(_attempts) > 4096:
            for candidate, timestamps in list(_attempts.items()):
                while timestamps and timestamps[0] <= cutoff:
                    timestamps.popleft()
                if not timestamps:
                    _attempts.pop(candidate, None)


def clear_rate_limits() -> None:
    """Clear process-local counters (used by tests)."""
    with _lock:
        _attempts.clear()
