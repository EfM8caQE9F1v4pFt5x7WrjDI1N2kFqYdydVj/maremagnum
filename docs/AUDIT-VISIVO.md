# Audit visivo — Maremagnum (già "Navigare il Web") v0.3+

Metodo: dopo ogni fase grafica si scattano screenshot reali (script
`scripts/shot.js`) alle quattro ore chiave del ciclo (giorno, tramonto,
crepuscolo, notte) e si valutano contro:

1. **Euristiche di visual design** — gerarchia focale, armonia della palette
   (tela smorzata + accenti saturi solo dove serve gameplay), Gestalt
   (raggruppamento acqua/terra/UI), contrasto testi (obiettivo WCAG AA sul
   HUD), coerenza dello stile (niente elementi che "parlano un'altra lingua").
2. **Personas emotive** — quattro giocatori tipo, per misurare l'emozione
   suscitata, non solo la correttezza:
   - **Marta, 9 anni** — gioca per meraviglia; non deve mai spaventarsi troppo.
   - **Davide, 38** — nostalgico di Monkey Island; cerca romanticismo piratesco.
   - **Rex, 18** — PvP competitivo; ogni scelta estetica non deve costargli
     una bordata: leggibilità di nemici, proiettili, HP sopra tutto.
   - **Lucia, 45** — sensibile ad affaticamento visivo e motion sickness;
     effetti lampeggianti e pattern ad alto contrasto in movimento vanno dosati.

Riferimenti di direzione artistica (dalla ricerca sui migliori indie
2021-2026): DREDGE (forme semplici, atmosfera dal colore, nebbia centrata sul
giocatore, nuvole angolari), Sunless Sea (poche tinte, luce che emana dalla
nave, silhouette), Animal Well / Sea of Stars (2D + luce dinamica moderna).

---

## Round 1 — dopo acqua a shader + ciclo giorno/notte (fasi 2-3)

Screenshot: `giorno.png`, `tramonto3.png`, `notte.png` (scratchpad/shots).

### Cosa funziona
- **Notte**: la scena più forte del gioco. Nebbia che stringe la visuale,
  lanterne di bordo, faro che taglia il buio: leggibile e atmosferica insieme.
- **Acqua**: chiazze tonali, scintille puntiformi, grana sottile; al tramonto
  le creste si accendono mentre i cavi restano freddi (lezione: il calore va
  pesato sulla luminanza, mai spalmato — il primo tentativo era fango).
- **Ciclo**: la tinta del mondo segue l'ora in modo credibile.

### Problemi rilevati (euristiche)
| # | Problema | Gravità | Correzione decisa |
|---|----------|---------|-------------------|
| 1 | Isole verde-prato sature: palette da cartoon anni '60, fuori tela | alta | restyle: verdi salvia/oliva smorzati, sabbia meno gialla (fase 4) |
| 2 | Contorni neri duri su navi/case vs mare senza linee: due linguaggi | alta | eliminare/ammorbidire gli stroke (fase 4) |
| 3 | Disco "acqua bassa" attorno alle isole: cerchio piatto, effetto UI | media | gradiente radiale morbido (fase 4) |
| 4 | Ombre di nuvole troppo dense e frequenti al tramonto | media | alpha 0.32→0.22, scala tile più larga (subito) |
| 5 | Scintille leggermente grandi, vicino a riva leggono come detriti | bassa | soglia sparkle più alta (subito) |
| 6 | Di giorno il punto focale è l'isola, non la propria nave | media | nave più luminosa/contrastata nel restyle (fase 4) |

### Lettura delle personas
- **Marta**: «di notte la lanterna è magica» — ma da sola al buio è tanta
  tensione: la musica calma dovrà rassicurare (fase 5); di giorno tutto ok.
- **Davide**: il tramonto «sa di Monkey Island 2 al crepuscolo». Le casette
  rosso-fumetto però stonano: tetti terracotta spenta nel restyle.
- **Rex**: di notte i nemici fuori dal cerchio si vedono poco — è la scelta di
  design (DREDGE), compensata da lanterne nemiche visibili e minimappa sempre
  nitida. Da tenere d'occhio dopo il restyle.
- **Lucia**: grana e sfarfallio lanterna sotto soglia di fastidio; le macchie
  di nuvole in movimento al tramonto sono il rischio maggiore → ridotte (fix 4).

### Esito
Round superato con riserva: correzioni 4-5 applicate subito, 1-2-3-6 pianificate
nella fase 4 (restyle pittorico).

---

## Round 2 — dopo il restyle pittorico (fase 4) + audio (fasi 5-6)

Screenshot: `r2-giorno.png`, `r2-notte.png`, `r2-alba.png`, `r2-crepuscolo.png`,
`r2-battaglia.png`, `r2-impostazioni.png`.

### Verifica delle correzioni del round 1
| # | Correzione | Esito |
|---|-----------|-------|
| 1 | Palette isole smorzata (salvia/oliva, sabbia calda) | ✅ le isole siedono nella stessa luce del mare |
| 2 | Via i contorni neri (navi, case, faro) | ✅ il linguaggio ora è unico, tonale |
| 3 | Acqua bassa a gradiente radiale | ✅ sparito l'effetto "disco UI" |
| 4 | Nuvole ridotte (alpha 0.22, tile più larga) | ✅ presenti ma non invadenti |
| 5 | Scintille più fini | ✅ non leggono più come detriti |
| 6 | Nave protagonista più leggibile | ✅ vele crema + anello oro: primo piano netto |

### Nuovi rilievi
- I **moli** restano segmenti netti di legno: accettato come carattere "da
  carta nautica naïf"; eventuale rifinitura futura.
- L'**etichetta** di un'isola può sovrapporsi all'hint comandi in basso quando
  l'isola è a fondo schermo: raro e non bloccante.
- Il giorno pieno resta volutamente sotto-esposto rispetto a un arcade: è la
  scelta di mood (DREDGE), la leggibilità di rotte/nemici è verificata.
- Pannello **Impostazioni di bordo**: coerente con lo stile pergamena, i
  controlli non rubano il focus del timone (blur dopo il click).

### Lettura delle personas
- **Marta**: l'alba rosata è il suo momento («sembra una fiaba»); il tamburello
  del tema calmo tiene compagnia di notte.
- **Davide**: tetti in terracotta e sabbia calda al tramonto: «è la mia
  Monkey Island interiore». Soddisfatto.
- **Rex**: in battaglia il fumo delle bordate non copre i proiettili (ombra
  a terra sempre visibile); barre di ricarica leggibili su ogni fondale; la
  musica di battaglia parte QUANDO si spara, non quando un nemico è solo
  vicino: niente falsi allarmi che tradiscano un agguato. Approvato.
- **Lucia**: crossfade musicale morbido (~2.5s), niente cambi bruschi; volume
  di default 80% con master musica a -16dB circa rispetto agli effetti; tutto
  disattivabile dal pannello ⚙. Nessun elemento lampeggiante oltre soglia.

### Esito
Round superato. Residui accettati e documentati.

---

## Round 3 — verifica finale trasversale

Screenshot: `r3-primoavvio2.png` (prima esperienza, pergamena del nome sopra
il mare notturno) + riprese di controllo alle quattro ore.

- **Coerenza fra le ore**: la palette scivola alba→giorno→tramonto→
  crepuscolo→notte senza salti; il "calore" al tramonto tocca solo le creste
  (il primo tentativo, calore spalmato, produceva un mare color fango — v.
  lezione nel round 1).
- **Gerarchia sempre rispettata**: nave → rotta/oro → isole → mare, in
  quest'ordine di salienza a ogni ora del ciclo.
- **Accenti saturi = solo gameplay**: oro (rotta, anello, monete), rosso
  (X della destinazione, HP basso), verde (HP pieno). Il resto è tela.
- **Suite di protocollo**: verde (29/29 + fortezze).
- **Musica**: RMS misurato — calma 0.0064, battaglia 0.0122 (~2×), spenta 0.
  Crossfade e interruttori funzionano; l'ambiente onde segue il toggle effetti.
- **Nota tecnica sandbox**: senza GPU servono `--disable-gpu
  --enable-unsafe-swiftshader` (già nei default di `scripts/shot.js`), perché
  il fallback CanvasRenderer di Pixi ignora le mesh a shader. `antialias`
  resta spento: su SwiftShader un contesto con MSAA nasce rotto e TUTTI gli
  shader falliscono la init.

### Esito
Approvato per la v0.3. Prossimi candidati (fuori scopo): rifinitura moli,
god rays veri al tramonto su GPU reali, gabbiani sonori diurni.

---

## Round 4 — audit UX/UI interattivo (runner `scripts/audit-ui.js`)

Metodo: un runner headless pilota l'app VERA — click su ogni elemento, rotta
digitata, mappa, veleggiata cieca fino al Porto Franco (homing sul dockHint),
attracco, cantiere, assedi — e scatta uno screenshot per stato
(scratchpad/audit/a1..a12).

### Correzioni applicate
| Problema (euristica) | Fix |
|---|---|
| Azioni del Cantiere tagliate sotto la piega (visibilità dello stato) | footer `azioni` sticky nel pannello scrollabile |
| "Salpa!" della mappa staccato dalla pergamena, sopra la minimappa (prossimità/Fitts) | bottone ancorato dentro la pergamena, in basso a destra |
| Mappa auto-chiusa dopo 7s (controllo utente) | resta finché non si salpa: bottone, ESC o click fuori |
| Nessuna uscita standard dagli overlay (Nielsen: user control) | ESC globale (blur input → chiudi overlay; nei pannelli d'attracco = salpa) + click fuori sui pannelli non distruttivi |
| Riga "Ciurma di Guardia" disallineata nelle impostazioni | griglia 24px+1fr, testo a sinistra, copy asciugato |
| Chiusure incoerenti ("Salpa" anche dove non si salpa) | linkish "Chiudi" per i pannelli informativi; "⛵ Salpa" SOLO dove si lascia l'attracco |
| Pillola missione coperta dalla barra d'attracco | `body.attraccato` fa scendere missione/assedio/killfeed |
| Bottoni ← → ↺ piccoli (Fitts) | padding aumentato |
| Verde menta dei "+ Nuovo slot" fuori palette | salvia in tema |
| "Bandiscine uno" + ruoli assedio non spiegati | "Banditene uno" + riga ruoli sotto il titolo |
| Emoji monocromi (niente font emoji nel sistema) | fontconfig rigenerato; MAI mettere 'Noto Color Emoji' nello stack font (si mangia spazi e cifre — regressione vista e corretta) |

### Nota di metodo
La homing cieca del runner attraccava alla prima isola con "Premi F" (una
volta il Faro dell'Oracolo): il test ora pretende il Porto Franco. I bug
scoperti dai test sono spesso nei test.

---

## Round 5 — la flotta ha classi (e si vedono)

Prima c'era UNA nave pirata per tutti: il capitano al livello massimo era
identico al novellino. Progressione invisibile = progressione che non
emoziona (Rex, 18: "perché pago il Cantiere se non si vede?").

### La flotta cotta (scripts/bake-navi-page.js, parametrica)
| Classe | Quando | Silhouette |
|---|---|---|
| **Sloop** | scafo 0–1 | corta (L 0.78), 1 albero, fiocco |
| **Brigantino** | scafo 2–3 | L 1.00, 2 alberi, castello di poppa |
| **Galeone** | scafo 4 | L 1.22, 3 alberi, doppio castello, gabbie |
| **Galeone Dorato** | scafo 4 + vele 4 | come il galeone, ma listello/fregio/pomi/lanterna d'ORO, vele avorio |
| Fantasma / Mercantile | PvE | palette spettrale / 1 albero e casse |

La classe è derivata dallo snapshot (`maxHp` → scafo, nuovo campo `sl` →
vele): nessun profilo fidato dal client, e i client vecchi ignorano il campo.

### Scelte visive (e perché)
- **La stazza racconta il rango** (preattentivo: la dimensione si legge prima
  del colore): sloop → galeone si distinguono a colpo d'occhio dalla scia.
- **L'oro deve brillare anche a mezzogiorno**: a zoom di gioco il listello
  dorato del modello non basta; il Dorato ha bagliore caldo perenne che
  respira (sin 2.1 Hz) e nome in oro. Di notte la lanterna fa il resto.
- **Portelli e ombra si allungano con la classe** (fL 0.82/1/1.16): i portelli
  del galeone non galleggiano oltre lo scafo, quelli della sloop non si
  ammassano.
- **Il Cantiere dichiara la classe** (.shipClass): "La tua nave: Brigantino —
  con Scafo 4 diventa Galeone". La scala di progressione è visibile PRIMA
  dell'acquisto (Nielsen: visibilità dello stato + motivazione).
- Camera di cottura a D=13.6 (il galeone deve stare nel fotogramma 192px);
  compensata lato client con scala 82.6/frame per non rimpicciolire il mare.

Verifica: foto di famiglia con 4 bot (uno per classe) via harness scratchpad
shot-flotta.js + scatti giorno/notte del Dorato (dev param nuovi
`?scafo=0..4&vele=0..4`). Test protocollo verdi.

### Round 5-bis — la lezione di Monkey Island (reference dell'utente)

L'utente ha portato screenshot delle battaglie navali di The Curse of
Monkey Island: quello è il livello. Cosa mancava alle nostre navi, e cosa
si è fatto (tutto nel bake, gratis a runtime):

| Reference CMI | Fix nel Cantiere di Cottura |
|---|---|
| Vele quadre enormi, a 2-3 ordini, che DOMINANO la sagoma | ordini di vele più grandi e alti, alberatura +50%, royale sul galeone |
| Le vele restano piene da ogni inquadratura | pennoni **bracciati** (~22°): di traverso una vela squadrata sparirebbe di taglio — è il trucco che nei reference nessuno nota e tutti vedono |
| Tela candida anche in ombra (è dipinta, non fotorealista) | emissiva alta sulla tela + texture canvas con cuciture e ombra al piede |
| Bordo giallo che contorna il ponte visto dall'alto | piastra a forma di ponte, un filo più larga, sotto il capodibanda |
| Doppio listello giallo + fascia verdazzurra + incinta scura in fiancata | listelli sporgenti dallo scafo (prima erano DENTRO la geometria, invisibili) |
| Scafo di legno vivo, non lastra marrone | texture fasciame procedurale (corsi + chiazze di tono), UV in unità mondo |
| Pennoncello scuro in testa d'albero | bandiera ridotta, verde pino, teschio = punto chiaro (a questa scala basta) |
| Galleria di poppa che vive | finestrelle emissive calde sullo specchio |

L'ammiraglia dorata ora si distingue dalla TELA (canapa d'oro, non bianca)
oltre che da bagliore perenne e nome in oro: da quando tutte le classi
vestono il listello giallo, l'oro del solo scafo non bastava più.

Nota di metodo: il driver d'audit ora attracca col rilevamento vero
(`?spia=1` espone posizione e porto) invece di veleggiare alla cieca —
attracco in 6 iterazioni dove prima falliva 2 volte su 3.

---

## Round 6 — il cannocchiale e i cannoni veri

Richiesta dell'utente: tre livelli di zoom, e basta coi "pallini neri" al
posto dei cannoni.

### Il cannocchiale (Z o rotella)
Tre scatti: mare aperto (1×), manovra (1.45×), abbordaggio (2×), con
carrellata morbida (lerp) e scelta salvata nel profilo. Il mondo scala,
l'interfaccia no; i nomi si contro-scalano (1/z) per restare leggibili.
L'acqua zooma con il mondo in ENTRAMBI i tier: uniform uZoom nello shader
(world = uCam + vUV·uScreen/uZoom), tileScale·z + tilePosition·z nella tile
canvas. Nebbia e lanterna seguono la nave in coordinate schermo riscalate.

### Cannoni con la sagoma dell'arma (drawGun in render.js)
Lo snapshot ora porta `gw` (iniziale+livello per slot, es. "o3o3"): il
client disegna affusto + canna VERA, non un pallino — colubrina lunga e
sottile, cannone con cerchiatura dal lvl 2, carronata corta e tozza,
mortaio a pentola con la bocca al cielo, organo a TRE canne. Il livello 3
è di bronzo. Vecchi client: ignorano `gw`, tengono i conteggi.

### Lezioni tecniche pagate col sangue
- **8192 px è il tetto texture dei renderer software**: l'atlas 256px in
  colonna singola (1536×9216) diventava un QUADRATO NERO su SwiftShader.
  Riforma: 12 colonne → 3072×4608. Sempre sotto gli 8k.
- **PNG 6.8MB → WebP 1.7MB** via canvas.toDataURL('image/webp', 0.92):
  stessa trasparenza morbida (l'alpha c'è, VP8X+ALPH), un quarto del peso.
- Il fattore di stazza a schermo ora viaggia in navi.json (`scala` = 79·D/13):
  cambiare la camera di cottura non richiede più di ricordarsi il client.

---

## Round 7 — il Manuale del Corsaro e la rada del riscatto

Nuovo bottone 📜 in plancia → modale "Il Manuale del Corsaro": come si
naviga, le isole che crescono con gli approdi, le fortezze, le classi di
nave, l'Ancoraggio, la Ciurma di Guardia, i comandi. Testo a sinistra
(si LEGGE, non si ammira), pattern standard (ESC/click-fuori/Chiudi).

In coda al manuale, "Riscatta la tua isola": i proprietari dei siti veri
lasciano dominio+recapito in lista d'attesa per l'Editor dell'Isola
(visione nella issue #1 su GitHub). POST /riscatto → AtlanteDO (una voce
per dominio, max 5 recapiti), elenco per l'Ammiragliato dietro segreto.
Se attraccati a un sito, il dominio è precompilato.
