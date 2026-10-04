#!/usr/bin/env python3
"""Import only pinned local 1996–2004 NBA shot CSV archives; never acquire or execute source code.

Existing 2005–2025 summary/spatial bytes and official controls are immutable.
Unknown SHOT_TYPE rows are audited and excluded from all derived counts, never guessed.
"""
import argparse
import collections
import csv
import datetime
import gzip
import hashlib
import io
import json
import lzma
import math
from pathlib import Path
import re
import tarfile

PIN = 'e829d4678be1e075f99e5d41a1c5f97089be446b'
PARSER = 'nba-shot-summary-v1.2.0'
SPATIAL_PARSER = 'nba-spatial-importer-v1.2.0'
MAX_EXPANDED = 128 * 1024 * 1024
COUNT_KEYS = ('fgm', 'fga', 'fg3m', 'fg3a')
REASONS = ('missing-coordinate', 'nonfinite-coordinate', 'invalid-coordinate', 'out-of-court', 'backcourt', 'coordinate-shot-type-conflict')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded(value))


def write_gzip(path, value):
    raw = encoded(value)
    data = gzip.compress(raw, compresslevel=9, mtime=0)
    path.write_bytes(data)
    assert len(data) <= 2 * 1024 * 1024 and len(raw) <= 16 * 1024 * 1024
    return {'file': str(path), 'bytes': len(data), 'uncompressedBytes': len(raw), 'sha256': sha(data)}


def zero():
    return dict.fromkeys(COUNT_KEYS, 0)


def add(target, row):
    for key in COUNT_KEYS:
        target[key] += row[key]


def counts(row):
    return {key: row[key] for key in COUNT_KEYS}


def bin_for(x, y, radius):
    q = (math.sqrt(3) / 3 * x - y / 3) / radius
    r = 2 * y / (3 * radius)
    cube = [q, -q-r, r]
    rounded = [math.floor(v + 0.5) for v in cube]
    error = [abs(a-b) for a, b in zip(cube, rounded)]
    # Equal-error priority is z, y, x, matching the existing spatial contract.
    if error[0] > error[1] and error[0] > error[2]:
        rounded[0] = -rounded[1]-rounded[2]
    elif error[1] > error[2]:
        rounded[1] = -rounded[0]-rounded[2]
    else:
        rounded[2] = -rounded[0]-rounded[1]
    return rounded[0], rounded[2]


def coordinate(row, three):
    if row['LOC_X'] == '' or row['LOC_Y'] == '':
        return 'missing-coordinate', None
    try:
        point = tuple(float(row[key]) for key in ('LOC_X', 'LOC_Y'))
    except ValueError:
        return 'invalid-coordinate', None
    if not all(math.isfinite(v) for v in point):
        return 'nonfinite-coordinate', None
    x, y = point
    if not (-250 <= x <= 250 and -52.5 <= y <= 887.5):
        return 'out-of-court', point
    if y > 417.5:
        return 'backcourt', point
    if three and x == 0 and y == 0:
        return 'coordinate-shot-type-conflict', point
    return None, point


def read_archive(path, inventory):
    assert path.is_file() and not path.is_symlink(), 'Archive must be a regular local file'
    compressed = path.read_bytes()
    assert len(compressed) == inventory['size']
    git_sha = hashlib.sha1(f'blob {len(compressed)}\0'.encode() + compressed).hexdigest()
    assert git_sha == inventory['sha'], f'Wrong source blob: {path.name}'
    decoder = lzma.LZMADecompressor(format=lzma.FORMAT_XZ, memlimit=MAX_EXPANDED)
    raw = decoder.decompress(compressed, max_length=MAX_EXPANDED + 1)
    assert len(raw) <= MAX_EXPANDED and decoder.eof and not decoder.unused_data, 'Unbounded or concatenated XZ'
    expected = path.name.removesuffix('.tar.xz') + '.csv'
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        members = archive.getmembers()
        assert len(members) == 1, 'Expected one CSV member'
        member = members[0]
        assert member.isfile() and member.name == expected and member.size <= MAX_EXPANDED, 'Unsafe tar member'
        source = archive.extractfile(member)
        assert source is not None
        csv_bytes = source.read(MAX_EXPANDED + 1)
        assert len(csv_bytes) == member.size
    return compressed, csv_bytes, {'name': member.name, 'bytes': member.size, 'tarMtime': member.mtime}


class Block:
    def __init__(self, zone_order):
        self.total = zero()
        self.zones = {zone: zero() for zone in zone_order}
        self.triples = collections.defaultdict(zero)
        self.games = set()
        self.names = set()
        self.teams = collections.defaultdict(set)
        self.plotted = zero()
        self.residuals = {reason: zero() for reason in REASONS}
        self.bins = {name: collections.defaultdict(zero) for name in ('fine', 'coarse')}
        self.zeros = zero()
        self.dates = set()

    def ingest(self, row, shot, reason, point, day):
        add(self.total, shot)
        triple = tuple(row[key] for key in ('SHOT_ZONE_BASIC', 'SHOT_ZONE_AREA', 'SHOT_ZONE_RANGE'))
        add(self.triples[triple], shot)
        distance_key = f'{triple[1]} | {triple[2]}'
        if distance_key in self.zones:
            add(self.zones[distance_key], shot)
        self.games.add(row['GAME_ID'])
        self.names.add(row['PLAYER_NAME'])
        self.teams[row['TEAM_ID']].add(row['TEAM_NAME'])
        self.dates.add(day)
        if point == (0, 0):
            add(self.zeros, shot)
        if reason:
            add(self.residuals[reason], shot)
        else:
            add(self.plotted, shot)
            for name, radius in [('fine', 25), ('coarse', 40)]:
                add(self.bins[name][bin_for(*point, radius)], shot)

    def summary(self):
        triples = [dict(zip(('basic', 'area', 'range'), key), **value) for key, value in sorted(self.triples.items())]
        residual = [row for row in triples if f"{row['area']} | {row['range']}" not in self.zones]
        return {**self.total, 'shotBearingGames': len(self.games), 'zones': self.zones, 'residualZones': residual, 'sourceZoneCounts': triples}

    def spatial(self):
        assert all(sum(v[k] for v in self.residuals.values()) + self.plotted[k] == self.total[k] for k in COUNT_KEYS)
        for grid in self.bins.values():
            assert len(grid) <= 400 and all(sum(v[k] for v in grid.values()) == self.plotted[k] for k in COUNT_KEYS)
        return {'total': self.total, 'plotted': self.plotted, 'residuals': self.residuals,
                'bins': {name: [[*key, *[v[k] for k in COUNT_KEYS]] for key, v in sorted(grid.items())] for name, grid in self.bins.items()},
                'shotBearingGames': len(self.games), 'minGameDate': min(self.dates), 'maxGameDate': max(self.dates), 'recordedZeroCoordinates': self.zeros}


def process(root, source, item, verified_at, release_sha, template, zone_order, code_sha):
    path = source / item['path']
    compressed, csv_bytes, member = read_archive(path, item)
    year = int(path.name.removesuffix('.tar.xz').split('_')[-1])
    playoff = '_po_' in path.name
    season = f'{year}-{(year+1)%100:02}'
    season_type = 'Playoffs' if playoff else 'Regular Season'
    stem = f'{season}-{"playoffs" if playoff else "regular"}'
    league = Block(zone_order)
    players = {}
    keys = set()
    quarantined = []
    shot_types = collections.Counter()
    extrema = {key: [] for key in ('x', 'y')}
    csv.field_size_limit(4096)
    reader = csv.DictReader(io.StringIO(csv_bytes.decode('utf-8-sig'), newline=''))
    required = {'PLAYER_ID', 'PLAYER_NAME', 'TEAM_ID', 'TEAM_NAME', 'GAME_ID', 'GAME_EVENT_ID', 'SHOT_TYPE', 'SHOT_ATTEMPTED_FLAG', 'SHOT_MADE_FLAG', 'GAME_DATE', 'LOC_X', 'LOC_Y', 'SHOT_ZONE_BASIC', 'SHOT_ZONE_AREA', 'SHOT_ZONE_RANGE'}
    assert required <= set(reader.fieldnames or []) and len(set(reader.fieldnames)) == len(reader.fieldnames)
    row_count = 0
    for row_count, row in enumerate(reader, 1):
        assert None not in row and all(value is not None for value in row.values()), f'Malformed CSV row {row_count}'
        key = (row['GAME_ID'], row['GAME_EVENT_ID'])
        assert key not in keys, f'Duplicate event {key}'
        keys.add(key)
        assert all(re.fullmatch(r'[1-9]\d*', row[key]) and int(row[key]) <= 9007199254740991 for key in ('PLAYER_ID', 'TEAM_ID', 'GAME_ID')), f'Invalid positive identity at CSV row {row_count}'
        assert re.fullmatch(r'0|[1-9]\d*', row['GAME_EVENT_ID']) and int(row['GAME_EVENT_ID']) <= 9007199254740991, f'Invalid event identity at CSV row {row_count}'
        assert re.fullmatch(f'{4 if playoff else 2}{year % 100:02}' + r'\d{5}', row['GAME_ID']), 'Wrong game season/type identity'
        assert re.fullmatch(r'\d{8}', row['GAME_DATE']), 'Malformed game date'
        assert row['SHOT_ATTEMPTED_FLAG'] == '1' and row['SHOT_MADE_FLAG'] in ('0', '1')
        day = datetime.datetime.strptime(row['GAME_DATE'], '%Y%m%d').date().isoformat()
        assert f'{year}-07-01' <= day <= f'{year+1}-12-31'
        assert 0 < len(row['PLAYER_NAME']) <= 150
        shot_types[row['SHOT_TYPE']] += 1
        if row['SHOT_TYPE'] not in ('2PT Field Goal', '3PT Field Goal'):
            quarantined.append({'csvRow': row_count, 'reason': 'unknown-explicit-shot-type', 'record': row})
            continue
        three = row['SHOT_TYPE'] == '3PT Field Goal'
        made = int(row['SHOT_MADE_FLAG'])
        shot = dict(fgm=made, fga=1, fg3m=made if three else 0, fg3a=int(three))
        reason, point = coordinate(row, three)
        if point and all(math.isfinite(v) for v in point):
            extrema['x'].append(point[0]); extrema['y'].append(point[1])
        player = players.setdefault(row['PLAYER_ID'], Block(zone_order))
        player.ingest(row, shot, reason, point, day)
        league.ingest(row, shot, reason, point, day)
    assert row_count == league.total['fga'] + len(quarantined)
    assert all(sum(p.total[k] for p in players.values()) == league.total[k] for k in COUNT_KEYS)
    for reason in REASONS:
        assert all(sum(p.residuals[reason][k] for p in players.values()) == league.residuals[reason][k] for k in COUNT_KEYS)
    for resolution, grid in league.bins.items():
        for cell, count in grid.items():
            assert all(sum(p.bins[resolution].get(cell, zero())[k] for p in players.values()) == count[k] for k in COUNT_KEYS)
    quarantine_players = collections.Counter(q['record']['PLAYER_ID'] for q in quarantined)
    quality_flags = ['non-spatial-residual-categories-present'] if any(v['fga'] for v in league.residuals.values()) else []
    if quarantined:
        quality_flags.append('unknown-shot-type-rows-quarantined')
    quality = {'csvRows': league.total['fga'], 'sourceCsvRows': row_count, 'quarantinedRowCount': len(quarantined),
               'rowCountConvention': 'csvRows-accepted-explicit-point-type-only',
               'shotBearingGames': len(league.games), 'playersWithShots': len(players), 'teamsWithShots': len(league.teams),
               'minGameDate': min(league.dates), 'maxGameDate': max(league.dates), 'duplicateGameEventKeys': 0,
               'shotTypeRowCounts': dict(shot_types), 'coordinateExtrema': {'minX': min(extrema['x']), 'maxX': max(extrema['x']), 'minY': min(extrema['y']), 'maxY': max(extrema['y'])},
               'validation': 'passed', 'officialCoverage': 'not-officially-reconciled', 'qualityFlags': quality_flags,
               'members': [member], 'uncompressedSha256': sha(csv_bytes), 'officialControls': []}
    provenance = {'repository': 'fxy2026/nba_data', 'revision': PIN, 'path': item['path'],
                  'sourceUrl': f'https://raw.githubusercontent.com/fxy2026/nba_data/{PIN}/{item["path"]}',
                  'acquisitionMethod': 'user-authorized-git-clone-local-blob-verification', 'localVerifiedAt': verified_at,
                  'verificationTimestampPrecision': 'minute', 'metadataVerifiedAt': verified_at, 'gitBlobSha1': item['sha'], 'compressedSha256': sha(compressed),
                  'compressedBytes': len(compressed), 'classification': 'exact-source-SHOT_ZONE_AREA-and-SHOT_ZONE_RANGE',
                  'leagueBenchmark': 'weighted-archive-counts-not-official-displayed-LA', 'rawPointAvailability': 'not-exported',
                  'parserCodeSha256': code_sha, 'archiveSafetyProfile': 'one-regular-csv-member-no-extraction-128MiB-xz-memory-and-output'}
    summary_players = {}
    spatial_players = {}
    for pid, block in sorted(players.items(), key=lambda pair: int(pair[0])):
        extras = {'playerId': pid, 'names': sorted(block.names), 'officialGp': None, 'officialControl': None,
                  'coverageStatus': 'not-officially-reconciled', 'quarantinedRowCount': quarantine_players[pid],
                  'qualityFlags': ['unknown-shot-type-rows-quarantined'] if quarantine_players[pid] else []}
        summary_players[pid] = {**block.summary(), **extras, 'rawPlayerIds': [pid],
                                'teams': [{'teamId': tid, 'names': sorted(names), 'rawIds': [tid]} for tid, names in sorted(block.teams.items())]}
        spatial_players[pid] = {**block.spatial(), **extras}
    summary = {'schemaVersion': 1, 'parserVersion': PARSER, 'seasonStartYear': year, 'season': season, 'seasonType': season_type,
               'zoneOrder': zone_order, 'league': league.summary(), 'players': summary_players, 'quality': quality, 'provenance': provenance}
    summary_file = f'summaries/{stem}.json.gz'
    transport = write_gzip(root / 'historical-shot-archive' / summary_file, summary)
    transport['file'] = summary_file
    summary_entry = {'season': season, 'seasonType': season_type, 'file': summary_file, 'sha256': transport['sha256'],
                     'compressedBytes': transport['bytes'], 'playersWithShots': len(players), 'fga': league.total['fga'], 'qualityFlags': quality_flags}
    write_json(root / 'historical-shot-archive' / 'manifests' / f'{stem}-manifest.json',
               {'schemaVersion': 1, 'parserVersion': PARSER, 'source': provenance, 'quality': quality, 'output': transport})
    spatial = {'schemaVersion': 'nba-spatial-v1', 'geometryVersion': template['geometryVersion'], 'parserVersion': SPATIAL_PARSER,
               'seasonStartYear': year, 'season': season, 'seasonType': season_type,
               **{k: template[k] for k in ('coordinateFrame', 'geometry', 'metrics')},
               'provenance': {'sourceArchive': provenance, 'sourceCsvSha256': sha(csv_bytes), 'sourceSummarySha256': transport['sha256'],
                              'sourceReleaseSha256': release_sha, 'generatingCodeSha256': code_sha,
                              'coordinateVerification': 'existing-versioned-geometry-source-coordinates-not-official-event-verification'},
               'quality': {'csvRows': league.total['fga'], 'sourceCsvRows': row_count, 'quarantinedRowCount': len(quarantined),
                           'duplicateGameEventKeys': 0, 'officialCoverage': 'not-officially-reconciled', 'qualityFlags': quality_flags, 'sourceQuality': quality},
               'players': spatial_players, 'league': league.spatial()}
    spatial_file = f'assets/{stem}.json.gz'
    spatial_transport = write_gzip(root / 'historical-shot-spatial' / spatial_file, spatial)
    spatial_entry = {'season': season, 'seasonType': season_type, 'seasonStartYear': year, 'file': spatial_file,
                     'sha256': spatial_transport['sha256'], 'compressedBytes': spatial_transport['bytes'], 'uncompressedBytes': spatial_transport['uncompressedBytes'],
                     'sourceSummarySha256': transport['sha256'], 'sourceArchiveSha256': sha(compressed), 'sourceCsvSha256': sha(csv_bytes),
                     'playersWithShots': len(players), 'total': league.total, 'plotted': league.plotted, 'residuals': league.residuals,
                     'minGameDate': min(league.dates), 'maxGameDate': max(league.dates)}
    audit = {'season': season, 'seasonType': season_type, 'sourcePath': item['path'], 'sourceGitBlobSha1': item['sha'],
             'sourceCsvSha256': sha(csv_bytes), 'sourceCsvRows': row_count, 'acceptedRows': league.total['fga'],
             'quarantinedRows': quarantined, 'players': len(players), 'shotBearingGames': len(league.games), 'total': league.total,
             'plotted': league.plotted, 'residuals': league.residuals,
             'jordan': {'summary': summary_players.get('893'), 'spatial': spatial_players.get('893')}}
    print(f'{stem}: {row_count} source, {league.total["fga"]} accepted, {len(players)} players', flush=True)
    return summary_entry, spatial_entry, summary_players, audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Verified local clone root')
    parser.add_argument('--verified-at', required=True, help='Actual local verification batch minute, ISO UTC ending :00Z')
    args = parser.parse_args()
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z', args.verified_at)
    datetime.datetime.fromisoformat(args.verified_at.replace('Z', '+00:00'))
    root = Path(__file__).resolve().parents[2] / 'src/data'
    summary_root = root / 'historical-shot-archive'
    spatial_root = root / 'historical-shot-spatial'
    code_sha = sha(Path(__file__).read_bytes())
    inventory = json.loads((summary_root / 'source-inventory.json').read_text())
    assert inventory['revision'] == PIN and inventory['archiveCount'] == 60
    items = [x for x in inventory['archives'] if re.fullmatch(r'datasets/shotdetail_(?:po_)?(?:199[6-9]|200[0-4])\.tar\.xz', x['path'])]
    assert len(items) == 18
    # Verify all inputs before writing any derived output.
    for item in items:
        data = (args.source / item['path']).read_bytes()
        assert len(data) == item['size'] and hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest() == item['sha']
    index = json.loads((summary_root / 'catalog-index.json').read_text())
    spatial_index = json.loads((spatial_root / 'index.json').read_text())
    old_summary = [e for e in index['summaries'] if int(e['season'][:4]) >= 2005]
    old_spatial = [e for e in spatial_index['entries'] if int(e['season'][:4]) >= 2005]
    assert len(old_summary) == 42 and len(old_spatial) == 42
    preserved = [(summary_root / e['file'], e['sha256']) for e in old_summary] + [(spatial_root / e['file'], e['sha256']) for e in old_spatial]
    for path, digest in preserved:
        assert sha(path.read_bytes()) == digest
    catalog = json.loads(gzip.decompress((summary_root / 'player-season-catalog.json.gz').read_bytes()))
    # Rebuilding is deterministic and idempotent; drop only this import's older entries first.
    catalog['players'] = {pid: {**p, 'seasons': [s for s in p['seasons'] if int(s['season'][:4]) >= 2005]} for pid, p in catalog['players'].items()}
    catalog['players'] = {pid: p for pid, p in catalog['players'].items() if p['seasons']}
    release = {'schemaVersion': 1, 'repository': 'fxy2026/nba_data', 'revision': PIN, 'localVerifiedAt': args.verified_at,
               'verificationTimestampPrecision': 'minute', 'acquisitionMethod': 'user-authorized-git-clone-local-blob-verification', 'parserVersion': PARSER, 'spatialParserVersion': SPATIAL_PARSER,
               'parserCodeSha256': code_sha, 'archives': items, 'scope': '1996-2004-NBA-regular-and-playoffs-only',
               'unknownShotTypePolicy': 'retain-exact-record-in-validation-report-exclude-from-all-derived-counts-never-infer'}
    write_json(summary_root / 'early-import-source-manifest.json', release)
    release_sha = sha((summary_root / 'early-import-source-manifest.json').read_bytes())
    template = json.loads(gzip.decompress((spatial_root / old_spatial[0]['file']).read_bytes()))
    zone_order = json.loads(gzip.decompress((summary_root / old_summary[0]['file']).read_bytes()))['zoneOrder']
    new_summary, new_spatial, audits = [], [], []
    for item in items:
        entry, spatial_entry, players, audit = process(root, args.source, item, args.verified_at, release_sha, template, zone_order, code_sha)
        new_summary.append(entry); new_spatial.append(spatial_entry); audits.append(audit)
        for pid, row in players.items():
            target = catalog['players'].setdefault(pid, {'playerId': pid, 'names': row['names'], 'seasons': []})
            target['names'] = list(dict.fromkeys(target['names'] + row['names']))
            target['seasons'].append({'season': entry['season'], 'seasonType': entry['seasonType'], 'summary': entry['file'],
                                      **{k: row[k] for k in (*COUNT_KEYS, 'shotBearingGames', 'officialGp', 'coverageStatus', 'qualityFlags')}})
    for p in catalog['players'].values():
        p['seasons'].sort(key=lambda s: (s['season'], s['seasonType'] == 'Regular Season'), reverse=True)
    catalog['players'] = dict(sorted(catalog['players'].items(), key=lambda pair: int(pair[0])))
    summaries = sorted(old_summary + new_summary, key=lambda e: (e['season'], e['seasonType']))
    catalog.update(parserVersion=PARSER, stagedArchiveCount=60, summaries=summaries)
    catalog_transport = write_gzip(summary_root / 'player-season-catalog.json.gz', catalog)
    catalog_transport['file'] = 'player-season-catalog.json.gz'
    index.update(stagedArchiveCount=60, playerCount=len(catalog['players']), catalog=catalog_transport, summaries=summaries)
    write_json(summary_root / 'catalog-index.json', index)
    spatial_index.update(parserVersion='mixed-versioned-v1.1.0-v1.2.0', stagedArchiveCount=60, expectedFrozenArchives=60,
                         completeHistory=False, completeAllowlistedHistoryStaged=True, unavailableStartYears=[], unavailableReason=None,
                         combinedCompressedBytes=sum(e['compressedBytes'] for e in old_spatial+new_spatial),
                         totalAttempts=sum(e['total']['fga'] for e in old_spatial+new_spatial),
                         sourceReleaseSha256=None, sourceReleases=[{'seasonStartMin': 2005, 'seasonStartMax': 2025, 'parserVersion': 'nba-spatial-importer-v1.1.0', 'sha256': template['provenance']['sourceReleaseSha256']},
                                                                  {'seasonStartMin': 1996, 'seasonStartMax': 2004, 'parserVersion': SPATIAL_PARSER, 'sha256': release_sha}],
                         entries=sorted(old_spatial+new_spatial, key=lambda e: (e['season'], e['seasonType'])))
    write_json(spatial_root / 'index.json', spatial_index)
    for path, digest in preserved:
        assert sha(path.read_bytes()) == digest
    report = {'schemaVersion': 1, 'parserVersion': PARSER, 'spatialParserVersion': SPATIAL_PARSER, 'sourceReleaseSha256': release_sha,
              'original42SummaryAndSpatialFilesByteIdentical': True, 'newArchiveCount': 18, 'archiveCount': 60,
              'newRawRows': sum(a['sourceCsvRows'] for a in audits), 'newAcceptedRows': sum(a['acceptedRows'] for a in audits),
              'allAcceptedRows': sum(e['fga'] for e in summaries), 'quarantinedRows': sum(len(a['quarantinedRows']) for a in audits),
              'playerCount': len(catalog['players']), 'playerSeasonTypeEntries': sum(len(p['seasons']) for p in catalog['players'].values()),
              'packReports': audits}
    write_json(summary_root / 'early-import-validation-report.json', report)
    # Current manifest is explicitly separate from the immutable original partial staging manifests.
    files = [summary_root / 'catalog-index.json', summary_root / 'player-season-catalog.json.gz', spatial_root / 'index.json']
    files += [summary_root / e['file'] for e in new_summary] + [spatial_root / e['file'] for e in new_spatial]
    files += [summary_root / 'early-import-source-manifest.json', summary_root / 'early-import-validation-report.json']
    write_json(summary_root / 'early-import-release-manifest.json', {'schemaVersion': 1, 'status': 'validated-local-derived-assets',
               'sourceReleaseSha256': release_sha, 'stagedArchiveCount': 60, 'completeAllowlistedHistoryStaged': True,
               'completeNbaHistory': False, 'files': [{'file': str(p.relative_to(root)), 'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())} for p in files]})
    print(json.dumps({k:v for k,v in report.items() if k != 'packReports'}, indent=2))


if __name__ == '__main__':
    main()
