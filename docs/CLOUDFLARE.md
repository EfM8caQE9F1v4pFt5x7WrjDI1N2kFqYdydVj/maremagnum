# Maremagnum su Cloudflare — come si fa il real-time a costo zero

*Risposta tecnica a "come fate il multiplayer real-time tutto su Cloudflare, gratis?" Aggiornato al 2026-07-12.*

Questo documento descrive **il codice com'è**, non come vorremmo che fosse.
Dove non facciamo la cosa da manuale, lo diciamo e spieghiamo perché ce lo
possiamo permettere. Ogni affermazione è ancorata a un file e una riga veri.

## 1. La forma: un Worker, un mare, sei archivi

```
                         ┌────────────────────────┐
   browser ── HTTP/WS ──▶│  Worker (worker.js)     │──▶ R2 "DEPOSITO"
                         │  routing + cron + AI    │    (blocklist, cache OG)
                         └───────────┬─────────────┘
                                     │ fetch() interni fra DO
              ┌──────────┬──────────┼──────────┬──────────┬──────────┐
              ▼          ▼          ▼          ▼          ▼          ▼
          MareDO      ContiDO   AtlanteDO  GazzettaDO CampagneDO   GildeDO
        (mare, RAM,   (Ancorag- (contatori  (albo      (dungeon    (Fratel-
         30 Hz)        gio,TOTP) d'approdo)  notizie)   Mastro)     lanze)
```

Un Worker (`cf/src/worker.js`) + **6 Durable Object** + **1 bucket R2** +
Workers AI + **2 cron**. Config in `cf/wrangler.jsonc`.

Il mare è **6000×6000** (`server/world.js:10`). Un solo Durable Object per
tutto il mare, ID letterale hard-coded, niente sharding né zone:

```js
// cf/src/worker.js:113
return env.MARE.get(env.MARE.idFromName('mare-1')).fetch(req);
```

Tetto `MAX_CIURMA = 24` (`cf/src/mare-do.js:16`). Al 25° il DO risponde
**prima ancora di aprire il socket**:

```js
// cf/src/mare-do.js:186-188
if (this.equipaggio.size >= MAX_CIURMA) {
  return new Response('Mare pieno: torna con la prossima marea.', { status: 503 });
}
```

Il WebSocket vive su `/mare`, un path che **non è mai un file**: con Workers
Static Assets gli asset hanno la precedenza sul Worker, quindi se `/mare`
corrispondesse a un file reale in `game/` il `fetch()` del Worker non
verrebbe eseguito (`game/src/net.js:32-33`). Tutte le rotte a mano (`/mare`,
`/atlante`, `/og-img/:dominio`, `/riscatto`, `/ammiragliato/*`, `/salute`,
`/ancora/*`) sono scelte apposta come path che non esistono come file — non è
un caso, è un vincolo architetturale. Fallback finale banale:
`return env.ASSETS.fetch(req)` (`worker.js:235`), binding su `../game`
(`wrangler.jsonc:8-11`).

## 2. Il tick dentro il Durable Object

```js
// server/game.js:18-19
const TICK = 1 / 30;          // simulazione a 30Hz
const SNAP_EVERY = 2;         // snapshot ai client a 15Hz
```

Simulazione a **30 Hz**, snapshot ogni due tick quindi a **15 Hz**
(`game.js:1529-1531`, `if (this.tickCount % SNAP_EVERY === 0)
this.sendSnapshot()`). Schedulato con **`setInterval`**, non con l'`alarm()`
dei DO: `this.timer = setInterval(() => this.tick(), TICK*1000)`
(`server/game.js:407-408`). Un secondo interval a 3s manda la classifica
(`sendBoard`). Autosalvataggio profili ogni 60s, interval separato del
`MareDO` (`SALVA_OGNI_MS = 60000`, `cf/src/mare-do.js:17,201`).

`alarm()` **esiste** nel progetto, ma solo in `ContiDO`, per lo sweep
giornaliero degli account scaduti (`cf/src/conti-do.js:27-44`) — non
c'entra col real-time. `alarm()` è pensato per un evento futuro isolato, non
per un ciclo a 30 Hz: `setInterval` dentro un'istanza viva non costa di più.

## 3. Il mare che dorme

Punto più frainteso da fuori: **non usiamo la WebSocket Hibernation API**.
Zero occorrenze di `acceptWebSocket`/`webSocketMessage`/`webSocketClose` in
tutto `cf/src/` — verificato con grep. Usiamo `server.accept()` standard
(`mare-do.js:191`) e i normali `addEventListener` (`:209`, `:264-265`).

Quello che facciamo davvero: quando l'ultimo giocatore stacca, si ferma la
simulazione.

```js
// cf/src/mare-do.js:258-262
if (this.equipaggio.size === 0 && this.game) {
  this.game.pausa(); // il mare si riaddormenta: il piano gratuito ringrazia
  clearInterval(this.saveTimer);
  this.saveTimer = null;
}
```

`pausa()` fa `clearInterval` su timer e board-timer (`server/game.js:397-402`).
Da lì: zero CPU.

**Perché basta senza Hibernation API**: a mare vuoto non ci sono più socket
aperte, quindi l'istanza è già idonea allo sfratto per il normale lifecycle
dei Durable Object. La Hibernation API serve a un caso che qui non si
presenta — tenere socket **aperte** mentre il DO viene scaricato dalla
memoria. Da noi: o ci sono giocatori (il tick a 30 Hz deve girare comunque,
hibernation o no) o non c'è nessuno (le socket sono già tutte chiuse). Il suo
vantaggio non si materializza nel nostro caso d'uso.

**Trade-off onesto**: un giocatore connesso ma inattivo (scheda aperta, mani
ferme) tiene il tick a 30 Hz acceso. Con la Hibernation API quel socket
costerebbe zero. È il prezzo che paghiamo, consapevolmente.

`riprendi()` risincronizza `this.now = Date.now()/1000` prima di far
ripartire l'interval, senza salti di simulazione (`server/game.js:404-409`).
Se invece l'istanza era stata sfrattata per davvero (cold start), `pronto()`
(`mare-do.js:126-177`) ricostruisce tutto da fonti persistenti: blocklist da
R2, Atlante/Gazzetta/Campagne/Gilde via `fetch()` verso gli altri cinque DO.
I **profili dei giocatori non vivono nel MareDO**: vivono in `ContiDO` e
tornano al join col token. Conseguenza: lo stato del mare — navi, colpi,
mostri — è **in RAM e basta**, sopravvive quanto l'istanza. Accettabile
perché il mare è un luogo, non una partita: chi entra trova un mare nuovo, ma
la sua nave, il suo oro e le sue armi arrivano da `ContiDO`.

## 4. Il protocollo: JSON senza vergogna

**JSON su testo. Niente binario, niente MessagePack, niente Protobuf.**
Broadcast serializzato **una volta sola** per tutti i socket
(`mare-do.js:135-138`). Limite d'ingresso hard-coded 2048 caratteri
(`mare-do.js:210`, commento "niente bombe").

**Niente delta compression.** Ogni snapshot contiene TUTTE le navi
(`game.js:2530`) e TUTTE le fortificazioni con difese (`:2586-2593`). Nessun
confronto col tick precedente. **Niente interest management** sullo stato di
gioco: il broadcast va identico a tutti, a prescindere dalla distanza.
L'unica selettività riguarda le *isole* della mappa, non le navi — sotto
soglia di approdi vanno solo a chi le ha tracciate (verificato dal test
`scripts/test-protocol.js:359-360`).

Quello che facciamo *invece* della delta compression è **sparse encoding +
arrotondamento**: posizioni a 1 decimale (`r1(n)=round(n*10)/10`, tempi/angoli
a 2 decimali con `r2`, `game.js:2630-2631`); armi codificate in stringa
compatta tipo `"n2r1"` invece che oggetti (`encW`, `:2633-2637`); campi
opzionali emessi solo se lo stato è attivo, con spread condizionale
(`:2549-2582`: blocco, debuff munizioni, abilità, resa, gilda, livree); nomi
di campo di 1-2 caratteri. Uno snapshot di navi tranquille è molto più magro
di uno di battaglia.

Input **edge-triggered**: il client manda `{t:'input',...}` solo quando
cambia, non ogni frame (`game/src/main.js:1090-1093`). I proiettili non
viaggiano tick-per-tick: il server manda una volta l'evento `{t:'shots'}` con
posizione, velocità e ttl (`spawnShot`, `game.js:1047-1066`); il client anima
la balistica da solo, ma le collisioni le risolve **solo** il server
(`moveShots` `:2047-2109`, `explode` `:2111-2131`) — il client non calcola mai
un danno.

Non esiste nel repo alcuna misurazione della dimensione dei pacchetti: nessun
KB/pacchetto da citare. Lo snapshot scala linearmente con le entità, e il
tetto di 24 è ciò che lo tiene in piedi. Vincolo dichiarato in
`docs/ROADMAP.md:102`: "Protocollo e snapshot SOLO additivi (i client vecchi
ignorano, mai rompono)".

## 5. Il client che non indovina

**Niente client-side prediction, niente reconciliation.** Nemmeno per la
propria nave. Solo **interpolazione**, 120ms nel passato:

```js
// game/src/main.js:18
const INTERP_DELAY = 120; // ms nel passato: si naviga fra due snapshot certi
```

`interpolatedShips()` (`main.js:1412-1459`) fa `lerp` su x/y/vel e `anglerp`
su rot fra due snapshot di un buffer degli ultimi 10 (`:819`). Clock sync
minimo: nessun ping/pong, nessuna stima RTT — solo un offset one-way con
media mobile esponenziale, `state.offset = state.offset*0.9 +
arrivedOffset*0.1` (`:814`).

**Conto onesto della latenza percepita**: RTT input→server, più l'attesa del
prossimo tick (≤33ms), più l'attesa del prossimo snapshot (≤66ms), più i
120ms fissi di `INTERP_DELAY`, prima che il proprio movimento appaia sullo
schermo.

**Perché ce lo possiamo permettere**: il combattimento navale è lento di suo.
Le navi hanno inerzia, virano piano, i cannoni hanno cooldown. Non è un FPS.
La prediction serve dove 100ms sul proprio movimento sono intollerabili; qui
una nave che risponde al timone con un attimo di ritardo è **realismo**, non
un bug. Il costo di prediction + reconciliation — simulazione duplicata,
rollback, snap-back visibili — non varrebbe il guadagno.

L'unico update ottimistico è cosmetico: il cambio munizione nell'HUD, e il
commento nel codice lo dichiara — "l'ack del server fa fede"
(`main.js:1096-1105`). Nota a margine, non estetica: il canvas PixiJS è
`aria-hidden="true"` (`game/src/render.js:43`) e tutto lo stato di gioco vive
duplicato in un DOM accessibile parallelo (`game/src/ui.js`) — vincolo WCAG
2.2 AA.

## 6. Chi tiene il libro mastro

Il client manda **intenti**, mai valori: nessun messaggio può impostare
`gold`. Ogni mutazione è server-side, `sendGold()` unico canale di notifica
(`game.js:1482`). Il profilo salvato — che transita da `ContiDO` — è
ri-validato integralmente a ogni join, trattato come input ostile: `ship.gold
= Math.min(1e7, Math.max(0, (p.gold|0) || START_GOLD))` (`game.js:476`),
livelli clampati a `MAX_SHIP_LVL=4` (`:477`), armi sanificate con riscatto
(`:483-487`), esclusive validate contro il catalogo reale (`:490-495`).
L'identità (`uid`, gilda) non arriva mai dal client: viene dal token HMAC
verificato (`cf/src/sessione.js:22-26`), e il `MareDO` la sovrascrive
comunque (`mare-do.js:240`).

**Limiti noti**: niente lag compensation/rewind server-side — le collisioni
si risolvono sulle posizioni correnti del tick, chi ha ping alto spara "nel
passato". Niente backpressure sui socket in uscita (nessun controllo di
`bufferedAmount`), nessun rate limiter sui messaggi di gameplay oltre ai
cooldown verificati server-side in `fire()` (`game.js:1006-1021`). Scelte
consapevoli: a 24 giocatori su combattimento lento non ripagano.

## 7. Lo stato che sopravvive: i sei Durable Object

Tutti singleton globali per dominio di stato (`idFromName` con nome fisso):

| DO | Cosa tiene | Note |
|---|---|---|
| **MareDO** | Il mare in RAM (`this.game`, `equipaggio: Map ws→{ship,uid}`) | Non persiste righe proprie; orchestra gli altri 5 via `fetch()` |
| **ContiDO** | `conto:<uid>`, `bozza:<uid>` | Unico DO con `alarm()` (sweep giornaliero) |
| **AtlanteDO** | `isola:<dominio>` | Cap 500 righe (`atlante-do.js:58`), filtro ≥3 approdi (`:56`) |
| **GazzettaDO** | `voce:<timestampPadded>:<salt>` | Potatura a `CAP=100` a ogni scrittura (`gazzetta-do.js:7,30-37`) |
| **CampagneDO** | `dungeon:<tipo>:corrente` + `:<periodo>` | Puntatore mutabile + storico immutabile |
| **GildeDO** | Le Fratellanze | Bandiere come dati, niente immagini: niente R2 |

**SQLite — sfata il mito.** `wrangler.jsonc` dichiara tutte le classi come
`new_sqlite_classes` (migrazioni v1-v5), ma **zero occorrenze** di
`storage.sql`, `sql.exec`, `CREATE TABLE`, `transaction()` in tutto `cf/src/`
— verificato con grep. Tutti e sei i DO usano solo l'API
documento/chiave-valore (`get/put/list({prefix})/delete/getAlarm/setAlarm`),
chiavi gerarchiche a prefisso. Il commento in `wrangler.jsonc:2-3` lo dice:
"Durable Objects SQLite-backed (obbligatori sul free)". "SQLite-backed" qui
significa il motore di persistenza imposto da Cloudflare sul free tier, non
una scelta di design per query relazionali.

**Transazioni: nessuna esplicita, e non servono.** Ogni DO è single-threaded
per definizione — una sola esecuzione alla volta su quell'istanza. La mutua
esclusione la dà il modello di esecuzione del Durable Object, non il
database. È il motivo per cui il DO è la primitiva giusta per un game
server: il lock è gratis, viene dalla piattaforma.

## 8. R2: due cache e un lasciapassare

Il commento dice "solo per la cache della blocklist", ma sono due cose:

1. **Blocklist NSFW**: chiave `oisd-nsfw-abp.txt`, TTL 7 giorni
   (`LIST_MAX_AGE_MS`, `mare-do.js:15`). Se il fetch fallisce si usa la copia
   scaduta — "meglio vecchia che niente" (`:48`). Accettata solo se >1000
   domini parsati (`blocklist-core.js:29`), altrimenti scartata: difesa
   contro payload troncati. Fallback hard-coded di 10 domini se tutto fallisce.
2. **Cartelloni Open Graph**: due namespace. `og-ok/<dominio>` è il
   lasciapassare — l'URL approvato, scritto dal `Game` solo quando una nave
   si è avvicinata davvero a quell'isola (`mare-do.js:162-163`).
   `og-img/<dominio>` è il binario dell'immagine (`worker.js:155`). **Il
   proxy non è aperto**: senza lasciapassare, 404 (`worker.js:143`). Limite
   3 MiB (`:154`), content-type deve iniziare per `image/` (`:152`), cache 7
   giorni (`:132-140`). User-Agent dichiarato perché "Wikimedia e altri
   rifiutano client anonimi" (`:145,149`).

Nessuna lifecycle rule R2: invalidazione applicativa, confrontando
`Date.now()` col metadato `uploaded` dell'oggetto.

## 9. Il Mastro di Rotte: l'AI fa il costumista, non il contabile

Due cron (`wrangler.jsonc:34`): `"0 5 * * *"` (dungeon del giorno, 05:00 UTC)
e `"0 6 * * 1"` (campagna della settimana, lunedì 06:00 UTC), discriminati
confrontando la stringa cron esatta (`worker.js:241`) — il lunedì scattano
entrambi. `generaDungeon` (`worker.js:24-103`): (1) calcola il periodo; (2)
chiede all'`AtlanteDO` le isole reali sopra soglia; (3) costruisce il paniere
— isole comunitarie ∪ 8 `BERSAGLI_NOTI` hard-coded (wikipedia.org,
archive.org, openstreetmap.org, gutenberg.org, wiktionary.org, nasa.gov,
openlibrary.org, wikimedia.org — `campagna-core.js:88-89`), mai vuoto; (4)
genera il dungeon **procedurale e deterministico** con seed
`mulberry32(hashStr('mastro-'+tipo+'-'+periodo))` — la rete di sicurezza; (5)
solo se `env.AI` esiste, chiede all'AI di "vestirlo"; (6) pubblica su
`CampagneDO`; (7) annuncia sulla Gazzetta. Modello:
`@cf/qwen/qwen3-30b-a3b-fp8` (`worker.js:21`), max_tokens 2600; Qwen3 emette
un blocco `<think>...</think>` rimosso con regex prima del parse (`:70`).

**Come si blinda l'oro** — il cuore del paragrafo. La garanzia non è nel
prompt (un prompt è una richiesta, non un contratto). È in
`applicaVestito(base, vestito, candidati)` (`campagna-core.js:157-192`),
funzione **pura e testabile**, che tratta ogni campo dell'AI come ostile:

```js
// server/campagna-core.js:35,166-167
const LISTINO = { facile: 400, medio: 700, tosto: 1000 };
// ...
d.difficolta = difficoltaValida(v.difficolta); // clamp a un enum di 3 valori
d.premio = premioPer(d.difficolta);            // legge dal listino, MAI da v.premio
```

Il codice **non accede mai** a `v.premio`. L'AI sceglie l'aggettivo; il
prezzo dell'aggettivo lo decide il codice. Il **bersaglio** è accettato solo
se è esattamente uno dei domini reali passati in input
(`candidati.includes(v.bersaglio)`, `:169`); un dominio inventato viene
scartato e resta quello procedurale. Le **difese** sono clampate per fascia —
torri 3-10, bombarde/corazzate/serventi 0-3, specchio forzato a booleano
(`difeseValide`, `:48-62`). Il **testo libero** (nome, lore, tappe, versioni
EN) è l'unico vero spazio dell'AI, comunque troncato (nome 60 caratteri, lore
200, lore di tappa 120). **Fail-safe totale**: se l'AI manca, la fetch
fallisce, il JSON non parsa o il risultato non è un oggetto, il try fallisce
in silenzio ed esce comunque il dungeon procedurale. Il gioco non dipende mai
dall'AI per funzionare.

Formula: **l'AI fa il costumista, non il contabile.**

Il budget "~10k neuron/dì" (`docs/ROADMAP.md:42`) è una stima di
pianificazione, esplicitamente "da confermare" — non è nel codice, nessun
contatore di neuroni esiste nel repo.

## 10. Un core, due gusci

La logica di gioco è scritta **una volta** e gira in **due runtime**. Non è
duplicazione: è lo stesso file su disco. `server/game.js` e i `server/*-
core.js` sono **CommonJS** (`module.exports`; `package.json:25` dichiara
`"type": "commonjs"`). Node li carica con `require()`
(`server/index.js:10`); il Worker li importa con `import` ESM
(`cf/src/mare-do.js:5`). Il ponte lo fa **esbuild dentro Wrangler**, che sa
fare interop statico CJS→ESM: da un `module.exports` object literal
sintetizza sia il default export sia i named export — per questo
`mare-do.js` può fare `import { Game }` (named) e insieme `import blocklist
from ...` (default, usato come namespace).

I core sono **logica pura senza I/O** — niente `fs`, `https`, `fetch`
(dichiarato in `server/blocklist-core.js:3-4`). La parte sporca è iniettata
dall'host via callback — `this.broadcast`, `onGilde`, `onGazzetta`,
`onCartellone`, `onApprodo` — assegnate dal `MareDO` (`mare-do.js:143-173`) e
assenti/no-op in Node. Stessa tabella su due colonne: la blocklist, Node la
scarica su disco (`server/blocklist.js:21-46`), il Worker su R2
(`mare-do.js:32-52`); il cartellone OG, Node lo cachea in una `Map` di
processo (`server/index.js:40-60`), il Worker su R2 (`worker.js:124-162`).

**Perché conta**: `npm test` esercita **23 suite** (`package.json:13`) contro
lo stesso `Game` in produzione. Deterministico: i test istanziano `new
Game(() => {})`, chiamano subito `game.pausa()` per spegnere i timer reali, e
avanzano il tempo a mano chiamando `game.tick()` — millisecondi, in-process,
senza Wrangler, senza rete. C'è anche un test end-to-end vero
(`scripts/test-protocol.js`) che spawna `server/index.js` e apre WebSocket
reali. Curiosità cross-runtime: `scripts/test-cf.js` calcola il TOTP in Node
puro (`crypto.createHmac('sha1', ...)`, riga 31) contro il Worker che lo
calcola con WebCrypto (`crypto.subtle`, `cf/src/totp.js:44`) — stesso
algoritmo, due runtime, stesso codice a 6 cifre atteso: test di parità.

## 11. L'Ancoraggio e la navigazione reale, in breve

Nessuna password: handle + **TOTP** (RFC 6238) con WebCrypto (`totp.js`:
HMAC-SHA1, finestra 30s, tolleranza ±1 step). Sessione: formato a 2 parti
`body.sig` con HMAC-SHA256 (`sessione.js:22-26`), TTL **90 giorni**
(`conti-do.js:10`). Anti-bruteforce: 5 errori TOTP → **15 minuti** di
blocco, HTTP 429 (`conti-do.js:47-54,90`). Account cancellato dopo **30
giorni** di inattività dallo sweep `alarm()` giornaliero (`conti-do.js:9,
34-36`) — non confondere i due TTL: 30gg è l'inattività dell'account, 90gg è
la sessione.

Nessun iframe, **nessun proxy di contenuto**: attraccare apre una vera nuova
scheda verso il dominio reale (`game/index.html:137`,
`target="_blank" rel="noreferrer noopener"`; `game/src/ui.js:1050-1052`).
L'unica cosa che transita dal Worker è l'immagine OG del cartellone; l'HTML
del sito bersaglio è letto solo lato server per i meta OG, e buttato dopo il
parsing. Vale la divisione del lavoro di §10: il **fetch**, con timeout di
6.5s, vive nell'host (`server/game.js:154`, `AbortSignal.timeout(6500)`); il
**parsing** è logica pura in `server/og-core.js`, che infatti non conosce la
rete. Il parsing sanifica: scarta schemi non-http(s), decodifica entità,
tronca a 90/180 caratteri — testato contro `<script>` e `javascript:`
(`scripts/test-og.js:37-41`).

## 12. Quello che non abbiamo fatto (e perché)

- **Un solo mare** (`mare-1`), tetto 24. Rooms multi-zona abilitate
  dall'architettura ma **non implementate**.
- **Niente delta compression, niente interest management**: lo snapshot
  scala linearmente con le entità. Regge perché il tetto è 24.
- **Niente prediction, niente lag compensation** server-side.
- **Niente backpressure** sui socket in uscita.
- Un giocatore idle connesso tiene il tick a 30 Hz acceso (niente
  Hibernation API, vedi §3).
- Lo stato del mare è in RAM: uno sfratto del DO azzera navi e colpi in
  corso, ma non oro/nave/armi, che stanno in `ContiDO`.
- I limiti numerici del free tier (CPU per request, memoria per DO) non sono
  citati da nessuna parte nel codice: il design è guidato dal vincolo "zero
  costo", non da cifre misurate.

## In sintesi: i numeri veri

| Cosa | Valore | Fonte |
|---|---|---|
| Dimensione del mare | 6000×6000 | `server/world.js:10` |
| Tetto giocatori per mare | 24 | `cf/src/mare-do.js:16` |
| Tick di simulazione | 30 Hz | `server/game.js:18` |
| Snapshot ai client | 15 Hz (ogni 2 tick) | `server/game.js:19,1531` |
| Classifica (board) | ogni 3s | `server/game.js:408` |
| Autosalvataggio profili | ogni 60s | `cf/src/mare-do.js:17` |
| Limite messaggio in ingresso | 2048 caratteri | `cf/src/mare-do.js:210` |
| Precisione posizioni in snapshot | 1 decimale | `server/game.js:2630` |
| Interpolazione client | 120ms nel passato | `game/src/main.js:18` |
| Buffer snapshot client | 10 | `game/src/main.js:819` |
| Cache blocklist NSFW (R2) | 7 giorni | `cf/src/mare-do.js:15` |
| Soglia validità blocklist | >1000 domini | `server/blocklist-core.js:29` |
| Cache immagini OG (R2) | 7 giorni | `cf/src/worker.js:137` |
| Limite immagine OG | 3 MiB | `cf/src/worker.js:154` |
| Isole in Atlante pubblico | cap 500, soglia ≥3 approdi | `cf/src/atlante-do.js:56,58` |
| Voci in Gazzetta | cap 100 | `cf/src/gazzetta-do.js:7` |
| Listino premio dungeon | 400/700/1000 dobloni | `server/campagna-core.js:35` |
| Cron dungeon del giorno | 05:00 UTC | `cf/wrangler.jsonc:34` |
| Cron campagna della settimana | lunedì 06:00 UTC | `cf/wrangler.jsonc:34` |
| Modello AI | `@cf/qwen/qwen3-30b-a3b-fp8` | `cf/src/worker.js:21` |
| TTL inattività account | 30 giorni | `cf/src/conti-do.js:9` |
| TTL token di sessione | 90 giorni | `cf/src/conti-do.js:10` |
| Blocco anti-bruteforce TOTP | 5 errori → 15 minuti | `cf/src/conti-do.js:47-54` |
| Suite di test | 23 | `package.json:13` |
