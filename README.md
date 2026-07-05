# ⚓ Maremagnum

*L'internet è un mare magnum. Salpa.* (già "Navigare il Web")

**Un vero browser che è anche un gioco multiplayer.** Sei un pirata nel Mare
dell'Internet: ogni sito è un'isola, ogni navigazione è un viaggio. Salpi dal
Porto Franco, tracci la rotta, schivi (o affondi) gli altri corsari, attracchi —
e il sito si apre. I siti per adulti? Fortezze quasi inespugnabili.

Le scelte tecnologiche e le loro motivazioni (con fonti) sono in
[`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md). In breve: guscio **Electron**
(vista sito sandbox sotto, vista gioco sopra, ogni navigazione intercettata),
gioco in **PixiJS v8**, server autoritativo **Node + ws**. Tutto il gioco è
tecnologia web: il guscio è sostituibile (CEF / fork Chromium in Fase 2).

## Gioca subito (senza scaricare nulla)

**https://maremagnum.maremagnum.workers.dev** — il Maremagnum online: stesso mare
per tutti (multiplayer vero), gira su Cloudflare Workers + Durable Objects nei
limiti del piano gratuito. In questa versione web i siti si aprono in una nuova
scheda; per il "vero browser" (siti dentro il gioco + Ciurma di Guardia) scarica
l'app qui sotto.

**Ancoraggio del profilo**: giochi subito con un nome a caso; da ⚙ Impostazioni
puoi "gettare l'ancora" — nome a scelta (o mail: non la verifichiamo) + codice
TOTP dalla tua app di autenticazione. Niente password, niente email di conferma.
Il profilo (monete, nave, conquiste) vive sul server; 30 giorni senza entrare e
il mare se lo riprende.

## Scarica e gioca (release)

Dalla [pagina delle release](../../releases) scarica il pacchetto per il tuo sistema:

| Sistema | File | Avvio |
|---|---|---|
| Linux (tutte le distro, x64) | `Maremagnum-v*-linux-x64.tar.gz` | estrai ed esegui `./Maremagnum` |
| macOS Apple Silicon | `Maremagnum-v*-macos-arm64.zip` | estrai; al primo avvio: tasto destro → Apri (app non firmata), oppure `xattr -cr Maremagnum.app` |
| Windows x64 | `Maremagnum-v*-windows-x64.zip` | estrai ed esegui `Maremagnum.exe` (portable, niente installer) |

L'app avvia da sola il proprio server di gioco in locale. Il multiplayer vero
si ha puntando più client sullo stesso server (`npm run server` su una macchina
raggiungibile, poi `GAME_URL=http://host:3210` per i client).

## Avvio da sorgente

```bash
npm install
npm run dev        # bundle → server di gioco → guscio Electron
```

Sviluppo senza Electron (il gioco in un normale browser, siti in nuova scheda):

```bash
npm run build && npm run server
# poi apri http://localhost:3210
```

Il multiplayer è reale: apri più finestre/istanze sullo stesso server e vi
vedrete in mare. Il server è il solo arbitro di danni, oro e upgrade.

## Comandi

| Tasto | Azione |
|---|---|
| `W A S D` / frecce | Vela e timone (`S` ammaina/frena) |
| `Q` / `E` | Bordata di fiancata **sinistra** / **destra** (indipendenti) |
| `SPAZIO` | Cannoni di **prua e poppa** (se installati) |
| `F` | Attracca / salpa (vicino a un'isola, a vele ammainate) |
| `TAB` (tieni premuto) | Registro dei Corsari (classifica) |
| `INVIO` | Vai alla barra della rotta |
| `F12` (nel guscio) | DevTools del gioco |

## Come si gioca

- **Traccia la rotta** scrivendo un dominio (`wikipedia.org`) o una ricerca
  ("ricette col rum" → si fa rotta verso il **Faro dell'Oracolo**). Compare la
  mappa del tesoro con la rotta; la X rossa segna l'isola.
- **Attracca** all'isola per aprire il sito. Nel guscio Electron il sito si apre
  *dentro il browser-gioco*, con barra d'attracco (indietro/avanti/ricarica).
  Un link verso un **altro dominio** ti rimette in mare: nuovo viaggio.
- **Combatti**: cannoni a bordata, barra della vita, chi affonda torna al porto
  per le riparazioni e perde parte dell'oro a favore del vincitore (+taglia).
- **Al Porto Franco** c'è il cantiere: si parte con 1 colubrina per lato e si
  arriva a 5 slot per fiancata + 2 a prua + 2 a poppa; ogni arma ha 3 livelli e,
  al massimo, si sostituisce col tier superiore (colubrina → cannone → carronata
  → mortaio ad area → **l'esclusiva del tuo tipo di nave**). Col **varo** si
  sceglie il tipo: Goletta veloce e fragile, Brigantino da Guerra equilibrato o
  Galeone corazzato — ognuno con la sua arma esclusiva e una linea di punti a
  metà prezzo. A parte, i **punti nave**: scafo, vele, timone, ciurma e stiva —
  l'oro a bordo si perde se ti affondano, i punti spesi mai. Numeri in
  [`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md).
- **Missioni**: una missione personale sempre attiva (esplorazione/caccia); alla
  Bacheca del porto si bandiscono gli **Assedi**: Corridori che devono attraccare
  a un'isola bersaglio contro Bloccatori che lo impediscono.
- **I mercantili PNG** vagano per il mare: oro facile, se non ti dispiace la fedina.
- **Un mare per tutti**: conformità **WCAG 2.2 AA** (più i AAA fattibili) —
  tasti rimappabili dalla Timoneria, interfaccia navigabile da tastiera, stato
  annunciato agli screen reader, contrasti verificati, Mare calmo per il
  movimento ridotto. Dettagli e verifiche in
  [`docs/ACCESSIBILITA.md`](docs/ACCESSIBILITA.md) (`npm run test:a11y`).
- **Le Fortezze Proibite** nascono dalla blocklist **oisd NSFW** (~370k domini,
  scaricata e cacheata dal server): il blocco è reale, non si attracca finché le
  difese sono in piedi. Arsenale: 8 Torri Colossali, 2 Bombarde ad area e lo
  Specchio Ustorio sul mastio (colpibile solo coi mortai). Chi abbatte TUTTO
  espugna la fortezza: 1500 crediti e blocco disattivato per sempre (per lui).
- **PvE**: i **Corsari Fantasma** pattugliano il mare e cacciano i giocatori.
- Anche gli altri giocatori possono **bloccarti la rotta**: piazzarsi davanti a
  un'isola e affondare chiunque provi ad attraccare è una strategia legittima. 🏴‍☠️

## Struttura

```
shell/    guscio Electron: BaseWindow + 2 WebContentsView, intercettazione navigazioni
game/     client: PixiJS v8, HUD DOM, mappa del tesoro, minimappa, audio procedurale
server/   autoritativo: mondo/isole deterministiche, simulazione 30Hz, snapshot 15Hz
scripts/  dev.js: bundle + server + electron
docs/     ARCHITETTURA.md: analisi tecnologica con fonti
```

## Stato e rotta futura

Prototipo giocabile (Fase 1). Verificato con `npm test` (server dedicato con
difese di cartapesta): 29 asserzioni end-to-end su battaglia, bottino, respawn,
cantiere, scala dei tier, missioni, assedio ed espugnazione della fortezza.
Prossime tappe sensate: ciurme/alleanze e scorte, persistenza server-side dei
profili (oggi: localStorage, fidarsi è da ingenui), zone/rooms con Colyseus,
hardening del guscio (Fase 2: CEF o fork stile Vivaldi).

## Musiche

Kevin MacLeod (incompetech.com) — Licensed under [Creative Commons: By Attribution 3.0](http://creativecommons.org/licenses/by/3.0/):
"Netherworld Shanty", "Bushwick Tarantella" (navigazione) e "Stoneworld Battle" (battaglia).
Dettagli in `game/assets/musica/LICENZE.md`.
