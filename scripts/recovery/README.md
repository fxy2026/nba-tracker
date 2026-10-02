# Bounded player-data recovery

This job reads BigBallsData only on the scheduled/operator runner. Visitors read saved JSON; no provider key is deployed to Vercel or sent to a browser.

## Scope and operation

- Workflow: `.github/workflows/player-data-ingestion.yml`, **Recover NBA player data**
- Daily trigger:03:17 UTC. Operator runs default to verify-only mode with at most3 provider requests (two known samples); backfill mode and choices25/100 remain subject to the same admission check
- Global workflow concurrency serializes quota admission and ingestion. This workflow has no push or pull-request trigger
- The read-only quota job uses GitHub's complete run history. A prior run reserves100 requests unless complete metadata proves its named ingestion job was skipped in every attempt. Reruns and unverifiable ledgers fail closed. This is conservative: a small failed run can consume the day's reservation
- The per-job client obeys the admitted UTC-midnight expiry, at most100 requests,8 seconds per request, and120 seconds total. It never resets allowance after midnight or retries a failed request. Non-200 responses and exhausted provider headers stop the batch
- Known initial manual evaluation usage of7 requests on2026-10-02 is conservatively accounted for. The separate initial connection workflow reserves two calls per attempt on any affected UTC day; its historical successful master/manual job and exact check step can establish provider verification. Its unmetered manual trigger is now retired; future checks use this shared quota gate. Other manual/API clients are outside this workflow's guarantee
- Missing `BIGBALLSDATA_API_KEY` is a clean no-op for backfill and a failed verification for verify-only mode. No key, raw error body, request header, image URL or raw response is written to logs/artifacts

The job uses only approved job-level `contents:write` and `actions:read` for the ingestor; the quota job has read-only access. No PAT, administrator grant, secret-write permission, paid service or database migration is needed. The owner manually adds the provider key as a repository Actions Secret. Do not paste it into chat or code.

## Controlled data flow

1. Generate at most20 explicit targets from canonical, completed2025-26 games in the existing local schedule. Skip saved/stronger snapshots; a persisted cursor advances past unavailable targets
2. Look up complete date lists using the schedule's calendar date and its UTC date when different. Require a unique finished NBA matchup with matching teams and final score. Reject incomplete lists, duplicate/conflicting identities and ambiguous adjacent-date matches
3. Fetch the resolved match's stats. Validate shapes, numeric values, shooting arithmetic, rebound splits and combined points. Provider current-roster team fields never establish historical membership
4. Save generalized rows as **combined, historically unassigned** player tables, clearly attributed to the provider. These consistency checks do not independently establish each row's accuracy
5. Preserve the two separately verified historical snapshots. Never invent NBA player IDs, DNP rows, coordinates, exact minutes, play-by-play, season averages or career totals
6. Validate saved data, then publish at most one data/cursor commit. If master advanced, withhold the commit. Never force push or overwrite concurrent work

Snapshots are server-only. Minutes remain provider-rounded. Final-game rows are not fetched again automatically once saved. The new provider archive starts empty; publishing this code alone does not establish that ingestion has succeeded.

## Offline dry run

Use the installed TypeScript compiler, with no provider credentials or requests:

```sh
npx tsc scripts/recovery/dry-run.ts --outDir /tmp/nba-recovery-cli --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck --strict
node /tmp/nba-recovery-cli/scripts/recovery/dry-run.js --manifest manifest.json --captures captures.json --verified verified-game-ids.json --output report.json
```

Captured excerpts in the tests intentionally contain fewer rows than their original responses. They must fail completeness checks. Successful whole-envelope tests are explicitly reconstructed fixtures, not a claim of a complete live HTTP capture. The first real run must be checked for admission, request count, source response, output commit and deployment before calling automatic recovery active.

## References

- [Provider OpenAPI](https://bigballsdata.com/openapi.json): `x-api-key` authentication, stored matches/stats routes, response rate headers and UTC-day quota reset
- [GitHub run API](https://docs.github.com/en/rest/actions/workflow-runs): complete pagination; do not filter by created time and miss old reruns
- [GitHub job-attempt API](https://docs.github.com/en/rest/actions/workflow-jobs): skipped-job proof uses metadata, never logs
- [GitHub token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)

## Confirmed first connection

The standalone manual run [37003396261](https://github.com/fxy2026/nba-tracker/actions/runs/37003396261), commit `bbb5b153779bf9460d0ab1c4752dc4d330ed92fa`, succeeded on2026-10-02 at11:52UTC. Both fixed sample requests returned HTTP200 and matched their22/19 player counts and selected known values. This verifies the saved Actions Secret path; it does not establish broader ingestion coverage. Its two calls plus the seven earlier manual evaluation calls leave at most91 requests for the first controlled daily batch on that UTC date. A partial run still conservatively reserves the full day for subsequent admissions.
