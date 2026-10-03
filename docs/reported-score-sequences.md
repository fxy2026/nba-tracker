# Official-gamebook reported score sequence

This isolated archive covers only `0022500961`, Memphis at Detroit on March 13,
2026 (MEM 110, DET 126). It contains **124 explicitly printed timed score rows,
including 3 possession rows**, and four separate untimed period-end summaries.
These are cumulative team-score observations, not 124 scoring events, complete
play-by-play, a live provider feed, shots, or player actions.

## Factual source and review

- Official source: https://statsdmz.nba.com/pdfs/20260313/20260313_MEMDET_book.pdf
- PDF SHA-256: `e798bb1ce8dd0d5e035f53af522567c8f5a038577ba3ba27be1bb3afb3afe55e`.
- Timed score rows are on PDF pages 9, 10, 11, 12, 14, 15, 17, 18 and 19.
  Endpoints are on pages 10, 12, 15 and 19; pages 13 and 16 have no timed score rows.
- Independent review approved every ordered factual row and endpoint with zero
  omissions, extras, ordering/clock/orientation/page mismatches. Its report hash
  is `7066cdf10871ecaa1cbeca9771f5bd218a1fb33d2aa1fcfead71399dafd9d5a7`.
- The unchanged factual-only canonical file is
  `src/data/reported-score-sequences/0022500961.json`, SHA-256
  `97209ef88c46f19cd95ae1664f6e60e9540de81b40e215047c8adf3ca49efe44`.
  Encoding: UTF-8, lexicographically sorted object keys, compact JSON, no final
  newline. The loader verifies this reviewed factual content hash at runtime.
- `docs/evidence/reported-score-sequences/0022500961.json` records the factual
  review digests, local identity reconciliation and preservation manifest. It
  includes no copied source narratives, extracted transcript or page images.

The independent PDF review did not authenticate NBA numeric IDs. That binding
was separately reconciled with the canonical archived schedule row:
`20260313/MEMDET`, UTC `2026-03-13T23:30:00Z`, home DET `1610612765` with 126,
away MEM `1610612763` with 110. The existing recovered player box independently
matches the game ID, local game date, sides, final scores and exact report URL.
The PDF identifies home Detroit and visiting Memphis and the same final on page 1.
The schedule and existing player-box byte hashes are recorded in the evidence.
No numeric ID was inferred from the PDF or a team name alone.

## Runtime and presentation boundaries

The strict validator accepts exactly five fields per timed row (period, printed
clock, home score, away score, PDF page) and four per untimed endpoint. It rejects
extra narrative/event fields, wrong counts/pages/order/clocks, bad reconciliation
and edited content even when the edited values remain superficially plausible.
The allowlisted loader also requires exact final status, game ID/code/date,
numeric team IDs, tricodes, home/away orientation and final scores. It fails closed.

The game page uses this separate representation only in its no-box,
schedule-known-final branch. It does not convert observations to `PlayAction`,
alter the live PBP path, synthesize a box score, or enable shot/replay/metric
widgets. It makes no additional source/provider requests and has no API route.
The Finals period-score module remains independent and unchanged.

The EN/ZH section leads with a responsive cumulative-score chart and keeps four
exact quarter tables behind one native, initially collapsed disclosure. Every row
retains source order and printed clock spelling, including all
12 decimal-clock rows and 17 repeated-clock groups. Keys are local array indexes,
never NBA event IDs. No artificial 0–0 opening row is added. Three opening
possession rows at Q2/Q3/Q4 12:00 remain genuine score-unchanged observations.
Quarter-end summaries are outside the timed-row tables and have no clock field;
00:00 is never fabricated. Every row/summary links to its exact PDF page, and
both languages clearly explain scope and limitations.

All 87 recovered player boxes and four career archives retain their exact bytes.
Tests pin the 91-file preservation manifest, approved facts, PDF hash, canonical
identity, counts/order/decimal clocks, endpoints, strict scope, plausible-content
tampering, live-vs-archive separation and both localized renderings.

## Score trend chart

The client receives only the five reviewed facts per timed row, two tricodes, the
source PDF URL and locale. Archive metadata, hashes, identities, evidence and
untimed endpoints remain outside the client component. No new requests or
dependencies are introduced. The server still gates this chart through the
existing reviewed, identity-bound loader.

The pure transform maps each printed clock onto elapsed regulation seconds. It
never sorts, rounds, deduplicates, inserts a 0–0 opening observation, assigns a
clock to an endpoint, or fills missing events. All 124 observations appear as
blue circles (home) and amber squares (away); faint dashed connectors are
explicitly identified as visual guides rather than continuous event data. The
chart does not derive lead changes, runs, shots, or play-by-play.

The full-game view has quarter dividers and four quarter zoom buttons. Pointer
inspection selects a real observation; a native range control and previous/next
buttons traverse source rows, including exact overlaps and repeated clocks. A
persistent readout shows the unchanged printed clock, both scores, record index
and source-page link. SVG description, live readout, shape-plus-color legend,
44-pixel controls, keyboard navigation, theme tokens and a server-rendered exact
table provide accessible alternatives. The static table remains usable without
JavaScript. Four untimed period-end summaries are still separate from its rows.

Reference research checked Hupu's official desktop game pages, which expose a
large scoreboard, compact quarter summary and chronological text-record table:
https://nba.hupu.com/games/boxscore/168859 and
https://nba.hupu.com/games/playbyplay/168859. No public score curve or touch
scrubbing design was verified there; this chart is an independent presentation,
not a claimed replica of an unseen Hupu visualization.
