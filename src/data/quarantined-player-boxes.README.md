# Withheld original provider snapshots

These unchanged originals are retained for audit and recovery, not imported by rendering code or included in the generated player-table archive. `player-box-quarantine.json` pins their original file hashes, source commit, report reference and unresolved reason.

0042500154 and0042500155 contain a returned row named Drew Doughty. The official reports do not contain that name and instead include a missing Portland starter, Jrue Holiday. Matching numeric lines do not establish that these provider identities are the same person. No name/identity correction was applied. Both whole supplementary tables are withheld pending a trustworthy identity resolution; official report links and final schedule scores remain available. A separately available official NBA box score remains preferred.

The ingestor includes quarantined game IDs and provider match UUIDs in its existing/protected set, so automatic backfill cannot silently reintroduce the rejected table. Automated data-publish paths exclude this directory and review metadata. Releasing a quarantine requires a reviewed source/identity correction, not an automatic retry or guessed alias.
