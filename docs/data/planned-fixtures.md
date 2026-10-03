# Published 2026–27 planned fixtures

This is a separate, server-only, dated schedule snapshot. It is not a live or completed game archive, a complete 1,230-game season, or a preseason schedule.

## Source and scope

The August 13, 2026 NBA schedule contains 1,200 assigned regular-season fixtures (80 per team). The two Cup-dependent games per team, 60 team appearances or 30 eventual games, are unassigned and are not synthesized. The published dates and times are subject to change.

- [NBA schedule by date](https://cdn.nba.com/manage/2026/08/2026-27-NBA-Regular-Season-Schedule-By-Date.pdf), 23 pages. SHA-256: `5e82e37ef1b19e226dee57be69958b95b5694516280d3034aa7c1d64292b3570`
- [NBA schedule by team](https://cdn.nba.com/manage/2026/08/2026-27-NBA-Regular-Season-Schedule-By-Team.pdf), 30 pages. SHA-256: `10a2b81388dcf79011b5405c43966446f5c3e4c35a0034f115c4cf124379bec3`
- [NBA schedule announcement](https://pr.nba.com/2026-27-nba-regular-season-schedule/)

The core dates, teams, designated home/away and times were independently reconciled across both PDFs. Both source page references remain on every record. UTC instants use `America/New_York`, including DST, and browser grouping uses those instants. Six alternate-venue notes and the three source-marked neutral-site `vs` relationships are retained. The local clock text is preserved without interpreting it from the home-team city.

Two Denver/Houston games (source numbers 208 and 50) have conflicting Cup highlighting. Their reconciled Cup value is null and source-specific flags are recorded in metadata. The display deliberately shows no Cup badges. National broadcast information is outside this display's scope.

## Compact storage

`src/data/planned-fixtures-2026-27.json` contains public provenance and positional rows:

1. Source-local number
2. UTC instant
3. Original ET date
4. Original ET clock
5. Designated away tricode
6. Designated home tricode
7. By-date PDF page
8. Away-team PDF page
9. Home-team PDF page
10. Original local clock text
11. Source `at` / `vs` relationship
12. Reconciled Cup flag (null for conflicts)
13. Alternate venue `[name, city]`, or null

Source numbers are not chronological and are never canonical NBA game IDs. The decoder sorts by UTC before filtering and limiting. Runtime keys are explicitly scoped to `nba-pdf:2026-08-13:by-date:<source-number>`. All official game IDs, current statuses and scores are null. No game-detail links, analytics records or zero scores are created.

The complete snapshot is imported only behind `server-only`. Day, month and upcoming responses are bounded; upcoming accepts at most 20 fixtures. The route makes no upstream fetches. It returns source facts, not a statement about current-source availability. Existing pages decide whether to show this fallback from the canonical data they already loaded.

## Precedence and lifecycle

Canonical schedule coverage is stored atomically with the exact cached schedule array and propagated through the versioned slim projection. Older concurrent responses cannot overwrite newer data or change its provenance. A validated official season schedule with actual structurally valid canonical games in its stated season establishes coverage; an empty requested day within that coverage suppresses the PDF. An empty whole-season array, a list containing only empty days, or a malformed response remains unavailable/stale and preserves previously known facts.

Canonical games always win. A replacement schedule does not blend obsolete same-season future arrangements back in; separately verified historical completed facts remain intact. A successful dated scoreboard can supply real rows by canonical ID and UTC timestamp when the season schedule is unavailable. Its empty ET-day evidence only excludes that ET date from a local-day fallback, rather than asserting coverage of an entire different-timezone day.

Home and calendar retain their existing request/refresh paths. Team and schedule pages reuse their already-loaded canonical context before requesting the local snapshot slice. No dependencies, services, credentials or additional live-source retries are added. Failed/invalid background refreshes retain their data timestamp and coverage, with an independent retry cooldown using the existing two-hour cadence. No polling is added. Team cache age is explicitly labeled “Cache loaded”; it is not advertised as source freshness.

Client responses are keyed by date/team/timezone and canceled on navigation or unmount. The UI shows the August 13 snapshot, source link, timezone, change warning and unassigned Cup scope. It can point to the next published date without claiming there is no season.

A future source update should replace this snapshot only after a reviewed source/hash and fact-level diff; do not silently relabel it as current.
