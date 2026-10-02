# Reference-checked historical player-stat snapshots

Source: [BigBallsData](https://bigballsdata.com), authenticated free-tier stored-match stats responses retrieved approximately 2026-10-02 09:49 UTC. No API keys or current-roster team assignments are stored here. These original two fixed snapshots began this manually reference-checked archive; later promotions and their coverage limits are documented below.

| NBA schedule game | Provider match | Verified game/date |
| --- | --- | --- |
| 0022500961 | 5ce3b301-7023-433a-b8d1-ce8ee1b306be | MEM at DET, 2026-03-13,110–126 |
| 0022500340 | a8da9b0f-573e-4b78-9cf4-7f2838449969 | DEN at ATL, 2025-12-05,134–133 |

The NBA schedule IDs are linked by the existing schedule's date, teams and final score, not by the provider's unreliable kickoff timestamp or current player team. No NBA player IDs are inferred.

All41 provider player rows were checked against page1 of the corresponding final report:
- [MEM–DET official report](https://statsdmz.nba.com/pdfs/20260313/20260313_MEMDET_book.pdf)
- [DEN–ATL official report](https://statsdmz.nba.com/pdfs/20251205/20251205_DENATL.pdf)

Names, per-game side assignments, counting stats, starter flags and plus/minus agree. Each team's player points reconcile with its final score. Values originate from the provider responses; reports were used for reference validation. Ten provider current-team labels were historically wrong and five absent, so each historical side assignment is explicit here.

Minutes are provider-rounded whole minutes, not exact duration. Nine DNP/DND roster rows absent from the provider are not fabricated. These snapshots supply only player box tables; they do not synthesize NBA BoxScore objects, play-by-play, shot coordinates, exact clocks or career statistics. The normal NBA box remains preferred whenever available.

Keep the JSON behind the server-only archive module. Do not import it into client components or replace missing fields with zero.

## Finals game4 and5 historical assignments

The previously saved provider snapshots for0042500404 (2026-06-10,SAS atNYK) and0042500405 (2026-06-13,NYK atSAS) were manually checked against their official final scorer reports. All42 played rows,16 numeric fields,starter flags and source-rounded minutes match; both games contain12 NYK players and9 SAS players. Jeremy Sochan's team in these games is NYK, as the reports explicitly show.

These two snapshots now use the verified two-team renderer. Provider player UUIDs are retained without inferring NBA player IDs; numeric values are unchanged. The original unassigned snapshots remain retrievable in source commit2b940ea22e950396c5e5f0679b335a578c3f0e8f. Report URLs, page numbers, PDF hashes, source-snapshot hashes and each historical assignment are recorded in recovered-player-box-provenance.json. No report/PDF file is republished.

### Finals games 1–3 minute corrections

Games 0042500401–0042500403 now use the same manually verified historical-team mapping. Their 59 played rows matched the official final reports for all counting/shooting/plus-minus fields and starter flags. Eight minute fields differed or were missing in the provider snapshot. Only these minutes are corrected from the report's exact MM:SS value, rounded to the nearest whole minute. Each row's `minutesCorrection` retains the original provider value (including null), exact official duration, report URL, verification date and rounding rule. A † note marks corrections in the table. The provenance file pins the original provider snapshot commit/hash and report hash; all other values remain unchanged.

### Saved conference-finals team verification

Eight saved conference-final snapshots (185 played rows) have been checked against their game-specific official final reports and promoted to historical-team tables. Seven games require no numeric changes. In 0042500304, Tyrese Proctor's provider blocks value 1 conflicts with the official report's 0; only that block count is corrected, with `blocksCorrection` retaining both values, source/report URL/hash and verification date. The corrected BLK cell is marked †. All other saved scalars remain unchanged. Explicit accent-only Dennis Schröder/Schroder name correspondence is recorded in provenance; stored player names remain unchanged. Source per-game files remain retrievable at the pinned migration commit.


### Verified per-game persistence and second-round review

`recovered-player-boxes/<gameId>.json` is now authoritative. `recovered-player-boxes.json` is a deterministic gitignored build artifact produced with the provider aggregate by `npm run data:generate` (also pretest/prebuild/predev/pretypecheck). Existing server imports are unchanged. The pure validator has no API/archive import, so generation has no circular dependency. Both input directories and active quarantine are fully checked for game identity, points and provider match UUID conflicts before either aggregate is written. Automated ingestion still only publishes generic per-game files plus cursor state; it cannot alter verified files, exclusions or quarantine.

Twenty saved second-round games were checked against their official final reports. 465 played rows match; no numeric field was changed. Ten additional provider records in 0042500203 and0042500214 were unsupported as either played or DNP in the reports. They are excluded from player tables, with an explicit notice; every original value, original row index and source envelope is retained in `excluded-provider-player-records.json`, alongside source commit/hash and report references. The old15 verified game snapshots remain exactly unchanged. Small report-internal printed-minute total differences are retained in provenance, not used to modify matching player values.

### First-round review and explicit partial coverage

Nineteen complete saved first-round games add 423 played rows with historical teams and all source numbers unchanged. Five genuine appearances rounded to zero minutes are retained. Game 0042500164 contains 19 validated rows, but its report lists 21 played players: Denver players DaRon Holmes II and Jalen Pickett each appeared for one second and are absent from the provider snapshot. Its `playedCoverage` records the missing official names, team, report/hash and verification date. The table explicitly shows 19 of 21 coverage without synthesizing the missing rows or marking them DNP. Team point totals still reconcile, which alone does not prove roster completeness.

After the first-round promotion there were 55 renderable historical-team snapshots (1,234 rows), including this one partial game. The two identity-defective games then remained quarantined with 55 original rows; ten other excluded original records remain separately retained. Thus all 1,299 original stored records across 57 games remain recoverable, but they are not all verified played records. Generic storage is temporarily empty after manual review of every renderable saved game; its empty `.gitkeep` preserves the directory for future daily ingestion. The reader rejects nonempty or nonregular markers.

### Independently sourced identity recovery

Games0042500154 and0042500155 are now restored using explicitly mixed sources. Each game's Jrue Holiday line is independently transcribed from its official NBA final report and has no provider player UUID. The other53 provider lines retain their source values and have been fully checked against the same reports. The original provider's wrong identity is not accepted as an alias and remains blocked for incoming data. The entire55-row original evidence is retained byte-for-byte in `resolved-player-box-originals/`, with resolution and row-hash links in `resolved-player-box-quarantine.json`. The runtime validator requires official-row attribution; build generation additionally pins the reviewed recovered snapshot and original evidence.

Current displayed coverage is57 games /1,289 player rows:56 complete saved games plus0164 with19 of21 played players. Two official rows were added independently; all1,299 original provider records remain recoverable through current data, resolved originals and the10 excluded records. Original record count must not be described as verified played coverage.
