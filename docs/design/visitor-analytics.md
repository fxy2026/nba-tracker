# Visitor analytics: implementation and activation checklist

> Historical Supabase design/deployment record, superseded on 2026-10-04 by
> [the Vercel Web Analytics migration](vercel-web-analytics.md). Do not follow the
> old activation checklist. The public collector and both former browser
> collectors are now inert even if legacy environment flags remain enabled.
> Applied SQL, historical data, retention jobs, credentials and RLS are unchanged.
> The text below records its original verification point, not current activation.

Status: analytics is disabled by default. The dedicated database migration has
been applied; its exact SQL and verified boundaries are recorded in
[deployment status](visitor-analytics-deployment.md). The original
`visitor-analytics-proposed.sql` remains a historical proposal, not the applied
record. SQL verification does not establish HTTP RPC connectivity or collection
activation. Keep `VISITOR_ANALYTICS_ENABLED` unset until the checks below pass.

## Small scope and metrics

- Reuse the Next App Router with a same-origin POST collector and a password-gated
  GET report. All analytics data lives in a new private PostgreSQL schema.
- Never modify `replay_links`, its policies, or the existing replay URLs. The old
  `/api/admin/stats` remains a separate operational endpoint. Its figures are not
  site traffic. An existing Cloudflare beacon is separate, not a data source for
  these reports; past visitor data cannot be reconstructed from it here.
- Default: page views, finite route templates, categorical source and screen-size
  breakdowns. No persistent browser token, analytics cookie, IP, IP hash, raw user
  agent, geo, full referrer/hostname, URL query, hash, searches, event timestamp,
  account ID, or individual browsing trail is stored by this feature.
- The browser reads the referrer only to map to a finite category locally; only
  that category is sent. Screen size is mobile/tablet/desktop/unknown, no exact
  dimensions or actual OS/device claims. Dynamic IDs become route templates.
- A new random UUIDv4 is a retry key per page view, not an identity. The client
  should count initial visible render and completed SPA pathname changes, not
  prefetches, parameter-only changes, or dev/preview/admin/offline routes. Reuse
  the same event UUID if bounded retries are later introduced; the current client
  makes one best-effort attempt and never replays an offline backlog.
- Any later daily identifier adapter requires explicit, affirmative analytics
  consent. It may generate a random UUIDv4 in first-party localStorage, share it
  across tabs, and rotate it each Asia/Shanghai date; no stable seed/fingerprint.
  No adapter or consent UI is implemented here. Stale identity dates become
  anonymous PV. Withdrawal must stop identity collection and remove its storage.
- `visitors` means consenting daily browsers, not people or the whole audience.
  No identified PV means `visitors: null`. `identifiedPageViews / pageViews` is
  coverage; blocked storage/ad blockers can undercount. Daily counts sum to
  browser-days, not a deduplicated 7/30-day audience. Average uses `period.observedDays`, starting on the first collected day;
  pre-collection days are omitted from the series, never filled with zeros.
  Disclose `collectedSince` and partially observed first/current days. No sessions/bounce/
  duration claims. A genuinely queried empty database yields PV zero and UV null;
  unconfigured/unavailable yields null figures, never fabricated zero traffic.
- Date boundaries and reports use Asia/Shanghai (UTC+8). Server/database clocks
  determine day. Clients cannot backdate or choose a reporting timezone.

## Durable design and failure behavior

`visitor_analytics_collect` is one database transaction. Mutation paths acquire
the singleton state lock before the per-day row lock to keep pruning and ingestion
in the same lock order. The locks serialize the budget, dedupe, daily browser insertion, and all aggregate
increments. Reusing an event UUID (even across midnight while retained) cannot
increment counters twice. Failures roll back the entire function. If a network
timeout occurs after commit, the same event ID can be retried without double
counting. The API awaits the RPC; it does not rely on a detached promise.

The five private tables are singleton state, daily totals, dimensions, one-off
event retry keys, and daily consented browser hashes. No key joins events to paths
or browser hashes. Daily hashes use SHA-256 of a cryptographically random UUID
and the daily scope, not sensitive inputs. This is pseudonymous data if enabled,
not a legal claim of anonymity. Raw IDs and identity hash rows are kept only for
today/yesterday. Aggregates are kept 90 days. Ingest opportunistically cleans up,
but verified daily DB cleanup is REQUIRED to enforce retention while idle.

The store has a hard 50,000 accepted-PV daily budget and 1,000 identified-PV daily
per-token budget. A finite route/category set bounds dimension cardinality.
Reports expose `limited` if rejected collection makes figures incomplete.
These limits bound stored data, NOT total requests, platform usage, or cost:
spam can still invoke RPC before the database rejects it. Same-origin checks stop
ordinary cross-site browser submissions, not forged requests from bots.

## Configuration, auth, and privacy

Server-only settings:

- `VISITOR_ANALYTICS_ENABLED=true`: explicit activation after checks, absent off.
- `VISITOR_ANALYTICS_ORIGIN=https://exact-approved-production-domain`: no slash,
  port, query, or wildcard; one production origin, never derived from a Host header.
- `ANALYTICS_SUPABASE_URL`: URL of the separately approved analytics project.
  Only hosted `https://<project>.supabase.co` is accepted, optionally ending in
  `/`; paths, credentials, custom ports, queries and fragments are rejected.
- `ANALYTICS_SUPABASE_SECRET_KEY`: preferred server-only modern `sb_secret_...`
  key for that analytics project. It is sent in `apikey` only, with no
  `Authorization` header: modern keys are opaque, not JWTs.
- `ANALYTICS_SUPABASE_SERVICE_ROLE_KEY`: optional legacy compatibility setting,
  used only if the dedicated modern setting is absent or empty. It must be a
  JWT-shaped value whose payload has `role: "service_role"`; it is sent in both
  `apikey` and `Authorization: Bearer`. Prefer the modern key for a new project.
  A nonempty but invalid modern setting disables analytics instead of silently
  falling back. Publishable, anon, user-session and custom-role keys are not
  supported privileged credentials. Local format/role checks do not verify a
  key's signature, validity or permissions; Supabase performs that verification.
- Both credential settings must remain server-only. Never use a `NEXT_PUBLIC_`
  name, send keys to client code, log them, or put them in source control.
- `ADMIN_PASSWORD`: existing password, remains in `x-admin-password` for private
  admin reads. No auth/session credential is created by this implementation.

There is deliberately no fallback to `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, or any public key.
The generic public URL/anon-key settings belong to the separate legacy replay
helper and must not be repointed to the analytics project. A hosting integration
may synchronize a broad generic credential bundle; do not enable that sync if
it would overwrite existing settings. Configure only the dedicated analytics
settings through the owner's secure setup after checking the target project.
This code neither changes replay configuration nor creates credentials.

Collection requires NODE_ENV production; if VERCEL_ENV exists it must also be
production. Client enablement is only a safe boolean and exact public origin.
Config completeness is NOT proof the database works. Failure/missing RPC is
unavailable. Provider calls are `no-store`, redirect-error, 2.5-second timeout;
errors are generic and never include bodies, keys, provider payloads, or IPs.

The collector accepts only JSON, a streamed maximum of 2 KiB, UUIDv4 retry IDs,
known body keys, same Origin and same-origin Fetch Metadata when provided. No
CORS opt-in. DNT/GPC opt-outs are honored. All responses are private/no-store.
Admin auth is checked before config, request validation, or database work;
password hashes are timing-safe compared. Reads expose only aggregate DTOs.

SQL functions are SECURITY INVOKER with an empty search path and fully-qualified
tables, executable only by service_role. Their RLS-protected private schema has
no anon/authenticated/public table or function grants and must remain outside
PostgREST's exposed schemas. There is no anonymous browser-to-Supabase path.
Both supported key types resolve to service_role and bypass RLS; server secrecy
is mandatory. A dedicated variable name does not scope the key's database
permissions. Its project-wide authority is why setup is an explicit approved
security step.
A scoped database role would be preferable if already supported, but is not
created, guessed, or silently substituted here.

## Mandatory activation checklist

Completed database work and still-unverified items are separated in
[deployment status](visitor-analytics-deployment.md). This checklist is not a
claim that collection is active or that every prerequisite has passed.

1. Select the owner's separately approved new free analytics project; inspect
   its plan, usage, schemas and actual migration workflow. Do not assume old
   credentials work or reuse/repoint the legacy replay project. Keep legacy
   replay storage and its generic environment settings intact.
2. Preserve the exact applied migration and its returned history version through
   the real project workflow. The original `visitor-analytics-proposed.sql` is
   retained for design history; do not run it over the applied schema. Further
   schema/table/function access changes require a new approved migration.
3. Apply and verify on a disposable/local DB first: duplicate/concurrent events,
   rollback, quotas, midnight, bounds, day sums and retention. Then verify anon
   and authenticated roles cannot SELECT tables or execute either public RPC;
   the designated server role can execute only the intended workflow. Never
   change replay policies just to make analytics work.
4. Configure `ANALYTICS_SUPABASE_URL` and the preferred
   `ANALYTICS_SUPABASE_SECRET_KEY` through the owner's secure setup. Use
   `ANALYTICS_SUPABASE_SERVICE_ROLE_KEY` only for an explicitly selected legacy
   credential. Creating credentials or materially expanding persistent access
   requires separate approval; the user must handle highly sensitive credential
   transmission. No pasted secrets in chat, generic integration-variable
   overwrite, paid plan, upgrade, auto-spend, or paid add-on.
5. Verify free-plan headroom, database/storage quotas and provider backup/log
   retention. Existing hosting and database limits still apply; this is not a
   promise of unlimited or universally free usage.
6. Install/approve and verify a daily cleanup job (e.g. approved Supabase Cron).
   The documented 00:15 Shanghai cleanup yields at most about 48h15m of daily
   retry/identifier keys while healthy. Alert on failure. Cron job logs have
   independent retention and also need a bounded policy.
7. Verify database-side statement/lock timeouts for the RPC role. A 2.5s client
   fetch abort does not prove PostgreSQL stopped running, and locked ingestion
   can queue. Apply scoped database limits only with approval.
   Configure and verify deployment-edge global request limits/bot protection
   before collection: database quotas alone do not bound invocation costs or
   denial-of-service. No IP-derived visitor identity should be added to this
   analytics store. Service-level access logs may still process network data;
   audit their retention and redact request bodies/headers/cookies.
8. Review the site's actual privacy obligations and publish accurate disclosure
   for anonymous PV/source/screen collection. Identifier collection stays off
   until explicit consent adapter and withdrawal behavior are approved/tested.
   Consent-free compliance is not assumed just because there are no cookies.
9. With all above confirmed, enable only the approved production origin. Verify
   real row writes and aggregate reads using the selected key/header branch,
   not just env values or mocked responses. Verify the actual hosted REST RPC
   permissions for that project; no public route waits for analytics, and
   service/database failure must never break the site.
   Disable the env flag to stop collection without touching replay data.

## Verification boundaries and sources

Local focused tests cover parsing, auth/config/origin guards, date windows,
privacy normalization, result statuses and mocked database transport. Credential
checks cover dedicated-variable isolation, modern/legacy headers for both RPCs,
modern-key precedence without invalid-key downgrade, public/anon-key rejection,
URL scoping, and generic error/client responses that never expose keys. These
fixtures are deliberately unusable synthetic keys, not real credentials. SQL text
checks can detect contract drift, but are not execution/concurrency/RLS proof.
Real database tests and activation checks require access to the target database
and deployment configuration. A successful application build alone does not
verify database permissions or ingestion.

Reviewed bundled Next16.3.6 docs for Route Handlers, cookies, environment variables,
`usePathname`, `after`, and authentication. Do not put collection in SSR/`after`
where static generation/revalidation could count as visits or alter caching.

Primary implementation references:
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/cron
- https://supabase.com/docs/guides/getting-started/api-keys#known-limitations
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- https://nextjs.org/docs/app/guides/environment-variables
