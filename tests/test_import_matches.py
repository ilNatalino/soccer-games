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
        new_ids = [str(number) for number in range(105, 118)]
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
                        (today + timedelta(days=offset)).isoformat() for offset in range(-8, 8)
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


class ShortNameImportTests(unittest.TestCase):
    def test_only_away_starters_are_searched_and_results_are_reused(self):
        away = [{'player_id': str(index), 'name': f'Away {index}'} for index in range(1, 12)]
        match = {
            'game': {'away': {'team_id': 'away'}},
            'lineups': [
                {'team_id': 'home', 'starting_xi': [{'player_id': '12', 'name': 'Home'}]},
                {'team_id': 'away', 'starting_xi': away},
            ],
        }

        def search(tool, key, *, name, limit):
            self.assertEqual(tool, 'search_players')
            player_id = name.removeprefix('Away ')
            return json.dumps({'data': {'players': [
                {'player_id': '12', 'short_name': 'Wrong player'},
                {'player_id': player_id, 'short_name': f'A. {player_id}'},
            ]}}).encode()

        with TemporaryDirectory() as output, patch.object(import_matches, 'OUTPUT', Path(output)):
            with patch.object(import_matches, 'request_data', side_effect=search) as request:
                self.assertEqual(import_matches.cache_short_names(match, 'key', set()), 11)
                self.assertEqual(request.call_count, 11)
                request.reset_mock()
                self.assertEqual(import_matches.cache_short_names(match, 'key', set()), 0)
                request.assert_not_called()
            cached = json.loads((Path(output) / 'short-names' / '1.json').read_text())
            self.assertEqual(cached, {'player_id': '1', 'short_name': 'A. 1'})

    def test_short_name_lookup_does_not_retry_timeouts(self):
        with patch.object(import_matches, 'urlopen', side_effect=TimeoutError) as urlopen:
            with self.assertRaises(RuntimeError):
                import_matches.request_data('search_players', 'key', name='Player')
            urlopen.assert_called_once()

    def test_only_applicable_name_overrides_skip_the_lookup(self):
        starters = [
            {'player_id': '39748', 'name': 'Julio César De León'},
            {'player_id': '1', 'name': 'Other Player'},
        ]

        def match(team_id):
            return {
                'game': {'away': {'team_id': team_id}},
                'lineups': [{'team_id': team_id, 'starting_xi': starters}],
            }

        with TemporaryDirectory() as output:
            path = Path(output) / 'overrides.json'
            path.write_text(json.dumps({
                '39748': {'name': 'Júlio César', 'team_id': '110'},
                '1': {'name': 'Correct Name'},
            }))
            with patch.multiple(import_matches, OUTPUT=Path(output), NAME_OVERRIDES=path):
                response = b'{"data":{"players":[]}}'
                with patch.object(import_matches, 'request_data', return_value=response) as request:
                    searched = set()
                    import_matches.cache_short_names(match('110'), 'key', searched)
                    request.assert_not_called()
                    import_matches.cache_short_names(match('other'), 'key', searched)
                    request.assert_called_once_with('search_players', 'key', name='Julio César De León', limit=15)


class TeamColorsImportTests(unittest.TestCase):
    def test_saves_all_valid_palettes_and_keeps_the_first_value_for_each_team(self):
        first_season = {'data': {'teams': [
            {'team_id': '110', 'color': ' 3777D6 ', 'alt_color': '#151E2F', 'text_color': 'FFFFFF'},
            {'team_id': '109', 'color': '503187', 'alt_color': 'invalid'},
            {'team_id': '114', 'color': 'invalid'},
        ]}}
        second_season = {'data': {'teams': [
            {'team_id': '110', 'color': '000000'},
            {'team_id': '114', 'color': '2585C8'},
        ]}}
        responses = [json.dumps(season).encode() for season in (first_season, second_season)]

        with TemporaryDirectory() as output, patch.object(import_matches, 'OUTPUT', Path(output)):
            directory = Path(output) / 'team-colors'
            with patch.object(import_matches, 'request_data', side_effect=responses) as request:
                self.assertEqual(import_matches.cache_team_colors('110', 2009, 'key', set()), 2)
                self.assertEqual(import_matches.cache_team_colors('109', 2022, 'key', set()), 0)
                self.assertEqual(import_matches.cache_team_colors('110', 2023, 'key', set()), 0)
                request.assert_called_once_with('list_teams', 'key', season=2009)
                self.assertFalse((directory / '114.json').exists())
                self.assertEqual(import_matches.cache_team_colors('114', 2023, 'key', set()), 1)

            self.assertEqual(json.loads((directory / '110.json').read_bytes()), {
                'team_id': '110', 'color': '#3777d6', 'alt_color': '#151e2f', 'text_color': '#ffffff',
            })
            self.assertEqual(json.loads((directory / '109.json').read_bytes()), {
                'team_id': '109', 'color': '#503187',
            })

    def test_failed_lookup_is_retried_on_a_later_import(self):
        response = b'{"data":{"teams":[{"team_id":"110","color":"3777d6"}]}}'
        with TemporaryDirectory() as output, patch.object(import_matches, 'OUTPUT', Path(output)):
            with patch.object(import_matches, 'request_data', side_effect=[RuntimeError('offline'), response]) as request:
                with patch('builtins.print') as report:
                    requested_seasons = set()
                    self.assertEqual(import_matches.cache_team_colors('110', 2009, 'key', requested_seasons), 0)
                    self.assertEqual(import_matches.cache_team_colors('109', 2009, 'key', requested_seasons), 0)
                    report.assert_called_once()
                request.assert_called_once_with('list_teams', 'key', season=2009)
                self.assertFalse((Path(output) / 'team-colors').exists())
                self.assertEqual(import_matches.cache_team_colors('110', 2009, 'key', set()), 1)
                self.assertEqual(request.call_count, 2)


if __name__ == '__main__':
    unittest.main()
