# Application security controls

## Deployed API configuration

Set `APP_ENVIRONMENT=production` in production and `APP_ENVIRONMENT=staging` in staging. The API now refuses to start in either environment when:

- `SECRET_KEY` is a placeholder or shorter than 32 characters;
- `DATABASE_URL` is the local/default database;
- `CORS_ORIGINS` is empty or contains `*`;
- a production browser origin or `PUBLIC_BASE_URL` is not HTTPS; or
- only part of the Supabase Storage configuration is present.

Generate separate secrets for staging and production. Never copy the production JWT or Supabase service-role key into Netlify browser variables.

## HTML and browser controls

Rich article and legal-page HTML is allow-list sanitised at API input/output and again before browser rendering. Netlify responses enforce CSP, frame denial, MIME sniffing protection, a permissions policy, a strict referrer policy and HSTS. API media responses use a sandboxed CSP so a legacy uploaded active document cannot run in the API origin.

## Authentication and anonymous forms

All `/admin` API routes continue to require JWT authentication and role checks. Login, token refresh, contact, merchandise order and fan-vote POST requests are rate-limited before request-body parsing. The repository limiter is deliberately dependency-free and process-local; retain platform/CDN rate limiting as the outer layer before scaling the API to multiple workers or instances.

Current per-client limits:

- login: 20 requests per 15 minutes;
- refresh: 120 requests per 15 minutes;
- contact: 5 requests per hour;
- merchandise orders: 10 requests per hour; and
- fan votes: 30 requests per minute.

## Uploads

Upload types are determined from file contents, not the supplied name. Images are limited to valid JPEG, PNG, GIF or WebP files, 15 MB, 12,000 pixels on either axis and 40 megapixels. SVG and other active formats are rejected. Gallery video signatures are checked and capped at 120 MB. Provider error bodies are not returned to users.

Keep the Supabase media bucket restricted to uploads made by the API service role. Browser clients must never receive the service-role key.
