import json
import unittest
from datetime import date, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from scripts import import_matches


class CalendarImportTests(unittest.TestCase):
    def test_fills_only_missing_dates_and_formations_in_the_rome_window(self):
        today = date(2026, 11, 22)
        original = {'2026-11-14': '103', '2026-11-15': '101', '2026-11-22': '102'}
        new_ids = [str(number) for number in range(105, 119)]
        candidates = ['101', '103', '104', *new_ids]
        starters = [
            {'player_id': str(number), 'name': f'Player {number}', 'jersey': str(number),
             'formation_place': number, 'goals': 0, 'assists': 0}
            for number in range(1, 12)
        ]

        def game(game_id):
            return {
                'game_id': game_id, 'date': '2025-05-25', 'status': 'final',
                'home': {'team_id': 'home', 'name': 'Home', 'score': 0},
                'away': {'team_id': 'away', 'name': 'Away', 'score': 0},
            }

        def match(game_id):
            return {'data': {'game': game(game_id), 'lineups': [{
                'team_id': 'away', 'formation': '4-3-3',
                'starting_xi': starters[:-1] if game_id == '104' else starters,
            }]}}

        def request(tool, key, **params):
            if tool == 'list_games':
                return json.dumps({'data': {'games': [game(game_id) for game_id in candidates]}})
            self.assertEqual(tool, 'get_lineups')
            self.assertNotIn(params['game_id'], {'101', '103'})
            return json.dumps(match(params['game_id']))

        with TemporaryDirectory() as directory:
            calendar = Path(directory) / 'calendar.json'
            output = Path(directory) / 'strikerapi'
            output.mkdir()
            cached = output / '2025-05-25.json'
            cached.write_text(json.dumps(match('101')))
            calendar.write_text(json.dumps(original))

            with patch.multiple(import_matches, CALENDAR=calendar, OUTPUT=output):
                with patch.object(import_matches, 'request_data', side_effect=request) as api:
                    import_matches.fill_calendar('key', today)
                    result = json.loads(calendar.read_bytes())
                    self.assertEqual({day: result[day] for day in original}, original)
                    self.assertEqual(set(result), {
                        (today + timedelta(days=offset)).isoformat() for offset in range(-8, 9)
                    })
                    self.assertEqual(set(result.values()), {'101', '102', '103', *new_ids})
                    self.assertTrue((output / 'game-102.json').is_file())
                    self.assertFalse((output / 'game-104.json').exists())
                    self.assertEqual(json.loads(cached.read_bytes()), match('101'))
                    downloaded = json.loads((output / 'game-105.json').read_bytes())['data']
                    self.assertNotIn('assists', downloaded['lineups'][0]['starting_xi'][0])

                    api.reset_mock()
                    import_matches.fill_calendar('key', today)
                    api.assert_not_called()
                    self.assertEqual(json.loads(calendar.read_bytes()), result)

    def test_runs_calendar_import_without_flags(self):
        today = date(2026, 11, 22)
        with patch('sys.argv', ['import_matches.py']), patch.dict('os.environ', {'STRIKERAPI_KEY': 'key'}):
            with patch.object(import_matches, 'datetime') as clock, patch.object(import_matches, 'fill_calendar') as fill:
                clock.now.return_value.date.return_value = today
                self.assertEqual(import_matches.main(), 0)
                fill.assert_called_once_with('key', today)


if __name__ == '__main__':
    unittest.main()
