# Scoring reliability runbook

The live ball ledger (`match_ball_events`) is the authoritative match record. The
scorecard, player figures and match result are derived from it.

## Concurrent-write protection

Every scoring mutation acquires a database row lock on the match and requires:

- `X-Scoring-Session`: the active 90-second scorer lease token;
- `X-Score-Version`: the version returned by the latest live-score response.

A stale version returns HTTP `409`. A missing precondition returns HTTP `428`.
Retried ball submissions are safe because `client_event_id` is checked before
the version precondition and is unique within a match.

## Session ownership and takeover

The scoring screen renews its lease every 30 seconds. A second browser tab or
device is read-only until the operator chooses **Take over scoring** and records
a reason. Acquisitions, releases and takeovers are written to the audit log.

## Offline scoring

If connectivity is lost, deliveries are appended to a persistent browser
outbox and applied optimistically to the local innings. On reconnection the
client:

1. loads the authoritative server version;
2. replays queued deliveries in recorded order;
3. advances the expected version after each acknowledgement;
4. retains the unsent tail if any delivery fails;
5. reloads the authoritative score after the queue is empty.

Do not clear browser site data while deliveries remain queued.

## Reconciliation

Every accepted scoring mutation rebuilds the materialized scorecard in the same
database transaction. The live response exposes the ledger and reconciled
versions. If they differ, the scoring screen automatically calls:

`POST /api/v1/admin/matches/{match_id}/live/reconcile`

The endpoint rebuilds scorecard/player rows from the ledger and records an audit
entry. For a completed match it also rebuilds the official result, career totals
and dependent playoff placement.

## Match-day recovery

1. Check the connectivity banner and queued-delivery count.
2. Restore connectivity and use **Sync queued** if automatic replay has stopped.
3. If another device owns the match, verify with that scorer before takeover.
4. Never re-enter a queued ball manually; replay uses its idempotency ID.
5. Finalise only after the queued count reaches zero and reconciliation is in sync.
