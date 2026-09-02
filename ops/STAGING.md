# NPL staging environment

Staging must be isolated from production. It may use a production-shaped copy of public cricket data, but private operational data must be anonymised before either frontend is connected.

## Required resources

- A separate API application, for example `npl-api-staging`.
- A separate PostgreSQL database with independent credentials.
- A separate Supabase bucket, or at minimum an isolated `staging/` prefix with a staging-only service key.
- Netlify branch deploys for the public and admin sites from the `staging` branch.
- Separate Sentry environments/projects and analytics disabled by default.

Never point a Netlify staging build at the production API. Never use production service-role keys in staging.

## API environment

Configure these on the staging API host:

```text
APP_ENVIRONMENT=staging
APP_RELEASE=<git-commit-sha>
DATABASE_URL=<staging-postgres-url>
SECRET_KEY=<staging-only-random-secret>
CORS_ORIGINS=<public-staging-url>,<admin-staging-url>
PUBLIC_BASE_URL=<staging-api-origin>
SENTRY_DSN=<staging-sentry-dsn>
SENTRY_TRACES_SAMPLE_RATE=0.05
SUPABASE_URL=<staging-storage-url>
SUPABASE_SERVICE_ROLE_KEY=<staging-only-key>
SUPABASE_STORAGE_BUCKET=<staging-bucket>
SUPABASE_STORAGE_PREFIX=uploads
```

Run `alembic upgrade head` as a release command before serving traffic. Confirm `/health/live` and `/health/ready` both return HTTP 200.

## Netlify environment

The repository marks deploy previews as `preview` and branch deploys as `staging`. Configure environment-variable scopes in Netlify:

Public site:

```text
VITE_API_BASE_URL=<staging-api-origin>/api/v1
VITE_APP_RELEASE=<git-commit-sha>
VITE_SENTRY_DSN=<public-staging-sentry-dsn>
VITE_SENTRY_TRACES_SAMPLE_RATE=0.01
```

Admin site:

```text
VITE_API_BASE_URL=<staging-api-origin>/api/v1
VITE_APP_RELEASE=<git-commit-sha>
VITE_SENTRY_DSN=<admin-staging-sentry-dsn>
VITE_SENTRY_TRACES_SAMPLE_RATE=0.01
```

Do not configure the production Plausible domain or Google verification token on preview builds.

## Creating an anonymised dataset

1. Take a verified PostgreSQL backup using `ops/scripts/backup-postgres.sh`.
2. Restore it into the isolated staging database using `ops/scripts/restore-postgres-staging.sh`.
3. Keep the API and both frontends disconnected from the database.
4. From `api/`, inspect the target name:

   ```bash
   STAGING_DATABASE_URL='<staging-url>' .venv/bin/python scripts/anonymize_staging.py
   ```

5. Apply only after checking the printed database name:

   ```bash
   STAGING_DATABASE_URL='<staging-url>' \
   PRODUCTION_DATABASE_URL='<production-url>' \
   STAGING_ADMIN_EMAIL='<staging-admin-email>' \
   STAGING_ADMIN_PASSWORD='<unique-password-at-least-12-characters>' \
   .venv/bin/python scripts/anonymize_staging.py --apply --confirm-target '<database-name>'
   ```

The command disables and anonymises copied users, removes contact/order details, pseudonymises fan vote keys, and redacts audit, disciplinary, scoring-commentary and correction-request text. Public teams, players, articles, fixtures and scorecards remain available for realistic testing. It creates one new staging-only super administrator.

## Promotion rule

Staging never writes back to production. Changes move through Git; data changes move through reviewed migrations or explicit admin workflows. A staging database is disposable and should be rebuilt periodically.
