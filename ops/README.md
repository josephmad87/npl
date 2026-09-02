# NPL operations baseline

This directory contains the Stage 0 release and operating controls.

- `STAGING.md` — isolated staging architecture and anonymised-clone workflow.
- `BACKUP_AND_RESTORE.md` — backup policy and quarterly restore drill.
- `RESTORE_DRILLS.md` — dated evidence from completed restoration tests.
- `ACCEPTANCE_CRITERIA.md` — performance, accessibility and match-day reliability gates.
- `SECURITY.md` — production secrets, browser controls, throttling and upload rules.
- `ACCESSIBILITY_STAGE4.md` — WCAG 2.2 AA implementation evidence and keyboard, screen-reader, zoom and reflow test matrix.
- `SEO_CONTENT_STAGE5.md` — canonical URL, redirect, structured-data, sitemap and editorial publishing rules.
- `FAN_ENGAGEMENT_STAGE6.md` — supporter consent, notification scheduling, voting, commerce and reporting controls.
- `OPERATIONS_CHECKLIST.md` — account-level activation items that cannot be completed from source code.
- `smoke_check.py` — read-only public, admin and API health checks.
- `scripts/` — guarded PostgreSQL backup and staging-restore helpers.

## Local smoke examples

```bash
python3 ops/smoke_check.py \
  --public-url http://127.0.0.1:5174 \
  --admin-url http://127.0.0.1:5173 \
  --api-url http://127.0.0.1:8000
```

## CI workflows

- `ci.yml` validates both frontends and the API on pull requests and pushes to `main` or `staging`.
- `deployment-preview-smoke.yml` checks successful deployment previews and supports manual URLs.
- `uptime.yml` checks production every 15 minutes after the workflow is merged into the default branch.

The scheduled workflow is not a full external observability service: configure Sentry alerts and an independent uptime provider for coverage when GitHub Actions itself is unavailable.
