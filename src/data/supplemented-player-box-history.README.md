# Preserved partial player boxes

These files retain the exact bytes of previously verified partial boxes before independently sourced official records were appended. They are historical evidence, not a second active game store.

For `0042500164`, the provider omitted DaRon Holmes II and Jalen Pickett. The NBA official final report lists both Denver players as having played `00:01`, with all recorded counting statistics and plus/minus equal to zero. The report does not print a position for either bench player. Their added records therefore use `providerPlayerId: null`, `position: null`, exact official durations and field-level official provenance. Rounded zero minutes are not interpreted as DNP.

The original 19 player records and metadata are preserved unchanged here. `supplemented-player-box-history.json` binds the original byte/canonical hashes, completed snapshot hash, missing-row coverage and report reference. The build validates this chain before generating active archives. Automated ingestion cannot write this directory or the verified store.
