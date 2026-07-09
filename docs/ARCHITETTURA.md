# Maremagnum — Architettura

*Come è fatto, e perché. Aggiornato al 2026-07-09.*

Maremagnum è un **browser game**: gira nel browser, online per tutti, servito da
Cloudflare. L'internet è il mare, ogni dominio un'isola, e il gioco (vascelli,
cannoni, fortezze, economia) vive *attorno* alla navigazione — ma il gioco **è**
tecnologia web, non un guscio desktop.

## Il principio de-rischiante: tutto in tecnologia web

Il gioco e tutta la UI sono web (PixiJS + DOM accessibile). Questo rende il
*dove-gira-il-server* un dettaglio sostituibile e tiene il 90% del lavoro al
riparo da qualunque cambio d'infrastruttura. È il modello Vivaldi (la UI di un
browser è HTML/JS che gira nel browser stesso) applicato a un gioco: **il gioco
è la UI**.

## Lo stack

| Componente | Scelta | Perché |
|---|---|---|
| Rendering 2D | **PixiJS v8** (MIT) | WebGL production-ready, 100k sprite a ~15ms; è *solo* rendering — la simulazione resta nostra e speculare al server. |
| Server multiplayer | **Cloudflare Workers + Durable Objects** (SQLite-backed, piano gratuito). Dev locale: **Node + `ws`**. | Lo stato del mare vive in un Durable Object (`MareDO`) che ospita lo **stesso** `Game` del core; l'*hibernation* dei DO = «il mare dorme quando è vuoto» → **costo zero**, niente server sempre acceso. |
| Tecniche di rete | Server **autoritativo** (30 Hz sim, 15 Hz snapshot) + client prediction/interpolation | Canone Gambetta/Valve. Il server decide danni, oro e upgrade: l'economia non si baro. |
| Persistenza | Durable Objects (uno per dominio di stato) + **R2** per due sole cache | Vedi sotto. |
| Fortezze anti-porno | Blocklist di domini adulti (OISD NSFW) lato server | Il blocco è reale: non si attracca finché le difese della fortezza sono in piedi. |

### Perché Cloudflare (e non Colyseus)

**Colyseus v0.17** (MIT) è stato valutato: rooms e delta-compression eleganti, ma
richiede un **processo persistente** fuori dal piano gratuito. I Durable Objects
danno rooms-per-zona equivalenti a **costo zero** grazie all'hibernation. Il naval
combat è lento di suo → WebSocket basta, niente WebRTC (geckos.io scartato a
monte: WebRTC + il meno mantenuto del lotto).

I sei Durable Objects, ognuno un dominio di stato (`cf/wrangler.jsonc`):

- **`MareDO`** — lo stato del mare in tempo reale (tetto 24 giocatori per DO);
- **`ContiDO`** — i profili «Ancoraggio» (handle + TOTP, no password, TTL 30 giorni);
- **`AtlanteDO`** — i contatori d'approdo per dominio (l'Atlante comunitario);
- **`GazzettaDO`** — l'albo delle notizie; **`CampagneDO`** — la campagna del Mastro;
- **`GildeDO`** — le Fratellanze.

**R2** (`DEPOSITO`) fa da cache per due sole cose: la blocklist NSFW scaricata e
le immagini Open Graph dei Cartelloni. Una **cron settimanale** (lunedì) rigenera
la campagna del Mastro di Rotte — con Workers AI a scrivere **solo la lore**, mai
i numeri di gioco (deterministici e blindati nel codice).

## Il trucco che regge tutto: un core, due gusci

La logica di gioco è scritta **una volta sola** e gira in **due host diversi**:

- i moduli `server/*-core.js` (mondo, armi, missioni, atlante, gazzetta, campagna,
  gilde, blocklist) sono **logica pura, senza I/O** — la parte sporca (download,
  cache, rete) è affare dell'ambiente che li importa;
- `server/game.js` monta questo core sotto **Node + `ws`** (dev locale);
- `cf/src/mare-do.js` monta lo **stesso** `Game` dentro il Durable Object (produzione).

Un solo cervello, due gusci. Cambiare infrastruttura non tocca le regole del gioco.

## Il client

- `game/src/` — 22 moduli, bundlati da esbuild. `render.js` (la scena PixiJS,
  canvas `aria-hidden`), `ui.js` (tutto il DOM accessibile), `net.js` (WebSocket
  JSON), più i sottosistemi (mappa, minimappa, acqua, ciclo giorno, bandiere,
  audio, i18n, palette).
- Il **restyle a token unica** (issue #32): `game/tokens.json` è la sola fonte di
  verità dell'estetica — genera le custom property CSS **e** serve i colori interi
  al canvas. `style.css` non ha un colore, raggio, spazio, corpo-font o z-index a
  mano.
- **I bake 3D**: navi, armi e livree sono modelli **three.js** renderizzati
  offscreen e cotti in atlanti **WebP** (`game/assets/`), che PixiJS serve come
  sprite. Il 3D si paga una volta, in build.

## Prior art (nessuno ha fatto la nostra versione)

- **PMOG / The Nethernet** (2008–09): MMO a estensione Firefox sopra la
  navigazione. Morto per monetizzazione e complessità, **non per limiti tecnici**.
  Lezione: serve una *compulsion* di gioco chiara — la nostra è combattimento
  navale + economia, non meccaniche passive
  ([post-mortem](https://links.net/vita/gamelayers/)).
- **Dedalium** (2023–oggi): RPG a estensione browser, battaglie mentre navighi.
  Dimostra che la domanda esiste.
- **Vivaldi**: la UI di un browser può essere interamente HTML/JS. Per noi: il
  gioco *è* la UI.

## Rischi aperti

1. **Lezione PMOG**: il gioco dev'essere divertente *anche da solo* (PNG
   mercantili, Corsari Fantasma, fortezze), non solo col multiplayer pieno.
2. **Isole dal dominio, non dalla pagina**: la navigazione interna a un sito
   (stesso dominio) non deve scatenare viaggi — nuovo viaggio solo al cambio di
   dominio.
3. **Scala**: oggi un DO per mare (tetto 24). I Durable Objects già abilitano il
   modello a *rooms* per più zone di mare quando servirà.

---

### Nota storica

Un tempo Maremagnum era progettato come un **guscio-browser desktop** (un vero
browser che apriva i siti *dentro* il gioco, catturando la navigazione). Si
valutarono a fondo i motori — fork di Chromium, CEF, Electron, Tauri, Qt WebEngine,
estensione Chrome. Quella rotta è stata **abbandonata**: Maremagnum è e resta un
browser game. Il codice del guscio (`shell/`, Electron) sopravvive solo come
strumento headless di build/test (bake 3D, verifica a11y), non come prodotto.
L'analisi originale dei motori vive nella storia git, se un giorno servisse.
