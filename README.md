# ⚓ Maremagnum

[**Italiano**](README.md) · [English](README.en.md)

*L'internet è un mare magnum. Salpa.* (già "Navigare il Web")

**Un browser game piratesco e multiplayer.** L'internet è un mare, ogni sito
un'isola, ogni ricerca una rotta: sei un corsaro che salpa dal Porto Franco,
traccia la rotta verso un dominio, schiva (o affonda) gli altri corsari,
attracca — e il sito si apre. I siti per adulti? Fortezze quasi inespugnabili.

Gira **nel browser**, online per tutti, su Cloudflare. Il gioco è tecnologia web
pura (PixiJS + un'interfaccia DOM accessibile). Le scelte tecnologiche, con le
fonti, sono in [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md); i numeri di gioco
in [`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md).

## Gioca subito

**https://maremagnum.maremagnum.workers.dev** — stesso mare per tutti
(multiplayer vero), sul piano gratuito di Cloudflare. Tracci la rotta verso un
sito reale, navighi, combatti; quando attracchi, il sito si apre in una nuova
scheda del tuo browser. Niente da installare.

**Ancoraggio del profilo**: giochi subito con un nome a caso; da ⚙ Impostazioni
puoi "gettare l'ancora" — un nome a scelta (o una mail: non la verifichiamo) + un
codice **TOTP** dalla tua app di autenticazione. Niente password, niente email di
conferma. Il profilo (monete, nave, conquiste) vive sul server; 30 giorni senza
entrare e il mare se lo riprende.

## Avvio da sorgente

```bash
npm install
npm run build && npm run server
# poi apri http://localhost:3210
```

Il multiplayer è reale: apri più finestre/schede sullo stesso server e vi vedrete
in mare. Il server è il solo arbitro di danni, oro e upgrade. Per il mare
condiviso vero, punta i client su un server raggiungibile
(`GAME_URL=http://host:3210`) — o gioca online sull'istanza Cloudflare qui sopra.

## Comandi

| Tasto | Azione |
|---|---|
| `W A S D` / frecce | Vela e timone (`S` ammaina/frena) |
| `Q` / `E` | Bordata di fiancata **sinistra** / **destra** (indipendenti) |
| `SPAZIO` | Cannoni di **prua e poppa** (se installati) |
| `R` | Abilità del tipo di nave (Bordata Doppia, Fumogeno…) |
| `X` | Cambia munizione: palle, catene o mitraglia |
| `F` | Attracca / salpa (vicino a un'isola, a vele ammainate) |
| `TAB` (tieni premuto) | Registro dei Corsari (classifica) |
| `INVIO` | Vai alla barra della rotta |

I tasti si rimappano dalla **Timoneria** (⚙ Impostazioni): le frecce restano
sempre riservate al timone (WCAG 2.1.4).

## Come si gioca — il cuore

- **Traccia la rotta** scrivendo un dominio (`wikipedia.org`) o una ricerca
  ("ricette col rum" → si fa rotta verso il **Faro dell'Oracolo**). Compare la
  mappa del tesoro con la rotta; la X rossa segna l'isola.
- **Attracca** all'isola per aprire il sito (in una nuova scheda). Un dominio
  diverso è un'isola diversa: ogni navigazione è un nuovo viaggio in mare.
- **Combatti**: cannoni a bordata, munizioni situazionali e barra della vita.
  Fra capitani, chi arriva a zero resta prima **bloccato**: il vincitore incassa
  il 25% dell'oro in gioco e può completare l'arrembaggio col contatto. Chi
  affonda torna al porto per le riparazioni.
- **Al Porto Franco** c'è il **Cantiere**. Si parte con 1 colubrina per lato;
  quantità e posizione degli slot dipendono dal tipo di nave. Ogni arma ha 3
  livelli e, al massimo, si sostituisce col tier superiore. Brigantino e Galeone
  seguono colubrina → cannone → carronata → mortaio; Goletta e Sciabecco saltano
  la carronata. In cima arriva **l'esclusiva del tuo tipo di nave**.
- **Il varo** sceglie il **tipo di nave** — quattro, ognuno con una matrice di
  bocche diversa, un'arma esclusiva in cima alla scala e un'**abilità** (tasto R):
  - **Goletta** — veloce e fragile, punge di prua; esclusiva la Colubrina Lunga.
  - **Sciabecco** — leggero, colpisce a prua *e* a poppa; esclusivo il Falconetto a Ripetizione.
  - **Brigantino da Guerra** — equilibrato, la matrice classica di fiancate.
  - **Galeone** — corazzato, sei bocche per lato ma niente assiali; esclusivo l'Organo.
- **I punti nave** (scafo, vele, timone, ciurma, stiva) si comprano a parte:
  l'oro *a bordo* si perde se ti affondano, i **punti spesi mai**. La Ciurma
  accorcia la ricarica; la Stiva protegge una fetta d'oro dal saccheggio.
- **L'economia del bottino** premia il rischio con misura: chi ti **blocca la
  rotta** e ti affonda si prende il **25%** del tuo oro in gioco; un **arrembaggio**
  vero (contatto) svuota il forziere (**100%**); il **timeout del blocco** ne
  cede il **75%**. Il doppiofondo della Stiva resta.
- **Missioni & Assedi**: ogni giorno arrivano tre imprese condivise, con tris,
  serie giornaliera e premio settimanale. Alla Bacheca del porto si bandiscono
  gli **Assedi** — Corridori che devono attraccare a un'isola bersaglio contro
  Bloccatori che lo impediscono.
- **PvE**: mercantili, Corsari Fantasma, Convogli, Galeoni del Tesoro e Cacciatori
  di Taglie si contendono il mare. Negli abissi vivono Kraken, Drago di Mare e
  Serpente Abissale, ciascuno con attacchi e comportamento propri.
- **Vento, burrasche e notte** cambiano velocità, gittata, visibilità e bottino.
  Le catene tagliano le vele, la mitraglia falcidia la ciurma e una rastrellata
  ben allineata colpisce più forte a poppa.
- **Le Fortezze Proibite** nascono dalla blocklist **OISD NSFW** (~370k domini,
  scaricata e cacheata dal server): il blocco è reale, non si attracca finché le
  difese sono in piedi. Arsenale: 8 Torri Colossali, 2 Bombarde ad area e lo
  **Specchio Ustorio** sul mastio (colpibile solo coi mortai). Chi abbatte TUTTO
  espugna la fortezza — e per lui quel dominio resta sbloccato per sempre.

## La meta-piattaforma

Oltre al mare, il Maremagnum tiene una memoria condivisa e viva di ciò che i
corsari combinano:

- 📖 **Il Diario del Capitano** raccoglie imprese, obiettivi giornalieri e
  cronache personali; la **Gazzetta** conserva gli eventi pubblici del mare.
- ⚔ **Il Mastro di Rotte** prepara PvE giornaliero, campagna PvE settimanale e
  **torneo PvP mensile** su isole reali, con difese temporanee e bottino cosmetico. Workers AI
  scrive bersaglio, struttura e narrazione una volta per periodo; validazione,
  difficoltà e ricompense spendibili restano blindate nel codice. Se l'AI non
  risponde, un fallback deterministico mantiene il gioco disponibile.
- 🤝 **Le Alleanze temporanee** uniscono fino a quattro vele per i dungeon:
  invito diretto o bandiera aperta, bottino diviso fra chi ha combattuto. Durano
  la sessione e il fuoco amico resta attivo.
- 🏴 **Le Fratellanze** — gilde con nome e tag unici, bandiera disegnata
  nell'editor, gerarchia di galloni, riti d'ammissione a porte aperte o chiuse,
  tetto di 24 membri.
- 🎨 **Il Negozio delle Livree & il Registro** — cosmetici (livree dello scafo,
  scie colorate, vessilli). Regola d'oro: **pay-to-show, mai pay-to-win**. Il
  Registro tiene il conto della tua collezione.
- 🗺 **L'Atlante comunitario** — le isole sono **vive**: più un sito viene
  visitato, più la sua isola cresce (a scatti, con un tetto), e le isole sopra
  soglia **rinascono** a ogni risveglio del mare, in posizioni stabili per tutti.
- 🖼 **Il Cartellone** — accostandoti a un'isola ne vedi l'**anteprima Open
  Graph** (titolo, descrizione, immagine del sito), sanificata e cacheata.

## Un mare per tutti (accessibilità)

Conformità **WCAG 2.2 AA** (più gli AAA fattibili), verificata da axe-core su 14
schermate reali (`npm run test:a11y`):

- tasti **rimappabili** dalla Timoneria (frecce sempre riservate);
- interfaccia **navigabile da tastiera**, stato annunciato agli screen reader
  (il canvas è `aria-hidden`, tutto lo stato è duplicato nel DOM accessibile);
- **focus visibile** ovunque, contrasti verificati sui token di palette;
- **Mare calmo** per il movimento ridotto (default da `prefers-reduced-motion`);
- **ancoraggio accessibile** (TOTP con incolla libero, `autocomplete=one-time-code`).

Dettagli e conquiste in [`docs/ACCESSIBILITA.md`](docs/ACCESSIBILITA.md).

## Tecnologia

Il gioco è **web puro** (PixiJS v8 + DOM accessibile), servito online da
**Cloudflare**. Un Worker serve gli asset statici e instrada il WebSocket; lo
stato vive nei **Durable Objects** SQLite-backed. Il `MareDO` ferma simulazione
e timer quando non resta nessun collegamento; un utente inattivo viene congedato
dopo 350 secondi, così una scheda dimenticata non tiene acceso il mare:

- `MareDO` — lo stato del mare in tempo reale (tetto 24 per DO), **ospita lo
  stesso `Game` del server Node**;
- `ContiDO` — i profili Ancoraggio (handle + TOTP, no password, TTL 30 giorni);
- `AtlanteDO` — i contatori d'approdo per dominio (l'Atlante comunitario);
- `GazzettaDO` — l'albo delle notizie; `CampagneDO` — dungeon e campagne del Mastro;
- `GildeDO` — le Fratellanze.

Un **R2** (`DEPOSITO`) fa da cache per blocklist NSFW e immagini dei Cartelloni.
Tre cron generano dungeon giornaliero, campagna settimanale e torneo mensile. Una
guardia applicativa limita Workers AI a 500 neuroni/giorno (5% della quota gratuita). L'infrastruttura
è configurata esclusivamente per il piano gratuito Cloudflare.

**Il server autoritativo** (Node + `ws`, in `server/`) simula a **30 Hz** e manda
snapshot ai client a **15 Hz**, protocollo JSON su WebSocket. Il trucco che tiene
insieme locale e cloud: **il core puro condiviso**. La logica di gioco (mondo,
armi, missioni, atlante, gazzetta, campagna, gilde, blocklist) vive in moduli
`*-core.js` **senza I/O** — la parte sporca (download, cache, rete) è affare
dell'ambiente. Così lo **stesso `Game`** gira identico sotto Node e sotto il
Durable Object: un solo cervello, due gusci.

**I bake 3D** — navi, armi e livree sono modelli **three.js** renderizzati
offscreen e cotti in **atlanti WebP** (`game/assets/`), che PixiJS serve come
sprite. Il 3D si paga una volta, in fase di build, non a ogni frame.

**La Ciurma di Guardia** applica nel vecchio guscio desktop adblock, GPC e
HTTPS-first. Quel guscio Electron (`shell/`) è oggi **deprecato come prodotto**:
resta uno strumento di sviluppo/headless per screenshot e test. Il prodotto
pubblico è il browser game web; la nota storica completa è in
[`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md).

## Struttura

```
game/     client: src/ (PixiJS v8), DOM accessibile, stile, token e asset
server/   autoritativo: game.js (30Hz) + moduli *-core.js puri
cf/        Cloudflare: worker.js + 6 Durable Object + R2, wrangler.jsonc
scripts/  build (gen-tokens, esbuild), bake-* (three.js→WebP), test-*.js, shot.js
shell/    guscio Electron deprecato; resta per strumenti e test headless
docs/     ARCHITETTURA · GAME-DESIGN · ACCESSIBILITA · AUDIT-UX · AUDIT-VISIVO · ROADMAP
```

Un dettaglio del restyle (issue #32): **una fonte di verità unica** per l'estetica.
`game/tokens.json` genera le custom property CSS **e** serve i colori al canvas
PixiJS; `style.css` non ha un solo colore, raggio, spazio, corpo-font o z-index
scritto a mano. Un cambio di palette si fa in un posto solo.

## Stato e rotta futura

**v1 in mare**, giocabile e multiplayer, live su Cloudflare. Verificato da
`npm test` (suite end-to-end su un server dedicato con difese di cartapesta):
battaglia, bottino, respawn, cantiere, scala dei tier, missioni, assedio ed
espugnazione, più Atlante, Gazzetta, campagna del Mastro, Fratellanze e Livree.
`npm run test:a11y` tiene la barra WCAG 2.2 AA.

Rotta futura in [`docs/ROADMAP.md`](docs/ROADMAP.md): più zone di mare, isole
vive, modalità storia e le modalità d'arrembaggio/platform. I Durable Objects
abilitano già il modello a *rooms*; il design system unico verrà riusato dalle
nuove scene quando esisteranno.

## Musiche

Kevin MacLeod (incompetech.com) — Licensed under [Creative Commons: By Attribution 3.0](http://creativecommons.org/licenses/by/3.0/):
"Netherworld Shanty", "Bushwick Tarantella" (navigazione) e "Stoneworld Battle" (battaglia).
Dettagli in `game/assets/musica/LICENZE.md`.
