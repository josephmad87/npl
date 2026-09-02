# Stage 5 SEO and content architecture

This document defines the public URL, metadata and editorial rules for NPL Zimbabwe.

## Canonical public URLs

- News: `/news/{article-slug}`
- Teams: `/teams/{team-slug}`
- Players: `/players/{player-slug}`
- Competitions: `/leagues/{league-slug}`
- Seasons: `/leagues/{league-slug}/seasons/{season-slug}`
- Matches: `/leagues/{league-slug}/seasons/{season-slug}/matches/{id}/{home}-vs-{away}`
- Merchandise: `/merchandise/{product-name}-{id}`
- Team merchandise: `/merchandise/teams/{team-slug}`

New editable slugs must contain lowercase letters, numbers and single hyphens only.
Changing a team, player, league, season or article slug records the old path in
`seo_redirects`. The edge layer resolves that record with a permanent `301` and
collapses redirect chains to the current path.

Static legacy aliases such as `/about`, `/contact`, `/shop`, `/live-scores` and
`/ladies/...` are also permanently redirected. Numeric and malformed match URLs are
resolved from the current match data and redirected to the full canonical match URL.

## Crawlable delivery

The Netlify edge function provides these elements before client JavaScript runs:

- a unique title, description, canonical URL, robots directive and social cards;
- `WebSite`, `WebPage`, `BreadcrumbList` and entity-specific JSON-LD;
- a crawlable heading, summary, breadcrumb trail and related internal links;
- a genuine `404` response and `noindex,follow` for missing public resources; and
- `sitemap.xml` entries with `lastmod` whenever the source record has a reliable date.

Entity schemas are `NewsArticle`, `SportsEvent`, `SportsTeam`, `Person`,
`SportsOrganization`, `CollectionPage` and `Product`. The React pages repeat the
canonical metadata and visible breadcrumbs for client-side navigation.

## Managed information pages

The super-admin page editor owns these public routes:

- `/privacy`
- `/terms`
- `/support`
- `/account-deletion`
- `/competition`
- `/safeguarding`
- `/scorecard-corrections`
- `/supporters`

Competition summaries must not replace published regulations or official decisions.
Safeguarding copy must identify urgent reporting routes without inviting sensitive
evidence to be posted publicly. Correction guidance must stay aligned with the live
scoring lock and approval workflow.

## Article publication checklist

Before publishing, editors should provide:

1. a clear human-readable title and generated lowercase slug;
2. a useful listing excerpt;
3. a featured image with meaningful context;
4. an SEO title of about 50–60 characters;
5. a specific meta description of about 140–160 characters;
6. focused tags and the correct competition category; and
7. relevant internal links to fixtures, results, competition pages, teams or players.

Avoid duplicating titles across articles, changing a live slug without a reason,
keyword stuffing, or publishing a match claim before it is official.

## Release validation

Before release:

1. run public edge tests, frontend lint/build, admin lint/build and API tests;
2. apply the database migration in staging;
3. inspect a news article, team, player, match, season, product and information page
   with JavaScript disabled;
4. verify one historical slug returns one `301` to its current canonical URL;
5. validate representative JSON-LD with a structured-data testing tool;
6. submit the sitemap in Search Console and monitor coverage and redirect reports; and
7. check that staging remains `noindex` and production does not expose draft content.
