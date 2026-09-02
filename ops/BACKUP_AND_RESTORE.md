# Backup and restoration runbook

This runbook defines the minimum evidence needed to say backups are working. Enabling a provider backup without completing a restoration drill is not sufficient.

## Recovery objectives

| Data | Target RPO | Target RTO |
| --- | ---: | ---: |
| PostgreSQL match and CMS data | 5 minutes during match windows; 24 hours otherwise | 4 hours |
| Uploaded media | 24 hours | 8 hours |
| Application code and configuration | Every merged commit | 2 hours |

RPO is the maximum acceptable data loss. RTO is the time allowed to restore service.

## Database backups

1. Enable provider-managed daily backups and point-in-time recovery where the plan supports it.
2. Before a migration or large statistical rebuild, create an additional logical backup:

   ```bash
   BACKUP_DATABASE_URL='<database-url>' \
   NPL_BACKUP_DIR='<encrypted-backup-directory>' \
   ./ops/scripts/backup-postgres.sh
   ```

3. Store backups encrypted, outside the production host, with access restricted to authorised super administrators.
4. Retain daily backups for 35 days and monthly backups for 12 months unless the privacy policy requires earlier removal.
5. Record the filename, checksum, database, operator and retention expiry in the restoration log.

## Media backups

- Supabase: enable bucket versioning/backups where available and copy objects to an independent encrypted location daily.
- Docker volume: snapshot `npl_api_media` and test restoring it to an isolated volume.
- Verify that database media URLs and restored object paths agree.

## Quarterly restoration drill

1. Create an empty, isolated staging database.
2. Verify the dump with `pg_restore --list`.
3. Restore with `ops/scripts/restore-postgres-staging.sh`.
4. Run `alembic upgrade head`.
5. Run `api/scripts/anonymize_staging.py` before exposing the database.
6. Start the staging API and run `ops/smoke_check.py`.
7. Check a completed scorecard, current standings, an article image, a product image and an admin login.
8. Record actual RPO/RTO, missing objects, errors and corrective actions.

## Production restoration

A production restore requires an incident owner, a selected recovery point, a fresh pre-restore snapshot and approval from the authorised system owner. Restore into a new database first, validate it, then change the application connection. Do not overwrite the only production database in place.

## Current confirmation status

The repository now contains repeatable backup, verification and staging-restore procedures. A synthetic local PostgreSQL 16 drill passed on 2026-09-02; see `ops/RESTORE_DRILLS.md`. Provider-managed backup/PITR settings and a production-sized provider restoration still cannot be confirmed from source code. Complete the activation checklist in `ops/OPERATIONS_CHECKLIST.md` before marking this control operational.
