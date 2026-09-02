# Stage 6 fan engagement and commerce operations

Stage 6 adds public supporter identities without granting access to the admin
identity store. It also adds consent history, team/player follows, authenticated
fan voting, a durable match-notification outbox, merchandise variants, stock,
private order tracking and aggregate reporting.

## Notification schedule

Run this command every 10–15 minutes in staging and production:

```bash
cd api
python scripts/process_fan_notifications.py
```

The command queues idempotent alerts for followed teams at approximately 24
hours and one hour before the fixture, then queues a result alert after the
scorecard is finalised. Re-running it never creates the same supporter/match
alert twice.

`FAN_PUSH_GATEWAY_URL` is a server-to-server adapter endpoint. The request
contains the notification plus registered FCM, APNs or Web Push devices.
`FAN_PUSH_GATEWAY_TOKEN` is sent as a bearer token. If no gateway is configured,
alerts remain available in My NPL's in-app inbox and stay pending for later
delivery. Never expose either gateway setting in a Vite variable.

The production Docker Compose file includes a ten-minute worker. On a managed
host, use its scheduler instead and run the one-shot command above.

## Consent and privacy

- Terms and Privacy Policy acceptance are required at registration.
- Marketing, push and engagement analytics are separate, optional switches.
- Every change is written to `supporter_consent_events`.
- Turning off push disables every registered device immediately.
- Closing an account anonymises its sign-in identity, withdraws optional
  consent and removes device tokens. Order/audit records remain for legitimate
  operational and accounting needs.
- Engagement reporting stores no raw anonymous browser identifier; the API
  HMAC-hashes it with `SECRET_KEY`.

## Voting controls

Fan Player of the Match voting requires an active supporter access token. The
database enforces one vote per supporter and match. A supporter may change that
vote, but cannot create a second vote. Candidate validation remains tied to the
published scorecard and endpoint/CDN rate limiting remains required.

## Commerce controls

- Every variant has its own SKU, status, price and optional stock count.
- Finite stock is locked and reserved transactionally when the order is made.
- Cancelling an order restores reserved stock once.
- Guest orders return a high-entropy tracking token once; only its SHA-256 hash
  is stored. My NPL also lists orders made while signed in.
- Customer-visible status history is separate from internal fulfilment notes.
- Order tracking routes are marked `noindex` and never expose contact or address
  fields.

## Reporting

The admin **Fan engagement** page reports new accounts and opt-ins, follows,
votes, notification delivery/opening, product views, orders, fulfilments and
conversion for a bounded date range. Product views only enter the first-party
report when the supporter has opted in to engagement analytics.

## Release activation checklist

- [ ] Apply Alembic revision `20260903_0041` in staging.
- [ ] Test registration, login, preference withdrawal and account closure.
- [ ] Configure a staging push gateway and non-production APNs/FCM projects.
- [ ] Run the worker twice and prove reminder/result idempotency.
- [ ] Test a device-token rejection without logging or exposing the token.
- [ ] Create one finite-stock variant and test purchase/cancellation stock flow.
- [ ] Test guest tracking with a valid and invalid token.
- [ ] Confirm public vote POST is rejected when signed out.
- [ ] Confirm a supporter token is rejected by `/auth/me` and every admin route.
- [ ] Review the Privacy Policy, Terms, supporter and account-deletion content
  before enabling the feature in production.
