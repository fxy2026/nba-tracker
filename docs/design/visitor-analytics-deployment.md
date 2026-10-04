# Visitor analytics deployment status

> Historical Supabase design/deployment record, superseded on 2026-10-04 by
> [the Vercel Web Analytics migration](vercel-web-analytics.md). Do not follow the
> old activation checklist. The public collector and both former browser
> collectors are now inert even if legacy environment flags remain enabled.
> Applied SQL, historical data, retention jobs, credentials and RLS are unchanged.
> The text below records its original verification point, not current activation.

Recorded on 2026-10-04. First-party collection remains disabled. This record
separates verified database work from the HTTP/deployment checks still required
before activation; it is not a claim of production traffic collection.

## Applied database record

- Dedicated Free project: `nba-tracker-analytics` (`myeffpbpdqvnoinnchjy`).
- Returned migration version: `20261004103147`; name:
  `create_private_visitor_analytics`.
- Exact applied SQL:
  [`20261004103147_create_private_visitor_analytics.sql`](../../supabase/migrations/20261004103147_create_private_visitor_analytics.sql).
- SHA-256: `e45d19f6ea5062e7f3ef4443a0c2c7bd29f5db1ac2d993dc0896799abad0ef23`.

The migration file is a byte-for-byte historical record, including its original
pre-application comments. Do not rename its returned version, edit its applied
bytes, or rerun it against this project. Subsequent changes need a new migration.
The older SQL under `docs/design/visitor-analytics-proposed.sql` is a design
proposal and differs from this applied migration.

## Verified SQL boundary

Four rollback-only live SQL suites passed: functional behavior, quotas, retention,
and access control. Checks covered anonymous and consented counts, retry
deduplication, stale identifiers, dimension sums, report windows, invalid input,
daily/per-token limits, cleanup boundaries, and transaction rollback.

Actual `anon` and `authenticated` table reads and both RPC calls were denied.
All five tables have RLS enabled; PUBLIC has no access. The three functions use
SECURITY INVOKER, an empty search path, and a one-second local lock timeout.
The `service_role` table grants match the intended operations; it has no cron
schema access. This privileged role still bypasses RLS, so server-key secrecy
remains essential.

The security advisor reported five informational RLS-with-no-policy findings,
consistent with intentional default denial. No performance-advisor findings
were reported. SQL checks do not prove the hosted REST gateway or deployment
credentials are configured correctly.

## Cleanup and contention verification

The actual retention cron job succeeded at 2026-10-04 10:42:00 UTC. Its original
command and daily `15 16 * * *` UTC schedule were restored exactly after that
verification. This runs at 00:15 Asia/Shanghai. The command includes a 30-second
statement timeout, one-second lock timeout, and pruning of its own finished
cron-run logs older than seven days. Provider logs and backups remain separate.

After the rollback-only fixtures and cleanup verification, `daily`, `dimensions`,
`event_ids`, and `browsers` were empty. `collected_since` remained null; cleanup
set only `last_pruned_day`. The project was healthy on the Free plan, with about
11 MB of database usage at verification time; this is not a future capacity or
cost guarantee.

Two parallel connector test attempts did not establish overlapping database
sessions. Multi-session contention is therefore **unverified**; the shared
state-before-daily lock order was inspected, not proven under an overlapping
load test. Actual hosted HTTP statement/lock-timeout inheritance is also
**unverified**. No passing concurrency or HTTP result is claimed.

## Still required before collection

- Verify the dedicated server credential/header branch against the actual hosted
  collect/report RPCs, including public-role denial through HTTP and correct
  project schema exposure. No hosted HTTP RPC tests have been completed here.
- Configure only the dedicated analytics settings through secure owner setup.
  Generic legacy replay variables and the legacy replay project stay unchanged.
- Verify deployment-edge request limits, database statement/lock timeouts,
  genuine multi-session contention, free-plan headroom, ongoing cleanup
  monitoring, and provider log/backup handling.
- Review and publish the conditional visitor-statistics disclosure at
  `/about#visitor-statistics`. Its retention wording describes targets rather than
  unconditional deletion guarantees. No legal-compliance conclusion is implied.
- After the remaining checks and explicit activation approval, enable only the
  approved production origin and verify actual durable writes and aggregate reads.
  Keep `VISITOR_ANALYTICS_ENABLED` unset until then. A successful build or empty
  SQL report is not evidence of visitor collection.

The About disclosure separately describes the existing production Cloudflare
beacon and WebVitals' local 50-entry path-bearing diagnostic buffer. They are
not data sources for the first-party report, and this release does not change them.
