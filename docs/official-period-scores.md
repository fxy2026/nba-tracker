# Reviewed official quarter-score archive

## Scope and source

All 87 recovered 2025–26 games have a separate, team-only period-score archive: 82 regulation games, four one-overtime games, and one two-overtime game. This includes the original five Finals records (`0042500401`–`0042500405`), whose bytes and attribution metadata are preserved. The archive covers only these 87 explicitly reviewed game identities; a future game or another report is not accepted automatically.

`docs/evidence/game-period-scores/finals-2025-26.json` retains the unchanged evidence for the five Finals. Each of those five one-page reports was visually inspected and independently text-extracted.

`docs/evidence/game-period-scores/remaining-2025-26.json` records the other 82 reports' exact URLs, original PDF SHA-256 hashes, page counts, printed period/team labels, factual score rows, extraction geometry, historical identities, canonical schedule and unchanged player snapshot hashes, and review/capture metadata. All 82 passed independent text and PDF-geometry checks. All five overtime reports and seven regulation reports were visually reviewed; the other 70 records are explicitly text/geometry verified only. The reviewed candidate SHA-256 is `31380abc03725f8cc67b19cb5214ee86937609f036377a5f90098606786eb6a5` and its verification report SHA-256 is `4a57297f7f34da24e28d9197caac6de734dc437330568d24e427a6f6da9ff919`.

Only MEM–DET `0022500961` uses a 19-page `_book.pdf`. Its quarter-score source is page 1. Every other archive uses page 1 of its one-page final report. No PDFs, narrative descriptions or local research paths are included in this expansion.

## Original five Finals (unchanged)

| Game | Official local date | Away quarter scores | Home quarter scores |
| --- | --- | --- | --- |
| 0042500401 | 2026-06-03 | NYK 19, 29, 28, 29 = 105 | SAS 27, 28, 21, 19 = 95 |
| 0042500402 | 2026-06-05 | NYK 25, 31, 28, 21 = 105 | SAS 34, 18, 23, 29 = 104 |
| 0042500403 | 2026-06-08 | SAS 33, 24, 35, 23 = 115 | NYK 22, 42, 27, 20 = 111 |
| 0042500404 | 2026-06-10 | SAS 41, 35, 14, 16 = 106 | NYK 22, 27, 26, 32 = 107 |
| 0042500405 | 2026-06-13 | NYK 13, 24, 28, 29 = 94 | SAS 23, 19, 30, 18 = 90 |

## Validation and runtime boundary

- `official-period-scores-manifest.json` explicitly binds all 87 canonical game IDs, local dates/game codes, season, final status, historical home/away team IDs and tricodes, final scores, exact source URL/PDF hash/page count, literal period labels, and each parsed runtime record's `JSON.stringify` SHA-256. The loader statically imports exactly these reviewed records. A content change fails closed until the evidence and pinned hash are explicitly reviewed again.
- `official-period-score-validation.ts` rejects unapproved identities even if an untrusted record and supplied context agree with each other. It validates exact schema keys, canonical identity, source, date, 4/5/6 ordered labels, equal side lengths, nonnegative safe-integer period scores, and both period sums against canonical finals. Overtime is accepted only for the five pinned overtime games, with ties after regulation and every pre-final overtime boundary. The MEM–DET URL/hash/page-count exception never permits another gamebook or another page.
- The official local date comes from `gameCode`, not the UTC tipoff, which can be a day later. No current player-team membership is used.
- The loader imports `node:crypto` and is reachable only from the game Server Component. Full archive, source evidence, hashes and capture timestamps do not enter client bundles. Only the selected game's period values, sequence numbers, regulation/overtime type and tricodes cross into the existing `QuarterBars` Client Component; linked source attribution is rendered by the server wrapper.
- There are no new network/provider requests, API routes, services, dependencies, credentials or visitor writes.

## Timestamp semantics

The 82 added records distinguish `verifiedAt` (the actual text/geometry validation completion checkpoint) and `verifiedOn` (its date) from `originalPdfCapturedAt`. Sixteen originals have recorded capture-completion timestamps emitted after download and local processing, not exact instrumented HTTP response times. Eleven capture timestamps remain null because the saved timestamp could reflect retrieval or later reverification; 55 remain null because no original acquisition time was recorded in reviewed evidence. The corresponding status is retained for each record. Player snapshot retrieval/preparation timestamps, PDF metadata and filesystem modification times are never used as replacement capture times. Visual review times are separate, and are null for text/geometry-only records. Original five Finals metadata remains unchanged.

## Display boundaries

When an actual NBA box score is absent and the schedule confirms a final, the game page may render the existing `QuarterBars` visualization, with linked NBA report attribution, source page and fixed verification date in English or Chinese. Periods 1–4 are `REGULAR`; periods 5–6 are `OVERTIME`, shown as OT1/OT2 (or the existing Chinese overtime labels). A real box score always retains its original behavior, even when its period array is empty. Scheduled/live games and unsupported finals do not use this archive.

The player-box contracts, all 87 recovered player files, four existing career archives and their evidence are unchanged. The previously released MEM–DET feature retains all 124 explicitly printed timed score rows and four untimed period-end summaries unchanged. These independent factual archives are never transformed into a live `BoxScore` or play-by-play, never used to derive lead changes or event timing, and do not unlock recap, shot-chart or play-by-play widgets. Existing player point totals bind identity and final sums, but are not evidence of roster completeness or an independent statistical publisher when their source overlaps the same official report.
