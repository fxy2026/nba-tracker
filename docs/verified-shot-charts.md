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

Source coordinates share a normalized basket; they are never rewritten to infer
attacking direction. The full-court display applies an explicitly standardized
rigid transform in feet: away `(5.25 + y, 25 - x)`, home `(88.75 - y, 25 + x)`
on a 94 × 50 court. SVG adds 3 ft of border and scales by 10. Thus away is always
left and home right, not a claim about the actual attacking end in any period.
Negative y and genuine (0,0) positions remain exact. No jitter, clamping, record
dropping or inferred ball flight is permitted. Display bounds expand for genuine
outliers instead of clipping them. Half focus uses the original top-hoop view.

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

The initial release restored one reviewed game. Adding another game requires a new
public capture, an independent coordinate/identity/totals review and an explicit
archive/hash allowlist entry. Successful scraping alone is not publication.

## Three-game reviewed coverage

The archive now includes the separately captured and independently reviewed
Finals Game 5 (0042500405, NYK 94–90 SAS) and Lakers–Rockets first-round Game 3
(0042500173, LAL 112–108 HOU, overtime). The original MEM–DET factual and evidence
files remain byte-for-byte unchanged. That expansion established 531 shots across three games:
181 MEM–DET, 173 NYK–SAS and 177 LAL–HOU. At that stage, the other 84 official-period archives
had no verified shot chart; source availability is never inferred.

The new canonical local game codes are `20260613/NYKSAS` and `20260424/LALHOU`.
Their UTC tipoffs are June 14 00:30Z and April 25 00:00Z. Local game dates and UTC
tipoff dates must not be equated. The source footer links each game's own official
Game Charts page. Source metadata retains actual fresh capture completion times:
2026-10-03T06:22:28.352889+00:00 and 2026-10-03T06:22:32.965745+00:00.

Each game has its own explicit immutable facts hash, final identity, shooting
totals and period reconciliation in the server-only integrity allowlist. Every
shot and roster entry is verified before a minimal display object is returned.
Current defined team FG/3PT, made free throws, points, period scores and player
identity/shooting conflicts withhold the entire chart. Absent fields and the
normal empty-array API contract remain unknown, never zero-filled.

NYK–SAS period attempts are 43, 45, 46, 39. LAL–HOU has 47, 36, 39, 40 and 15
attempts, including all 15 official OT1 records. Only LAL–HOU's allowlist permits
period 5. ISO clocks are at most 720 seconds in regulation and 300 in overtime,
including fractional seconds at the boundary. Per-team period field-goal points
plus independently verified made free throws equal the official period scores;
period totals exactly reconcile to the final. Source row order remains intact.
The existing OT1 / 加时1 filter, shot selection and list labels are tested with
these real records. The comparison explorer is entirely SVG, with no canvas,
Three import, WebGL probe or animation loop in its dependency path. The older
optional 3D component is retained separately but is not mounted by this explorer.

New evidence files record 350 exact shot rows / 3,500 fields, 57 official roster
identities, and 42 played-player PDF rows. Numeric NBA person IDs come from the
NBA pages; printed PDF names and historical teams independently reconcile.
Raw PBP actionNumber can repeat for paired events, but each promoted shot ID is
unique. DNP/DND entries are identity evidence and never plotted. The Finals PDF's
original retrieval time remains unknown; no timestamp is invented. Its exact
preserved SHA-256 matches the official-period archive.

No new source/PBP payload, trajectory, provider request or paid quota is added.
Every original score sequence, period archive, player/career archive, screenshot
asset, dependency and top-down rendering file is preserved unchanged. New captures
still need independent review and an explicit integrity allowlist entry.

## Full-court comparison UI

The shared period/result controls are always visible, with independent away/home
player selectors. Per-team FG made/attempts/percentage follows player + period
selection and deliberately ignores the result visibility filter. The separately
labeled shown-shot count follows every filter and the current focus. Zero attempts
show a dash plus 0/0 and “No attempts,” never an invented percentage.

Full / away-half / home-half switches preserve both player selections. Team colors
identify sides; filled circles mean made and hollow circles mean missed. Lakers
purple and Spurs charcoal remain readable against maple. The court is one keyboard
stop: arrows browse every filtered shot, Home/End jump, Escape clears. A separately
accessible list and exact-location cycling expose genuine overlaps without moving
points. Mobile full-view glyphs enlarge without changing their centers.

The static court and marker layers are memoized. Hover updates only selection and
tooltip presentation. Source and coverage disclosures, source clocks, OT labels,
existing scores and unavailable-game behavior remain unchanged.

## Seven-game reviewed coverage

Finals Games 1–4 (0042500401–0042500404) now add 183, 167, 172 and 164
field-goal attempts, respectively. All five Finals games are covered. The four
new games contribute 686 exact source rows; total coverage is seven games and
1,217 attempts. The remaining 80 official-period archives have no verified chart.
The original three factual and evidence archives and all UI files are unchanged.

Each new game has its own explicit immutable canonical-facts SHA-256 pin, final
identity, local gameCode, UTC tipoff, source URL and actual capture timestamp.
Independently verified team/player FG and 3PT totals and all 32 team-quarter
FG-points-plus-made-FT totals reconcile to official gamebook period/final scores.
The existing validation schema and fail-closed checks are unchanged. Only the
reviewed Lakers–Rockets game permits period 5. No raw PBP, score observations,
narrative or player box minutes cross the shot-chart display boundary.

The new per-game evidence retains the independent review, original source hashes,
120 official roster identities, and 80 played-player PDF reconciliations. Numeric
NBA player IDs come from each historical official box/action pair, never provider
UUIDs or current rosters. DNP/DND rows remain identity evidence without shots.

Negative-y counts are 2, 32, 10 and 18; exact (0,0) counts are 9, 4, 4 and 7.
All original coordinates are retained, including those pairs. A reported zero
pair is not independent proof of exact basket-level precision; some such source
descriptions are not tip shots. No substitution, jitter, clamping, trajectory,
physical attacking-end or independently video-verified precision is claimed.
The same standardized full-court transform and source-relative half view apply.

Game 4 Jeremy Sochan's official embedded box minutes remain `2:60`; the PDF
prints `03:00`. Both durations equal 180 seconds, but the evidence does not claim
literal string agreement or silently normalize the original. Game 3 Sochan has
a genuine NYK 00:10 appearance even though the saved player archive rounds to
zero minutes. These minute caveats do not alter the plotted ten-field facts.
Official PDFs' original capture times remain unknown. Optional schedule points
leaders are not used as final player-stat evidence. The inert capture bundle and
independent source review are preserved; runtime inclusion required the separate
allowlist, data-integrity, UI-preservation and offline production gates.
