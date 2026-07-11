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

## Due tracce diverse: SPLASH e SPRITE (importante)

Provando i primi tre è emerso il nodo vero. Un'illustrazione MJ magnifica (posa
drammatica, luce d'atmosfera, sfondo di tempesta) è perfetta per **guardarla**,
ma **non** si anima come sprite di gioco: è una posa sola, la luce è «cotta»
dentro, e il personaggio corre/salta/combatte in decine di fotogrammi. Quindi
servono DUE tipi di render, per due usi diversi:

### 1) SPLASH — `<id>-splash.png` (già i tre che hai fatto)
Illustrazione «figa», posa eroica, sfondo e luce liberi. **Uso**: il **ritratto
nel riquadro** del roster (alla Tekken) e la **figura intera** nella scheda Ciurma
del Cantiere. Questi li uso quasi come sono (ritaglio il volto per il ritratto).

### 2) SPRITE — `<id>-sprite.png` (la prossima infornata, serve per animare)
Per l'animazione in gioco (idle/corsa/salto/colpo) MJ va guidato diverso. Prompt/impostazioni:
- **figura intera** testa-piedi, **posa neutra** in piedi (braccia un po' staccate dal corpo);
- **luce piatta e uniforme**, niente ombre drammatiche;
- **sfondo pieno e liscio** (bianco o verde), niente scenari;
- **vista laterale o 3/4 leggero**, scala coerente fra i pirati;
- parole utili: «character reference sheet, full body, A-pose, flat lighting, plain background, game asset».

Da uno sprite così io **ritaglio il personaggio a strati** (testa, busto, braccia,
gambe, cappello, arma) e lo **rigo come una marionetta** (animazione scheletrica 2D
in PixiJS): idle/corsa/colpo senza ridisegnare a mano, tenendo il tratto di MJ.

## Come nominare i file (`midjourney/`)

- `<id>-splash.png` — l'illustrazione eroica (ritratto + figura del roster)
- `<id>-sprite.png` — la posa neutra a luce piatta su sfondo liscio (per animare)
- `<id>-volto.png` — opzionale, un primo piano dedicato del volto
- varianti: `<id>-splash-2.png`, `-3.png`… (tengo la migliore che mi indichi)

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
