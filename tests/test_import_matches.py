import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from scripts import import_matches


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


if __name__ == '__main__':
    unittest.main()
