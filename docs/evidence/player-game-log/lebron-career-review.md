# LeBron James: reviewed 23-season game-log archive

Reviewed on 2026-10-06. Used within the existing `/player/2544` Games panel and game-log API. No new page, roster inference, paid source or application shot/play-by-play import is introduced.

## Coverage

The added 16 seasons are 2003-04 through 2017-18 and 2023-24. They add 1,214 regular-season, 244 playoff and 25 source-recorded preseason appearances. Together with the seven existing captures, the archive has 1,622 regular-season and 302 playoff appearances over 23 seasons, plus 45 source-recorded preseason rows. Preseason source availability does not establish completeness or zero appearances in empty seasons.

All 23 regular-season game counts and 299 counting-stat totals (13 per season) match the pre-existing NBA career totals evidence, `docs/evidence/player-career/2544-2026-10-03.json`, SHA-256 `680346925121f1c7b11aafe43b33ed73c9facf324cb02555455e2eee273fb6b8`. The 302 playoff identities were cross-checked with collected historical NBA shot/PBP game identities; an independent official playoff counting-total control was not available. This archive does not claim that check.

## Unchanged sources, narrowly reviewed deltas

All ESPN gzip responses remain unchanged. The original seven shipped captures are preserved byte-for-byte. Manifest SHA-256 values cover decompressed original ESPN responses. The 16 new gzip files total 428,440 bytes.

A separate, checksummed server-only overlay applies:

- 46 StatMuse appearances missing from ESPN: 35 regular-season and 11 playoff rows, from six public season tables covering 2012-13 through 2017-18. Each uniquely matches the reviewed NBA game date and historical home/away identity; FGM/FGA/3PM/3PA agree with collected shot rows. The public source URLs, exact capture times, source HTML hashes and compressed/decompressed numeric-table hashes are retained in `statmuse-manifest.json`. Only factual numeric tables and short field labels are included here, not source HTML, scripts, images or editorial content.
- 55 exact historical opponent-code corrections: 36 NJ→NJN, 15 NOP→NOH and 4 NOP→NOK. Each patch is bound to its ESPN event, date, home/away side, original team codes and a separately reviewed NBA identity. The original abbreviations are retained alongside the display value. No generic franchise rename or current-roster assumption is used.
- One assist discrepancy: ESPN event 400489766, 2014-03-03, MIA vs CHA. ESPN lists 5 assists; StatMuse lists 4. Using 4 reconciles the NBA 2013-14 season total of 488. This is season-total reconciliation, not verification against an official NBA individual game box score. Both source references and that limitation are visible on the row. Every other ESPN stat and its displayed-minute precision remain unchanged.

The 2023-12-09 NBA In-Season Tournament championship (ESPN 401607495, LAL vs IND) stays in the original source but is excluded from regular-season stats by exact player, season, phase, event ID, date, teams and source event note. This guard also applies to live refresh. The UI explicitly states that regular-season totals exclude the NBA Cup final, play-in, preseason and All-Star games.

## Identity and attribution

A `statmuse:lebron-<season>-<phase>-<date>` ID is an application-local source-attributed record key, not a StatMuse-issued game ID. A reviewed NBA game ID is a separate field. None of these recovered rows gets an internal game URL, ESPN identity or fabricated box-score link. Original ESPN IDs and links are preserved. The numeric StatMuse table may expose its own entity IDs; they are not treated as NBA or ESPN IDs.

Mixed selections are labeled ESPN + StatMuse. Recovered rows link to their actual public StatMuse season table. The disputed assist row links to ESPN and StatMuse and explains the limited reconciliation. StatMuse fractional minutes remain fractional; ESPN displayed minutes remain as supplied. Unavailable fields remain null, never zero-filled.

## Refresh and integrity

The overlay fails closed on a source-hash mismatch, changed reviewed identity, invalid source, duplicate game identity or failed regular-season counting control. It is loaded server-side under the existing gzip tracing glob.

A new ESPN response is reconciled against exact reviewed identities before selection. A recovered appearance is deduplicated only when date, historical teams, venue, result and all shared counting values agree. An assist patch is retained only when the new value agrees with the expected original or reviewed value. Conflicts retain the reviewed archive with a visible refresh-conflict notice. A genuinely larger compatible response can be selected without losing reviewed corrections. NBA retains tie priority; an archived reviewed ESPN selection wins an ESPN tie only when actual game coverage matches, not merely row counts.

## Reproduction and verification

`scripts/prepare-lebron-career-archive.py <collection-path>` copies the 16 raw responses and six numeric-table captures and reproduces the overlay from the separately collected evidence. Running it again is deterministic. The input collection is not included in application bundles.

Focused tests verify all 69 season/phase selections, all regular-season totals, raw and reviewed hashes, all 46 source-table rows, all 55 aliases, separate local/provider/NBA identities, null safety, the Cup guard, corrupted evidence rejection, refresh reconciliation and bilingual source/caveat rendering. Existing original-batch tests remain intact except that their formerly absent 2023-24 assertion now checks the intentionally added 71 regular-season rows.
