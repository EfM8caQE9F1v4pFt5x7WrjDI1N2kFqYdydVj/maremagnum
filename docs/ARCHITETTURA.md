# Maremagnum (già "Navigare il Web") — Scelte tecnologiche

*Analisi del 2026-07-04, basata su una ricognizione a 6 fronti: docs ufficiali dei framework,
docs ufficiali Chromium, blog ingegneristici dei browser alternativi, forum (dissenso incluso),
stack di gioco/multiplayer, prior art.*

> **Aggiornamento 2026-07-09 — com'è finita davvero.** Questa pagina resta il
> *registro dell'analisi del 2026-07-04* (serve a ricordare **perché** certe opzioni
> furono scartate). Ma ciò che è stato **costruito e messo in mare** ha preso una rotta
> diversa su due punti, ed è quella che vale oggi:
> - **Runtime: Cloudflare, solo piano gratuito** — non Electron come deploy primario.
>   Un Worker (`cf/src/worker.js`) serve il client web e smista i WebSocket; lo stato
>   multiplayer vive in **Durable Objects SQLite-backed** (`MareDO`, `ContiDO`,
>   `AtlanteDO`, `GazzettaDO`, `CampagneDO`, `GildeDO`), R2 per la cache della blocklist,
>   cron + Workers AI per il solo lore. Fonte: `cf/wrangler.jsonc`. Il paletto *"il mare
>   dorme quando è vuoto"* **è** l'hibernation dei Durable Objects → costo zero.
> - **Colyseus: valutato, mai adottato.** Il suo posto l'hanno preso i Durable Objects
>   (Colyseus avrebbe richiesto un server sempre acceso, fuori dal piano gratuito).
> - **PixiJS: confermato.** Il client gira nel browser, servito come asset statici dal Worker.
> - **Electron (`shell/`) resta come guscio della «fase 2»** (desktop, browser vero con
>   intercettazione della navigazione). La v1 in mare è la **versione web**, dove i siti
>   si aprono in una scheda nuova invece di essere catturati dal guscio.
>
> Il trucco che regge tutto: la logica di gioco è scritta **una volta** (`server/*-core.js`,
> `server/game.js`) e gira in **due gusci** — Node + `ws` in locale per il dev, Worker + DO
> in produzione (`cf/src/mare-do.js` importa lo **stesso** `Game`). Da qui in giù è l'analisi
> originale, lasciata intatta come memoria delle alternative.

## Il requisito

Un **vero browser**: barra URL reale, i siti renderizzati dal motore (niente iframe), e ogni
navigazione intercettata per trasformarla in un viaggio per mare multiplayer. Il gioco (mare,
vascelli, cannoni, fortezze) deve vivere *sopra e attorno* al contenuto web.

## Le opzioni valutate

### 1. Fork completo di Chromium (modello Brave)
- Checkout 100+ GB, build di ore, 8–16+ GB di RAM ([docs build Chromium](https://chromium.googlesource.com/chromium/src/+/main/docs/linux/build_instructions.md)).
- Chrome passa a **release stabili ogni 2 settimane da settembre 2026** → il "patch treadmill"
  raddoppia; esiste un canale Extended Stable a 8 settimane per gli embedder
  ([annuncio ufficiale](https://developer.chrome.com/blog/chrome-two-week-release)).
- Vivaldi: 67 dipendenti, ~900 file modificati, ~2 settimane di integrazione per ogni release
  Chromium ([blog Vivaldi](https://vivaldi.com/blog/vivaldi-code-integration/)). Brave in pratica
  esce 7–14 giorni dopo Chrome stable nonostante team dedicati.
- Manutentori singoli esistono (Thorium, Supermium) ma dichiarano rebase da 8+ ore e build da
  ~5 ore a piattaforma ([FAQ Thorium](https://github.com/Alex313031/thorium/blob/main/docs/FAQ.md)).

**Verdetto**: la potenza massima, ma la manutenzione è un lavoro a tempo pieno *prima ancora di
scrivere il gioco*. Da riconsiderare quando/se il progetto avrà un team.

### 2. CEF (Chromium Embedded Framework)
- Provato in produzione ovunque: Spotify, Steam, Epic, Battle.net; 100M+ installazioni
  ([repo CEF](https://github.com/chromiumembedded/cef)). Distribuzioni binarie: non serve
  compilare Chromium.
- API C++ first; binding per altri linguaggi solo community.
- Il rendering off-screen (per fondere pagine dentro una scena di gioco) **non ha compositing
  accelerato GPU** — limite documentato ([usage ufficiale](https://chromiumembedded.github.io/cef/general_usage.html)).
- È il consiglio ricorrente della community per "un browser vero" quando Electron non basta.

**Verdetto**: il piano B serio. C++ rallenta molto l'iterazione sul gioco; ha senso come
approdo di maturità, non come punto di partenza.

### 3. Electron
- Ha esattamente il modello di composizione che ci serve: `BaseWindow` + più `WebContentsView`
  sovrapponibili con controllo dello z-order → *view del sito sotto, view del gioco sopra*
  ([docs WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)).
- `will-navigate` è **annullabile** e `webRequest` intercetta tutto → ogni navigazione può
  diventare un viaggio ([docs webContents](https://www.electronjs.org/docs/latest/api/web-contents)).
- Segue Chromium a ~1 versione major di distanza; MIT.
- **Il punto debole, da non nascondere**: i docs stessi avvertono che "mostrare contenuto
  arbitrario da fonti non fidate è un rischio grave che Electron non è pensato per gestire"
  ([security docs](https://www.electronjs.org/docs/latest/tutorial/security)). Le mitigazioni
  oggi sono molto migliori di quando Beaker lo criticava (sandbox Chromium di default da
  Electron 20, context isolation da 12, niente Node nel renderer), e browser Electron sono stati
  spediti anche da sviluppatori solitari (Min, Polypane, Sizzy). Ma un browser Electron non sarà
  mai hardened quanto Chrome stesso: per una v1 da early adopter è un rischio consapevole e
  mitigabile; per il mercato di massa serve la fase 2.

**Verdetto**: il miglior rapporto potenza/velocità per arrivare a qualcosa di giocabile.

### 4. Tauri v2 — SCARTATO
Motori diversi per piattaforma (WebView2/WKWebView/WebKitGTK), e sia i docs sia la community
lo dichiarano inadatto a contenuto non fidato; per un browser vero la stessa community
rimanda a CEF ([discussione ufficiale](https://github.com/tauri-apps/tauri/discussions/4219)).

### 5. Qt WebEngine — SCARTATO
Valido ma C++/Qt, LGPL, e patch di sicurezza cherry-picked sul ciclo di release di Qt, non di
Chrome. Non batte né CEF né Electron per il nostro caso.

### 6. Estensione Chrome (Manifest V3) — SCARTATO come veicolo principale
MV3 non può bloccare davvero la navigazione (`webNavigation` è solo osservazionale; si può solo
redirigere a una pagina interstiziale) e il service worker muore dopo 30s di inattività
([docs webNavigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation)).
Utilizzabile in futuro come canale companion/marketing (Dedalium, RPG a estensione, fa ~4.000
giocatori attivi così).

## Prior art (nessuno ha fatto la nostra versione)

- **PMOG / The Nethernet** (2008–2009): MMO a estensione Firefox sopra la navigazione (mine,
  portali, casse sugli URL). Morto per monetizzazione e complessità concettuale, **non per
  limiti tecnici**. Lezione dal post-mortem del fondatore: serve "compulsion" di gioco chiara —
  la nostra risposta è combattimento navale + economia, non meccaniche passive
  ([post-mortem](https://links.net/vita/gamelayers/)).
- **Dedalium** (2023–oggi): RPG a estensione browser, battaglie mentre navighi. Dimostra che la
  domanda esiste.
- **Vivaldi** dimostra il trucco architetturale chiave: la UI di un browser può essere
  interamente HTML/JS che gira nel browser stesso. Per noi: *il gioco È la UI del browser*.

## Raccomandazione: strategia a due fasi con guscio sostituibile

**Il principio de-rischiante: tutto il gioco e tutta la UI in tecnologia web.** Così il guscio
(Electron oggi, CEF o fork domani) diventa un dettaglio sostituibile, e il 90% del lavoro
sopravvive a qualunque migrazione. È il modello Vivaldi senza pagarne il costo dal giorno uno.

### Fase 1 — Electron (piano originale; oggi rimandato — la v1 è la versione web su Cloudflare)
```
┌────────────────────────── BaseWindow ──────────────────────────┐
│ WebContentsView GIOCO (privilegiata, PixiJS, sempre sopra)     │
│   mare · vascelli · mappa · HUD · barra della rotta            │
│ ────────────────────────────────────────────────────────────── │
│ WebContentsView SITO (sandbox, zero privilegi, zero Node,      │
│   context isolation) — visibile solo dopo l'attracco           │
└────────────────────────────────────────────────────────────────┘
        will-navigate/webRequest → ogni navigazione = un viaggio
```
- Un click su un link nel sito → `will-navigate` la annulla → si torna in mare, rotta verso la
  nuova isola. Il browser-gioco è totale, non un interstiziale.
- La view del sito non ha alcun privilegio: un sito compromesso non tocca né il gioco né
  l'economia (che comunque è autoritativa lato server).

### Fase 2 — se decolla
Migrazione del guscio a CEF o fork leggero stile Vivaldi (motivi: hardening da mercato di massa,
distribuzione, feature da browser "vero" tipo sync/estensioni). Il gioco si porta quasi intatto.

## Stack di gioco (stato verificato a giugno–luglio 2026)

| Componente | Scelta | Perché |
|---|---|---|
| Rendering 2D | **PixiJS v8** (v8.19, MIT, TS) | WebGL production-ready, 100k sprite a ~15ms; è solo rendering: la simulazione resta nostra e speculare al server. Alternativa: Phaser 4 (uscito apr 2026, framework completo) — più "incluso" ma più opinionato e più giovane. |
| Server multiplayer | **Cloudflare Workers + Durable Objects** (SQLite-backed, piano gratuito) — *dev locale: Node + `ws`, protocollo JSON* | **Rotta effettiva** (vedi banner in testa). Lo stato del mare vive in un Durable Object (`MareDO`) che ospita lo **stesso** `Game` del core; l'hibernation = il mare dorme quando è vuoto → costo zero, niente server sempre acceso. Il naval combat è lento di suo → WebSocket basta, niente WebRTC. **Colyseus v0.17 (MIT, feb 2026) valutato ma NON adottato**: rooms/delta-compression eleganti, ma richiede un processo persistente fuori dal piano gratuito; i DO danno rooms-per-zona equivalenti a costo zero. (geckos.io scartato a monte: WebRTC + il meno mantenuto del lotto.) |
| Tecniche di rete | Server autoritativo + client prediction + entity interpolation | Canone Gambetta/Valve. Anti-cheat: il server decide danni, oro, upgrade. |
| Fortezze anti-porno | Blocklist di domini adulti lato server | In prototipo una lista hardcoded; poi una lista mantenuta (es. blocklist DNS pubbliche). |

## Rischi aperti

1. **Sicurezza Electron vs Chrome**: rischio **rimandato** — la v1 web su Cloudflare non
   spedisce il guscio Electron, quindi i siti restano nel browser dell'utente (sandbox del
   browser stesso). Torna in scena solo con la fase 2 (guscio desktop): mitigazioni previste
   sandbox, context isolation, view sito senza privilegi.
2. **Siti che rompono la fiction**: navigazione interna a un sito (stesso dominio) non deve
   scatenare viaggi — regola: nuovo viaggio solo al cambio di dominio (configurabile).
3. **Lezione PMOG**: il gioco deve essere divertente *anche da solo* (PNG mercantili, fortezze),
   non solo col multiplayer pieno.
