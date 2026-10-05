# ESPN daily-scoreboard fallback

The timezone-aware home scoreboard can use ESPN when no canonical NBA games are available for the selected date. The current ET-day API path without `tz` also supports it. Historical callers without `tz`, calendar, standings, NBA detail pages and season analytics retain their existing contracts.

## Identity and presentation

`/api/games` keeps NBA records in `data`. An optional `espn` envelope contains source-native records with `source: "espn"`, `eventId`, an `espn:<eventId>` key, explicit season year/type, actual UTC tipoff, state and source URL. These records never become `ScheduleGame`/`NbaGame`, synthetic NBA IDs, internal game-detail links, player IDs, or box-score requests. ESPN's season year is the ending year (2027 for 2026–27); type 1 is preseason. Scheduled scores are null, not 0–0. Recognized team IDs map to team logos; international opponents retain their source identity without an NBA team ID.

Cards identify ESPN, the competition phase, display timezone, retrieval time and an external ESPN detail link. Only HTTPS `www.espn.com/nba/game/_/gameId/<matching eventId>` links returned in the provider's summary links are accepted. No URL is guessed when the source lacks a valid link.

## Date, coverage and failure semantics

The requested local day is converted to an exact half-open UTC interval using IANA timezone calendar boundaries. All intersecting ET calendar dates are requested concurrently, then events are filtered by actual UTC tipoff. This handles 23/25-hour DST days, UTC+14, UTC−11, midnight and skipped calendar dates without assuming a 24-hour day.

Existing nonempty NBA daily data wins. An empty, dated NBA scoreboard or explicitly empty dated rows in a validated matching-season NBA schedule can establish empty ET-day coverage. Whole-season metadata or a regular-season fixture alone does not establish preseason coverage. A known empty ET date excludes only that slice of another timezone's local day.

ESPN requests use the public dated NBA scoreboard endpoint with `limit=100`, a shared five-second deadline including body consumption, a 2 MiB limit per response, at most three overlapping ET days, no redirects and no retries. They use no credentials. The route cache handles repeated public requests; upstream reads are not stored independently. Current-day or live results use the existing 30-second shared cache policy, including a game continuing after the viewer's midnight. Provider failure is `state: "unavailable"`, not a valid empty day, and is returned with `Cache-Control: no-store`.

All rows must be structurally valid and belong to the requested ET date. Exact duplicates are collapsed; conflicting duplicates, wrong dates, unsupported states and incomplete responses fail closed. Successful `events: []` is a source-reported empty response. The observed ESPN response has no returned `day` or `season` envelope, so a genuinely empty payload cannot independently attest its date beyond the requested URL. A dated response containing events is checked against every event's timestamp.

A failed refresh retains previously successful same-date/timezone ESPN scores with a visible stale warning and Retry. Live scores continue using the existing refresh timer, even after local midnight. Switching date or timezone hides old scores immediately. An initially unavailable response offers Retry while retaining existing date navigation. A valid empty response replaces previous scores normally.

This is a daily scores fallback, not a full-season ESPN ingestion or an NBA-ID reconciliation service. Third-party API availability and schema are not guaranteed. NBA-only detail/statistical views remain unchanged.
