# Missing XI — Prima versione MVP

**Piano pronto per lo sviluppo** · 21 novembre 2026

## Obiettivo confermato — 21 novembre 2026

Verificare che indovinare una formazione sia divertente e comprensibile con una sola sfida completa. Chi ha commissionato il gioco svolgerà la prova e deciderà se preparare una seconda sfida.

La prima prova non deve ancora verificare il ritorno quotidiano degli utenti. Calendario giornaliero, storico e pubblicazione settimanale sono rinviati.

## Pubblico della prima prova

La sfida è pensata per chi segue con passione la Serie A. Scegliamo una formazione riconoscibile anche per chi ricorda solo alcuni titolari.

## Prima sfida

Si indovina l'Inter nel derby di Serie A **Milan–Inter 0–4 del 29 agosto 2009**. Il modulo di partenza era il **4-3-1-2**. La scelta permette di provare sul campo anche le regole dei nomi composti e degli apostrofi. Gli undici e il modulo sono verificati sul [sito ufficiale dell'Inter](https://www.inter.it/it/match_center/3777) e nella [cronaca della Gazzetta dello Sport](https://www.gazzetta.it/Calcio/29-08-2009/leo-sfida-mou-501162789474.shtml).

| Reparto | Titolari |
|---|---|
| Portiere | Júlio César |
| Difesa | Maicon, Lúcio, Samuel, Chivu |
| Centrocampo | Zanetti, Stanković, Thiago Motta |
| Trequartista | Sneijder |
| Attacco | Milito, Eto’o |

## Come si gioca

- Puoi iniziare da qualsiasi maglia, lasciarla in sospeso e tornarci con i tentativi già fatti.
- All'apertura vedi squadre, data, risultato e le undici maglie dell'Inter nel modulo di partenza. Quando selezioni una maglia, le caselle vuote mostrano la lunghezza del nome da indovinare.
- Fin dall'apertura, un piccolo pallone compare accanto alla maglia di ogni titolare che ha segnato, anche quando il nome è ancora nascosto.
- Da PC puoi scegliere le maglie con il mouse o la tastiera, digitare sulla tastiera fisica e inviare con Invio. Da telefono tocchi la maglia e usi la tastiera di sistema. In entrambi i casi si gioca in maiuscolo. Ogni casella richiede una lettera e puoi inviare solo a riga completa. Fino all'invio puoi correggere liberamente.
- Ogni maglia usa il nome riportato nella tabella dei titolari. Per Thiago Motta la griglia richiede «THIAGO MOTTA», con lo spazio già presente.
- Gli spazi sono già al loro posto. Per «Júlio César» vedi cinque caselle, uno spazio fisso e altre cinque caselle. Nella griglia gli accenti e gli altri segni diacritici si riducono alla lettera di base, mentre apostrofi e trattini si omettono. Quando scopri un titolare, leggi la grafia originale.
- Ogni maglia ha sei tentativi indipendenti. Puoi provare anche una sequenza di lettere inventata. Ogni tentativo valido conta e viene valutato esclusivamente rispetto al titolare della maglia selezionata, anche se hai scritto il cognome di un compagno.
- Dopo un errore ricevi il feedback Wordle sulle lettere al posto giusto, presenti altrove o assenti. Al sesto errore il gioco rivela il titolare e puoi continuare con le altre maglie.
- Puoi scegliere «Concludi» anche con maglie ancora aperte. Se ne restano quattro, il gioco chiede «Vuoi rivelare i 4 titolari rimasti?». Con «Continua a giocare» torni al campo con i tentativi disponibili. Con «Rivela e concludi» scopri i nomi rimasti e chiudi la sfida. Quando tutte le maglie sono già indovinate o rivelate, il risultato appare automaticamente.
- Il risultato mostra quanti titolari hai indovinato su undici e la somma di tutti i tentativi inviati, comprese le risposte corrette e gli errori sulle maglie rivelate. La rivelazione non aggiunge tentativi. Per esempio, «7 su 11 indovinati · 20 tentativi». Se indovini un titolare al terzo tentativo e gli altri dieci al primo, leggi «11 su 11 indovinati · 13 tentativi».
- Sul campo, l'etichetta sotto ogni maglia scoperta contiene solo il nome del titolare e, alla sua destra, il numero di tentativi inviati per quella maglia. Il contatore comprende la risposta corretta e mostra 0 se il gioco rivela il titolare senza tentativi. A sfida conclusa si leggono tutti gli undici nomi con i rispettivi contatori.
- Dopo ogni invio il browser conserva tentativi e stato delle maglie. Una sfida in corso riprende da dove l'hai lasciata. A sfida conclusa, ricaricare o riaprire lo stesso indirizzo nello stesso browser restituisce il primo risultato definitivo, senza un comando per ricominciare.

## Ordine di sviluppo e verifiche

1. Preparare una pagina Vue con Vite e TypeScript e un file di dati per il derby. Disegnare il campo e le undici maglie. Verificare che ciascuna sia selezionabile sia da PC con mouse e tastiera sia da telefono con il tocco.
2. Rendere giocabile una maglia con sei tentativi e feedback Wordle. Verificare gli spazi di Júlio César, l'apostrofo e le due O di Eto’o, comprese le risposte con una O di troppo.
3. Collegare le undici maglie, salvare i progressi in `localStorage` e calcolare il risultato dai tentativi inviati. Verificare il sesto errore, la chiusura automatica all'ultima maglia e le due scelte della conferma anticipata.
4. Eseguire una prova completa nel browser del PC e una dal telefono. Ricaricare a metà sfida per controllare che i tentativi siano conservati. Riaprire dopo la conclusione per verificare che risultato e formazione restino definitivi.

## Accesso per la prima prova

Il progetto gira sul PC. Lo script di avvio locale dovrà mostrare sia l'indirizzo locale da aprire nel browser del PC sia l'indirizzo di rete da aprire sul telefono collegato alla stessa rete. Il PC resta acceso con il progetto in esecuzione durante la prova. Ogni browser conserva i propri progressi, quindi si possono provare i due dispositivi indipendentemente.

## Rapporto con il piano iniziale

[Architettura tecnica](../../docs/riferimenti/gioco-quotidiano/architettura-tecnica.md) e [guida semplice](../../docs/riferimenti/gioco-quotidiano/guida-semplice.md) descrivono la proposta più ampia di gioco quotidiano. Le loro assunzioni di gameplay restano da confermare; non costituiscono automaticamente requisiti di questa prima versione.
