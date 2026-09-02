# Operations activation checklist

The code integration is complete when local checks pass. The controls are operational only after the account-level items below are configured.

## Staging

- [ ] Create an isolated staging API application and PostgreSQL database.
- [ ] Create isolated staging media storage and service credentials.
- [ ] Enable Netlify branch deploys for `staging` on both sites.
- [ ] Scope staging API URLs and monitoring DSNs to the staging/preview contexts.
- [ ] Restore and anonymise a dataset; record the date and operator.
- [ ] Confirm staging cannot send production notifications or analytics events.

## Monitoring and analytics

- [ ] Create separate Sentry projects/environments for API, public and admin.
- [ ] Configure DSNs and a low initial trace sample rate.
- [ ] Configure Sentry alerts for new errors, error spikes and API latency.
- [ ] Create a Plausible site for `npl.co.zw` and set the public-site variables.
- [ ] Verify page views after a production release without collecting form values or PII.
- [ ] Set GitHub repository variables `NPL_PUBLIC_URL`, `NPL_ADMIN_URL` and `NPL_API_URL` if defaults change.
- [ ] Choose an alert destination for failed scheduled uptime workflows.

## Search Console

- [ ] Verify the domain property, preferably using the DNS TXT method.
- [ ] If using the HTML tag method, set `VITE_GOOGLE_SITE_VERIFICATION` only for production.
- [ ] Submit `https://npl.co.zw/sitemap.xml`.
- [ ] Add Bing Webmaster Tools and import the verified Search Console property if desired.
- [ ] Record responsible owner accounts that are not tied to one employee.

## Backup and recovery

- [ ] Confirm provider daily backup retention and point-in-time recovery.
- [ ] Confirm media backup/versioning.
- [ ] Run the first isolated restoration drill.
- [ ] Record measured RPO/RTO and verify against the targets.
- [ ] Schedule the next quarterly restore drill.

## Release process

- [ ] Protect the default branch and require the CI workflow.
- [ ] Require at least one review for migrations, scoring or authentication changes.
- [ ] Require a successful deployment preview smoke check before production.
- [ ] Document the person authorised to approve a production deployment.

## Security activation

- [ ] Set `APP_ENVIRONMENT=production` and confirm the API starts with validated production-only secrets.
- [ ] Confirm `CORS_ORIGINS` lists only the public/admin production origins over HTTPS.
- [ ] Confirm CSP/security response headers with an external header scanner after release.
- [ ] Configure CDN/platform rate limits in front of the process-local application limiter.
- [ ] Confirm the storage service-role key is API-only and rotate any key ever exposed to a browser.
- [ ] Submit the corrected sitemap and validate that the former 253 `/-vs-` URLs return permanent redirects.

## Fan engagement and commerce

- [ ] Apply migration `20260903_0041` to staging and complete `FAN_ENGAGEMENT_STAGE6.md`.
- [ ] Configure isolated staging and production push gateways and mobile push credentials.
- [ ] Schedule `python scripts/process_fan_notifications.py` every 10–15 minutes.
- [ ] Confirm Privacy Policy and Terms cover supporter accounts, consent, notifications, voting and orders.
- [ ] Assign an order-fulfilment owner and define customer response, dispatch and cancellation targets.
