#!/usr/bin/env python3
"""Create the first admin user (requires DATABASE_URL / DB and applied migrations)."""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("email")
    p.add_argument("password")
    p.add_argument("--role", default="super_admin")
    args = p.parse_args()
    if args.role not in ("super_admin", "competition_manager", "content_editor", "read_only_admin"):
        sys.exit("Invalid role")
    db: Session = SessionLocal()
    try:
        if db.scalar(select(User).where(User.email == args.email)):
            print("User already exists")
            sys.exit(1)
        u = User(
            email=args.email,
            hashed_password=hash_password(args.password),
            full_name=None,
            role=args.role,
            is_active=True,
        )
        db.add(u)
        db.commit()
        print(f"Created user id={u.id} email={u.email} role={u.role}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
