# Resolved provider-identity evidence

The two JSON files in `resolved-player-box-originals/` retain the exact original rejected bytes for games 0042500154 and0042500155. They are audit evidence and are not imported by player-table rendering. Their hashes and original quarantine metadata remain in `resolved-player-box-quarantine.json`.

The provider's Drew Doughty identity was **not** mapped or aliased to Jrue Holiday. Instead, each replacement is a separately transcribed, independently reviewed NBA official final-report player line with `providerPlayerId: null`, report URL/hash/page, exact duration and verification date. The other53 provider lines were checked against their game reports and retained unchanged apart from explicit historical-team assignment and the established minute-field name conversion.

Recovered tables explicitly declare mixed BigBallsData / NBA official-report sources and mark each independent official line with ‡. These two games are no longer in the active quarantine directory; the incoming bad UUID/name guard remains unchanged. Verified game IDs/provider-match UUIDs still prevent the daily ingestor from overwriting either table. Historical originals do not become a second active game owner.

Build generation validates original byte/canonical hashes, all preserved-row hashes and source mappings, replacement provenance and the recovered snapshot hash before emitting either runtime aggregate. It refuses missing or mismatched resolution evidence. Automatic ingestion still stages only generic player snapshots plus its cursor state, never these reference-checked files or audit evidence.
