# Verified court-shot archive

The first restored game is **MEM at DET, 2026-03-13, NBA 0022500961**.
Its 181 field-goal attempts are genuine coordinate-bearing events from the
[NBA official game charts](https://www.nba.com/game/mem-vs-det-0022500961/game-charts).
They are separate from the 124 gamebook-reported score observations.

## Source and verification

The public game page returned HTTP 200 on 2026-10-03 at 05:08:18.649 UTC.
Its embedded `playByPlay` payload identifies itself as `hanaV3`, contains 499
actions and supplies actual `xLegacy`, `yLegacy`, `shotValue`, `shotResult`,
period, clock, NBA player/team IDs and unique action numbers for all 181 shots.
No credentials, paid quota or restricted endpoint are needed for this capture.
The standalone CDN PBP request returned 403 and was not used.

The factual archive preserves the exact source fields, with a server-only
SHA-256 allowlist and exact final-game identity checks. All player FG and 3PT
counts reconcile against the same official page and the NBA final gamebook.
DET: 50/92 FG, 12/35 3PT. MEM: 38/89 FG, 15/41 3PT. Quarter attempts are
46, 45, 43 and 47. No free throws appear on the court.

`docs/evidence/verified-shot-charts/0022500961.json` records source hashes,
coordinate documentation, identity, counts and independent review results.

## Coordinate contract

`src/lib/court-shots.ts` is the client-safe display contract. Coordinates are
feet relative to the basket: `xFeet = xLegacy / 10`, `yFeet = yLegacy / 10`.
Positive x is right in the official top-hoop view; positive y goes toward
midcourt. This exactly follows the NBA site's own served chart code.

Both teams share a normalized basket. The scene does not claim the teams were
attacking the same physical end. Negative y positions and six genuine (0,0)
tip-layups remain unchanged. No jitter, mirroring by team/period or point
clamping is permitted. The source supplies no flight path, release height or
tracking coordinates above the floor, so none are represented as real data.

The source's `shotDistance` has 21 zero entries, including 15 three-pointers.
It is deliberately excluded from the display contract. The official numeric
`shotValue` determines 2PT/3PT, never distance or natural-language descriptions.

## Isolation and availability

`verified-shot-chart-archive.ts` holds server-only facts and integrity logic;
only the validated minimal display object crosses into the renderer. It does
not populate `PlayAction`, score events, scoring runs or other PBP consumers.
The restored chart is independently available when the CDN box/PBP are down.
An unknown or conflicting game has a clear unavailable state and no points.
If a current live box provides FG/3PT totals that disagree with the archive,
the archived chart is withheld even if the final score is unchanged. Absent
shooting totals remain unknown and are never defaulted to zero.

This release restores one reviewed game. Adding another game requires a new
public capture, an independent coordinate/identity/totals review and an explicit
archive/hash allowlist entry. Successful scraping alone is not publication.
