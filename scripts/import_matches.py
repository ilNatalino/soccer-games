import argparse
import json
import os
import re
import socket
import ssl
import unicodedata
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


REPO = Path(__file__).resolve().parents[1]
OUTPUT = REPO / 'src' / 'strikerapi'
ENV_FILE = REPO / '.env'
MATCH_COUNT = 3
SAMPLES = (
    (2001, '2002-05-05', 'LAZ', 'INT', (4, 2)),
    (2009, '2009-08-29', 'MIL', 'INT', (0, 4)),
    (2022, '2023-05-07', 'NAP', 'FIO', (1, 0)),
    (2023, '2024-04-22', 'MIL', 'INT', (1, 2)),
)


def request_data(tool, key, **params):
    request = Request(
        f'https://mcp.strikerapi.com/v1/seriea/{tool}',
        data=json.dumps(params).encode(),
        headers={'Content-Type': 'application/json'},
    )
    request.add_unredirected_header('X-API-Key', key)
    for attempt in range(2):
        try:
            with urlopen(request, timeout=20) as response:
                return response.read()
        except HTTPError as error:
            raise RuntimeError(f'StrikerAPI: HTTP {error.code} per {tool}.') from None
        except (URLError, TimeoutError, socket.timeout) as error:
            reason = error.reason if isinstance(error, URLError) else error
            if isinstance(reason, (TimeoutError, socket.timeout)):
                if attempt == 0:
                    continue
                detail = 'tempo di attesa della risposta scaduto dopo due tentativi.'
            elif isinstance(reason, socket.gaierror):
                detail = 'DNS: impossibile risolvere mcp.strikerapi.com. Verifica che il comando abbia accesso alla rete.'
            elif isinstance(reason, ssl.SSLCertVerificationError):
                detail = 'verifica del certificato HTTPS fallita.'
            else:
                detail = f'errore di rete ({type(reason).__name__}).'
            raise RuntimeError(f'StrikerAPI: {tool}: {detail}') from None


def validate_match(match, game_id, day, score):
    game = match['game']
    if game['game_id'] != game_id or game['date'] != day:
        raise ValueError('partita diversa da quella richiesta')
    if (game['home']['score'], game['away']['score']) != score:
        raise ValueError('risultato diverso dal referto del club')
    if not all(isinstance(game[side]['name'], str) and game[side]['name'].strip() for side in ('home', 'away')):
        raise ValueError('nome della squadra mancante')

    lineup = next((team for team in match['lineups'] if team['team_id'] == game['away']['team_id']), {})
    starters = lineup.get('starting_xi', [])
    if len(starters) != 11 or len({player['player_id'] for player in starters}) != 11:
        raise ValueError('attesi undici titolari distinti per la squadra ospite')
    formation = lineup.get('formation') or ''
    if not re.fullmatch(r'[1-5](?:-[1-5])+', formation) or sum(map(int, formation.split('-'))) != 10:
        raise ValueError('modulo mancante o non valido')
    if not all(player.get('position') for player in starters):
        if {player.get('formation_place') for player in starters} != set(range(1, 12)):
            raise ValueError('posizioni dei titolari mancanti o non valide')

    jerseys = set()
    for player in starters:
        jersey = player.get('jersey') or ''
        name = unicodedata.normalize('NFD', player.get('name') or '').upper()
        goals = player.get('goals')
        if not re.fullmatch(r'[0-9]{1,3}', jersey) or not re.search(r'[A-Z]', name):
            raise ValueError('nome o numero di maglia mancante')
        if int(jersey) in jerseys:
            raise ValueError('numeri di maglia duplicati')
        if type(goals) is not int or goals < 0:
            raise ValueError('dato sui gol mancante o non valido')
        jerseys.add(int(jersey))

    if day == '2009-08-29':
        scorers = {int(player['jersey']) for player in starters if player['goals'] > 0}
        if scorers != {5, 8, 13, 22}:
            raise ValueError('marcatori del derby discordanti con il referto')


def save_match(path, raw_response):
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
        try:
            temporary.write(raw_response)
            temporary.close()
            temporary_path.replace(path)
        finally:
            temporary_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description='Importa tre partite di Serie A nel formato originale di StrikerAPI.')
    parser.add_argument('--key-file', type=Path, help='File privato contenente la chiave StrikerAPI')
    args = parser.parse_args()
    try:
        key = args.key_file.expanduser().read_text().strip() if args.key_file else os.environ.get('STRIKERAPI_KEY', '').strip()
        if not key and args.key_file is None and ENV_FILE.is_file():
            entries = (line.partition('=') for line in ENV_FILE.read_text().splitlines())
            key = next((value.strip() for name, _, value in entries if name.strip() == 'STRIKERAPI_KEY'), '')
    except OSError:
        parser.error('impossibile leggere il file della chiave')
    if not key or any(character.isspace() for character in key):
        parser.error(f'compila STRIKERAPI_KEY in {ENV_FILE.name}, impostala nell’ambiente o usa --key-file')

    saved = 0
    for season, day, home, away, score in SAMPLES:
        print(f'{day} {home}–{away}: richiesta a StrikerAPI…', flush=True)
        try:
            games = json.loads(request_data('list_games', key, season=season, date=day, status='final'))['data']['games']
            fixture = next((game for game in games if game['home']['abbrev'] == home and game['away']['abbrev'] == away), None)
            if fixture is None:
                raise ValueError('incontro assente nella risposta')
            raw_response = request_data('get_lineups', key, game_id=fixture['game_id'])
            validate_match(json.loads(raw_response)['data'], fixture['game_id'], day, score)
        except (ValueError, KeyError, TypeError, RuntimeError) as error:
            print(f'{day} {home}–{away}: {error}')
            continue

        path = OUTPUT / f'{day}.json'
        save_match(path, raw_response)
        print(path.relative_to(OUTPUT.parents[1]))
        saved += 1
        if saved == MATCH_COUNT:
            break

    print(f'{saved}/{MATCH_COUNT} risposte StrikerAPI salvate.')
    return int(saved != MATCH_COUNT)


if __name__ == '__main__':
    raise SystemExit(main())
