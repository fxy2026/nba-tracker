# Game-time player team assignments, 2026-10-05

All 31 previously unassigned saved games now use independent NBA official final-report player records: 645 played rows, grouped by the report's visitor/home sections. The prior 87 verified snapshots are byte-identical.

The original BigBallsData snapshots are preserved byte-for-byte in `original-provider/`, including provider UUIDs, names, rounded minutes and all source scalars. They are evidence only and are not active runtime sources. The new official rows do not inherit provider UUIDs or infer NBA player IDs.

`manifest.json` records the two source URLs, retrieval times and SHA-256 hashes for each game, the original and promoted snapshot hashes, and explicit name-to-team assignments. Page 1 of every official PDF was parsed independently, then its played rows and totals were compared with the game's ordinary NBA box-score page. Game ID, local date, home/away teams and final score were bound to the existing schedule. All 16 counting/shooting/signed plus-minus fields, starter positions and played-row counts matched. Each side's totals, five starters and exact durations passed the existing strict official-box validator. DNP/DND roster entries are not fabricated as played rows.

PDF minutes are authoritative and displayed as exact MM:SS:

- NBA game page `0022501176` renders Sandro Mamukelashvili as `24:60`; the official PDF prints `25:00`.
- NBA game page `0022501192` renders Scottie Barnes as `31:60`; the official PDF prints `32:00`.
- In `0022501171`, the original provider rounds Tre Mann's minutes to 3. The official PDF shows `03:30`; the official-only record retains that exact duration and a derived nearest-minute value of 4. The original 3 remains in the preserved provider file.

The four PDF pages covering `0022501198`, `0022501199` and the two `:60` cases were rendered and visually inspected for row/column alignment. An independent source review also checked all 72 played rows in `0022501198`, `0022501199` and `0022501171` against their PDF pages, including jerseys and exact durations.

No runtime fetch, quota, ingestion cadence or generic-provider trust rule changed. Future unverified provider snapshots still remain unassigned; this batch only promotes the 31 documented, source-checked games. Live NBA box scores retain first priority, followed by the existing official/recovered renderer. No play-by-play or shot-chart availability is inferred from these player records.
