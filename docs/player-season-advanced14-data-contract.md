# Player-season advanced-14 aggregate contract

## Enabled coverage

The application includes two immutable official NBA aggregate snapshots for Stephen
Curry (`201939`), both Regular Season:

| Season | Full-season FGM/FGA | Official 3PM/3PA | Normal 14 regions | Residual categories |
| --- | --- | --- | --- | --- |
| 2025–26 | 374/799 | 190/484 | 374/799 | None |
| 2015–16 | 805/1598 | 402/886 | 801/1584 | Backcourt 3/12; unclassified 1/2 |

Sources are the NBA's scoped [2025–26 chart](https://www.nba.com/stats/events?ContextMeasure=FGA&PlayerID=201939&Season=2025-26&SeasonType=Regular%20Season),
[2015–16 chart](https://www.nba.com/stats/events?ContextMeasure=FGA&PlayerID=201939&Season=2015-16&SeasonType=Regular%20Season),
[2025–26 shooting totals](https://www.nba.com/stats/player/201939/shooting?Season=2025-26&SeasonType=Regular%20Season),
and a separate [career Totals comparison](https://www.nba.com/stats/player/201939/career?PerMode=Totals).
The scoped URLs and capture times or observation windows are retained with the facts.
They are snapshots, not live feeds or a claim of coverage for other identities.

Factual evidence records for [2025–26](evidence/verified-season-heatmaps/201939-2025-26-regular.json)
and [2015–16](evidence/verified-season-heatmaps/201939-2015-16-regular.json) retain the original
capture SHA-256 identifiers, public source URLs and times, official totals, normal/residual
counts, and precision limitations. Separate canonical fact hashes bind the runtime records.

The historical denominator is **1598**, including all 14 residual attempts. An incomplete
historical game sample or CSV is never substituted for these full-season aggregates.

## Runtime boundary

- `src/data/verified-season-heatmaps/` contains only factual aggregate records and public
  source attribution. It contains no raw shot points, capture tooling details, or reports.
- `verified-season-heatmap-archive.ts` is protected by `server-only`. It owns a closed
  identity allowlist and canonical SHA-256 fact pins. It validates identity, schema,
  percentages, source context, region labels, counts, and reconciliation before projection.
- `loadSeasonHeatmapArchive(identity)` returns `{status: "ready", data}`, `{status:
  "unavailable"}`, or `{status: "error"}`. Ready data and cached envelopes are deeply frozen.
  An unsupported identity is unavailable. Corrupt registered facts produce an error.
- `getSeasonHeatmapCatalog(playerId)` returns immutable registered identities with
  `availability: "available"`. Registration remains visible if integrity validation fails,
  allowing the page to show a source error rather than silently switching datasets.
- The read-only `GET /api/player-season-heatmap` accepts exactly one `playerId`, `season`,
  and `seasonType`. It returns the same resource envelope: 200 for ready, 400 for malformed
  queries, 404 for unsupported identities, and 503 for a registered source integrity error.
  Only successful responses are cacheable. There is no network request, write, or fallback.
- Renderer data contains only stable region IDs, source names, counts, percentages,
  coverage, benchmark limitations, and public chart attribution. Archive facts and hashes
  are not imported by client components or copied into the renderer DTO.

Example: `/api/player-season-heatmap?playerId=201939&season=2015-16&seasonType=Regular+Season`.
Leading-zero IDs, duplicate or unknown query parameters, invalid season ranges, malformed
types, and coercible-but-invalid values are rejected. No latest-season default is inferred.

## Region and numerical semantics

All 14 stable region IDs are required exactly once, with matching source names.
`season-heatmap-geometry.ts` describes source illustration regions, not classifier
boundaries for raw shot points. Source order does not determine region identity. Never
split or relabel coarse game-sample regions to manufacture advanced-14 data.

Counts are nonnegative safe integers with FGM <= FGA. Percentages retain their source
one-decimal strings and use integer half-up rounding. Attempt shares always use full-season
FGA, including residuals; rounded displayed shares need not sum to 100.0. The sum of normal
regions and residuals must equal both official overall counts and independent career totals.

Backcourt and unclassified rows remain explicit, non-spatial residual categories. Their
apparent aggregate difference from official three-point totals does not establish each
residual's shot type, which stays unknown. They are never assigned to normal court regions.
No degenerate or non-finite residual placement is passed to the renderer.

For FGA=0, renderer FG% is null and attempt share is zero. A source `0.0` rate label may be
preserved separately as `sourceFgPctDisplay`. Renderer `fgPct` and `attemptShare` are ratios;
source display strings are percentage points. Missing values never become fabricated zeros.

## Coverage and benchmark limitations

`full-season-reconciled` means the captured aggregate matches the independent season
Totals row. It does not imply raw-shot coverage or real-time freshness. Raw points remain
`not-captured`; no plotted dots or claimed raw-shot denominator are synthesized.

LA values are the one-decimal `LA - League Average` labels displayed by each scoped NBA
chart. The player, chart season, and chart season type are verified. The LA benchmark's
own exact filtering, league numerator/denominator, methodology, and rounding inputs have
not been independently established. `independentlyVerifiedScope`, `leagueFgm`, and
`leagueFga` remain null. No weighted league mean or exact same-season league baseline is
claimed, averaged, or reverse-engineered. Missing LA remains null.

An observation window never becomes an exact capture timestamp. The source field's
`capturedAtUtc` remains null when an exact timestamp was not captured.

## Offline compatibility and verification

Existing offline candidate import and validation interfaces remain unchanged. They do not
enable runtime identities. Production eligibility comes only from the separate explicit
allowlist and immutable fact checks, with renderer status `verified-aggregate`.

Focused tests cover original candidate compatibility, supported totals, residual and
denominator preservation, source context, malformed queries, unsupported identities,
tampered facts, minimal projection, immutable cache behavior, and fail-closed API results.

    node node_modules/vitest/vitest.mjs run src/lib/season-heatmap.test.ts src/lib/verified-season-heatmap-archive.test.ts src/app/api/player-season-heatmap/route.test.ts --maxWorkers=1

Tests mock the framework's `server-only` marker. Production uses Next.js boundary
enforcement. No added dependency or runtime data-generation script is needed.
