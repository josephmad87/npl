#!/usr/bin/env python3
"""Create a default super_admin when the database has no users (local/dev only).

Credentials come from the environment (see api/.env.example):

- SEED_ADMIN_EMAIL — default: dev@npl.local
- SEED_ADMIN_PASSWORD — default: changeme (must be >= 8 characters)

Run after migrations: PYTHONPATH=. python scripts/seed_dev.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User

DEFAULT_EMAIL = "dev@npl.local"
DEFAULT_PASSWORD = "changeme"


def main() -> None:
    email = os.environ.get("SEED_ADMIN_EMAIL", DEFAULT_EMAIL).strip()
    password = os.environ.get("SEED_ADMIN_PASSWORD", DEFAULT_PASSWORD)
    if len(password) < 8:
        sys.exit("SEED_ADMIN_PASSWORD must be at least 8 characters")

    db: Session = SessionLocal()
    try:
        if db.scalar(select(User.id).limit(1)) is not None:
            print("Seed skipped: at least one user already exists.")
            return
        u = User(
            email=email,
            hashed_password=hash_password(password),
            full_name="Dev seed admin",
            role="super_admin",
            is_active=True,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        used_default_pw = os.environ.get("SEED_ADMIN_PASSWORD") is None
        print(f"Seeded super_admin id={u.id} email={u.email}")
        if used_default_pw:
            print(
                "WARNING: default password in use. Set SEED_ADMIN_PASSWORD before first run in any shared or deployed environment.",
            )
            print(f"  Login password: {DEFAULT_PASSWORD}")
        else:
            print("  Password: (value from SEED_ADMIN_PASSWORD; not printed)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
