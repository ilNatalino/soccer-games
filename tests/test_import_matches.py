import json
import unittest
from datetime import date, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import mock_open, patch
from urllib.error import HTTPError

from scripts import import_matches


class CalendarImportTests(unittest.TestCase):
    def test_fills_only_missing_dates_and_formations_in_the_rome_window(self):
        today = date(2026, 11, 22)
        original = {'2026-11-14': '103', '2026-11-15': '101', '2026-11-22': '102'}
        new_ids = [str(number) for number in range(105, 119)]
        historic_ids = new_ids[:7]
        pages = {
            (2001, 0): (['101', '104'], 50),
            (2001, 50): (historic_ids, None),
            (2026, 0): (['103', *new_ids[7:]], None),
        }
        starters = [
            {'player_id': str(number), 'name': f'Player {number}', 'jersey': str(number),
             'formation_place': number, 'goals': 0, 'assists': 0}
            for number in range(1, 12)
        ]
        home_starters = [
            {**player, 'player_id': str(number), 'name': f'Player {number}'}
            for number, player in enumerate(starters, 12)
        ]

        def game(game_id):
            played_on = '2001-12-09' if game_id in {'101', '104', *historic_ids} else '2026-09-13'
            return {
                'game_id': game_id, 'date': played_on, 'status': 'final',
                'home': {'team_id': 'home', 'name': 'Home', 'score': 0},
                'away': {'team_id': 'away', 'name': 'Away', 'score': 0},
            }

        def match(game_id):
            home = home_starters if game_id in {'102', '105', '106'} else []
            if game_id == '105':
                home = [{**home[0], 'player_id': '23', 'name': 'Player 23'}, *home[1:]]
            return {'data': {'game': game(game_id), 'lineups': [{
                'team_id': 'home', 'formation': '4-3-3',
                'starting_xi': home,
            }, {
                'team_id': 'away', 'formation': '4-3-3',
                'starting_xi': starters[:-1] if game_id in {'104', '106'} else starters,
            }]}}

        def request(tool, key, **params):
            if tool == 'list_games':
                self.assertIn(params['season'], range(2001, 2027))
                self.assertEqual(params['status'], 'final')
                ids, offset = pages.get((params['season'], params['offset']), ([], None))
                return json.dumps({'data': {'games': [game(game_id) for game_id in ids], 'next_offset': offset}})
            if tool == 'search_players':
                number = int(params['name'].removeprefix('Player '))
                profiles = [{'player_id': '999', 'short_name': 'Wrong player'}]
                if number == 1:
                    profiles.append({'player_id': 1, 'short_name': ' A. Rossi '})
                if number == 2:
                    profiles.append({'player_id': '2', 'short_name': ' '})
                if number == 12:
                    profiles.append({'player_id': '12', 'short_name': 'B. Bianchi'})
                return json.dumps({'data': {'players': profiles}})
            self.assertEqual(tool, 'get_lineups')
            self.assertNotIn(params['game_id'], {'101', '103'})
            return json.dumps(match(params['game_id']))

        with TemporaryDirectory() as directory:
            calendar = Path(directory) / 'calendar.json'
            output = Path(directory) / 'strikerapi'
            output.mkdir()
            cached = output / '2001-12-09.json'
            cached.write_text(json.dumps(match('101')))
            previous = match('103')
            previous['data']['quiz_side'] = 'home'
            previous['data']['lineups'][0]['starting_xi'] = [{**home_starters[-1], 'short_name': 'A. Verdi'}]
            (output / 'game-103.json').write_text(json.dumps(previous))
            calendar.write_text(json.dumps(original))

            picks = iter(('home', 'away'))
            with patch.multiple(import_matches, CALENDAR=calendar, OUTPUT=output), patch.object(
                import_matches, 'choice', side_effect=lambda sides: next(picks) if len(sides) == 2 else sides[0]
            ):
                with patch.object(import_matches, 'request_data', side_effect=request) as api:
                    import_matches.fill_calendar('key', today)
                    result = json.loads(calendar.read_bytes())
                    self.assertEqual({day: result[day] for day in original}, original)
                    self.assertEqual(set(result), {
                        (today + timedelta(days=offset)).isoformat() for offset in range(-8, 9)
                    })
                    self.assertEqual(set(result.values()), {'101', '102', '103', *new_ids})
                    api.assert_any_call('list_games', 'key', season=2001, status='final', limit=50, offset=50)
                    home_match = json.loads((output / 'game-102.json').read_bytes())['data']
                    self.assertEqual(home_match['quiz_side'], 'home')
                    self.assertEqual([lineup['team_id'] for lineup in home_match['lineups']], ['home'])
                    home_players = home_match['lineups'][0]['starting_xi']
                    self.assertEqual(home_players[0]['short_name'], 'B. Bianchi')
                    self.assertEqual(home_players[-1]['short_name'], 'A. Verdi')
                    self.assertFalse((output / 'game-104.json').exists())
                    self.assertEqual(json.loads(cached.read_bytes()), match('101'))
                    downloaded = json.loads((output / 'game-105.json').read_bytes())['data']
                    self.assertEqual(downloaded['game']['date'], '2001-12-09')
                    self.assertEqual(downloaded['quiz_side'], 'away')
                    self.assertEqual([lineup['team_id'] for lineup in downloaded['lineups']], ['away'])
                    players = downloaded['lineups'][0]['starting_xi']
                    self.assertNotIn('assists', players[0])
                    self.assertEqual((players[0]['name'], players[0]['short_name']), ('Player 1', 'A. Rossi'))
                    self.assertIsNone(players[1]['short_name'])
                    self.assertIsNone(players[2]['short_name'])
                    only_valid_home = json.loads((output / 'game-106.json').read_bytes())['data']
                    self.assertEqual(only_valid_home['quiz_side'], 'home')
                    searches = [call.kwargs['name'] for call in api.call_args_list if call.args[0] == 'search_players']
                    self.assertCountEqual(searches, [f'Player {number}' for number in range(1, 22)])

                    api.reset_mock()
                    import_matches.fill_calendar('key', today)
                    api.assert_not_called()
                    self.assertEqual(json.loads(calendar.read_bytes()), result)

    def test_missing_lineup_is_treated_as_an_invalid_match(self):
        error = HTTPError('https://mcp.strikerapi.com/', 404, 'Not Found', {}, None)
        with patch.object(import_matches, 'urlopen', side_effect=error):
            with self.assertRaisesRegex(ValueError, 'formazione non disponibile'):
                import_matches.fetch_calendar_match('key', '42')

    def test_retries_a_rate_limited_player_search(self):
        error = HTTPError('https://mcp.strikerapi.com/', 429, 'Too Many Requests', {'Retry-After': '12'}, None)
        response = mock_open(read_data=b'{"data":{"players":[]}}')()
        with patch.object(import_matches, 'urlopen', side_effect=[error, response]) as request:
            with patch.object(import_matches, 'sleep') as sleep:
                self.assertIsNone(import_matches.fetch_short_name('key', {'player_id': '1', 'name': 'Player 1'}))
                self.assertEqual(request.call_count, 2)
                sleep.assert_called_once_with(12)

    def test_runs_calendar_import_without_flags(self):
        today = date(2026, 11, 22)
        with patch('sys.argv', ['import_matches.py']), patch.dict('os.environ', {'STRIKERAPI_KEY': 'key'}):
            with patch.object(import_matches, 'datetime') as clock, patch.object(import_matches, 'fill_calendar') as fill:
                clock.now.return_value.date.return_value = today
                self.assertEqual(import_matches.main(), 0)
                fill.assert_called_once_with('key', today)


if __name__ == '__main__':
    unittest.main()
