#!/usr/bin/env python3
"""Verify built GameImpact tracing carries the four exact reviewed raw assets."""
import argparse
import hashlib
import json
from pathlib import Path

FILES = {
    "src/data/verified-play-by-play/0042500405.json": "c1bcd29760ebbf00dc6331ff98026ecbd4d6cae5fc2622f246b8ebfb6c129e92",
    "src/data/recovered-player-boxes/0042500405.json": "ab4f25a4016eecb5875929430ee0abb05283b42712b5d3a4b975cd8564259591",
    "src/data/verified-shot-charts/0042500405.json": "a95e6a3331e698c76d98e03ecbe84d69e7f5c2061a5598a9c47196ece8165e34",
    "src/data/official-period-scores/0042500405.json": "72f8aa8a744257464532ffe5b01831386d9a60ab76b1b4982a99c0d3e92836f5",
}

def check(root: Path) -> dict:
    trace = root / ".next/server/app/lab/game-impact/page.js.nft.json"
    raw = json.loads(trace.read_text())
    traced = {(trace.parent / item).resolve() for item in raw["files"]}
    checked = {}
    for relative, expected in FILES.items():
        target = (root / relative).resolve()
        if target not in traced:
            raise ValueError(f"GameImpact deployment trace omits {relative}")
        data = target.read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f"Deployment asset differs from reviewed bytes: {relative}")
        # Parse only after the independent raw-byte check, as runtime does.
        json.loads(data)
        checked[relative] = {"bytes": len(data), "sha256": expected}
    return {"route": "/lab/game-impact", "trace": str(trace.relative_to(root)), "files": checked}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path, nargs="?", default=Path.cwd())
    args = parser.parse_args()
    print(json.dumps(check(args.root.resolve()), indent=2))
