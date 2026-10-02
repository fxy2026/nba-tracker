# Bounded player-data recovery

This job reads BigBallsData only on the scheduled/operator runner. Visitors read saved JSON; no provider key is deployed to Vercel or sent to a browser.

## Scope and operation

- Workflow: `.github/workflows/player-data-ingestion.yml`, **Recover NBA player data**
- Daily trigger:03:17 UTC. Operator runs default to verify-only mode with at most3 provider requests (two known samples); backfill mode and choices25/100/230 remain subject to the same admission check
- Global workflow concurrency serializes quota admission and ingestion. This workflow has no push or pull-request trigger
- The read-only quota job uses GitHub's complete run history. A prior run reserves230 requests unless complete metadata proves its named ingestion job was skipped in every attempt. Reruns and unverifiable ledgers fail closed. This is conservative: a small failed run can consume the day's reservation
- The per-job client obeys the admitted UTC-midnight expiry, at most230 requests,8 seconds per request, and120 seconds total. It never resets allowance after midnight or retries a failed request. Non-200 responses and exhausted provider headers stop the batch
- Known initial manual evaluation usage of7 requests on2026-10-02 is conservatively accounted for. The separate initial connection workflow reserves two calls per attempt on any affected UTC day; its historical successful master/manual job and exact check step can establish provider verification. Its unmetered manual trigger is now retired; future checks use this shared quota gate. Other manual/API clients are outside this workflow's guarantee
- Missing `BIGBALLSDATA_API_KEY` is a clean no-op for backfill and a failed verification for verify-only mode. No key, raw error body, request header, image URL or raw response is written to logs/artifacts

The job uses only approved job-level `contents:write` and `actions:read` for the ingestor; the quota job has read-only access. No PAT, administrator grant, secret-write permission, paid service or database migration is needed. The owner manually adds the provider key as a repository Actions Secret. Do not paste it into chat or code.

## Controlled data flow

1. In backfill mode only, request the fixed NBA official schedule once. Strictly validate its declared current season and completed game identities. Current unseen finals come first, then previously observed pending finals, then the controlled2025-26 archive in Finals/conference/second/first-round priority. Select at most20 total targets. Saved snapshots are skipped; only the historical portion advances the legacy cursor.
2. Look up complete date lists using the schedule's calendar date and its UTC date when different. Require a unique finished NBA matchup with matching teams and final score. Reject incomplete lists, duplicate/conflicting identities and ambiguous adjacent-date matches
3. Fetch the resolved match's stats. Validate shapes, numeric values, shooting arithmetic, rebound splits and combined points. Provider current-roster team fields never establish historical membership
4. Save generalized rows as **combined, historically unassigned** player tables, clearly attributed to the provider. These consistency checks do not independently establish each row's accuracy
5. Preserve every separately verified historical snapshot. Never invent NBA player IDs, DNP rows, coordinates, exact minutes, play-by-play, season averages or career totals
6. Validate saved data, then publish at most one data/cursor commit. If master advanced, withhold the commit. Never force push or overwrite concurrent work

Snapshots are server-only. Minutes remain provider-rounded. Final-game rows are not fetched again automatically once saved. Publishing a new adapter does not establish that its current-season source has returned usable data.

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

## First pilot and bounded metadata diagnosis

The first playoff pilot, run37006667059 on immutable commit `60e9585a4f44ffb182db89fc39c381212c3944df`, used25 requests and accepted0 games. Seven stats responses failed the former combined metadata gate, two date pages failed the final-score check, and the last stats attempt had no request budget left. HTTP200 did not establish usable data. Do not infer a paid-plan restriction from that combined error.

Only this exact successful run/job/commit/master/push/first-attempt proof can reserve its reviewed25-request bound instead of the conservative100. Unknown or unverifiable runs still reserve230. Together with the seven manual evaluation calls and two connection-check calls, this leaves at most66 requests on2026-10-02 before another controlled operation. The configured limit was100 at that point; the owner subsequently approved230 as described below.

A separate, one-time diagnostic is limited to three requests for game0042500405 and writes no player snapshots or cursor. It logs only fixed metadata kinds, availability flags, counts and allowlisted error codes, never raw bodies, headers or credentials. Its new exact nonce/message/path rejects the retired25-request kickoff. Remove the temporary push trigger and manifest after its terminal run. Scheduled/operator data recovery remains quota-gated.

The actual metadata diagnostic run37011342891 found21 returned player rows with zero withheld player/stat values and50 returned team-stat rows with three withheld team/stat values for0042500405. All availability flags were true. The OpenAPI documents these as separate modules and source-side omissions. The player normalizer therefore treats a valid positive team withholding count as informational; it still requires zero player withholding, both returned team identities, all per-player arithmetic and exact combined final points. It does not return or infer withheld team aggregates.

The next one-request recovery uses only the UUID strictly matched in that diagnostic and pins the evidenced game tuple (0042500405,2026-06-13,SAS90–NYK94). It skips an existing snapshot and rejects any conflicting saved UUID owner before fetching. The reviewed diagnostic's immutable run/job/SHA/step can reserve its three-request bound; unknown runs retain conservative reservation. The old diagnostic kickoff is replaced and cannot replay under the new nonce. The one-request sample recovery used the then-existing100/day gate.

## Approved230/day and the first20-target replay

The owner explicitly approved230 collected API requests per UTC day, reserving20 of the provider's250 for other diagnostics/use. Uncertain workflow runs reserve the whole230 rather than silently consuming zero. Three exact immutable runs have lower proven bounds:25 for the original pilot,3 for metadata diagnosis, and1 for the successful Finals restoration. The earlier seven manual calls and two standalone connection calls are also counted, leaving192 on2026-10-02 before the next replay.

The completed one-request sample produced21 rows at data commit1264896d5148caddbf7e63160d4fffb802218fe9 and passed deployment verification. A new exact-nonce kickoff replays at most20 previously unarchived playoff-priority targets with a60-request cap; it replaces the completed sample trigger and rejects all old kickoffs. Only the failed cursor is reset to retry the now-fixed player-module gate; saved snapshots are always skipped. Scheduled/operator runs have an upper230 request limit but retain the20-target safety bound, so this is not a promise to use230 calls or recover230 games. Remove the temporary trigger after its terminal result.

## Follow-on two-chunk replay

The20-target replay run37014621758 (immutable source `e25c8e3b9d2587a033a8349b221226070918b15d`) used46 requests and saved17 games/391 player-game rows. Its reviewed code bound is60, not the observed46. Exact successful run/job/source evidence can reserve60; combined with the earlier reviewed bounds and known manual/standalone calls this leaves132 of the230 task limit before the next run. Unknown executions remain conservatively reserved.

A new one-time nonce allows two20-target chunks, one shared120-request ceiling, one shared120-second deadline, one date-page cache and one final data commit. Classified targets and provider UUID ownership carry across chunks; transport/budget interruption stops both chunks without skipping its target. All40 possible rejection codes fit the bounded persisted diagnostics. Scheduled and normal operator backfill continue to use one20-target chunk. The next40 local targets are16 second-round and24 first-round playoff games; they do not overlap saved snapshots. Their18 distinct date pages can be reused, but actual accepted coverage is reported only after the run.


## Current-season identity persistence (2026-10-02)

The active source is the fixed `https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json` URL. Only backfill mode requests it, once, with an8-second end-to-end deadline,16MiB response bound, and no redirect, retry or alternate endpoint. Verify, restore and diagnostic modes do not request it. This NBA request is separate from the unchanged BigBallsData230/day gate; there are still at most20 player-game targets per backfill run.

A source result distinguishes ready, successful empty, missing, unavailable, malformed, stale and wrong-season states in the run summary. No fresh result or usable new-season provider coverage is implied by this code. The parser uses the actual `seasonYear`, canonical game ID, official calendar/UTC dates, team IDs/tricodes and unequal final scores. Preseason/All-Star/Cup-final IDs without an approved contract are excluded rather than queried speculatively.

Validated selected identities are immutable per-game records in `src/data/observed-final-games/`. Their source hash and observed timestamp identify the bytes seen and retrieval time, not a source publication timestamp. A missing/empty/failed fresh response never deletes previously stored identities or player data. Previously observed finals remain eligible when the source is pending; classified failures wait48 hours while interrupted transport/budget targets remain retryable. Missing wins/losses/seeds are absent, not fabricated zeroes. The server-generated index fills missing schedule IDs, including missing games on an existing date, so a saved box remains addressable after the upstream schedule rotates.

Before any new files are written, the temporary recovery bundle captures normalized player files plus `official-<NBA game ID>.json` identity records. At most20 of each,40 files and2MB total, are allowed. Matching pairs must agree on season/date/teams/scores; only the two strict projections and fixed manifest metadata may enter it. Upload remains conditional,7-day temporary retention, and does not replace permanent repository publication. The data commit allowlist adds only the observed identity directory; permissions are unchanged.

Existing verified historical tables retain their stronger source and membership evidence. New generic provider data remains explicitly unassigned until game-time team membership is independently established. No automated membership route or2026-27 provider coverage has been demonstrated by these offline tests.
