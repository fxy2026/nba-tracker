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
