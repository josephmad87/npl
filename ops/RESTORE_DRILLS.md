# Restoration drill log

## 2026-09-02 — local PostgreSQL 16 baseline

- Scope: synthetic, empty NPL schema only; no production or personal data.
- Backup: `ops/scripts/backup-postgres.sh` produced a custom-format dump, validated it with `pg_restore --list`, and wrote a SHA-256 checksum.
- Restore: `ops/scripts/restore-postgres-staging.sh` restored the dump into a separate empty database.
- Verification: the restored database reported Alembic revision `20260902_0038 (head)`.
- Migration verification: a separate empty database upgraded through every revision and `alembic check` reported no new upgrade operations.
- Anonymisation verification: `api/scripts/anonymize_staging.py` completed against the migrated test database and created the isolated staging administrator.
- Result: pass.

This confirms the repository procedures work locally. It does not confirm the production provider's retention, point-in-time recovery, encrypted off-site storage, media backup, or production-sized restoration time. Record those during the first isolated provider restoration drill.
