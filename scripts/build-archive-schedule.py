# One-off: assemble the 2025-26 season schedule dataset from Wayback
# scoreboard captures + ESPN finals + archived nba.com/game URL evidence.
# Inputs live in the temp dir produced during the 2026-07 recovery session.
import json, sys, os, collections
from datetime import datetime, timedelta

tmp = sys.argv[1]
wb = json.load(open(os.path.join(tmp, 'wb_games.json'), encoding='utf-8'))
espn = json.load(open(os.path.join(tmp, 'espn_games.json'), encoding='utf-8'))
assign = json.load(open(os.path.join(tmp, 'assign3.json'), encoding='utf-8'))
still = json.load(open(os.path.join(tmp, 'still2.json'), encoding='utf-8'))

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
    gl = w.get('gameLeaders') or {}
    cands = [(gl.get('homeLeaders'), wht.get('teamId'), e['home']),
             (gl.get('awayLeaders'), wat.get('teamId'), e['away'])]
    pls = []
    for lead, tid, tc in cands:
        if lead and lead.get('points'):
            nm = (lead.get('name') or '').split(' ', 1)
            pls.append({'personId': lead.get('personId') or 0, 'firstName': nm[0], 'lastName': nm[1] if len(nm) > 1 else '',
                        'teamId': tid or teams[tc]['teamId'], 'teamTricode': tc, 'points': lead['points']})
    if pls:
        top = max(p['points'] for p in pls)
        game['pointsLeaders'] = [p for p in pls if p['points'] == top]
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
