# NBA identity registry

Captured 2026-10-03 from NBA Stats CommonAllPlayers, LeagueID=00,
Season=2026-27, IsOnlyCurrentSeason=0. The compact snapshot preserves the
5,238 unique positive NBA IDs, official display names and source season-start
years. It includes all 2,224 shot-archive IDs, all 587 bundled player-index IDs,
and all 620 IDs in the live NBA CDN index observed at capture.

The source URL, raw response SHA-256 and date are embedded in the snapshot.
Coverage means every row returned by this official query, not independently
proven universal completeness. This is a fixed snapshot, never a live activity
or team claim. FROM_YEAR / TO_YEAR are season-start years, not calendar career
endpoints. No biography, career averages or awards are derived from this data.

Three malformed source display names are explicitly overridden using official
NBA profile/CommonPlayerInfo corroboration; their original source names remain
in the compact registry, with correction evidence in the override file.
Verified curated ID corrections retain source proof in the corrections file.
Namesakes remain separate NBA IDs; names alone must never establish identity.

Shot summaries, real-coordinate packs, the existing player-index snapshot,
and verified career archives are unchanged by this identity expansion.
