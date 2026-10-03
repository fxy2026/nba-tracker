import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime

from archive_schedule_identity import validate_schedule_identities

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = json.loads((ROOT / 'src/data/season-2025-26-final.json').read_text())
EVIDENCE = json.loads((ROOT / 'scripts/archive-data/schedule-identity-corrections.json').read_text())
SCHEDULE = json.loads((ROOT / 'src/data/schedule-2025-26.json').read_text())
GAMES = {g['gameId']: (datetime.strptime(d['gameDate'], '%m/%d/%Y %H:%M:%S').date().isoformat(), g)
         for d in SCHEDULE['dates'] for g in d['games']}


class IdentityTests(unittest.TestCase):
    def test_full_checked_in_schedule_and_unique_ids(self):
        self.assertEqual(len(GAMES), sum(len(d['games']) for d in SCHEDULE['dates']))
        validate_schedule_identities(GAMES, ARCHIVE, EVIDENCE)

    def test_all_three_original_misassignments_rejected(self):
        for entry in EVIDENCE['corrections']:
            with self.subTest(gameId=entry['gameId']):
                old = entry['original']
                date = datetime.strptime(old['dateBucket'], '%m/%d/%Y %H:%M:%S').date().isoformat()
                with self.assertRaisesRegex(ValueError, 'Refusing inconsistent'):
                    validate_schedule_identities({entry['gameId']: (date, old['game'])}, ARCHIVE, EVIDENCE)

    def test_known_game_cannot_be_hidden_as_scheduled(self):
        games = copy.deepcopy(GAMES)
        games['0042500173'][1]['gameStatus'] = 1
        with self.assertRaisesRegex(ValueError, 'official game identity mismatch'):
            validate_schedule_identities(games, ARCHIVE, EVIDENCE)

    def test_unrelated_archived_final_cannot_be_downgraded(self):
        for status in (1, 2):
            games = copy.deepcopy(GAMES)
            games['0042500171'][1]['gameStatus'] = status
            with self.subTest(status=status), self.assertRaisesRegex(ValueError, 'archived final cannot become'):
                validate_schedule_identities(games, ARCHIVE, EVIDENCE)

    def test_wrong_kickoff_even_on_same_date_rejected(self):
        games = copy.deepcopy(GAMES)
        games['0042500173'][1]['gameDateTimeUTC'] = '2026-04-25T01:30:00Z'
        with self.assertRaisesRegex(ValueError, 'official UTC kickoff mismatch'):
            validate_schedule_identities(games, ARCHIVE, EVIDENCE)

    def test_wrong_bucket_and_code_rejected(self):
        gid = '0022500071'
        game = copy.deepcopy(GAMES[gid][1])
        with self.assertRaisesRegex(ValueError, 'date bucket/gameCode'):
            validate_schedule_identities({gid: ('2025-12-12', game)}, ARCHIVE, EVIDENCE)

    def test_synthetic_identity_and_absent_kickoff_preserved(self):
        game = copy.deepcopy(GAMES['0042500173'][1])
        game.update(gameId='9400000001', gameDateTimeUTC='')
        validate_schedule_identities({'9400000001': ('2026-04-24', game)}, ARCHIVE, EVIDENCE)

    def test_rejected_espn_mappings_removed_and_cannot_return(self):
        current_map = json.loads((ROOT / 'scripts/archive-data/espn-id-map.json').read_text())
        for entry in EVIDENCE['corrections']:
            self.assertNotIn(entry['gameId'], current_map)
            if 'rejectedEspnId' not in entry:
                continue
            with self.assertRaisesRegex(ValueError, 'rejected ESPN event mapping'):
                validate_schedule_identities(GAMES, ARCHIVE, EVIDENCE, {entry['gameId']: entry['rejectedEspnId']})

    def test_march_regular_game_and_april_playoff_are_both_preserved(self):
        self.assertEqual(GAMES['0022500989'][0], '2026-03-16')
        self.assertEqual(GAMES['0042500173'][0], '2026-04-24')
        self.assertNotIn('9401869400', GAMES)
        games = copy.deepcopy(GAMES)
        game = copy.deepcopy(games['0042500173'][1])
        game['gameId'] = '9401869400'
        games['9401869400'] = ('2026-04-24', game)
        with self.assertRaisesRegex(ValueError, 'duplicate date/opponents/final-score'):
            validate_schedule_identities(games, ARCHIVE, EVIDENCE)

    def test_corrected_buckets_and_ot(self):
        for entry in EVIDENCE['corrections']:
            self.assertEqual(GAMES[entry['gameId']][0], entry['verified']['gameDate'])
            self.assertEqual(GAMES[entry['gameId']][1]['gameDateTimeUTC'], entry['verified']['gameDateTimeUTC'])
        self.assertEqual(GAMES['0042500173'][1]['gameStatusText'], 'Final/OT')

    def test_retired_synthetic_cannot_replace_canonical_game(self):
        games = copy.deepcopy(GAMES)
        date, game = games.pop('0042500173')
        game['gameId'] = '9401869400'
        games['9401869400'] = (date, game)
        with self.assertRaisesRegex(ValueError, 'retired synthetic identity'):
            validate_schedule_identities(games, ARCHIVE, EVIDENCE)

    def run_builder(self, original=False, duplicate=False, mutate=None):
        # Minimal offline inputs retain all 30 teams required by the real builder.
        teams = {}
        for _, game in GAMES.values():
            for side in ('homeTeam', 'awayTeam'):
                teams[game[side]['teamTricode']] = game[side]
        teams = list(teams.values())
        wb = {f'940000{i:04d}': {'homeTeam': teams[i], 'awayTeam': teams[i + 1]}
              for i in range(0, 30, 2)}
        espn = []
        assign = {}
        for entry in EVIDENCE['corrections']:
            gid = entry['gameId']
            if original:
                game = entry['original']['game']
                date = datetime.strptime(entry['original']['dateBucket'], '%m/%d/%Y %H:%M:%S').date().isoformat()
            else:
                date, game = GAMES[gid]
            assign[str(len(espn))] = gid
            espn.append({'date': date, 'away': game['awayTeam']['teamTricode'], 'home': game['homeTeam']['teamTricode'],
                         'awayS': game['awayTeam']['score'], 'homeS': game['homeTeam']['score'],
                         'state': 'post', 'dateUTC': game['gameDateTimeUTC'], 'espnId': str(400000000 + len(espn)),
                         'seasonType': 3 if gid.startswith('004') else 2})
        if duplicate:
            assign[str(len(espn))] = EVIDENCE['corrections'][0]['gameId']
            espn.append(copy.deepcopy(espn[0]))
        if mutate is not None:
            mutate(wb, espn, assign)
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory)
            for name, data in [('wb_games.json', wb), ('espn_games.json', espn), ('assign3.json', assign), ('still2.json', [])]:
                (p / name).write_text(json.dumps(data))
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/build-archive-schedule.py'), directory], capture_output=True, text=True)
            outputs = [(p / name).exists() for name in ('schedule-2025-26.json', 'espn-id-map.json')]
            return result, outputs

    def test_real_builder_rejects_corrupt_inputs_before_either_output(self):
        result, outputs = self.run_builder(original=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('identity mismatch', result.stderr)
        self.assertEqual(outputs, [False, False])

    def test_real_builder_accepts_verified_inputs(self):
        result, outputs = self.run_builder()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(outputs, [True, True])

    def test_real_builder_rejects_duplicate_id_overwrite(self):
        result, outputs = self.run_builder(duplicate=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Duplicate assigned NBA identity', result.stderr)
        self.assertEqual(outputs, [False, False])

    def test_real_builder_rejects_archived_final_before_ghost_filter(self):
        def downgrade(_wb, espn, assign):
            gid = '0042500171'
            date, game = GAMES[gid]
            assign[str(len(espn))] = gid
            espn.append({
                'date': date, 'away': game['awayTeam']['teamTricode'],
                'home': game['homeTeam']['teamTricode'],
                'awayS': game['awayTeam']['score'], 'homeS': game['homeTeam']['score'],
                'state': 'pre', 'dateUTC': game['gameDateTimeUTC'],
                'espnId': '400000999', 'seasonType': 3,
            })
        result, outputs = self.run_builder(mutate=downgrade)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('archived final cannot become scheduled or live', result.stderr)
        self.assertEqual(outputs, [False, False])

    def test_real_builder_rejects_retired_synthetic_without_canonical(self):
        def replace_canonical(_wb, _espn, assign):
            for index, gid in assign.items():
                if gid == '0042500173':
                    assign[index] = '9401869400'
        result, outputs = self.run_builder(mutate=replace_canonical)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('retired synthetic identity', result.stderr)
        self.assertEqual(outputs, [False, False])

    def test_real_builder_cannot_discard_known_final_as_unusable_source(self):
        for reason in ('zero-scores', 'unknown-team', 'missing-wayback-date'):
            def corrupt(wb, espn, assign):
                index = next(index for index, gid in assign.items() if gid == '0042500173')
                if reason == 'zero-scores':
                    espn[int(index)].update(homeS=0, awayS=0)
                elif reason == 'unknown-team':
                    espn[int(index)]['home'] = 'UNKNOWN'
                else:
                    del assign[index]
                    wb['0042500173'] = copy.deepcopy(GAMES['0042500173'][1])
                    # Wayback input requires gameEt or gameTimeUTC, not the
                    # generated schedule's gameDateTimeUTC property.
            result, outputs = self.run_builder(mutate=corrupt)
            with self.subTest(reason=reason):
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('Known final identities dropped before validation', result.stderr)
                self.assertEqual(outputs, [False, False])


if __name__ == '__main__':
    unittest.main()
