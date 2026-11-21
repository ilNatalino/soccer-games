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

Quando tutte le maglie sono chiuse, il campo mostra i titolari indovinati e rivelati e il totale dei tentativi inviati. Puoi anche scegliere «Concludi» per rivelare i titolari rimasti e vedere il risultato. Per ora ricaricare la pagina azzera la sfida.

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
