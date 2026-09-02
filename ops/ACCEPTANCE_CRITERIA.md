# Release acceptance criteria

These criteria are the shared release contract for the public site, admin application and API. CI-enforced checks are blockers now. Tracked targets become blockers when the corresponding improvement stage is completed.

## CI-enforced baseline

- Public and admin dependency installation completes from lockfiles.
- Public and admin production dependencies have no known high or critical npm advisories.
- Public and admin ESLint checks pass.
- Public and admin production builds pass.
- API Ruff correctness checks and all Pytest tests pass.
- Alembic upgrades an empty PostgreSQL database to `head`.
- Alembic reports no ungenerated model changes.
- Built public and admin applications pass local HTML smoke checks.
- A successful Netlify deployment preview passes the remote smoke check.

## Performance targets

Measure real-user p75 separately for mobile and desktop:

- Largest Contentful Paint: no more than 2.5 seconds.
- Interaction to Next Paint: no more than 200 milliseconds.
- Cumulative Layout Shift: no more than 0.1.
- Public homepage first-load transfer budget: 2 MB excluding intentionally played video.
- Compressed first-route JavaScript budget: 250 KB.
- Public/API read requests: p95 under 1 second outside platform cold starts.

CI records builds immediately. Core Web Vitals and transfer budgets become release gates after the performance stage establishes representative staging data.

## Accessibility targets

- WCAG 2.2 AA for public and admin workflows.
- No critical or serious automated accessibility violations on the homepage, match page, scorecard, admin login and scoring workspace.
- Lighthouse Accessibility score at least 95 on those representative pages.
- Complete keyboard operation with visible focus and no focus traps.
- Meaningful headings/landmarks and announced form errors/status messages.
- Usable at 200% browser zoom and 320 CSS-pixel reflow; scoring is additionally verified in tablet landscape.
- Reduced-motion preference stops non-essential motion.

Automated scores supplement rather than replace manual keyboard, VoiceOver and TalkBack testing.

## Match-day reliability targets

- Every ball submission carries an idempotency identifier; a retry cannot duplicate the event.
- Simultaneous or out-of-order writes are rejected or reconciled without corrupting sequence numbers.
- A scorer sees whether a delivery is saved remotely, queued locally or in conflict.
- The scorer can resume after a network loss without losing acknowledged or queued deliveries.
- Automated reconciliation passes for team totals, extras, legal balls, wickets, batter balls and bowler figures.
- Critical scoring end-to-end scenarios pass twice: once connected and once with an interrupted request.
- API availability target during scheduled match windows: 99.9% monthly.
- API readiness and website uptime checks pass from an external runner.

## Release evidence

Every production release must link to:

- CI run and deployment preview.
- Migration and rollback notes.
- Smoke-check output.
- Known-risk/exception approval.
- For scoring changes, the scorer scenario test report.
- For schema or bulk data changes, the verified backup identifier.
