# Missing XI — Serie A

Un quiz di calcio per PC e telefono. Ogni giorno c’è una sfida per ricordare gli undici titolari di una partita storica di Serie A, con sei tentativi Wordle per maglia.

## Avviare la prima prova

Servono Node.js 22.18+ (o 24+) e npm.

```sh
npm ci
npm run dev
```

Apri l’indirizzo `Local` stampato nel terminale sul PC. Sul telefono, collegato alla stessa rete Wi-Fi, apri l’indirizzo `Network`. Lascia il PC acceso e il comando in esecuzione; se il sistema chiede accesso alla rete locale, consentilo. Per fermare il server premi `Ctrl+C`.

Per provare subito il derby del 29 agosto 2009, aggiungi `/?partita=demo` all’indirizzo del gioco. Per giocare le sfide del calendario, importa le partite come descritto qui sotto.

Scegli una delle undici maglie e scrivi le lettere indicate dalla griglia. Gli spazi dei nomi composti sono già al loro posto. Ogni maglia ha sei tentativi e puoi cambiare titolare e ritrovare le righe già inviate. La risposta corretta o il sesto errore chiude la maglia e mostra il nome del titolare.

Quando tutte le maglie sono chiuse, il campo mostra gli undici titolari. Il riepilogo indica quanti ne hai indovinati e il totale dei tentativi inviati. Puoi anche scegliere «Concludi» per rivelare i titolari rimasti e vedere il risultato.

Accanto a ogni nome visibile sul campo leggi il numero di tentativi inviati per quella maglia. Un piccolo pallone segnala le maglie dei marcatori fin dall’inizio.

Riaprendo lo stesso indirizzo nello stesso browser ritrovi i tentativi inviati o, a sfida conclusa, il risultato definitivo. Ogni browser conserva i propri progressi.

## Importare le partite da StrikerAPI

Inserisci la chiave dopo `STRIKERAPI_KEY=` nel file privato `.env` nella radice del progetto. Se il file manca, crealo con permessi `600`. Git lo ignora. Avvia l’importazione con Python 3 da un terminale con accesso alla rete.

```sh
python3 scripts/import_matches.py
```

Lo script accetta anche la variabile d’ambiente `STRIKERAPI_KEY` o un file con la sola chiave tramite `--key-file`. Copre i sette giorni precedenti, oggi e gli otto giorni successivi in `Europe/Rome`. Mantiene gli abbinamenti già presenti e recupera le relative formazioni se mancano. Per le date libere alterna partite concluse di Serie A dalla stagione 2001–02 fino a quella in corso e scarta quelle con dati di formazione incompleti. Salva gli abbinamenti in `src/calendar.json` e le formazioni in `src/strikerapi/game-*.json`. [Copertura Serie A di StrikerAPI](https://strikerapi.com/serie-a)

Le [palette personalizzate delle maglie](src/team-shirt-overrides.json) hanno la precedenza e sono indicizzate per `team_id`. Ogni voce indica il colore di base (`color`), il colore del numero (`text_color`) ed eventualmente un motivo (`pattern`) e un colore secondario (`accent_color`). Per le altre squadre il gioco usa una palette disponibile in `src/strikerapi/team-colors/` o la maglia neutra.

Per ogni nuova partita l’importatore sceglie a caso la squadra da indovinare tra casa e trasferta quando entrambe le formazioni sono valide. Se una sola è valida, usa quella. Salva la scelta in `quiz_side` nel JSON della partita e cerca con `search_players` il nome breve dei soli titolari scelti. Riusa i nomi brevi già recuperati per lo stesso `player_id` e li salva nella formazione. La griglia rimuove l’eventuale iniziale puntata e usa il nome della formazione quando manca il nome breve. I JSON precedenti senza `quiz_side` usano la squadra ospite e possono ancora usare i nomi brevi locali in `src/strikerapi/short-names/`.

Le [correzioni dei nomi](src/strikerapi-name-overrides.json) sono indicizzate per `player_id`. Imposta `name` per tutte le partite di un giocatore o aggiungi `team_id` se la correzione vale solo per una squadra. Júlio César è limitato all’Inter perché StrikerAPI gli associa l’ID di Julio César De León. Una correzione applicabile ha la precedenza.

## Aggiornare il calendario delle sfide

La pagina principale apre la sfida di oggi e mostra anche i sette giorni precedenti, secondo il fuso italiano. Una data senza una partita importata mostra «Sfida non disponibile».

Puoi anche assegnare una partita a mano in [src/calendar.json](src/calendar.json) associando una data di pubblicazione `AAAA-MM-GG` al `data.game.game_id` di una partita importata. Scegli una partita diversa per ogni data.

### Provare e pubblicare il calendario da GitHub

1. Aggiungi `STRIKERAPI_KEY` come secret del repository in **Settings → Secrets and variables → Actions**.
2. Quando [il workflow](.github/workflows/fill-calendar.yml) è su `main`, apri **Actions → Calendario sfide → Run workflow**.
3. Per la prova lascia `publish` disattivato. Scarica il risultato da **Artifacts → calendario-sfide-test**.
4. Per provare la pubblicazione, avvia il workflow da `main` con `publish` attivato. Controlla se su `main` compare il commit `Update daily challenge calendar` e cerca il deploy associato nella scheda **Deployments** di Vercel. Il progetto Vercel deve essere collegato al repository con `main` come branch di produzione. [Deploy da Git su Vercel](https://vercel.com/docs/git)

In modalità pubblicazione il workflow committa e pusha su `main` solo le modifiche al calendario e ai JSON `game-*.json`. Il push richiede che il token di GitHub Actions possa scrivere sul branch. Vercel gestisce build e deploy tramite l’integrazione Git.

## Verifiche

```sh
npm run typecheck
npm test -- tests/maglia.spec.ts --project=desktop
npm test
npm run build
```

I test Playwright richiedono Google Chrome installato e avviano automaticamente il server sulla porta 4173. Coprono l’interfaccia desktop e una viewport mobile con tocco emulato; non sostituiscono la prova della tastiera di sistema su un telefono reale. La build statica viene generata in `dist/`.

## Da dove iniziare

La [specifica dell’MVP](.scratch/mvp/spec.md) raccoglie la formazione verificata, le regole concordate e le condizioni per la prima prova. Il [glossario](CONTEXT.md) definisce i termini del gioco.

## Ticket di sviluppo

| Ticket | Risultato da provare | Dipende da |
|---|---|---|
| [01 · Giocare una maglia](.scratch/mvp/issues/01-giocare-una-maglia.md) | Aprire il derby e completare una maglia da PC o telefono | — |
| [02 · Giocare tutta la formazione](.scratch/mvp/issues/02-giocare-la-formazione.md) | Passare fra gli undici titolari mantenendo i tentativi di ciascuno | 01 |
| [03 · Concludere la sfida](.scratch/mvp/issues/03-concludere-la-sfida.md) | Scoprire la formazione e leggere il punteggio finale | 02 |
| [04 · Riprendere la sfida](.scratch/mvp/issues/04-riprendere-la-sfida.md) | Ritrovare i tentativi in corso o il primo risultato definitivo | 03 |

I quattro ticket sono proposte di lavoro ricavate dalla specifica approvata. Lo stato iniziale `needs-triage` indica che la suddivisione è da rivedere prima di assegnarli. Ogni ticket contiene criteri di accettazione da spuntare durante lo sviluppo.

## Riferimenti

L’[architettura iniziale](docs/riferimenti/gioco-quotidiano/architettura-tecnica.md) e la [guida al gioco quotidiano](docs/riferimenti/gioco-quotidiano/guida-semplice.md) documentano l’idea più ampia, con calendario e storico. Per sviluppare il primo derby vale la specifica dell’MVP.

Specifica e ticket sono file Markdown locali organizzati secondo il [flusso di Matt Pocock](https://github.com/mattpocock/skills).
