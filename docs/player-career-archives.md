# Reviewed, dated NBA career snapshots

The server can use four independently reviewed NBA.com public-page captures when
live career history fails or is demonstrably incomplete. These are dated source
snapshots, not a claim that the current provider endpoint works or that the
source has not changed since capture.

| NBA ID | Player | Captured Per Game table (UTC) | Captured coverage |
| --- | --- | --- | --- |
| 2544 | LeBron James | 2026-10-03 03:05:29.326 | 2003-04–2025-26, 23 season rows |
| 203999 | Nikola Jokić | 2026-10-03 03:07:53.770 | 2015-16–2025-26, 11 season rows |
| 201939 | Stephen Curry | 2026-10-03 03:18:56.056 | 2009-10–2025-26, 17 season rows |
| 203507 | Giannis Antetokounmpo | 2026-10-03 03:20:04.525 | 2013-14–2025-26, 13 season rows |

The exact public source is `https://www.nba.com/stats/player/{NBA_ID}/career`.
The separate Totals capture uses `?PerMode=Totals`. The table is explicitly
**Career Regular Season Stats**. Both captures showed all rows on page 1 of 1.
The site does not provide a last-update timestamp or independently certify
season finality. Player profile header/current-team information is not substituted
for historical row teams.

## Data and review

- Immutable normalized records are under `src/data/player-career-archives/`.
  Each contains explicit identity, schema version, coverage, fixed provenance,
  per-season values, direct Overall values, and factual evidence digests.
- `docs/evidence/player-career/` contains the exact displayed column labels,
  season cells, Overall cells, mode, source URL and capture time for both modes.
  It also records the SHA-256 of the original local DOM capture. It does not
  contain NBA page HTML, JavaScript, navigation or unrelated browser content.
- The first independent review compared all 530 normalized season/Overall values
  and 1,824 factual source-evidence cells for James/Jokić to the original captures.
  A separate review compared all 470 normalized values and 1,632 evidence cells
  for Curry/Antetokounmpo, with the earlier records unchanged. Coverage,
  identity, timestamps, unit conversions and original capture hashes matched.
  The reviewed JSON.stringify SHA-256 content hashes are pinned in the server
  allowlist. A plausible edited statistic still fails that hash check.
- The source has exactly 24 columns: Season, TEAM, AGE, GP, GS, MIN, PTS, FGM,
  FGA, FG%, 3PM, 3PA, 3P%, FTM, FTA, FT%, OREB, DREB, REB, AST, STL, BLK, TOV, PF.
  Per Game counting/attempt values are copied directly. Displayed percentages
  are divided by 100 (e.g. 50.7 → 0.507); no percentages are calculated from
  rounded makes/attempts. Zero remains zero; absent values are never invented.
- All season/team/TOT rows must remain intact. Coverage counts distinct seasons
  separately from rows. TOT is used only to avoid duplicate career arithmetic,
  never to erase displayed team rows.
- `careerShooting.source = nba-browser-overall` and `careerAverage.source =
  nba-browser-overall` identify the captured Per Game **Overall** row directly.
  Career averages and shooting rates are not reconstructed from rounded seasons.
  The independently captured Totals values are retained as evidence, not used to
  synthesize a more precise Per Game value.
- Source rounding is preserved: LeBron's displayed season MIN totals sum to
  61,029 versus the source Overall 61,028; Jokić's sum to 25,913 versus Overall
  25,910; Curry's sum to 36,306 versus Overall 36,305. All other checked integer
  counting-stat sums match the source Overall, including Antetokounmpo's minutes.
  These minute discrepancies are not “corrected.” Historical teams remain GSW
  for Curry and MIL for Antetokounmpo regardless of profile-header affiliation.

## Runtime and freshness

`/api/player` keeps its bounded live NBA → ESPN fallback chain. A complete valid
live result wins and retains only that provider's rows/aggregate/provenance.
For a reviewed player, live rows must cover every observed archived season and
at least its observed games per season. Truncated, empty or older game coverage
cannot replace that known history. A source correction that reduces historical
GP is conservatively held for a new review rather than silently overwriting the
snapshot. Unarchived players keep the existing valid-empty success and failure
503 behavior. Known-player canonical names replace a supplied fallback name;
missing request names do not enable new ESPN calls. ESPN full-name matching
folds only case and diacritics (Jokić/Jokic), rejecting ambiguous matches; it
does not remove suffixes or use substring/fuzzy matching.

After provider failure or the existing 14-second total deadline, a reviewed
archive yields HTTP 200, `stale: true`, and its original fixed provenance:

```json
{
  "source": "nba-com",
  "providerPlayerId": "2544",
  "scope": "regular-season",
  "retrievalKind": "archived-browser-capture",
  "capturedAt": "2026-10-03T03:05:29.326Z",
  "snapshotId": "nba-com-2544-2026-10-03T03:05:29.326Z",
  "coverage": {
    "firstSeason": "2003-04",
    "lastSeason": "2025-26",
    "seasonCount": 23,
    "rowCount": 23
  }
}
```

It has no newly minted `retrievedAt`, `updatedAt` or verification timestamp.
Actual visitor cancellation still aborts without a late successful fallback.
The browser-session cache keeps archive data stale on its initial response,
cache hits and retries. A failed refresh retains the complete last-good record
and its original metadata. An archive cannot replace complete live data of at
least the same coverage, or reduce already observed game coverage. A later
complete live result replaces the archive wholesale. EN/ZH UI labels the fixed
capture and coverage, warns about later changes, links the exact source, and
shows the comparison season explicitly.

Archive reads are local and server-only. They make no provider calls, write no
visitor state and add no polling, paid service, database or credentials. The
existing 30-second retry cooldown and request sharing remain. The full archive
and factual evidence are not imported by client components or hooks.

## Updating an archive

A new capture is an explicit maintenance change, never a visitor side effect.
Keep each dated file immutable; preserve source URLs, original timestamps,
coverage and original evidence hashes. Independently compare every normalized
field with the captured regular-season table, validate units and identity,
review the proposed coverage change, and then add the exact new approved content
hash to the server allowlist. Do not relabel an old capture with today's time.

Run the career archive/provider/cache/render tests, full test suite, typecheck,
lint and production build. Inspect the production client chunks to ensure the
capture payloads stayed server-only. Publication requires its own review; source
attribution alone is not data verification.
