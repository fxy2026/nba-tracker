# Player game-log sources (2026-10-05)

These public ESPN captures back the player-specific Games tab and standalone game-log page. They are fixed, dated archives; they are not claimed to represent an independently complete NBA career or every player-season. Original responses are gzip-compressed under `src/data/player-game-log-archives/`, with SHA-256 checksums, endpoint URLs and observed timestamps in the manifest. Athlete profile captures verify ESPN IDs against the separate official NBA name/debut-year registry. The source research manifest records response and mapping evidence.

## Captured scope

| NBA player ID | Season | Regular season | Playoffs |
| --- | --- | ---: | ---: |
| 2544 LeBron James | 2024-25 | 70 | 5 |
| 2544 LeBron James | 2025-26 | 60 | 10 |
| 201939 Stephen Curry | 2024-25 | 70 | 8 |
| 201939 Stephen Curry | 2025-26 | 43 | 0 returned |
| 893 Michael Jordan | 1997-98 | 82 | 21 |
| 893 Michael Jordan | 2002-03 | 82 | 0 returned |
| 977 Kobe Bryant | 2015-16 | 62 | 0 returned |

Kobe's 2015-16 regular-season source returns only 62 of the 66 games listed by the independently recorded season summary, totaling 1,091 rather than 1,161 points. The API/UI therefore explicitly labels it partial (62/66), not complete. A successful empty response is distinct from unavailable data and does not establish zero player appearances.

## Rules enforced by code and tests

- Match exact season filters and exact season-type group names. Preseason, play-in and All-Star events cannot appear in regular-season totals.
- ESPN event IDs stay ESPN IDs and link to their actual ESPN box scores. They are never used as NBA game IDs.
- Verify player IDs using exact NBA-namespace search UIDs, full name (diacritics folded only) and debut year. Require exactly one matching profile; do not rely on current team membership or first search result.
- Default to the latest locally recorded archive; registry/index seasons are selectable but do not prove that game rows are available.
- Preserve null for every absent field. The current ESPN source does not provide plus/minus, offensive or defensive rebounds in these game rows. Single-game minutes are source-rounded; do not claim exact aggregate minutes.
- Summaries and monthly splits use only the displayed source's recorded games, never a mixture of providers.
- Public live ESPN lookup has response-byte and time bounds. Provider failure cannot erase an independently validated archive or discard an already-completed result from another provider.

Only projected player/season-specific rows and attribution are sent to the browser. Compressed raw evidence stays server-side. No private provider credentials, Vercel settings, Supabase data or external state changes were used.
