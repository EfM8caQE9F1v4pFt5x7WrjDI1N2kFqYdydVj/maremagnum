# La Ciurma — pipeline grafica

Questa cartella contiene gli artwork originali dei pirati e i sorgenti da cui
ricavare gli sprite animati del gioco.

## Struttura

- `midjourney/<id>-splash.png`: artwork eroico usato come riferimento canonico
  per identità, costume, palette e materiali.
- `generati/lineup-*.png`: tavola di confronto visivo, non destinata al runtime.
- `generati/<id>-sprite-vN-source.png`: posa neutra su chroma key, conservata per
  poter rifare il ritaglio.
- `generati/<id>-sprite-vN.png`: posa neutra con trasparenza, pronta per essere
  separata in testa, busto, braccia, gambe e arma.

La directory `riferimenti/` non fa più parte della pipeline e non va usata come
fonte visiva.

## Asset prodotti

| Pirata | Sorgente sprite selezionato | Ritaglio RGBA | Asset runtime |
|---|---|---|---|
| Mozzo | `generati/mozzo-sprite-v2-source.png` | `generati/mozzo-sprite-v2.png` | `game/assets/pirati/mozzo.webp` |
| Cuoca | `generati/cuoca-sprite-v2-source.png` | `generati/cuoca-sprite-v2.png` | `game/assets/pirati/cuoca.webp` |
| Nostromo | `generati/nostromo-sprite-v2-source.png` | `generati/nostromo-sprite-v2.png` | `game/assets/pirati/nostromo.webp` |
| Vedetta | `generati/vedetta-sprite-v2-source.png` | `generati/vedetta-sprite-v2.png` | `game/assets/pirati/vedetta.webp` |
| Mastro d'Ascia | `generati/mastrodascia-sprite-v2-source.png` | `generati/mastrodascia-sprite-v2.png` | `game/assets/pirati/mastrodascia.webp` |
| Bucaniera | `generati/bucaniera-sprite-v3-source.png` | `generati/bucaniera-sprite-v3.png` | `game/assets/pirati/bucaniera.webp` |
| Gabbiere | `generati/gabbiere-sprite-v2-source.png` | `generati/gabbiere-sprite-v2.png` | `game/assets/pirati/gabbiere.webp` |
| Polena | `generati/polena-sprite-v2-source.png` | `generati/polena-sprite-v2.png` | `game/assets/pirati/polena.webp` |
| Mezzamiccia | `generati/mezzamiccia-sprite-v2-source.png` | `generati/mezzamiccia-sprite-v2.png` | `game/assets/pirati/mezzamiccia.webp` |
| Timoniere | `generati/timoniere-sprite-v2-source.png` | `generati/timoniere-sprite-v2.png` | `game/assets/pirati/timoniere.webp` |
| Filo di Fumo | `generati/filodifumo-sprite-v2-source.png` | `generati/filodifumo-sprite-v2.png` | `game/assets/pirati/filodifumo.webp` |
| Sergente | `generati/sergente-sprite-v2-source.png` | `generati/sergente-sprite-v2.png` | `game/assets/pirati/sergente.webp` |
| Ammiraglia | `generati/ammiraglia-sprite-v2-source.png` | `generati/ammiraglia-sprite-v2.png` | `game/assets/pirati/ammiraglia.webp` |
| Corsaro | `generati/corsaro-sprite-v2-source.png` | `generati/corsaro-sprite-v2.png` | `game/assets/pirati/corsaro.webp` |
| Senzanome | `generati/senzanome-sprite-v2-source.png` | `generati/senzanome-sprite-v2.png` | `game/assets/pirati/senzanome.webp` |

Le versioni precedenti restano come storico della prima serie, troppo uniforme.
Il recast corrente segue `../DIREZIONE-ARTISTICA.md`: umani di età, corporature e
provenienze diverse convivono con maledetti, esseri mitologici e creature nate
da legno navale, salsedine, fumo, nebbia e superstizione.

## Ricetta del recast

Prompt comune: concept 2D dipinto in realismo stilizzato, dark fantasy
marittimo fra Sei e Settecento, figura intera in posa neutra a tre quarti,
silhouette leggibile a 112 px, materiali consumati dal mare, nessun fantasy
medievale generico. Una sola figura su chroma key magenta uniforme, senza
fondale, ombra, testo, cornice o oggetti staccati.

I brief individuali sono i quindici ganci visivi elencati nella sezione
"Recast della Ciurma" di `../DIREZIONE-ARTISTICA.md`. Le sorgenti sono state
generate con lo strumento integrato `imagegen`; il chroma è stato rimosso
localmente con matte morbido e despill. I WebP runtime sono 320×320 con alpha,
qualità 82 e lato utile massimo di 292 px.

## Pipeline animata

I ritagli dipinti restano i ritratti canonici e le reference di identità. Gli
sprite giocabili usano invece uno scheletro low-poly parametrico condiviso, con
quindici ricette di corporatura, costume e accessori in
`scripts/bake-pirati-page.js`. Questa scelta conserva silhouette nette alle
scale da platform e picchiaduro senza tentare di deformare illustrazioni già
dipinte.

`npm run bake:pirati` produce `game/assets/pirati.webp` e i metadati associati:
una riga per personaggio e quattro sequenze comuni — idle, corsa, salto e
attacco. Il ritratto e il burattino hanno funzioni diverse ma condividono id,
roster e direzione artistica.

Gli id completi del roster sono: `mozzo, cuoca, nostromo, vedetta, mastrodascia,
bucaniera, gabbiere, polena, mezzamiccia, timoniere, filodifumo, sergente,
ammiraglia, corsaro, senzanome`.

## Licenza

Arte originale del progetto. Non introdurre asset copyleft o materiale di terzi
nel gioco.
