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

Metodo: un runner Electron pilota l'app VERA — click su ogni elemento, rotta
digitata, mappa, veleggiata cieca fino al Porto Franco (homing sul dockHint),
attracco, cantiere, assedi, sito reale nella siteView — e scatta uno
screenshot per stato (scratchpad/audit/a1..a12).

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
