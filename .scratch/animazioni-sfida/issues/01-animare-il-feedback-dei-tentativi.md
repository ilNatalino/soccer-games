# 01 — Animare il feedback dei tentativi

**What to build**

Dopo l’invio di un tentativo, chi gioca vede le caselle colorarsi da sinistra a destra. Quando indovina un titolare, la sua maglia e il suo nome ricevono un breve accento sul campo. Se il tentativo chiude la sfida, la riga completa la sequenza prima che compaia il risultato. Il comportamento è descritto nella [specifica delle animazioni](../spec.md).

**Blocked by:** Nessuno. Può partire subito.

**Status:** done

- [x] «Invia» e Invio da tastiera avviano la stessa sequenza. Si colorano una alla volta le caselle della riga appena inviata, saltando gli spazi tra le parole. La digitazione e le correzioni aggiornano subito le caselle e le righe precedenti mostrano i colori definitivi. I simboli degli esiti sono leggibili.
- [x] Dopo la sequenza, la maglia e il nome di un titolare indovinato si animano brevemente. Il nome di un titolare rivelato compare in modo statico.
- [x] Durante una sfida in corso si può passare subito a un’altra maglia. Il focus segue la scelta e, tornando alla maglia precedente, la riga è già colorata.
- [x] Una risposta corretta o un sesto errore sull’ultima maglia mostrano per intero la sequenza prima del risultato. Una risposta corretta anima la maglia sul campo del risultato. Il focus va al riepilogo quando compare. «Rivela e concludi» mostra il riepilogo subito.
- [x] Il tentativo viene salvato all’invio. Ricaricando durante la sequenza o riaprendo una sfida conclusa, lo stato salvato e il punteggio corrispondente compaiono subito.
- [x] Con la preferenza di sistema per il movimento ridotto, colori, nomi e risultato compaiono subito, con simboli e testi leggibili.
- [x] Su desktop e telefono, provare anche un nome composto lungo. Usare come valori iniziali circa 400 ms al massimo per la sequenza e circa 200 ms per l’accento sulla maglia, poi rifinirli in base alla prova.

Verifica visiva su Chrome desktop e con il profilo Pixel 7 di Playwright.
