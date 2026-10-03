import copy
import json
from pathlib import Path
import unittest
import tempfile
import subprocess
import sys
from archive_schedule_identity import validate_schedule_identities
from archive_synthetic_identities import canonicalize_verified_synthetic_games, synthetic_identity_corrections

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = json.loads((ROOT / 'scripts/archive-data/synthetic-identity-corrections.json').read_text())

class SyntheticIdentityTests(unittest.TestCase):
    def original(self):
        return {r['from']: (r['verified']['gameDate'], copy.deepcopy(r['original']['game'])) for r in EVIDENCE['mappings']}, {r['from']: r['espnEventId'] for r in EVIDENCE['mappings']}

    def test_all_67_rebuild_to_verified_ids_without_mutating_inputs(self):
        games, events = self.original()
        result, mapped = canonicalize_verified_synthetic_games(games, events, EVIDENCE)
        self.assertEqual(len(result), 67)
        self.assertEqual(len(mapped), 67)
        self.assertTrue(all(x.startswith('940') for x in games))
        for row in EVIDENCE['mappings']:
            self.assertEqual(result[row['to']][1]['gameId'], row['to'])
            self.assertEqual(result[row['to']][1]['gameDateTimeUTC'], row['verified']['gameDateTimeUTC'])
            self.assertEqual(mapped[row['to']], row['espnEventId'])
        finals = json.loads((ROOT / 'src/data/season-2025-26-final.json').read_text())
        validate_schedule_identities(result, finals, {'corrections': [dict(gameId=r['to'], verified=r['verified']) for r in EVIDENCE['mappings']]}, mapped)
        self.assertEqual(canonicalize_verified_synthetic_games(result, mapped, EVIDENCE), (result, mapped))

    def test_real_builder_reconstructs_all_67_as_canonical(self):
        schedule = json.loads((ROOT / 'src/data/schedule-2025-26.json').read_text())
        teams = {g[side]['teamTricode']: g[side] for d in schedule['dates'] for g in d['games'] for side in ('homeTeam', 'awayTeam')}
        teams = list(teams.values())
        wb = {f'940000{i:04d}': {'homeTeam': teams[i], 'awayTeam': teams[i + 1]} for i in range(0, 30, 2)}
        espn = []
        for row in EVIDENCE['mappings']:
            game = row['original']['game']
            espn.append({'date': row['verified']['gameDate'], 'home': row['verified']['home'], 'away': row['verified']['away'],
                         'homeS': row['verified']['homeScore'], 'awayS': row['verified']['awayScore'], 'state': 'post',
                         'dateUTC': game['gameDateTimeUTC'], 'seasonType': 2, 'espnId': row['espnEventId']})
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            for name, value in [('wb_games.json', wb), ('espn_games.json', espn), ('still2.json', []),
                                ('assign3.json', {str(i): row['from'] for i, row in enumerate(EVIDENCE['mappings'])})]:
                (path / name).write_text(json.dumps(value))
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/build-archive-schedule.py'), directory], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            generated = json.loads((path / 'schedule-2025-26.json').read_text())
            games = [game for day in generated['dates'] for game in day['games']]
            self.assertEqual({game['gameId'] for game in games}, {row['to'] for row in EVIDENCE['mappings']})
            self.assertEqual(json.loads((path / 'espn-id-map.json').read_text()), {row['to']: row['espnEventId'] for row in EVIDENCE['mappings']})

    def test_collision_is_not_silently_deduplicated(self):
        games, events = self.original(); row = EVIDENCE['mappings'][0]
        games[row['to']] = games[row['from']]
        with self.assertRaisesRegex(ValueError, 'already exists'):
            canonicalize_verified_synthetic_games(games, events, EVIDENCE)

    def test_changed_score_team_date_or_utc_cannot_reuse_evidence(self):
        for field in ('score', 'teamId', 'date', 'utc'):
            games, events = self.original(); row = EVIDENCE['mappings'][0]
            date, game = games[row['from']]
            if field in ('score', 'teamId'): game['homeTeam'][field] += 1
            elif field == 'date': games[row['from']] = ('2025-11-04', game)
            else: game['gameDateTimeUTC'] = '2025-11-04T01:00:00Z'
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'source identity changed'):
                canonicalize_verified_synthetic_games(games, events, EVIDENCE)

    def test_wrong_espn_binding_is_rejected_and_missing_binding_is_not_invented(self):
        games, events = self.original(); row = EVIDENCE['mappings'][0]
        events[row['from']] = 'wrong'
        with self.assertRaisesRegex(ValueError, 'conflicting ESPN'):
            canonicalize_verified_synthetic_games(games, events, EVIDENCE)
        del events[row['from']]
        _, result = canonicalize_verified_synthetic_games(games, events, EVIDENCE)
        self.assertNotIn(row['to'], result)


class SyntheticBuilderRegressionTests(unittest.TestCase):
    def full_inputs(self, legacy=True):
        schedule = json.loads((ROOT / 'src/data/schedule-2025-26.json').read_text())
        events = json.loads((ROOT / 'scripts/archive-data/espn-id-map.json').read_text())
        mappings = {row['to']: row for row in EVIDENCE['mappings']}
        teams = {g[side]['teamTricode']: g[side] for d in schedule['dates'] for g in d['games'] for side in ('homeTeam', 'awayTeam')}
        teams = list(teams.values())
        wb = {f'940000{i:04d}': {'homeTeam': teams[i], 'awayTeam': teams[i + 1]} for i in range(0, 30, 2)}
        espn, assignments = [], {}
        for day in schedule['dates']:
            for game in day['games']:
                gid = game['gameId']
                row = mappings.get(gid)
                if row and legacy:
                    gid = row['from']
                    game = row['original']['game']
                # No newly inferred real ESPN binding: explicit fixture-only IDs
                # cover the small set with intentionally unknown event provenance.
                event_id = events.get(game['gameId']) or (row['espnEventId'] if row else f'fixture-{len(espn)}')
                assignments[str(len(espn))] = gid
                espn.append({'date': game['gameCode'][:4]+'-'+game['gameCode'][4:6]+'-'+game['gameCode'][6:8],
                             'away': game['awayTeam']['teamTricode'], 'home': game['homeTeam']['teamTricode'],
                             'awayS': game['awayTeam']['score'], 'homeS': game['homeTeam']['score'],
                             'state': 'post', 'dateUTC': game['gameDateTimeUTC'], 'espnId': event_id, 'seasonType': 2})
        return wb, espn, assignments

    def run_builder(self, inputs, still=None):
        wb, espn, assignments = inputs
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            for name, value in [('wb_games.json', wb), ('espn_games.json', espn), ('still2.json', still or []), ('assign3.json', assignments)]:
                (path / name).write_text(json.dumps(value))
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/build-archive-schedule.py'), directory], capture_output=True, text=True)
            outputs = {name: json.loads((path / name).read_text()) if (path / name).exists() else None
                       for name in ('schedule-2025-26.json', 'espn-id-map.json')}
            return result, outputs

    def test_unresolved_index_cannot_overwrite_a_known_assignment(self):
        inputs = self.full_inputs()
        _, espn, assignments = inputs
        row = EVIDENCE['mappings'][0]
        index = next(key for key, gid in assignments.items() if gid == row['from'])
        espn[int(index)]['espnId'] = '401999999'
        event = espn[int(index)]
        still = [[int(index), event['date'], event['away'], event['home'], 2]]
        result, outputs = self.run_builder(inputs, still=still)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Unresolved source index already assigned', result.stderr)
        self.assertEqual(list(outputs.values()), [None, None])

    def test_duplicate_unresolved_indices_fail_closed(self):
        inputs = self.full_inputs()
        _, espn, assignments = inputs
        row = EVIDENCE['mappings'][0]
        index = next(key for key, gid in assignments.items() if gid == row['from'])
        del assignments[index]
        event = espn[int(index)]
        unresolved = [int(index), event['date'], event['away'], event['home'], 2]
        result, outputs = self.run_builder(inputs, still=[unresolved, unresolved])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Duplicate unresolved source index', result.stderr)
        self.assertEqual(list(outputs.values()), [None, None])

    def test_verified_unresolved_events_rebuild_without_assignment_overwrite(self):
        inputs = self.full_inputs()
        _, espn, assignments = inputs
        row = EVIDENCE['mappings'][0]
        index = next(key for key, gid in assignments.items() if gid == row['from'])
        del assignments[index]
        event = espn[int(index)]
        unresolved = [int(index), event['date'], event['away'], event['home'], 2]
        result, outputs = self.run_builder(inputs, still=[unresolved])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(outputs['espn-id-map.json'][row['to']], row['espnEventId'])
        self.assertNotIn(row['from'], outputs['espn-id-map.json'])

    def test_full_1327_final_rebuild_is_canonical_and_repeatable(self):
        for legacy in (True, False):
            result, outputs = self.run_builder(self.full_inputs(legacy=legacy))
            self.assertEqual(result.returncode, 0, result.stderr)
            actual = outputs['schedule-2025-26.json']
            games = [g for day in actual['dates'] for g in day['games']]
            expected = json.loads((ROOT / 'src/data/schedule-2025-26.json').read_text())
            physical = lambda value: sorted((day['gameDate'], g['gameId'], g['gameCode'], g['gameDateTimeUTC'],
                                             g['gameStatus'], g['awayTeam']['score'], g['homeTeam']['score'])
                                            for day in value['dates'] for g in day['games'])
            self.assertEqual(physical(actual), physical(expected))
            self.assertEqual(len(games), 1327)
            self.assertEqual(sum(g['gameId'].startswith('00225') for g in games), 1230)
            self.assertFalse(any(g['gameId'].startswith('9') for g in games))
            for row in EVIDENCE['mappings']:
                self.assertEqual(outputs['espn-id-map.json'][row['to']], row['espnEventId'])
                self.assertNotIn(row['from'], outputs['espn-id-map.json'])

    def test_raw_espn_conflicts_cannot_be_hidden_or_dropped(self):
        for legacy in (True, False):
            for field, value in [('homeS', 0), ('homeS', 1), ('home', 'UNKNOWN'), ('away', 'BOS'),
                                 ('date', ''), ('date', '2025-11-04'), ('dateUTC', ''), ('state', 'pre'),
                                 ('state', 'in'), ('espnId', 'wrong')]:
                inputs = self.full_inputs(legacy=legacy)
                wb, espn, assignments = inputs
                target = EVIDENCE['mappings'][0]['from' if legacy else 'to']
                index = next(key for key, gid in assignments.items() if gid == target)
                espn[int(index)][field] = value
                result, outputs = self.run_builder(inputs)
                with self.subTest(legacy=legacy, field=field, value=value):
                    self.assertNotEqual(result.returncode, 0)
                    self.assertTrue('source identity changed' in result.stderr or 'conflicting ESPN' in result.stderr, result.stderr)
                    self.assertEqual(list(outputs.values()), [None, None])

    def test_known_espn_event_cannot_be_unassigned_or_rebound(self):
        for replacement in (None, '9400000099', '0022500001'):
            inputs = self.full_inputs()
            _, _, assignments = inputs
            index = next(key for key, gid in assignments.items() if gid == EVIDENCE['mappings'][0]['from'])
            if replacement is None:
                del assignments[index]
            else:
                assignments[index] = replacement
            result, outputs = self.run_builder(inputs)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('conflicting ESPN event identity or missing known-final assignment', result.stderr)
            self.assertEqual(list(outputs.values()), [None, None])

    def test_wayback_disagreement_cannot_be_concealed_by_good_espn(self):
        for field in ('score', 'teamId', 'gameId', 'gameEt', 'gameCode', 'gameStatus', 'gameTimeUTC'):
            inputs = self.full_inputs()
            wb, _, _ = inputs
            row = EVIDENCE['mappings'][0]
            game = copy.deepcopy(row['original']['game'])
            game['gameTimeUTC'] = game.pop('gameDateTimeUTC')
            game['gameEt'] = row['verified']['gameDate'] + 'T19:00:00Z'
            if field in ('score', 'teamId'):
                game['homeTeam'][field] += 1
            elif field == 'gameStatus':
                game[field] = 1
            else:
                game[field] = 'conflict'
            wb[row['from']] = game
            result, outputs = self.run_builder(inputs)
            with self.subTest(field=field):
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('source identity changed', result.stderr)
                self.assertEqual(list(outputs.values()), [None, None])

    def test_wayback_only_source_is_supported_without_fabricating_espn(self):
        inputs = self.full_inputs()
        wb, espn, assignments = inputs
        row = EVIDENCE['mappings'][0]
        index = next(key for key, gid in assignments.items() if gid == row['from'])
        del assignments[index]
        espn[int(index)] = {'espnId': 'fixture-ignored'}
        game = copy.deepcopy(row['original']['game'])
        game['gameTimeUTC'] = game.pop('gameDateTimeUTC')
        game['gameEt'] = row['verified']['gameDate'] + 'T19:00:00Z'
        wb[row['from']] = game
        result, outputs = self.run_builder(inputs)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(row['to'], outputs['espn-id-map.json'])
        self.assertEqual(sum(len(day['games']) for day in outputs['schedule-2025-26.json']['dates']), 1327)

    def test_both_identities_fail_closed_even_for_identical_facts(self):
        inputs = self.full_inputs()
        wb, _, _ = inputs
        row = EVIDENCE['mappings'][0]
        game = copy.deepcopy(row['original']['game'])
        game.update(gameId=row['to'], gameTimeUTC=game.pop('gameDateTimeUTC'), gameEt=row['verified']['gameDate']+'T19:00:00Z')
        wb[row['to']] = game
        result, outputs = self.run_builder(inputs)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('canonical identity already exists', result.stderr)
        self.assertEqual(list(outputs.values()), [None, None])

    def test_validator_rejects_any_retired_alias_even_without_canonical(self):
        row = EVIDENCE['mappings'][0]
        game = copy.deepcopy(row['original']['game'])
        with self.assertRaisesRegex(ValueError, 'retired synthetic identity'):
            validate_schedule_identities({row['from']: (row['verified']['gameDate'], game)},
                                         {'finishedGames': []}, {'corrections': synthetic_identity_corrections(EVIDENCE)})

    def test_prior_playoff_alias_cannot_be_dropped_before_retirement_guard(self):
        for reason in ('zero-scores', 'unknown-team', 'missing-wayback-date'):
            inputs = self.full_inputs()
            wb, espn, assignments = inputs
            index = next(key for key, gid in assignments.items() if gid == '0042500173')
            assignments[index] = '9401869400'
            if reason == 'zero-scores':
                espn[int(index)].update(homeS=0, awayS=0)
            elif reason == 'unknown-team':
                espn[int(index)]['home'] = 'UNKNOWN'
            else:
                del assignments[index]
                wb['9401869400'] = {'gameId': '9401869400', 'homeTeam': {}, 'awayTeam': {}}
            result, outputs = self.run_builder(inputs)
            with self.subTest(reason=reason):
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('Known final identities dropped before validation', result.stderr)
                self.assertEqual(list(outputs.values()), [None, None])

    def test_canonical_only_conflicts_and_duplicate_evidence_fail_closed(self):
        games = {row['from']: (row['verified']['gameDate'], copy.deepcopy(row['original']['game'])) for row in EVIDENCE['mappings']}
        events = {row['from']: row['espnEventId'] for row in EVIDENCE['mappings']}
        games, events = canonicalize_verified_synthetic_games(games, events, EVIDENCE)
        row = EVIDENCE['mappings'][0]
        events[row['to']] = 'wrong'
        with self.assertRaisesRegex(ValueError, 'conflicting ESPN'):
            canonicalize_verified_synthetic_games(games, events, EVIDENCE)
        bad = copy.deepcopy(EVIDENCE)
        bad['mappings'].append(copy.deepcopy(bad['mappings'][0]))
        with self.assertRaisesRegex(ValueError, 'Conflicting synthetic identity evidence'):
            canonicalize_verified_synthetic_games({}, {}, bad)

if __name__ == '__main__':
    unittest.main()
