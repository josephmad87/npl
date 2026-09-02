#!/usr/bin/env python3
"""Read-only smoke and uptime checks for the NPL public, admin, and API services."""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class Check:
    name: str
    url: str
    expected_status: int = 200
    expected_text: str | None = None
    forbidden_text: str | None = None
    expected_json_status: str | None = None
    required_headers: tuple[str, ...] = ()


def fetch(check: Check, timeout: float) -> None:
    request = Request(
        check.url,
        headers={"User-Agent": "NPL-Uptime-Check/1.0"},
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            status_code = response.status
            response_headers = response.headers
            body = response.read(1_000_000).decode("utf-8", "replace")
    except HTTPError as error:
        status_code = error.code
        response_headers = error.headers
        body = error.read(1_000_000).decode("utf-8", "replace")

    if status_code != check.expected_status:
        raise RuntimeError(
            f"unexpected HTTP status {status_code}; expected {check.expected_status}",
        )

    if check.expected_text and check.expected_text.lower() not in body.lower():
        raise RuntimeError(f"response did not contain {check.expected_text!r}")

    if check.forbidden_text and check.forbidden_text.lower() in body.lower():
        raise RuntimeError(f"response contained forbidden text {check.forbidden_text!r}")

    missing_headers = [name for name in check.required_headers if not response_headers.get(name)]
    if missing_headers:
        raise RuntimeError(f"response omitted required headers: {', '.join(missing_headers)}")

    if check.expected_json_status:
        payload = json.loads(body)
        if payload.get("status") != check.expected_json_status:
            raise RuntimeError(
                f"JSON status was {payload.get('status')!r}, expected {check.expected_json_status!r}",
            )


def run_check(check: Check, *, attempts: int, timeout: float, retry_delay: float) -> None:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        started = time.monotonic()
        try:
            fetch(check, timeout)
            elapsed_ms = round((time.monotonic() - started) * 1000)
            print(f"PASS {check.name}: {elapsed_ms} ms")
            return
        except (HTTPError, URLError, TimeoutError, ValueError, RuntimeError) as error:
            last_error = error
            if attempt < attempts:
                time.sleep(retry_delay)

    raise RuntimeError(f"FAIL {check.name}: {last_error}")


def clean_base_url(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return value.strip().rstrip("/") + "/"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public-url")
    parser.add_argument("--admin-url")
    parser.add_argument("--api-url")
    parser.add_argument(
        "--site-url",
        help="Check one deployment-preview URL for an HTML application shell.",
    )
    parser.add_argument("--attempts", type=int, default=3)
    parser.add_argument("--timeout", type=float, default=15)
    parser.add_argument("--retry-delay", type=float, default=2)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    checks: list[Check] = []

    public_url = clean_base_url(args.public_url)
    admin_url = clean_base_url(args.admin_url)
    api_url = clean_base_url(args.api_url)
    site_url = clean_base_url(args.site_url)

    if public_url:
        checks.extend(
            [
                Check(
                    "public website",
                    public_url,
                    expected_text='<div id="root">',
                    required_headers=("Content-Security-Policy", "X-Content-Type-Options"),
                ),
                Check(
                    "public sitemap",
                    urljoin(public_url, "sitemap.xml"),
                    expected_text="<urlset",
                    forbidden_text="/-vs-",
                ),
                Check(
                    "public genuine 404",
                    urljoin(public_url, "codex-smoke-missing-page"),
                    expected_status=404,
                    expected_text='name="robots" content="noindex,follow"',
                ),
            ],
        )
    if admin_url:
        checks.append(
            Check(
                "admin website",
                admin_url,
                expected_text='<div id="root">',
                required_headers=("Content-Security-Policy", "X-Content-Type-Options"),
            ),
        )
    if api_url:
        checks.extend(
            [
                Check(
                    "API liveness",
                    urljoin(api_url, "health/live"),
                    expected_json_status="ok",
                    required_headers=("X-Content-Type-Options", "X-Frame-Options"),
                ),
                Check(
                    "API readiness",
                    urljoin(api_url, "health/ready"),
                    expected_json_status="ok",
                ),
            ],
        )
    if site_url:
        checks.append(Check("deployment preview", site_url, expected_text='<div id="root">'))

    if not checks:
        raise SystemExit("Provide at least one site or API URL to check.")

    for check in checks:
        run_check(
            check,
            attempts=max(1, args.attempts),
            timeout=max(1, args.timeout),
            retry_delay=max(0, args.retry_delay),
        )


if __name__ == "__main__":
    main()
