# La Ciurma — cartella dell'arte (issue #16, #7, #10)

Qui vive la pipeline dell'arte dei 15 pirati, **prima** che diventino sprite di gioco.
Decisione di stile (11/7): **2D**, con la resa «figa» che arriva da **Midjourney** (strumento
del capitano). Io produco i grezzi, tu li porti in MJ, io li rimonto in sprite PixiJS.

## Il flusso

```
1. io      → riferimenti/<id>.png     (grezzo «hero», tratto pulito, scala di grigi)
2. capitano → Midjourney               (colore, materia, «versione figa»)
3. capitano → midjourney/<id>-*.png    (ci lasci qui gli artwork che tornano)
4. io      → taglio in fotogrammi + impacchetto in atlante PixiJS (game/assets/pirati.webp)
```

I grezzi in `riferimenti/` sono **volutamente essenziali**: servono a fissare
**proporzioni, silhouette, tratti e accessori** — NON il colore. In MJ hai mano
libera sulla palette e sui materiali; l'importante è che resti riconoscibile il
pirata (stessa identità del roster in `server/pirati.js`).

## Come lasciarmi gli artwork di MJ (`midjourney/`)

Nomina i file così, che li ritrovo e li lavoro senza chiedertelo:

- `<id>-figura.png` — la figura intera (per platform e picchiaduro in campo)
- `<id>-volto.png` — il primo piano del volto (per il ritratto nel roster)
- se ne provi varianti: `<id>-figura-2.png`, `-3.png`… (tengo la migliore che mi indichi)

Gli `<id>` sono quelli del roster: `mozzo, cuoca, nostromo, vedetta, mastrodascia,
bucaniera, gabbiere, polena, mezzamiccia, timoniere, filodifumo, sergente,
ammiraglia, corsaro, senzanome`.

## Il brief dei primi tre (quelli in `riferimenti/`)

Silhouette diverse apposta, per tastare lo stile su corpi diversi:

- **mozzo** — Ugo «il Mozzo»: magro, giovane, sveglio. Bandana, camicia rimboccata,
  scalzo, coltellaccio corto. L'aria di chi sgattaiola tra le cime.
- **bucaniera** — Morgana «la Bucaniera»: portamento fiero, tricorno, capelli lunghi,
  panciotto e sciabola. La spadaccina del gruppo.
- **senzanome** — Il Capitano Senzanome: alto, spettrale, imponente. Tricorno grande,
  barba folta, cappotto lacero, occhi che ardono. Il leggendario che non si compra.

## Licenza / paletto

Arte **originale nostra** (i grezzi sono disegnati da zero dalle ricette del roster;
l'LPC è servito solo come riferimento di *costruzione*, mai copiato). Restiamo nella
corsia pulita: niente asset copyleft di terzi dentro il gioco.
