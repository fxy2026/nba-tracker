#!/usr/bin/env python3
"""Offline, additions-only import of the bounded PHI 2024-25 archive.

Usage: python scripts/prepare-sixers-season-archive.py COLLECTION_ROOT APP_ROOT
No network, player-ID inference, current-roster joins, or source prose exports.
The runtime TypeScript parser independently validates every projected box.
"""
import csv
import gzip
import hashlib
import io
import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

source, app = map(Path, sys.argv[1:])
target = app / "src/data/sixers-2024-25"
digest = lambda b: hashlib.sha256(b).hexdigest()
pack = lambda x: (json.dumps(x, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
read_json = lambda p: json.loads(p.read_bytes())
captures = [json.loads(line) for line in (source / "fetch-manifest.jsonl").read_text().splitlines()]
crosswalk_bytes = (source / "historical-indexes/espn-nba-game-crosswalk.json").read_bytes()
crosswalk = json.loads(crosswalk_bytes)
mapped = {x["espnEventId"]: x for x in crosswalk["matched"] if x["season"] == "2024-25"}
assert len(mapped) == 81 and len({x["nbaGameId"] for x in mapped.values()}) == 81

# Numeric NBA team identities are derived from the app's existing explicit map.
team_text = (app / "src/lib/teams.ts").read_text()
team_ids = {abbr: int(number) for abbr, number in re.findall(r"  (\w+): \{ teamId: (\d+),", team_text)}
espn_text = (app / "src/lib/espn-scoreboard.ts").read_text().split("export const ESPN_TEAM_TRICODES")[1].split("};")[0]
tricodes = dict(re.findall(r"'(\d+)': '(\w+)'", espn_text))
assert len(team_ids) == len(tricodes) == 30

nba_sources = {}
nba_games = defaultdict(dict)
for dataset in ["shotdetail", "nbastatsv3"]:
    path = source / f"historical-nba/{dataset}/2024-regular.csv.gz"
    archive_bytes = path.read_bytes()
    metadata = read_json(path.with_suffix(".manifest.json"))
    assert metadata["sha256"] == digest(archive_bytes) and metadata["games"] == 82
    nba_sources[dataset] = {"url": metadata["source"]["sourceUrl"], "sourceSha256": metadata["source"]["sha256"], "subsetSha256": digest(archive_bytes)}
    rows = csv.DictReader(io.StringIO(gzip.decompress(archive_bytes).decode()))
    for row in rows:
        gid = row["GAME_ID" if dataset == "shotdetail" else "gameId"].zfill(10)
        assert re.fullmatch(r"00224\d{5}", gid)
        if dataset == "shotdetail":
            assert row["TEAM_ID"] == "1610612755"
            identity = (row["GAME_DATE"], row["HTM"], row["VTM"])
            assert nba_games[gid].get("identity", identity) == identity
            nba_games[gid]["identity"] = identity
        else:
            if row["actionType"] == "period" and row["subType"] == "end" and row["clock"] == "PT00M00.00S" and row["scoreHome"] and row["scoreAway"]:
                nba_games[gid]["finalPeriod"] = {"period": int(row["period"]), "actionId": int(row["actionId"]), "homeScore": int(row["scoreHome"]), "awayScore": int(row["scoreAway"])}
            if row["scoreHome"] != "":
                nba_games[gid]["homeScore"] = int(row["scoreHome"])
            if row["scoreAway"] != "":
                nba_games[gid]["awayScore"] = int(row["scoreAway"])
assert len(nba_games) == 82
nba_by_identity = defaultdict(list)
for gid, row in nba_games.items():
    assert row["finalPeriod"]["period"] >= 4
    assert (row["finalPeriod"]["homeScore"], row["finalPeriod"]["awayScore"]) == (row["homeScore"], row["awayScore"])
    nba_by_identity[(*row["identity"], row["homeScore"], row["awayScore"])].append(gid)

nullable = lambda value: None if value in (None, "", "-", "--") else int(value)
simple = {"minutesRounded": "minutes", "points": "points", "rebounds": "rebounds", "assists": "assists", "steals": "steals", "blocks": "blocks", "offensiveRebounds": "offensiveRebounds", "defensiveRebounds": "defensiveRebounds", "turnovers": "turnovers", "fouls": "fouls", "plusMinus": "plusMinus"}
pairs = {"fieldGoals": "fieldGoalsMade-fieldGoalsAttempted", "threePointers": "threePointFieldGoalsMade-threePointFieldGoalsAttempted", "freeThrows": "freeThrowsMade-freeThrowsAttempted"}
games, files, counts = [], {}, defaultdict(int)
normalized = read_json(source / "normalized/2024-25/games.json")
assert len(normalized) == 88 and len({g["eventId"] for g in normalized}) == 88
for reference in normalized:
    event = reference["eventId"]
    assert re.fullmatch(r"\d{9}", event)
    path = f"raw/espn/summaries/2025/{event}.json"
    raw_bytes = (source / path).read_bytes()
    capture = [c for c in captures if c.get("path") == path and c.get("httpStatus") == 200][-1]
    api_url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={event}"
    assert capture["sha256"] == digest(raw_bytes) and capture["bytes"] == len(raw_bytes) and capture["url"] == api_url
    raw = json.loads(raw_bytes)
    header = raw["header"]
    assert header["id"] == event and header["uid"] == f"s:40~l:46~e:{event}"
    assert header["league"]["id"] == "46" and header["league"]["slug"] == "nba"
    assert header["season"]["year"] == 2025 and header["season"]["type"] in [1, 2]
    assert len(header["competitions"]) == 1
    competition = header["competitions"][0]
    assert competition["id"] == event and competition["boxscoreSource"] == "full"
    assert competition["status"]["type"]["completed"] is True and competition["status"]["type"]["state"] == "post"
    date = datetime.fromisoformat(competition["date"].replace("Z", "+00:00")).astimezone(ZoneInfo("America/New_York")).strftime("%Y-%m-%d")
    sides = {c["homeAway"]: c for c in competition["competitors"]}
    assert set(sides) == {"home", "away"} and len(competition["competitors"]) == 2
    teams = {}
    for side, c in sides.items():
        assert c["id"] == c["team"]["id"] and c["uid"] == c["team"]["uid"] == f"s:40~l:46~t:{c['id']}"
        tricode = tricodes.get(c["id"], c["team"]["abbreviation"])
        teams[side] = {"tricode": tricode, "teamId": team_ids.get(tricode), "espnTeamId": c["id"], "score": int(c["score"])}
    assert "PHI" in [t["tricode"] for t in teams.values()]
    assert teams["home"]["score"] != teams["away"]["score"]
    phase = "regular" if header["season"]["type"] == 2 else "preseason"
    identity_key = (date.replace("-", ""), teams["home"]["tricode"], teams["away"]["tricode"], teams["home"]["score"], teams["away"]["score"])
    candidates = nba_by_identity.get(identity_key, []) if phase == "regular" else []
    assert len(candidates) <= 1
    nba_id = candidates[0] if candidates else None
    assert (event in mapped or event == "401704888") == bool(nba_id)
    if event == "401704888":
        assert nba_id == "0022400322" and nba_games[nba_id]["finalPeriod"] == {"period": 4, "actionId": 476, "homeScore": 102, "awayScore": 106}
    if nba_id and event in mapped:
        assert mapped[event]["nbaGameId"] == nba_id and mapped[event]["espnSourceSha256"] == capture["sha256"]
    played, excluded = [], {"dnp": 0, "participationUnverified": 0}
    assert len(raw["boxscore"]["players"]) == 2
    for group in raw["boxscore"]["players"]:
        team = next(t for t in teams.values() if t["espnTeamId"] == group["team"]["id"])
        table = group["statistics"][0]
        assert len(group["statistics"]) == 1 and len(set(table["keys"])) == len(table["keys"])
        for athlete in table["athletes"]:
            if athlete["didNotPlay"]:
                assert athlete["stats"] == []
                excluded["dnp"] += 1
                continue
            assert len(athlete["stats"]) == len(table["keys"])
            stats = dict(zip(table["keys"], athlete["stats"]))
            if nullable(stats["minutes"]) is None:
                assert all(v in (None, "--", "-", "0", "+0", "0-0") for k, v in stats.items() if k != "minutes")
                excluded["participationUnverified"] += 1
                continue
            player = {"espnAthleteId": athlete["athlete"]["id"], "nbaPlayerId": None, "name": athlete["athlete"]["displayName"].strip(), "team": team["tricode"], "starter": athlete.get("starter")}
            player.update({k: nullable(stats.get(v)) for k, v in simple.items()})
            for prefix, key in pairs.items():
                pair = stats.get(key)
                made, attempts = (None, None) if pair in (None, "--", "-") else map(int, pair.split("-"))
                player[prefix + "Made"], player[prefix + "Attempted"] = made, attempts
            played.append(player)
        assert sum(p["points"] for p in played if p["team"] == team["tricode"]) == team["score"]
    assert len({p["espnAthleteId"] for p in played}) == len(played)
    counts["allPlayed"] += len(played)
    for key, value in excluded.items():
        counts["all_" + key] += value
    box_entry = None
    if nba_id:
        box = {"version": 1, "provider": "ESPN", "coverage": "source-boxscore", "game": {"nbaGameId": nba_id, "espnEventId": event, "season": "2024-25", "seasonType": "Regular Season", "gameDate": date, "gameCode": f"{date.replace('-', '')}/{teams['away']['tricode']}{teams['home']['tricode']}", "gameTimeUTC": competition["date"], **teams}, "retrievedAt": capture["retrievedAt"], "source": {"url": f"https://www.espn.com/nba/boxscore/_/gameId/{event}", "apiUrl": api_url, "rawSha256": capture["sha256"], "archived": True}, "players": played, "excluded": excluded}
        decoded = pack(box)
        compressed = gzip.compress(decoded, compresslevel=9, mtime=0)
        assert len(decoded) <= 128 * 1024 and len(compressed) <= 64 * 1024
        box_entry = {"gameId": nba_id, "eventId": event, "file": f"{nba_id}.json.gz", "sha256": digest(decoded), "compressedSha256": digest(compressed), "bytes": len(compressed), "uncompressedBytes": len(decoded), "sourceRawSha256": capture["sha256"], "sourceUrl": api_url, "retrievedAt": capture["retrievedAt"]}
        files[box_entry["file"]] = compressed
        counts["mappedPlayed"] += len(played)
        counts["mappedZeroMinutes"] += sum(p["minutesRounded"] == 0 for p in played)
        for key, value in excluded.items():
            counts["mapped_" + key] += value
    games.append({"eventId": event, "nbaGameId": nba_id, "phase": phase, "date": date, "tipoffUTC": competition["date"], "home": teams["home"], "away": teams["away"], "source": {"url": f"https://www.espn.com/nba/boxscore/_/gameId/{event}", "rawSha256": capture["sha256"], "retrievedAt": capture["retrievedAt"]}, "identityEvidence": {"method": "crosswalk-and-raw" if event in mapped else "crosswalk-omission-verified-final-period", "finalPeriod": nba_games[nba_id]["finalPeriod"], "crosswalkSha256": digest(crosswalk_bytes), "shotSubsetSha256": nba_sources["shotdetail"]["subsetSha256"], "pbpSubsetSha256": nba_sources["nbastatsv3"]["subsetSha256"]} if nba_id else None, "boxEntry": box_entry})

assert len(files) == 82 and sum(g["phase"] == "regular" for g in games) == 82
catalog = {"version": 1, "team": "PHI", "season": "2024-25", "sources": nba_sources, "games": sorted(games, key=lambda g: (g["date"], g["eventId"])), "coverage": dict(counts)}
files["catalog.json"] = pack(catalog)
assert len(files["catalog.json"]) <= 160 * 1024
# Validate all changes before writing. A rerun can only reproduce identical bytes.
for name, data in files.items():
    path = target / name
    assert not path.exists() or path.read_bytes() == data, f"Refusing to overwrite changed archive: {path}"
target.mkdir(parents=True, exist_ok=True)
for name, data in files.items():
    if not (target / name).exists():
        with (target / name).open("xb") as f:
            f.write(data)
print(json.dumps({"games": len(games), "internalGames": len(files) - 1, "gzipBytes": sum(len(b) for n, b in files.items() if n.endswith(".gz")), "catalogBytes": len(files["catalog.json"]), **counts}, indent=2))
