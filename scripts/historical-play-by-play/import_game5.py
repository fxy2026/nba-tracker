#!/usr/bin/env python3
"""Offline one-game factual extraction. Never runs cloned code or calls a provider."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import tarfile

ARCHIVE_SHA256 = "22f8479396ee7c5cd5a286f884eab4f9020d145e49cdfd7499d8abad5e70852c"
CSV_SHA256 = "0dd9a89e44c9b92026eb2fad2f5371b00fa650d8b6745184974fc2e1acd12812"
SOURCE = {
    "repository": "https://github.com/fxy2026/nba_data",
    "commit": "e829d4678be1e075f99e5d41a1c5f97089be446b",
    "archivePath": "datasets/nbastatsv3_po_2025.tar.xz",
    "archiveGitBlob": "e7237d33250fc71b5f1f5fa643988170420f4b3e",
    "archiveSha256": ARCHIVE_SHA256,
    "csvSha256": CSV_SHA256,
    "feed": "nbastatsv3",
    "captureTime": None,
    "verifiedOn": "2026-10-04",
}

def extract(archive: Path) -> dict:
    data = archive.read_bytes()
    if len(data) != 614224 or hashlib.sha256(data).hexdigest() != ARCHIVE_SHA256:
        raise ValueError("Archive bytes differ from reviewed source")
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:xz") as tar:
        members = tar.getmembers()
        if len(members) != 1 or not members[0].isfile() or members[0].name != "nbastatsv3_po_2025.csv" or members[0].size != 6512147:
            raise ValueError("Unexpected archive member or size")
        stream = tar.extractfile(members[0])
        if stream is None:
            raise ValueError("Missing CSV bytes")
        payload = stream.read(6512148)
    if len(payload) != 6512147 or hashlib.sha256(payload).hexdigest() != CSV_SHA256:
        raise ValueError("CSV bytes differ from reviewed source")
    reader = csv.reader(io.StringIO(payload.decode("utf-8", errors="strict"), newline=""))
    columns = next(reader)
    if len(columns) != 24 or len(set(columns)) != 24 or columns[-2:] != ["actionId", "gameId"]:
        raise ValueError("Unexpected source schema")
    rows = []
    for row in reader:
        if len(row) != len(columns):
            raise ValueError("Malformed source row")
        if row[-1] == "42500405":
            rows.append(row)
    if len(rows) != 554 or [r[-2] for r in rows] != [str(i) for i in range(1, 555)]:
        raise ValueError("Incomplete or reordered target game")
    return {"schemaVersion": 1, "kind": "reviewed-stats-v3-game-actions", "gameId": "0042500405", "source": SOURCE, "columns": columns, "rows": rows}

def encode(facts: dict) -> bytes:
    # All original cells remain strings, including blanks, decimals, IDs and
    # factual play descriptions. One row per line makes source review practical.
    head = json.dumps({k: v for k, v in facts.items() if k != "rows"}, ensure_ascii=False, indent=2)
    rows = ",\n".join("    " + json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in facts["rows"])
    return (head[:-2] + ',\n  "rows": [\n' + rows + '\n  ]\n}\n').encode("utf-8")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    encoded = encode(extract(args.archive))
    # This tool does not update the independent runtime allowlist or enable data.
    args.output.write_bytes(encoded)
    print(f"{len(encoded)} bytes; sha256={hashlib.sha256(encoded).hexdigest()}")
