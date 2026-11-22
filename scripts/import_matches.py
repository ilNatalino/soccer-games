import argparse
import json
import os
import re
import socket
import ssl
import unicodedata
from collections import deque
from datetime import date, datetime, timedelta
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


REPO = Path(__file__).resolve().parents[1]
OUTPUT = REPO / 'src' / 'strikerapi'
CALENDAR = REPO / 'src' / 'calendar.json'
ENV_FILE = REPO / '.env'


def request_data(tool, key, **params):
    request = Request(
        f'https://mcp.strikerapi.com/v1/seriea/{tool}',
        data=json.dumps(params).encode(),
        headers={'Content-Type': 'application/json'},
    )
    request.add_unredirected_header('X-API-Key', key)
    attempts = 2
    for attempt in range(attempts):
        try:
            with urlopen(request, timeout=20) as response:
                return response.read()
        except HTTPError as error:
            raise RuntimeError(f'StrikerAPI: HTTP {error.code} per {tool}.') from None
        except (URLError, TimeoutError, socket.timeout) as error:
            reason = error.reason if isinstance(error, URLError) else error
            if isinstance(reason, (TimeoutError, socket.timeout)):
                if attempt + 1 < attempts:
                    continue
                detail = 'tempo di attesa della risposta scaduto.'
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


def save_response(path, raw_response):
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
        try:
            temporary.write(raw_response)
            temporary.close()
            temporary_path.replace(path)
        finally:
            temporary_path.unlink(missing_ok=True)


def fetch_calendar_match(key, game_id, fixture=None):
    match = json.loads(request_data('get_lineups', key, game_id=game_id))['data']
    game = match['game']
    if game['status'] != 'final':
        raise ValueError('partita non conclusa')
    expected = game if fixture is None else fixture
    score = expected['home']['score'], expected['away']['score']
    if any(type(goals) is not int or goals < 0 for goals in score):
        raise ValueError('risultato mancante o non valido')
    date.fromisoformat(expected['date'])
    validate_match(match, game_id, expected['date'], score)

    teams = {side: {field: game[side][field] for field in ('team_id', 'name', 'score')}
             for side in ('home', 'away')}
    lineup = next(team for team in match['lineups'] if team['team_id'] == teams['away']['team_id'])
    player_fields = ('player_id', 'name', 'jersey', 'position', 'formation_place', 'goals')
    return {'data': {
        'game': {'game_id': game_id, 'date': game['date'], **teams},
        'lineups': [{
            'team_id': lineup['team_id'],
            'formation': lineup['formation'],
            'starting_xi': [{field: player.get(field) for field in player_fields}
                            for player in lineup['starting_xi']],
        }],
    }}


def fill_calendar(key, today):
    calendar = json.loads(CALENDAR.read_bytes())
    available = {json.loads(path.read_bytes())['data']['game']['game_id']
                 for path in OUTPUT.glob('*.json')}
    days = [(today + timedelta(days=offset)).isoformat() for offset in range(-7, 9)]
    missing_days = deque(day for day in days if day not in calendar)
    missing_ids = {calendar[day] for day in days if day in calendar} - available
    matches = {game_id: fetch_calendar_match(key, game_id) for game_id in sorted(missing_ids)}
    new_dates = len(missing_days)

    if missing_days:
        used = set(calendar.values())
        # shortcut: il test pesca dalle ultime 50 partite della Serie A 2024–25, ampliare per la rotazione in produzione.
        games = json.loads(request_data('list_games', key, season=2024, status='final', limit=50))['data']['games']
        for fixture in games:
            game_id = fixture['game_id']
            if game_id in used:
                continue
            if game_id not in available:
                try:
                    matches[game_id] = fetch_calendar_match(key, game_id, fixture)
                except (KeyError, TypeError, ValueError) as error:
                    print(f'Partita {game_id} scartata: {error}')
                    continue
            day = missing_days.popleft()
            calendar[day] = game_id
            used.add(game_id)
            print(f'{day}: assegnata la partita {game_id}')
            if not missing_days:
                break

    if missing_days:
        raise ValueError(f'partite valide insufficienti per {", ".join(missing_days)}')
    for game_id, match in matches.items():
        path = OUTPUT / f'game-{quote(game_id, safe="")}.json'
        save_response(path, json.dumps(match, ensure_ascii=False).encode())
    if new_dates:
        save_response(CALENDAR, (json.dumps(calendar, indent=2, sort_keys=True) + '\n').encode())
    print(f'{days[0]} – {days[-1]}: {len(days)} sfide pronte, {new_dates} date aggiunte, {len(matches)} formazioni scaricate.')


def main():
    parser = argparse.ArgumentParser(description='Completa il calendario da oggi −7 a oggi +8 con StrikerAPI.')
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

    try:
        fill_calendar(key, datetime.now(ZoneInfo('Europe/Rome')).date())
    except (KeyError, TypeError, ValueError, RuntimeError, OSError) as error:
        parser.exit(1, f'Importazione calendario fallita: {error}\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
