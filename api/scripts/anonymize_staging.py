#!/usr/bin/env python3
"""Anonymise a restored production clone before a staging app may use it."""

from __future__ import annotations

import argparse
import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.staging_data import (  # noqa: E402
    anonymize_staging_data,
    assert_safe_staging_target,
    database_name,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply anonymisation. Without this flag the command is a dry run.",
    )
    parser.add_argument(
        "--confirm-target",
        default="",
        help="Exact target database name; required with --apply.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    staging_url = os.environ.get("STAGING_DATABASE_URL", "").strip()
    if not staging_url:
        sys.exit("Set STAGING_DATABASE_URL. This script never reads DATABASE_URL.")

    target_name = database_name(staging_url)
    if not args.apply:
        print(f"Dry run only. Target database: {target_name}")
        print(
            "To apply, set STAGING_ADMIN_EMAIL and STAGING_ADMIN_PASSWORD, then run "
            f"with --apply --confirm-target {target_name}",
        )
        return

    admin_email = os.environ.get("STAGING_ADMIN_EMAIL", "").strip()
    admin_password = os.environ.get("STAGING_ADMIN_PASSWORD", "")
    if not admin_email or not admin_password:
        sys.exit("Set STAGING_ADMIN_EMAIL and STAGING_ADMIN_PASSWORD before applying.")

    assert_safe_staging_target(
        staging_url,
        confirmation=args.confirm_target,
        production_database_url=os.environ.get("PRODUCTION_DATABASE_URL"),
    )

    engine = create_engine(staging_url, pool_pre_ping=True)
    with Session(engine) as db:
        summary = anonymize_staging_data(
            db,
            admin_email=admin_email,
            admin_password=admin_password,
        )

    print("Staging clone anonymised successfully.")
    for field, value in summary.__dict__.items():
        print(f"  {field}: {value}")


if __name__ == "__main__":
    main()
