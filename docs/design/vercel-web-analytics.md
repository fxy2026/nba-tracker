# Vercel Web Analytics migration

Prepared 2026-10-04 against `master` commit
`5437375272fbe4ee2e5971d053fad5807480f2f3` (tree
`f185950a25c4926099613f77cab51681e4482805`). This is the implementation record,
not evidence of production deployment or dashboard enablement.

## Current provider and installation

- The sole mounted page-view provider is official `@vercel/analytics/next`, pinned
  to npm `@vercel/analytics` **2.0.1** with its registry integrity in package-lock.
- `NODE_ENV=production` **and** `VERCEL_ENV=production` must both be present.
  Ordinary local builds/starts, tests, development and Vercel preview deployments
  do not mount it. No new environment variables or credentials are required.
- The SDK owns initial and Next App Router navigation tracking. No custom events,
  manual pageview calls, paid Drains, new access tokens, or alternate intake are
  added. Leave provider endpoint configuration to the official SDK/platform;
  v2 can use randomized paths, so do not assume only `/_vercel/insights/*` exists.
- Enable Web Analytics in the owner's Vercel project dashboard before deploying
  this release. An SDK build alone does not prove collection is enabled.
- Admin links to the owner-verified project:
  https://vercel.com/fdgs-projects-f2130961/nba-tracker . Open its Analytics tab.
  No private dashboard access or Vercel analytics API was used for this migration.
  Vercel now documents a read API; this release does not configure a token or
  embed those metrics. Dashboard access still requires the owner's account.

## Privacy and coverage

- The client wrapper does not load Analytics on admin/API/unknown routes, when
  DNT or GPC is enabled, or when a path-bearing/query-bearing incoming referrer
  cannot be safely passed through. The callback rechecks these conditions for
  every event, including after SPA navigation and privacy preference changes.
- Only pageviews are accepted by `beforeSend`. A finite public route allowlist
  is reused; dynamic page IDs become existing route categories. Page URL query
  strings and fragments are removed. Unknown URLs, another origin, URL userinfo,
  custom events and malformed URLs are dropped. Search terms are not included.
- The owner approved limiting outgoing referrers to origins. The existing
  `Referrer-Policy` response header is changed to **strict-origin**, retaining
  HTTPS-to-HTTP downgrade protection. This reduces referring-page detail for
  analytics and other outbound requests/links; it applies site-wide.
- The documented `beforeSend` event exposes only type and URL, not referrer.
  Incoming `document.referrer` is controlled by the previous page's policy.
  If it contains a non-root path, query, fragment or userinfo, this integration
  skips loading/sending rather than claiming to redact a field it cannot edit.
  Thus some legitimate visits may be omitted. Once loaded, the provider script
  remains managed by its SDK; this is not a claim about blocking all hosting logs.
- Vercel processes request data and can report geography, browser, OS and device
  type. Its visitor estimate uses a request-derived hash reset daily, without
  analytics cookies. It is not the former consent-based daily-browser metric or
  a precise person count. No blanket claim of no IP processing, no referrer
  processing, legal compliance, or guaranteed deletion is made.
- Current Hobby documentation lists 50,000 monthly events across the team's
  projects and a one-month reporting window. Exceeding its quota pauses collection;
  no paid upgrade or overage commitment is introduced. Reporting availability
  is not a deletion guarantee. Blockers, privacy guards and quota limits can
  reduce coverage. Recheck provider documentation if plan details change.

## Retired collection and preserved history

- The root layout no longer mounts Cloudflare or the custom Supabase collector.
  Their former wrapper components also return null if imported accidentally.
- `/api/analytics/pageview` always returns private/no-store 204. It does not read
  the request body, environment settings, credentials, or database module, and
  never calls a provider. Old cached clients cannot write through that route
  even while `VISITOR_ANALYTICS_ENABLED=true` remains in the deployment.
- Historical Supabase report code and its password-gated GET endpoint remain for
  read-only history. The admin UI loads that report only on an explicit click,
  identifies it as stopped legacy data, and never labels it as Vercel metrics.
  No background polling or automatic Supabase report request is added.
- Previous owner setup activated the dedicated collector and a normal acceptance
  visit produced one stored pageview before this migration. That observation
  supersedes the earlier database-only verification snapshot. It is not a claim
  that this new release has been deployed or that Vercel received any event.
- No database/project/key deletion, schema/RLS/retention change, migration rerun,
  environment change, or live Supabase call is part of this release. Existing
  cleanup targets remain about 48 hours for event IDs and 90 days for aggregates,
  dependent on successful jobs. Logs/backups have independent retention.
- Exact applied migration remains
  `supabase/migrations/20261004103147_create_private_visitor_analytics.sql`,
  SHA-256 `e45d19f6ea5062e7f3ef4443a0c2c7bd29f5db1ac2d993dc0896799abad0ef23`.
  The [prior deployment record](visitor-analytics-deployment.md) and proposed SQL
  are preserved as history. NBA data and replay data/configuration are unchanged.
- Local WebVitals diagnostics remain unchanged: latest 50 path-bearing metrics
  in browser storage/console, no backend upload from that module.

## Release verification

Run offline lint, typecheck, all tests with one worker, webpack production build,
and post-build typecheck with outbound connections blocked and the existing font
fixture. Do not enable telemetry or run a live provider acceptance event as part
of local checks. Browser and exact production deployment verification are
separate release gates; unit tests are not proof of hosted analytics delivery.

After authorized publication: verify the exact commit/deployment, confirm the
owner's dashboard enablement, inspect one real authorized production navigation
and its sanitized payload, verify admin and DNT/GPC suppression, query/hash
redaction, no Cloudflare beacon/custom POST writes, and bilingual privacy/admin
presentation. Do not log credentials or create new tokens for acceptance.

## Official references (checked 2026-10-04)

- https://vercel.com/docs/analytics/quickstart
- https://vercel.com/docs/analytics/package
- https://vercel.com/docs/analytics/using-web-analytics
- https://vercel.com/docs/analytics/privacy-policy
- https://vercel.com/docs/analytics/limits-and-pricing
- https://vercel.com/docs/analytics/web-analytics-api
- https://www.npmjs.com/package/@vercel/analytics
