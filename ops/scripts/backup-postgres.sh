#!/bin/sh
set -eu

: "${BACKUP_DATABASE_URL:?Set BACKUP_DATABASE_URL to the database being backed up}"

backup_dir="${NPL_BACKUP_DIR:-./backups}"
mkdir -p "$backup_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/npl-$timestamp.dump"

pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$backup_file" \
  "$BACKUP_DATABASE_URL"

pg_restore --list "$backup_file" >/dev/null

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$backup_file" >"$backup_file.sha256"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$backup_file" >"$backup_file.sha256"
fi

echo "Verified PostgreSQL backup: $backup_file"
