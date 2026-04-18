#!/bin/sh
set -e
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  cd /app && alembic upgrade head
fi
if [ -n "${SEED_ADMIN_EMAIL:-}" ] && [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  cd /app && python scripts/seed_dev_user.py
fi
exec "$@"
