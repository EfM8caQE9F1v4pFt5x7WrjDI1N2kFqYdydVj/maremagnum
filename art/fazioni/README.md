# Fazioni — pipeline dei personaggi

Il catalogo visivo comprende tre fazioni da 15 personaggi:

- Ciurma Libera: sorgenti in art/pirati/generati e runtime in
  game/assets/pirati;
- Compagnia delle Indie: sorgenti in compagnia/generati e runtime in
  game/assets/fazioni/compagnia;
- Marina britannica: sorgenti in marina/generati e runtime in
  game/assets/fazioni/marina.

I roster canonici e i ganci individuali sono in ../DIREZIONE-ARTISTICA.md.
server/fazioni.js espone i 45 asset senza aggiungere Compagnia e Marina agli
sblocchi della Ciurma pirata.

## Prompt comuni

Tutti gli asset usano concept art 2D in realismo stilizzato, figura intera a
tre quarti, posa neutra, silhouette leggibile a 112 px e materiali marittimi
fra Sei e Settecento. Le sorgenti sono generate su chroma key magenta uniforme;
il fondale viene rimosso con matte morbido e despill. I WebP runtime sono
320x320 con alpha, qualità 82 e lato utile massimo di 292 px.

La Compagnia ripete avorio sporco, bordeaux, verde bottiglia, ottone, targhette
d'inventario e ceralacca. Persone, automi e creature devono sembrare registrati,
sigillati o posseduti dall'istituzione.

La Marina ripete blu profondo, bianco, oro contenuto, acciaio, ancora d'ottone,
cinghie regolamentari e gradi leggibili. Tutti i membri sono esseri umani vivi:
il soprannaturale può comparire soltanto in strumenti, gabbie e reliquiari
chiusi.
