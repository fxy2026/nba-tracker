# Historical shot-summary archive

This snapshot contains 42 regular-season/playoff packs for 2005-06 through 2025-26: 4,571,321 source shot rows, 2,224 distinct player IDs, and 14,824 player-season/type entries. The 18 older allowlisted packs are absent and are never exposed as zero-attempt seasons.

Compressed summaries stay on the server. The player-season API returns one bounded renderer DTO per selection; directory searches return at most 48 players. The gzip catalog and source summaries are not public assets or client imports.

Source: `fxy2026/nba_data`, revision `e829d4678be1e075f99e5d41a1c5f97089be446b`, NBA shotdetail regular-season/playoff files only. `catalog-index.json` records exactly the bundled files and SHA-256 hashes. A catalog entry means source data exists, not that the season is independently complete. No absent player-season is filled with zeros.

The default court-aligned 12-zone view is recomputed from exact source BASIC/AREA/RANGE groups: restricted area, non-restricted paint, five midrange directions, two corners and three above-break directions. Contradictory explicit point-type counts remain in a non-spatial classification-conflict residual. The legacy 14 distance/direction summaries remain retained in source, not reused as court-zone counts. Residual categories stay non-spatial and remain in the denominator. Three-point totals always use explicit source SHOT_TYPE, including historical shorter-line seasons and contradictory distance classifications. League comparisons are weighted counts from that same archive and season type; they are not NBA-displayed LA. Source download dates and later metadata observation dates remain distinct.

Official verified Curry 2025-26 and 2015-16 distance-zone aggregates are preserved unchanged as separate source facts. The new default court-aligned 2015 view uses the raw archive (804/1596 FG, 401/884 3P), explicitly compared with official controls (805/1598 FG, 402/886 3P); the shortfall is never assigned to a fabricated court region. Optional official controls verify only aggregate shooting totals, not every event or league coverage. Games containing shots are never relabelled as games played; official GP is displayed only with its separately sourced control.

Runtime checks compressed digests, bounds decompression, validates identity/counts/dates, retains two decompressed summaries and up to 256 immutable player DTOs. Failed reads and corrupt data are errors, not cached fabricated records. Next file tracing includes compressed data only for consuming server routes.

`staging-release-manifest.json` retains the source export manifest unchanged. Its original per-pack `*-manifest.json` paths are stored under `manifests/` here; the summary and catalog bytes remain identical. `semantic-content-digests.json` records count/classification identities separately from audit timestamps. Original parser versions remain explicit.
