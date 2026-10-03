"""Fail closed before publishing archive schedules assembled from mixed sources."""
from datetime import datetime
from zoneinfo import ZoneInfo


def validate_schedule_identities(games, final_archive, verified_identities, espn_map=None):
    """Validate ID/date/opponents/final score and independently verified kickoff times.

    Unlisted synthetic IDs remain valid; explicitly retired identities do not.
    This never guesses a replacement ID or repairs an upstream assignment.
    """
    finals = {g['gameId']: g for g in final_archive['finishedGames']}
    verified = {g['gameId']: g['verified'] for g in verified_identities['corrections']}
    retired = {
        entry['replacedSyntheticRecord']['game']['gameId']: entry['gameId']
        for entry in verified_identities['corrections']
        if 'replacedSyntheticRecord' in entry
    }
    errors = []
    if espn_map is not None:
        for entry in verified_identities['corrections']:
            if entry.get('rejectedEspnId') and espn_map.get(entry['gameId']) == entry['rejectedEspnId']:
                errors.append(f"{entry['gameId']}: rejected ESPN event mapping")
    physical_games = {}
    for gid, (date, game) in games.items():
        if gid in retired:
            errors.append(f'{gid}: retired synthetic identity; verified canonical ID is {retired[gid]}')
        home, away = game['homeTeam'], game['awayTeam']
        actual = (date, away['teamTricode'], home['teamTricode'], away['score'], home['score'])
        if actual in physical_games:
            errors.append(f'{gid}: duplicate date/opponents/final-score identity with {physical_games[actual]}')
        physical_games[actual] = gid
        expected_code = date.replace('-', '') + '/' + away['teamTricode'] + home['teamTricode']
        if game['gameId'] != gid or game['gameCode'] != expected_code:
            errors.append(f'{gid}: inconsistent ID/date bucket/gameCode')
        final = finals.get(gid)
        if final is not None:
            if game['gameStatus'] != 3:
                errors.append(f'{gid}: archived final cannot become scheduled or live')
            expected = (final['gameDate'], final['awayTricode'], final['homeTricode'], final['awayScore'], final['homeScore'])
            if actual != expected:
                errors.append(f'{gid}: final archive identity mismatch: {actual!r} != {expected!r}')
        evidence = verified.get(gid)
        if evidence is not None:
            expected = (evidence['gameDate'], evidence['away'], evidence['home'], evidence['awayScore'], evidence['homeScore'])
            if actual != expected or game['gameStatus'] != 3:
                errors.append(f'{gid}: official game identity mismatch')
            if game['gameDateTimeUTC'] != evidence['gameDateTimeUTC']:
                errors.append(f'{gid}: official UTC kickoff mismatch')
        utc = game.get('gameDateTimeUTC')
        if utc:
            try:
                instant = datetime.fromisoformat(utc.replace('Z', '+00:00'))
                if instant.tzinfo is None or instant.astimezone(ZoneInfo('America/New_York')).date().isoformat() != date:
                    errors.append(f'{gid}: UTC kickoff does not match NBA Eastern date')
            except ValueError:
                errors.append(f'{gid}: invalid UTC kickoff')
    if errors:
        raise ValueError('Refusing inconsistent schedule identities:\n' + '\n'.join(errors))
