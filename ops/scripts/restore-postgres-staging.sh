#!/bin/sh
set -eu

: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to an empty staging database}"
: "${NPL_BACKUP_FILE:?Set NPL_BACKUP_FILE to a verified PostgreSQL custom-format dump}"

if [ "${NPL_CONFIRM_RESTORE:-}" != "RESTORE_STAGING" ]; then
  echo "Refusing to restore. Set NPL_CONFIRM_RESTORE=RESTORE_STAGING after checking the target URL." >&2
  exit 1
fi

pg_restore --list "$NPL_BACKUP_FILE" >/dev/null
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="$RESTORE_DATABASE_URL" \
  "$NPL_BACKUP_FILE"

echo "Restore completed. Run Alembic and the staging anonymiser before attaching an application."
