# Historical spatial shot maps

These compressed assets are server-only summaries of actual `LOC_X`/`LOC_Y` records from the pinned NBA shooting archive. They must not be placed in `public`, imported by client components, or sent as complete season packs to browsers.

## Scope and identity

The index contains regular-season and playoff archives for season starts 2005–2025. It does not establish complete NBA history or complete coverage of every official player-season. Each pack is linked to the immutable source summary by SHA-256. The source-summary files and their official controls are unchanged.

A separate, versioned per-player API projects only the selected player's two sparse hex grids, their same-cell league counts, and coverage metadata. The BASIC12 court-zone API remains a separate projection. A geometry-defined backcourt residual need not equal a source-zone-labelled backcourt residual.

## Coordinate and metric conventions

- Source units are tenths of a foot, with the near basket at `(0, 0)`, positive x to the right and positive y toward half court. Half-court bounds are inclusive: x −250 to 250, y −52.5 to 417.5. No reflection, repositioning, or synthetic coordinates are applied.
- The coordinate convention is checked against implementation references and source distances/directions. Individual event positions have not been independently verified against official footage or event coordinates.
- Pointy axial grids use radii 25 and 40 source units. Both resolutions are independently computed from original points. Grid cells can contain both explicit two- and three-point attempts.
- Efficiency is actual bin FG% minus the weighted archive FG% for that same bin, season, and season type. This league reference includes the selected player. It is not the official displayed LA figure. No statistical shrinkage or interpolated accuracy is represented as an observed percentage.
- Low-sample coloring is neutral below five player attempts or twenty league attempts. This threshold is a caution, not a significance test.
- Density, when rendered, is a smoothed estimate of binned attempt frequency only. It is not shooting accuracy and does not add attempts.

## Coverage and reconciliation

All four integer counts (`fgm`, `fga`, `fg3m`, `fg3a`) reconcile in each resolution. Plotted counts plus non-spatial residuals equal the archive total. Three-point counts come from explicit `SHOT_TYPE`, never from distance or court geometry.

Missing, nonfinite, invalid, out-of-court, and backcourt positions remain explicit residuals. An additional `coordinate-shot-type-conflict` residual quarantines only explicit three-point records at exactly `(0, 0)`. Literal source zero-coordinate audit counts retain those records; ordinary two-point zeros remain plotted. No near-three-point-line heuristic is used.

Official total comparisons remain separate controls. For example, Curry 2015–16 is still 804/1596 in the source archive versus 805/1598 in the official control. Missing attempts are never assigned to bins or zones.

## Runtime bounds

The server verifies compressed SHA-256 and byte length before decompression, with a 2 MiB compressed / 16 MiB expanded ceiling. Reads and decompression are serialized; at most two decoded packs are retained. Selected DTOs are immutable and cached up to 128 entries and a 4 MiB serialized-content budget, with a 128 KiB per-response ceiling. The strict client boundary accepts only the two known resolutions, at most 400 cells each, valid lattice footprints, explicit count conservation, and matching provenance/identity. Failures return unavailable or error, never a fabricated zero season.
