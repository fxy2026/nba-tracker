# One-off: assemble the 2025-26 season schedule dataset from Wayback
# scoreboard captures + ESPN finals + archived nba.com/game URL evidence.
# Inputs live in the temp dir produced during the 2026-07 recovery session.
import json, sys, os, collections
from datetime import datetime, timedelta
from pathlib import Path
from archive_schedule_identity import validate_schedule_identities
from archive_synthetic_identities import (
    canonicalize_verified_synthetic_games, synthetic_identity_corrections,
    validate_verified_synthetic_sources,
)

tmp = sys.argv[1]
wb = json.load(open(os.path.join(tmp, 'wb_games.json'), encoding='utf-8'))
espn = json.load(open(os.path.join(tmp, 'espn_games.json'), encoding='utf-8'))
assign = json.load(open(os.path.join(tmp, 'assign3.json'), encoding='utf-8'))
still = json.load(open(os.path.join(tmp, 'still2.json'), encoding='utf-8'))

# Unresolved inputs must not erase prior assignment evidence before validation.
# Otherwise a stale still2 row can silently replace a known final with a new
# arbitrary synthetic ID, hiding both its original identity and ESPN conflict.
unresolved_indices = [str(row[0]) for row in still]
if len(unresolved_indices) != len(set(unresolved_indices)):
    raise ValueError('Duplicate unresolved source index')
if set(unresolved_indices) & set(assign):
    raise ValueError('Unresolved source index already assigned; refusing identity overwrite')

NBA30 = set('ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split())
teams = {}
for g in wb.values():
    for side in ('homeTeam', 'awayTeam'):
        t = g.get(side) or {}
        tc = t.get('teamTricode')
        if tc in NBA30 and t.get('teamId') and tc not in teams and t.get('teamName'):
            teams[tc] = {'teamId': t['teamId'], 'teamName': t.get('teamName') or '', 'teamCity': t.get('teamCity') or ''}
assert len(teams) == 30, len(teams)

series_by_pair = {}
for gid, g in wb.items():
    if not gid.startswith('00425'):
        continue
    pair = frozenset([(g.get('awayTeam') or {}).get('teamTricode'), (g.get('homeTeam') or {}).get('teamTricode')])
    series_by_pair.setdefault(pair, set()).add(gid[:9])
po_fix = {}
for i, date, away, home, st in still:
    if st != 3:
        continue
    pair = frozenset([away, home])
    prefixes = series_by_pair.get(pair)
    if prefixes and len(prefixes) == 1:
        prefix = next(iter(prefixes))
        pair_games = sorted((e['date'], j) for j, e in enumerate(espn) if e['seasonType'] == 3 and frozenset([e['away'], e['home']]) == pair)
        num = [d for d, _ in pair_games].index(date) + 1
        po_fix[str(i)] = prefix + str(num)
print('structural playoff ids:', po_fix)

used = set(assign.values())
syn = 0
for i, date, away, home, st in still:
    si = str(i)
    if si in po_fix and po_fix[si] not in used:
        assign[si] = po_fix[si]
        used.add(po_fix[si])
        continue
    if away not in teams or home not in teams:
        continue
    e = espn[i]
    gid = '9' + str(e['espnId'])[-9:].rjust(9, '0')
    assign[si] = gid
    syn += 1
print('synthetic ids:', syn)

root = Path(__file__).resolve().parents[1]
synthetic_evidence = json.loads((root / 'scripts/archive-data/synthetic-identity-corrections.json').read_text())
# Check each raw source before choosing fallback values or discarding residue.
validate_verified_synthetic_sources(wb, espn, assign, synthetic_evidence)


def norm_utc(s):
    if not s:
        return ''
    s = s.replace('Z', '+00:00')
    try:
        t = datetime.fromisoformat(s)
        return t.strftime('%Y-%m-%dT%H:%M:%SZ')
    except Exception:
        return ''


def et_date(g):
    et = g.get('gameEt') or ''
    if len(et) >= 10:
        return et[:10]
    utc = g.get('gameTimeUTC') or ''
    try:
        t = datetime.fromisoformat(utc.replace('Z', '+00:00'))
        return (t - timedelta(hours=5)).date().isoformat()
    except Exception:
        return None


def mk_team(tc, score, wl):
    base = teams[tc]
    slug = base['teamName'].lower().replace(' ', '-')
    return {'teamId': base['teamId'], 'teamTricode': tc, 'teamName': base['teamName'], 'teamCity': base['teamCity'],
            'teamSlug': slug, 'score': score, 'wins': wl[0], 'losses': wl[1], 'seed': 0}


games_out = {}
espn_map = {}
for si, gid in assign.items():
    e = espn[int(si)]
    if e['away'] not in teams or e['home'] not in teams:
        continue
    w = wb.get(gid) or {}
    wht = w.get('homeTeam') or {}
    wat = w.get('awayTeam') or {}
    final = e['state'] == 'post' or (w.get('gameStatus') == 3)
    hs = e['homeS'] or (wht.get('score') or 0)
    as_ = e['awayS'] or (wat.get('score') or 0)
    if final and (hs == 0 or as_ == 0):
        continue  # postponed/cancelled ESPN residue marked "post" with no score
    stxt = w.get('gameStatusText') if (w.get('gameStatus') == 3 and w.get('gameStatusText')) else ('Final' if final else 'TBD')
    utc = norm_utc(w.get('gameTimeUTC') or '') or norm_utc(e.get('dateUTC') or '')
    d8 = e['date'].replace('-', '')
    game = {
        'gameId': gid, 'gameStatus': 3 if final else 1, 'gameStatusText': stxt,
        'gameCode': d8 + '/' + e['away'] + e['home'], 'gameDateTimeUTC': utc,
        'homeTeam': mk_team(e['home'], hs, (wht.get('wins') or 0, wht.get('losses') or 0)),
        'awayTeam': mk_team(e['away'], as_, (wat.get('wins') or 0, wat.get('losses') or 0)),
    }
    # Do not promote potentially in-progress Wayback leaders to final leaders.
    # Only final team totals are reconstructed/verified here.
    if gid in games_out:
        raise ValueError(f'Duplicate assigned NBA identity: {gid}')
    games_out[gid] = (e['date'], game)
    espn_map[gid] = e['espnId']

for gid, g in wb.items():
    if gid in games_out:
        continue
    at = g.get('awayTeam') or {}
    ht = g.get('homeTeam') or {}
    atc, htc = at.get('teamTricode'), ht.get('teamTricode')
    d = et_date(g)
    if not d or atc not in teams or htc not in teams:
        continue
    st = g.get('gameStatus') or 1
    d8 = d.replace('-', '')
    game = {
        'gameId': gid, 'gameStatus': st, 'gameStatusText': g.get('gameStatusText') or ('Final' if st == 3 else 'TBD'),
        'gameCode': d8 + '/' + atc + htc, 'gameDateTimeUTC': norm_utc(g.get('gameTimeUTC') or ''),
        'homeTeam': mk_team(htc, ht.get('score') or 0, (ht.get('wins') or 0, ht.get('losses') or 0)),
        'awayTeam': mk_team(atc, at.get('score') or 0, (at.get('wins') or 0, at.get('losses') or 0)),
    }
    games_out[gid] = (d, game)

# Mixed-source assignment indices are not identity evidence. Reject bad mappings
# before writing either schedule or ESPN map, rather than silently rebinding IDs.
# Validate before dropping ghosts so a known final cannot silently disappear
# when an input incorrectly downgrades it to scheduled or live.
final_archive = json.loads((root / 'src/data/season-2025-26-final.json').read_text())
verified_identities = json.loads((root / 'scripts/archive-data/schedule-identity-corrections.json').read_text())
verified_identities['corrections'] += synthetic_identity_corrections(synthetic_evidence)
known_final_ids = {game['gameId'] for game in final_archive['finishedGames']}
known_final_ids.update(entry['gameId'] for entry in verified_identities['corrections'])
known_final_ids.update(entry['replacedSyntheticRecord']['game']['gameId']
                       for entry in verified_identities['corrections'] if 'replacedSyntheticRecord' in entry)
# Earlier cleanup can skip unusable source rows (unknown teams, missing dates,
# or zero-score residue). It must never silently erase a known final supplied
# by either input. Partial input fixtures remain valid; only supplied IDs count.
supplied_final_ids = (set(assign.values()) | set(wb)) & known_final_ids
missing_final_ids = supplied_final_ids - set(games_out)
if missing_final_ids:
    raise ValueError(f'Known final identities dropped before validation: {sorted(missing_final_ids)}')
games_out, espn_map = canonicalize_verified_synthetic_games(games_out, espn_map, synthetic_evidence)
validate_schedule_identities(
    games_out,
    final_archive,
    verified_identities,
    espn_map,
)

# Drop ghosts: unplayed playoff/play-in placeholders and 0-0 preseason
# shells captured pre-tipoff that ESPN never finalized.
games_out = {gid: v for gid, v in games_out.items()
             if not (v[1]['gameStatus'] != 3 and (gid.startswith('004') or gid.startswith('005') or gid.startswith('001')))}

bydate = collections.defaultdict(list)
for gid, (d, game) in games_out.items():
    bydate[d].append(game)
dates_out = []
for d in sorted(bydate):
    gs = sorted(bydate[d], key=lambda g: g['gameDateTimeUTC'])
    y, m, dd = d.split('-')
    dates_out.append({'gameDate': m + '/' + dd + '/' + y + ' 00:00:00', 'games': gs})
out = {'seasonYear': '2025', 'dates': dates_out}
json.dump(out, open(os.path.join(tmp, 'schedule-2025-26.json'), 'w'), separators=(',', ':'))
json.dump(espn_map, open(os.path.join(tmp, 'espn-id-map.json'), 'w'), separators=(',', ':'), sort_keys=True)
tot = sum(len(x['games']) for x in dates_out)
pref = collections.Counter(g['gameId'][:3] for x in dates_out for g in x['games'])
fin = sum(1 for x in dates_out for g in x['games'] if g['gameStatus'] == 3)
reg = sorted(int(g['gameId'][5:]) for x in dates_out for g in x['games'] if g['gameId'].startswith('00225'))
print('TOTAL games:', tot, ' dates:', len(dates_out), ' finals:', fin)
print('by prefix:', dict(pref))
print('regular real-id count:', len(reg), ' missing real ids:', 1230 - len(reg))
print('size bytes:', os.path.getsize(os.path.join(tmp, 'schedule-2025-26.json')))
