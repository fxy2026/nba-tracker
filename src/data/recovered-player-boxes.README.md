# Two verified historical player-stat snapshots

Source: [BigBallsData](https://bigballsdata.com), authenticated free-tier stored-match stats responses retrieved approximately 2026-10-02 09:49 UTC. No API keys or current-roster team assignments are stored here. These are two fixed snapshots, not an automatic or comprehensive archive.

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
