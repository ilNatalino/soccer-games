# Missing XI — Serie A

Un quiz di calcio per PC e telefono. La prima sfida consiste nel ricordare gli undici titolari dell’Inter nel derby del 29 agosto 2009, con sei tentativi Wordle per maglia.

## Avviare la prima prova

Servono Node.js 22.18+ (o 24+) e npm.

```sh
npm ci
npm run dev
```

Apri l’indirizzo `Local` stampato nel terminale sul PC. Sul telefono, collegato alla stessa rete Wi-Fi, apri l’indirizzo `Network`. Lascia il PC acceso e il comando in esecuzione; se il sistema chiede accesso alla rete locale, consentilo. Per fermare il server premi `Ctrl+C`.

Scegli una delle undici maglie e scrivi le lettere indicate dalla griglia. Gli spazi dei nomi composti sono già al loro posto. Ogni maglia ha sei tentativi e puoi cambiare titolare e ritrovare le righe già inviate. La risposta corretta o il sesto errore chiude la maglia e mostra il nome del titolare.

Quando tutte le maglie sono chiuse, il campo mostra gli undici titolari. Il riepilogo indica quanti ne hai indovinati e il totale dei tentativi inviati. Puoi anche scegliere «Concludi» per rivelare i titolari rimasti e vedere il risultato.

Accanto a ogni nome visibile sul campo leggi il numero di tentativi inviati per quella maglia. Un piccolo pallone segnala le maglie dei marcatori fin dall’inizio.

Riaprendo lo stesso indirizzo nello stesso browser ritrovi i tentativi inviati o, a sfida conclusa, il risultato definitivo. Ogni browser conserva i propri progressi.

## Provare tre partite da StrikerAPI

Inserisci la chiave dopo `STRIKERAPI_KEY=` nel file privato `.env` nella radice del progetto. Se il file manca, crealo con permessi `600`. Git lo ignora. Avvia l’importazione con Python 3 da un terminale con accesso alla rete.

```sh
python3 scripts/import_matches.py
```

Lo script accetta anche la variabile d’ambiente `STRIKERAPI_KEY` o un file con la sola chiave tramite `--key-file`. Parte da Lazio–Inter (2002), Milan–Inter (2009) e Napoli–Fiorentina (2023). Se una formazione è incompleta, prova le partite successive del campione fino a salvare tre risposte valide. I JSON originali finiscono in `src/strikerapi/`, esclusa da Git. La build include i dati importati nel JavaScript inviato al browser.

L’app mostra le partite importate e propone di indovinare la squadra ospite in ciascuna. Se la cartella è vuota si apre il derby dimostrativo. La demo resta accessibile su `/?partita=demo`.

Quando manca la palette della squadra da indovinare, l’importatore chiede a `list_teams` le squadre della stagione e salva le palette disponibili per `team_id` in `src/strikerapi/team-colors/`. Le importazioni successive riusano i colori salvati. Se i colori mancano, sul campo appare una maglia neutra e una nuova importazione può riprovare.

L’importazione cerca il nome breve solo per i titolari della squadra da indovinare e lo salva per ID in `src/strikerapi/short-names/`. Ogni giocatore già in cache evita una ricerca nelle partite successive. La griglia usa il nome breve senza l’eventuale iniziale, oppure il nome della formazione se la ricerca non restituisce un nome breve.

Le [correzioni dei nomi](src/strikerapi-name-overrides.json) sono indicizzate per `player_id`. Imposta `name` per tutte le partite di un giocatore o aggiungi `team_id` se la correzione vale solo per una squadra. Júlio César è limitato all’Inter perché StrikerAPI gli associa l’ID di Julio César De León. Una correzione applicabile ha la precedenza e evita la ricerca del nome breve.

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
