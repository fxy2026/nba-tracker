"""Apply only independently evidenced, same-physical-game synthetic ID aliases."""
from copy import deepcopy
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def _utc(value):
    try:
        instant = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if instant.tzinfo is None:
            return ''
        return instant.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    except (ValueError, AttributeError):
        return ''


def _indexes(evidence):
    by_id, by_event = {}, {}
    if evidence.get('schemaVersion') != 1:
        raise ValueError('Unsupported synthetic identity evidence schema')
    for row in evidence['mappings']:
        old, new, event = row['from'], row['to'], row['espnEventId']
        if (old in by_id or new in by_id or old == new or event in by_event
                or len(old) != 10 or not old.isdigit() or not old.startswith('9')
                or len(new) != 10 or not new.isdigit() or not new.startswith('00225')
                or old != '9' + event[-9:].rjust(9, '0')):
            raise ValueError('Conflicting synthetic identity evidence')
        by_id[old] = by_id[new] = row
        by_event[event] = row
    return by_id, by_event


def _check_game(gid, date, game, row):
    verified = row['verified']
    away, home = game.get('awayTeam') or {}, game.get('homeTeam') or {}
    actual = (date, game.get('gameId'), game.get('gameCode'), away.get('teamTricode'), home.get('teamTricode'),
              away.get('teamId'), home.get('teamId'), away.get('score'), home.get('score'))
    expected = (verified['gameDate'], gid, verified['gameDate'].replace('-', '') + '/' + verified['away'] + verified['home'],
                verified['away'], verified['home'], verified['awayTeamId'], verified['homeTeamId'],
                verified['awayScore'], verified['homeScore'])
    allowed_utc = {row['original']['game']['gameDateTimeUTC'], verified['gameDateTimeUTC']}
    if (game.get('gameStatus') != 3 or actual != expected
            or _utc(game.get('gameDateTimeUTC')) not in allowed_utc):
        raise ValueError(f'{gid}: verified synthetic source identity changed')


def validate_verified_synthetic_sources(wb, espn, assignments, evidence):
    """Check each source before fallback/merge can conceal contradictory facts.

    Known ESPN events cannot be silently skipped or assigned to unrelated IDs.
    Both source records must agree with evidence when both are supplied.
    """
    by_id, by_event = _indexes(evidence)
    for index, event in enumerate(espn):
        gid = assignments.get(str(index))
        row = by_id.get(gid) or by_event.get(str(event.get('espnId')))
        if row is None:
            continue
        if gid not in (row['from'], row['to']) or str(event.get('espnId')) != row['espnEventId']:
            raise ValueError(f'{gid}: conflicting ESPN event identity or missing known-final assignment')
        v = row['verified']
        actual = (event.get('date'), event.get('away'), event.get('home'), event.get('awayS'), event.get('homeS'))
        expected = (v['gameDate'], v['away'], v['home'], v['awayScore'], v['homeScore'])
        if (event.get('state') != 'post' or actual != expected
                or _utc(event.get('dateUTC')) not in {row['original']['game']['gameDateTimeUTC'], v['gameDateTimeUTC']}):
            raise ValueError(f'{gid}: verified synthetic ESPN source identity changed')
    for gid, game in wb.items():
        row = by_id.get(gid) or by_id.get(game.get('gameId'))
        if row is None:
            continue
        if gid not in (row['from'], row['to']):
            raise ValueError(f'{gid}: conflicting Wayback game identity')
        source = dict(game, gameDateTimeUTC=game.get('gameTimeUTC'))
        date = (game.get('gameEt') or '')[:10]
        if not date and _utc(game.get('gameTimeUTC')):
            date = datetime.fromisoformat(_utc(game['gameTimeUTC']).replace('Z', '+00:00')).astimezone(
                ZoneInfo('America/New_York')).date().isoformat()
        _check_game(gid, date, source, row)


def canonicalize_verified_synthetic_games(games, espn_map, evidence):
    """Rebind exact verified aliases; reject collisions and preserve event bindings.

    Canonical input is also checked, making subsequent rebuilds idempotent and
    preventing stale ESPN bindings from returning after aliases are retired.
    """
    _indexes(evidence)
    games, espn_map = deepcopy(games), dict(espn_map)
    for row in evidence['mappings']:
        old, new = row['from'], row['to']
        if old in games and new in games:
            raise ValueError(f'{old}: canonical identity already exists: {new}')
        for gid in (old, new):
            if gid in espn_map and (gid not in games or espn_map[gid] != row['espnEventId']):
                raise ValueError(f'{gid}: conflicting ESPN event identity')
        gid = old if old in games else new
        if gid not in games:
            continue
        date, game = games[gid]
        _check_game(gid, date, game, row)
        game['gameId'] = new
        game['gameDateTimeUTC'] = row['verified']['gameDateTimeUTC']
        games[new] = (date, game)
        if old in games:
            del games[old]
        if old in espn_map:
            espn_map[new] = espn_map.pop(old)
    return games, espn_map


def synthetic_identity_corrections(evidence):
    """Reuse final identity/retired-ID guards with the same explicit evidence."""
    _indexes(evidence)
    return [dict(gameId=row['to'], verified=row['verified'], replacedSyntheticRecord=row['original'])
            for row in evidence['mappings']]
