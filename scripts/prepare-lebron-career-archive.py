"""Reproduce the reviewed overlay from the separately collected public evidence.
Usage: python scripts/prepare-lebron-career-archive.py /path/to/lebron-data-collection
Raw ESPN responses and numeric StatMuse tables are preserved byte-for-byte.
"""
import collections, gzip, hashlib, json, pathlib, shutil, sys
root = pathlib.Path(__file__).resolve().parents[1]
source = pathlib.Path(sys.argv[1])
archive = root / 'src/data/player-game-log-archives'
evidence = root / 'docs/evidence/player-game-log'
manifest = json.loads((archive / 'manifest.json').read_text())
original = json.loads((source / 'espn-manifest.json').read_text())
old = {'2018-19', '2019-20', '2020-21', '2021-22', '2022-23', '2024-25', '2025-26'}
controls = {r['season']: r for r in json.loads((source / 'recovery/combined-23-season-controls.json').read_text())}
curated = json.loads((source / 'curated-gamelog-manifest.json').read_text())
supplements = json.loads((source / 'recovery/recovered-gamelog-supplements.json').read_text())
sm = json.loads((source / 'recovery/statmuse-manifest.json').read_text())
sm_by = {r['season']: r for r in sm}
review = {'schemaVersion': 1, 'playerId': 2544, 'seasons': []}
for item in original:
    season = item['season']
    if season in old:
        continue
    src = source / item['file']
    assert hashlib.sha256(gzip.decompress(src.read_bytes())).hexdigest() == item['uncompressedSha256']
    shutil.copyfile(src, archive / src.name)
    manifest = [r for r in manifest if not (r['playerId'] == 2544 and r['season'] == season)]
    manifest.append({'playerId': 2544, 'espnId': '1966', 'season': season, 'file': src.name, 'sha256': item['uncompressedSha256'], 'retrievedAt': item['retrievedAt'], 'retrievalPrecision': 'exact', 'url': item['sourceUrl']})
    season_review = {'season': season, 'sourceSha256': item['uncompressedSha256'], 'phases': []}
    for phase in ['Regular Season', 'Playoffs', 'Pre Season']:
        entry = next(r for r in curated if r['season'] == season and r['phase'] == phase)
        data = json.loads((source / entry['file']).read_text())
        changes = []
        for change in data['review']['historicalCodeChanges']:
            row = next(r for r in data['rows'] if r['id'] == change['eventId'])
            changes.append({'id': row['id'], 'date': row['date'], 'home': row['home'], 'sourceTeam': change['originalTeam'], 'sourceOpponent': change['originalOpponent'], 'team': row['team'], 'opponent': row['opponent'], 'nbaGameId': row['nbaGameId']})
        added = []
        for row in supplements:
            if row['season'] != season or row['phase'] != phase:
                continue
            kind = 'regular' if phase == 'Regular Season' else 'playoffs'
            added.append({'id': f"statmuse:lebron-{season}-{kind}-{row['date']}", 'nbaGameId': row['nbaGameId'], 'internalGameId': None, 'date': row['date'], 'team': row['team'], 'opponent': row['opponent'], 'home': row['home'], 'wl': row['resultDisplay'][0], 'sourceUrl': row['source']['seasonPageUrl'], 'sourceProvider': 'StatMuse', **row['stats']})
        phase_review = {'seasonType': phase, 'rows': entry['rows'] + len(added), 'aliases': changes, 'supplements': added}
        if phase == 'Regular Season':
            phase_review['totals'] = controls[season]['stats']
            assert phase_review['rows'] == controls[season]['gp']
        if added or season == '2013-14' and phase == 'Regular Season':
            s = sm_by[season]
            phase_review['supplementSource'] = {'provider': 'StatMuse', 'url': s['sourceUrl'], 'retrievedAt': s['retrievedAt']}
        if season == '2013-14' and phase == 'Regular Season':
            phase_review['assistReview'] = {'id': 'espn:400489766', 'date': '2014-03-03', 'team': 'MIA', 'opponent': 'CHA', 'home': True, 'sourceValue': 5, 'reviewedValue': 4}
        season_review['phases'].append(phase_review)
    review['seasons'].append(season_review)
blob = (json.dumps(review, separators=(',', ':')) + '\n').encode()
(archive / '2544-career-review.json.gz').write_bytes(gzip.compress(blob, mtime=0))
(archive / 'lebron-review-manifest.json').write_text(json.dumps({'file': '2544-career-review.json.gz', 'sha256': hashlib.sha256(blob).hexdigest(), 'seasons': [r['season'] for r in review['seasons']]}, indent=2) + '\n')
(archive / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
for item in sm:
    shutil.copyfile(source / 'recovery' / item['tablesFile'], evidence / item['tablesFile'])
(evidence / 'statmuse-manifest.json').write_text(json.dumps([{k: v for k, v in r.items() if k != 'htmlFile'} for r in sm], indent=2) + '\n')
print(f"Added {len(review['seasons'])} source archives; reviewed overlay {len(blob)} raw bytes.")
