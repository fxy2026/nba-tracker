# Reviewed historical scoring: Finals Game 5

The Game Takeover Curve at `/lab/game-impact?id=0042500405` has a one-game local archive path. It contains the actual 96 made scoring events, including 32 made free throws, reconciled from all 554 source records. It does not create an NBA `BoxScore`, a live CDN response, possession data, a career record, or a replacement shot chart.

## Sources and provenance

- Raw source: [fxy2026/nba_data, pinned commit e829d4678be1e075f99e5d41a1c5f97089be446b](https://github.com/fxy2026/nba_data/blob/e829d4678be1e075f99e5d41a1c5f97089be446b/datasets/nbastatsv3_po_2025.tar.xz), `nbastatsv3_po_2025.tar.xz`. The repository uses the starting season year, so `2025` denotes 2025–26 here.
- NBA identity and player/FG evidence: the existing [official Game 5 charts](https://www.nba.com/game/nyk-vs-sas-0042500405/game-charts) archive.
- Independently saved period scores and played-player totals: the existing [NBA final report](https://statsdmz.nba.com/pdfs/20260613/20260613_NYKSAS.pdf) evidence and reviewed recovered player box. The box remains labeled BigBallsData, with its existing report cross-check and rounded-minute limitations.
- This archive was verified on 2026-10-04. Original play-by-play collection time is unknown. Git commit time, this verification date, and the separate official shot-page capture time are not PBP capture timestamps.

The source archive SHA-256 is `22f8479396ee7c5cd5a286f884eab4f9020d145e49cdfd7499d8abad5e70852c`; its CSV SHA-256 is `0dd9a89e44c9b92026eb2fad2f5371b00fa650d8b6745184974fc2e1acd12812`. The archive Git blob is `e7237d33250fc71b5f1f5fa643988170420f4b3e`.

The committed facts contain all 554 × 24 original CSV cells as strings, preserving original fields and factual play descriptions. No publisher narrative, HTML or full article is included. JSON formatting is new; it is not claimed to be the original CSV byte stream. Exact original compressed/CSV hashes and the reproducible importer bind it to that source. The runtime JSON bytes are separately pinned at `c1bcd29760ebbf00dc6331ff98026ecbd4d6cae5fc2622f246b8ebfb6c129e92`.

## Source distinctions

- `actionId` is stable source order 1…554. Original `actionNumber` is retained unchanged, including 25 repeated groups. Scoring events expose both `sourceOrder` and `sourceActionNumber`, with a separate compound event ID.
- All 173 actual FG attempts match the existing ten-field reviewed FG records, including the original coordinates. The GameImpact path creates no court coordinates or replacement shot data.
- All 47 FT attempts are explicit source events. The raw v3 FT `shotResult` is blank and `shotValue` is zero. A normalized make is supported by its explicit FT description, the real cumulative score change, player totals and period/final totals. Each normalized FT event identifies that derivation. Missed FT attempts remain in raw facts and validation, but contribute no scoring step.
- There are 110 actual paired score observations and 444 absent pairs. No absent value becomes zero or a reported carry-forward score. Every observation, including replay checkpoints, must match explicit scoring events. Score corrections or contradictory observations reject the candidate.
- 491 rows carry known played-player identities. In 48 team events, `personId` contains the team ID while raw `teamId` is zero, tricode is blank and location is `h`/`v`. Six replay rows carry opaque small integer person values; no undocumented reference meaning is assigned. Nine neutral rows include eight period markers and one home heave.
- Eleven paired block rows retain raw attempted shotValue 2/3 while `isFieldGoal=0`, actionType and shotResult are blank. They remain non-scoring events. The remaining 14 blank-actionType rows are steals.
- The reviewed official roster has 30 identities; only the independently report-verified 21 played rows form the complete expected scoring roster. No played/DNP status or statistics are invented for the other nine.

## Reconciliation

Home SAS 90, away NYK 94; game code `20260613/NYKSAS`, UTC tipoff `2026-06-14T00:30:00Z`, final status 3 supplied independently by the recorded schedule.

- SAS: FG 33/86, 3PT 12/37, FT 12/19; quarter points 23, 19, 30, 18
- NYK: FG 31/87, 3PT 12/37, FT 20/28; quarter points 13, 24, 28, 29
- All seven per-player FG/3PT/FT/point measures match the 21 played rows
- Chart: 97 steps with the pre-tip baseline, quarter boundaries 18/39/69
- Top six: Jalen Brunson 45, Dylan Harper 25, Victor Wembanyama 19, Julian Champagnie 14, Mikal Bridges 14, Josh Hart 13

The complete source spans every period and reconciles these checks; this is not an independent video review of every non-scoring action.

## Loading and scope

Explicit G5 requests, including metadata, check the immutable local archive before any full schedule, box or PBP request. The no-ID page still selects the latest finished game from the full schedule; it uses this archive only when that selected identity is G5 and agrees with the reviewed identity. It never pins the default to this old game. Other, future, live and uncovered game IDs keep their existing behavior. The default's separate schedule wait is not removed by this change.

The loader verifies exact raw bytes before Node JSON parsing for the factual source, player box, reviewed shots and period scores. Paths are an explicit one-game allowlist and never derived from a query parameter. The successful result is deeply frozen and cached in-process; a conflicting supplied schedule identity is rejected even after caching. Filesystem errors, missing assets, hash changes and validation failures return null rather than a partial curve.

Only six derived series and quarter markers reach the chart client. Raw source rows, original identities, filesystem logic and 112 KB archive stay server-side. `next.config.ts` explicitly traces the four assets into `/lab/game-impact`.

This integration does not alter the game-detail page, generic CDN PBP normalization, global `getBoxScore`, live refresh, scoring runs, win probability, key moments, lineup/possession claims, season aggregates or career data. It does not enable any of the other 84 source games. Games `0042500204` and `0042500312` remain excluded because of unresolved replay score observations.

## Reproduction and release checks

1. With the separately acquired pinned source archive, run `python3 scripts/historical-play-by-play/import_game5.py /path/to/nbastatsv3_po_2025.tar.xz /tmp/game5-facts.json`. It verifies archive size/hash and its sole regular CSV member size/hash, preserves strings, and never extracts paths or executes source code. Compare the output byte-for-byte to the committed facts. The importer cannot update the runtime allowlist.
2. Run the focused historical scoring, GameImpact and deployment-contract tests. Corruption cases exercise both the enclosing byte hash and the underlying structural/reconciliation checks.
3. Run the normal application gates and production build.
4. After build, run `python3 scripts/historical-play-by-play/check_deployment.py`. This requires the actual `/lab/game-impact` NFT file, verifies all four deployed source paths are present, and checks exact byte hashes before parsing. Config assertions alone are not a deployment pass.
5. Review both locale charts, source labels, existing mobile header/controls and unknown/default game behavior on the resulting exact release.
