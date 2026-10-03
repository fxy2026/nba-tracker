# Reviewed official quarter-score archive

## Scope and source

Five saved 2025–26 Finals games, `0042500401`–`0042500405`, have a separate, team-only quarter-score archive. All five original NBA final-report PDFs are one page and report four regulation quarters, without overtime. Each page was visually inspected and independently text-extracted before these records were prepared.

`docs/evidence/game-period-scores/finals-2025-26.json` retains exact report URLs, original PDF SHA-256 hashes, page numbers, literal printed labels and extracted rows, side identities, sums, canonical schedule hash, and the hashes of the unchanged player snapshots. Its source-research SHA-256 is `4b7c9bca8f1ed941cb6871528d9e67ee1f80f4daf94bfac1e9f218372b2cda05`. Runtime records in `src/data/official-period-scores/` retain only the required identity, source, final scores and quarter values.

| Game | Official local date | Away quarter scores | Home quarter scores |
| --- | --- | --- | --- |
| 0042500401 | 2026-06-03 | NYK 19, 29, 28, 29 = 105 | SAS 27, 28, 21, 19 = 95 |
| 0042500402 | 2026-06-05 | NYK 25, 31, 28, 21 = 105 | SAS 34, 18, 23, 29 = 104 |
| 0042500403 | 2026-06-08 | SAS 33, 24, 35, 23 = 115 | NYK 22, 42, 27, 20 = 111 |
| 0042500404 | 2026-06-10 | SAS 41, 35, 14, 16 = 106 | NYK 22, 27, 26, 32 = 107 |
| 0042500405 | 2026-06-13 | NYK 13, 24, 28, 29 = 94 | SAS 23, 19, 30, 18 = 90 |

## Validation and runtime boundary

- `official-period-score-archive.ts` allowlists just these five files and pins the SHA-256 of each parsed record's `JSON.stringify` representation. Any content change fails closed until source review and an explicit hash update.
- `official-period-score-validation.ts` separately checks schema, Finals game ID, final status, season, exact game code, official local date, historical home/away IDs and tricodes, exact report URL/date/team order, report hash/page, verification date, four printed period labels, four nonnegative safe-integer scores per side, and both sums against the canonical schedule finals. Missing, malformed, mismatched and unsupported records return `null`.
- The official local date comes from `gameCode`, not the UTC tipoff, which can be a day later. No current player-team membership is used.
- The loader imports `node:crypto` and is reachable only from the game Server Component. The archive/evidence payloads are not client imports. Only the selected game's quarter values and tricodes cross into the existing `QuarterBars` Client Component.
- There are no new network/provider requests, API routes, services, credentials or visitor writes.

## Display boundaries

When an actual NBA box score is absent and the schedule confirms a final, the game page may render the existing `QuarterBars` visualization, with its own linked NBA report attribution, source page and fixed verification date in English or Chinese. A real box score always retains its original page behavior, even when its period array is empty. Scheduled/live games and unsupported finals do not use this archive.

The player-box contracts and all 87 recovered player files are unchanged. The four existing career archives and their evidence are unchanged. This archive is never transformed into a live `BoxScore` or play-by-play, never used to derive lead changes or event timing, and does not unlock recap, shot-chart or play-by-play widgets. Those data remain unavailable in the schedule-only branch.

Adding other games or overtime periods requires a separately reviewed source expansion; this release does not accept them automatically.
