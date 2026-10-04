# Historical season career archives

Historical profiles use a separate, immutable secondary-source archive. These
records do not enter the live provider cache or the four NBA.com-reviewed career
archives. `src/lib/historical-career-archive.ts` allowlists player IDs and pins
SHA-256 of canonical `JSON.stringify` content before validating the schema.

## Michael Jordan, NBA ID 893, 2026-10-04

- Data: `src/data/historical-career-archives/893-2026-10-04.json`
- Coverage: 15 regular seasons (1984-85 to 2002-03, with career gaps retained),
  13 playoff seasons (1984-85 to 1997-98). No absent season is synthesized.
- Source: StatMuse public season-total tables. Basketball Monster independently
  corroborates regular-season counts. The retained NBA page establishes identity
  only; it does not verify these season statistics.
- Source observations and corroboration rows are preserved as factual data in the
  JSON. The original source extracts were retained separately for the independent
  audit; `evidenceFile` names identify those audit records, not public repository
  files. Source URLs and original extract SHA-256 hashes remain in the JSON. Full
  webpage extracts, including unrelated prose/navigation, are not redistributed.
- The common retrieval timestamp is the completion time of the retained-source
  collection batch. It is not a source publication or update time. Dataset revision
  and source publication times were not supplied.
- Dispute: 2001-02 regular-season minutes are 2,093 in StatMuse and 2,094 in
  Basketball Monster. Canonical season MIN stays null; regular career MIN and MPG
  also remain null. `publishedCareerTotals` and `sourceObservations` retain source
  claims for audit only and are never consumed by the profile.
- Games started are unavailable. Plus/minus has only partial coverage. Explicit
  nulls remain unknown, not zero. Statistical totals do not imply shot-location
  coverage or complete shot records.

## Display and extension contract

Each row is one whole season for one competition, with exact totals and explicit
nulls for missing/disputed fields. Team splits must not coexist with aggregate rows
in `rows`; retain split observations separately. Source URLs, provenance, row
identities, season format, source timestamps, arithmetic identities and disputes
are validated. Duplicate season/type rows, missing total keys and invalid source
links fail closed.

The browser receives only checked totals, sources and disputes. It calculates
per-game values as total / games and shooting percentages as makes / attempts.
Career values aggregate exact totals before calculating rates, separately for
regular season and playoffs. If any season is missing a field, its aggregate stays
null. A zero-attempt percentage is unknown. Rounded source averages are not inputs.

To extend: retain source evidence, reconcile discrepancies without choosing an
unsupported value, document coverage (especially early-era missing fields), run an
independent source audit, and add a dated hash-pinned entry plus validation tests.
Do not relabel a secondary source as NBA-officially verified.

## Kobe Bryant, NBA ID 977, 2026-10-04

- Data: `src/data/historical-career-archives/977-2026-10-04.json`
- Coverage: 20 regular seasons (1996-97 through 2015-16), 15 playoff seasons
  (1996-97 through 2011-12, with missed playoffs retained as gaps).
- StatMuse is the selected secondary source for both competitions. RealGM
  corroborates regular-season and playoff totals; Basketball Monster provides
  an additional regular-season comparison. The NBA/Lakers page corroborates
  only regular-season GP, FGM, FGA, FG3M and FG3A (100 field comparisons), not
  the full season rows or whole dataset.
- Unresolved 2002-03 minutes remain null in both competitions. Both career MIN
  and MPG therefore remain null. Plus/minus is unavailable throughout.
- Regular-season counts total 1,346 games and 33,643 points; playoff counts total
  220 games and 5,640 points. All displayed averages derive from the exact counts.

## Tim Duncan, NBA ID 1495, 2026-10-04

- Data: `src/data/historical-career-archives/1495-2026-10-04.json`
- Coverage: 19 regular seasons (1997-98 through 2015-16), 18 playoff seasons
  (1997-98 through 2015-16, excluding 1999-00 when he did not appear).
- StatMuse provides separate selected regular-season and playoff sources.
  RealGM corroborates both competitions; Basketball Monster adds a
  regular-season comparison. No whole-dataset official verification is claimed.
- Regular-season MIN remains null in 2002-03, 2003-04, 2005-06, 2006-07 and
  2008-09, so regular career MIN and MPG remain unknown. Playoff PF for 2000-01
  is unresolved, so career playoff PF remains null. Games started are unavailable.
- Regular-season counts total 1,392 games and 26,496 points; playoff counts total
  251 games and 5,172 points. Partial field coverage is never silently summed.

## Additional reconciliation contract

The two source artifacts retain the independently audited bytes and factual
source observations. Original full third-party page extracts stay in the separate
local audit record; only factual JSON and provenance documentation are published.
The batch retrieval time is `2026-10-04T03:31:48.000Z`. Source publication times
and dataset revisions are unavailable.

Resolved secondary-source disagreements and unresolved quarantines have distinct
labels. A resolved value must match the selected row source and at least one
other source. Count values must agree exactly; corroborating fractional MIN may
agree within the half-minute precision of a published whole-minute value. MIN
therefore represents published rounded minutes, not exact seconds. Unresolved
fields remain null. Duplicate source-disagreement records preserve all original
observations and use distinct display keys.

Percentage disagreements retain rounded source observations as fractions in the
archive, display them as percentages, and never supply the table's rates. The
table still calculates rates only from exact made/attempted totals. Unconsumed
per-game averages, source percentages, career claims and evidence excerpts never
enter client props. A narrowly allowlisted official corroboration source cannot
promote the secondary-source row or dataset to official status.

## Kareem Abdul-Jabbar and Wilt Chamberlain, 2026-10-04

The immutable 76003 and 76375 snapshots add 38 and 27 actual played-season rows:
Kareem 20 regular / 18 playoff seasons, Wilt 14 regular / 13 playoff seasons.
Selected numeric rows remain StatMuse secondary-source statistics. Regular-season
rows are corroborated by Basketball Monster. Wilt playoff totals are also
corroborated by APBR; APBR's regular numeric table is explicitly excluded, while
its historical Philadelphia Warriors labels are used. Kareem playoff rows have
source-internal arithmetic/career reconciliation but no separate season-by-season
corroborating publisher in this evidence packet. Identity evidence does not
establish official verification of season statistics.

The `2026-10-04T03:36:00Z` timestamp is an approximate minute-level collection-batch
marker assigned during normalization, not an instrumented fetch/completion time.
Exact per-fetch seconds were not recorded. The archive registry marks this
precision explicitly; the source disclosure shows approximate minutes without
claiming precise seconds or a publisher revision date.

Early-era steals, blocks, offensive/defensive rebound splits, turnovers and
three-point fields remain explicitly null when unavailable. Genuine recorded
zeros remain zero. Zero-attempt percentages remain undefined. Full-career totals
and averages stay null for any partially covered category. The folded disclosure
recomputes category coverage from non-null season totals, separately by competition:
Kareem regular STL/BLK/OREB/DREB cover 1,239 GP, TOV 929, 3PT 787; playoffs cover
196 / 169 / 158 respectively. These are coverage counts, not full-career rate
denominators; the UI does not display partial-era career averages.

Wilt's 1964-65 regular season remains exactly one 73-GP `TOT` whole-season record.
His first three seasons use `PHW` for Philadelphia Warriors, preserving the
source's `PHI` separately in the factual archive. Later `PHI` means Philadelphia
76ers. Full historical team names are retained in accessible row labels and the
folded team legend; they never link to current-franchise pages.

Approved factual-artifact SHA-256:
- 76003: `9b1c3dc8657c757779381e832c8f61054a954dd5963aad9f4a1b02dd401b9d86`
- 76375: `5336a28280c7538cb5233cf142d2453f32719d5a7310ee43f4ce1e75c38c884a`

The JSON bytes are preserved exactly. Full third-party webpage text stays in the
separate retained audit materials and is not redistributed in this repository.

## Shaquille O'Neal, Magic Johnson and Larry Bird, 2026-10-04

The dated archives add 87 independently audited played-season rows:

- Shaquille O'Neal, NBA ID 406: 19 regular seasons and 17 playoff seasons.
  Regular totals: 1,207 games and 28,596 points; playoffs: 216 games and
  5,250 points. Regular 2005-06 MIN is quarantined, leaving regular career
  MIN/MPG unknown. The 2007-08 regular season has one TOT row (61 games);
  MIA (33) and PHX (28) corroboration splits remain audit data and are never
  added to the displayed whole-season row.
- Magic Johnson, NBA ID 77142: 13 regular seasons and 13 playoff seasons.
  Regular totals: 906 games and 17,707 points; playoffs: 190 games and
  3,701 points. Regular 1985-86 MIN/REB/DREB/AST/FG3A/FG3_PCT,
  1986-87 FGA/FG_PCT and 1987-88 REB/DREB remain quarantined. Dependent
  career totals, averages and shooting percentages remain unknown.
- Larry Bird, NBA ID 1449: 13 regular seasons and 12 playoff seasons.
  Regular totals: 897 games and 21,791 points; playoffs: 164 games and
  3,897 points. Regular 1985-86 MIN, playoff 1985-86 FTA/FT_PCT and
  playoff 1987-88 AST remain quarantined, including dependent career rates.

Selected StatMuse records and RealGM corroboration cover every row. Additional
Basketball Monster regular-season observations are retained for Shaq. These
sources do not establish independent upstream collection or official NBA
statistical verification. All three complete datasets remain secondary-source.
Only factual JSON and this provenance documentation ship; retained full webpage
extracts remain in the separate local audit record.

`retrievedAt: 2026-10-04` explicitly has `retrievalTimePrecision: day` throughout
this source batch. The validator accepts calendar dates only with that marker,
and the display labels day precision rather than inventing retrieval seconds.
These are collection dates, not publisher update dates.

Games started are unavailable throughout. Magic/Bird plus-minus is unavailable;
Shaq plus-minus has only 15 regular seasons / 912 games and 14 playoff seasons /
180 games. Those partial subtotals are not complete career totals and are never
divided by his full-career game counts. Missing seasons are not fabricated.
Zero-attempt shooting percentages remain null, while recorded zero counts remain
zero. Percentage quarantine must also leave the derived canonical rate unknown;
source-published career totals and TS% observations never override canonical
missing operands. Exact count values are never reconstructed from rounded rates.
