# Missing XI — Animazioni della sfida

## Comportamento concordato

- Dopo «Invia» o Invio da tastiera, le caselle del tentativo appena inviato passano al colore del loro esito una alla volta, da sinistra a destra. La sequenza salta gli spazi tra le parole. La digitazione e le correzioni aggiornano subito le caselle. Le righe precedenti mostrano i colori definitivi.
- Dopo la sequenza, la maglia e il nome del [titolare indovinato](../../CONTEXT.md) ricevono un breve accento visivo. Il nome di un titolare rivelato appare in modo statico.
- Se il tentativo risolve l’ultima maglia, il risultato compare dopo che si è colorata tutta la riga. Se il tentativo è corretto, l’accento sulla maglia si vede sul campo del risultato. Il sesto errore sull’ultima maglia segue la stessa sequenza delle caselle e porta al risultato.
- Se la sfida prosegue, puoi passare subito a un’altra maglia durante la sequenza. Quando torni alla precedente, trovi la riga già colorata.
- Quando riprendi una sfida, trovi subito i tentativi e il risultato salvati. Con la preferenza di sistema per il movimento ridotto, colori, nomi e risultato compaiono subito anche durante il gioco.

## Indicazioni per l’implementazione

- Valutare e salvare il tentativo all’invio. Far dipendere dalla sequenza solo la presentazione del feedback e il passaggio visivo al risultato.
- Tenere visibile la riga fino alla fine della sequenza. Coordinare gli spostamenti automatici del focus con la comparsa del nome e del risultato. Se chi gioca sceglie un’altra maglia nel frattempo, il focus segue quella scelta.
- Provare una sequenza complessiva entro circa 400 ms anche per i nomi lunghi e un accento di circa 200 ms sulla maglia. Rifinire i tempi su desktop e telefono.

## Verifiche

- Su desktop e telefono, digitare e correggere un nome composto, poi inviarlo. Verificare l’ordine delle caselle nella riga appena inviata e la leggibilità di colori, simboli e spazi.
- Indovinare un titolare a sfida in corso. Controllare che la maglia e il nome si animino dopo le caselle. Ripetere con il sesto errore e verificare la comparsa statica del nome rivelato.
- Cambiare maglia a sequenza iniziata e tornare indietro. Verificare che il cambio sia immediato e che il feedback della riga precedente appaia completo.
- Chiudere la sfida con un tentativo corretto e, in una seconda prova, con il sesto errore. Verificare l’ordine tra caselle e risultato, il focus sul risultato e il salvataggio del punteggio. Provare anche «Rivela e concludi», che mostra subito il risultato.
- Ricaricare durante una sequenza e riaprire una sfida conclusa. Ripetere invio e conclusione con il movimento ridotto attivo. Verificare che in tutti questi casi lo stato disponibile sia mostrato subito, con simboli e testi di feedback leggibili.
