# Player season heatmap

The player page offers NBA's 14 displayed aggregate zones for Stephen Curry's 2025–26 and 2015–16 regular seasons. The season selector lists only these supported archives. Other players retain the existing partial game-sample heatmap and its coverage disclosure. No playoff or all-player/all-season coverage is implied.

## Loading and source boundary

- The server loads the current registered archive and supplies a minimal validated DTO with the initial player page.
- The client requests another supported season from `/api/player-season-heatmap`. This read-only route uses immutable local archives and makes no external source calls.
- Results are cached separately by player, season and season type for the lifetime of the mounted view. Repeated selections reuse successful results. In-flight requests are deduplicated, late responses cannot replace another selection, and unmount cancels pending requests.
- A failed response, unexpected identity, invalid DTO or failed source integrity check produces an error with Retry. An unsupported selection produces Unavailable. Neither becomes a zero-attempt dataset.
- The app never sends candidate evidence, raw source documents, full archives, source checksums or raw shot records to the client. Official source links and observation dates accompany the displayed aggregates.

## Visual and statistical rules

- Only the 14 canonical source IDs have court geometry. Row order cannot determine placement. Back Court and unclassified residuals appear separately; their locations and shot types are not inferred.
- All volume shares use the full season-attempt denominator, including residuals. Curry 2015–16 reconciles 801/1584 in mapped zones, 3/12 in Back Court and 1/2 unclassified to 805/1598 overall.
- Reference colors compare source-displayed FG% and source-displayed NBA LA using integer tenths. Above +3.0 percentage points is orange; below −3.0 is blue; the inclusive [−3.0, +3.0] band is yellow. This band is a product rule, not an NBA threshold or significance test. The chart year context is known; exact league filtering and denominators remain independently unverified.
- Missing LA or a missing benchmark makes reference coloring neutral. Actual FG% and shot-share modes remain usable. No attempts means no FG% (shown as a dash), zero share and neutral coloring. An asterisk marks 1–24 attempts.
- Absolute FG% bands: below 30%, 30–<45%, 45–<60%, at least 60%. Shot-share bands: below 5%, 5–<15%, at least 15% of all season attempts. The legend changes with the mode.
- The schematic widens source corner strips from 36 to 68 of 600 units. Source paths are unchanged; only geometric paths receive the display transform. Labels use normal glyphs with no horizontal compression, `textLength`, or font-stretch. This illustration is not a classifier for raw shot locations.
- There are 14 keyboard-focusable SVG regions with Enter/Space activation, persistent details and native button-list alternatives. Back Court and unclassified values remain in the list, outside the SVG. English and Chinese use the same counts and identities.
- The layout stacks on mobile and uses a court/detail layout on larger screens. Reduced-motion preferences are respected.

## Verification

Tests cover source integrity, identity/query validation, per-selection loading and retry, stale responses, cached revisits, language and season-type changes, keyboard/tap/list selection, exact ±3-point boundaries, absent benchmarks, zero attempts, count reconciliation, residual exclusion from the court and normal-width labels. Aggregate completeness is separate from raw-shot completeness. This release contains no raw-point or density view.
