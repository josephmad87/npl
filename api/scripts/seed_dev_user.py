#!/usr/bin/env python3
"""Ensure a default super_admin exists (idempotent). Intended for local Docker / development."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User


def main() -> None:
    if os.environ.get("SKIP_DEV_SEED", "").strip() in ("1", "true", "yes"):
        print("SKIP_DEV_SEED set; not seeding")
        return

    email = os.environ.get("SEED_ADMIN_EMAIL", "admin@npl.local").strip()
    password = os.environ.get("SEED_ADMIN_PASSWORD", "changeme")
    if not email or not password:
        print("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be non-empty", file=sys.stderr)
        sys.exit(1)

    db: Session = SessionLocal()
    try:
        if db.scalar(select(User).where(User.email == email)) is not None:
            print(f"Seed skipped: user already exists ({email})")
            return
        u = User(
            email=email,
            hashed_password=hash_password(password),
            full_name="Seeded admin",
            role="super_admin",
            is_active=True,
        )
        db.add(u)
        db.commit()
        print(f"Seeded super_admin id={u.id} email={u.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
