# ⚓ Maremagnum

[Italiano](README.md) · [**English**](README.en.md)

*The internet is a mare magnum. Set sail.* (formerly “Navigare il Web”)

**A pirate multiplayer browser game.** The internet is an ocean, every website
is an island, and every search is a course. You are a corsair sailing from the
Free Port: plot a course to a real domain, fight or evade the other ships, dock,
and the website opens. Adult websites become heavily defended fortresses.

Maremagnum runs directly **in the browser**, online for everyone on Cloudflare.
It is pure web technology: PixiJS for the sea and an accessible DOM interface.
The technology decisions and game numbers live in
[`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md) and
[`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md).

## Play now

**https://maremagnum.maremagnum.workers.dev** — one shared, real multiplayer
sea on Cloudflare's free plan. Enter a website or a search, sail, fight and dock;
the destination opens in a new browser tab. Nothing to install.

You can play immediately under a generated name. To keep a server-authoritative
profile, drop anchor from Settings with a handle and a TOTP code from your
authenticator app. There are no passwords or verification emails. Anchored
profiles expire after 30 days without a login.

## Run from source

```bash
npm install
npm run build && npm run server
# then open http://localhost:3210
```

Open multiple tabs against the same server to see real multiplayer locally. The
server is the sole authority for damage, gold and upgrades.

## Controls

| Key | Action |
|---|---|
| `W A S D` / arrows | Sails and helm (`S` slows/backs) |
| `Q` / `E` | Independent left/right broadsides |
| `SPACE` | Bow and stern guns, when fitted |
| `R` | Ship-type ability |
| `X` | Cycle round shot, chain shot and grapeshot |
| `F` | Dock / undock near an island with sails down |
| hold `TAB` | Corsair Register (leaderboard) |
| `ENTER` | Focus the course bar |

Every gameplay key can be remapped at the Helm in Settings. Arrow keys remain
reserved for steering, in accordance with WCAG 2.1.4.

## The core game

- **Plot a course** by entering a domain (`wikipedia.org`) or a search. Searches
  lead to the Oracle Lighthouse; domains become islands. A treasure map shows
  the destination before you sail.
- **Dock** to open the real website. Each registrable domain is one shared
  island, regardless of subdomain or deep URL.
- **Fight** with independent batteries and situational ammunition. Between
  captains, a ship at zero health is first **blocked**: the winner immediately
  takes 25% of the gold at risk and can complete boarding by making contact.
- **Build your ship** at the Free Port shipyard. Buy hull, sails, helm, crew and
  hold upgrades; add gun slots and level each weapon. Spent ship points are
  permanent even when cargo gold is lost.
- **Choose one of four hull identities**:
  - **Schooner** — fast and fragile, strong bow battery; Long Culverin exclusive.
  - **Xebec** — agile, armed fore and aft; Repeating Falconet exclusive.
  - **War Brigantine** — balanced, with the classic battery matrix.
  - **Galleon** — armoured, six guns per side and no axial mounts; Organ Gun exclusive.
- War Brigantines and Galleons follow culverin → cannon → carronade → mortar.
  Schooners and Xebecs deliberately skip the carronade. The type-exclusive gun
  sits at the top of each progression.
- **Daily missions and Sieges**: three shared daily deeds feed a treble, streak
  and full-week reward. At the port, Runners can challenge Blockers in an
  island-landing Siege.
- **PvE** includes merchants, Ghost Corsairs, convoys, Treasure Galleons and
  Bounty Hunters. A Sea Dragon, Kraken and Abyssal Serpent hunt with distinct
  attacks and behaviours.
- **Wind, squalls and night** affect speed, range, visibility and loot. Chain
  shot cuts sails, grapeshot scythes crew, and a stern rake deals extra damage.
- **Forbidden Fortresses** come from the OISD NSFW blocklist. Eight towers, two
  bombards and a Burning Mirror physically prevent docking until destroyed.
  Conquest permanently unlocks that domain for the winning profile.

## The shared metagame

- 📖 **The Captain's Journal** combines deeds, daily objectives and personal
  history; the **Corsair Gazette** records public events across the sea.
- ⚔ **The Pathmaster** creates a three-stage weekly campaign and a daily dungeon
  on a real island with temporary defences. Workers AI writes the target,
  structure and story once per period; code validates the target and bounds all
  spendable rewards. A deterministic fallback keeps the game running if AI is
  unavailable.
- 🤝 **Temporary Alliances** join up to four sails for a dungeon. Invite a
  captain or hoist an open flag; contributors split the loot. Alliances last
  for the session, and friendly fire remains enabled.
- 🏴 **Brotherhoods** are persistent guilds with unique name and tag, a custom
  flag, ranks, open or closed admission and a 24-member cap.
- 🎨 **Liveries and the Register** provide hull paints, dyed sails, wakes and
  personal ensigns. The design rule is “pay to show, never pay to win”.
- 🗺 **The community Atlas** remembers visits. Popular islands grow and are
  seeded back into the sea at stable positions whenever it wakes.
- 🖼 **Island billboards** show a sanitised, cached Open Graph preview of the
  real website when a ship approaches.

## One sea for everyone

The interface targets **WCAG 2.2 AA**, plus applicable AAA criteria, and is
tested with axe-core across real UI states (`npm run test:a11y`):

- fully remappable keyboard controls;
- keyboard-navigable panels with visible focus and focus trapping;
- a DOM description of game state for screen readers while the canvas remains
  `aria-hidden`;
- palette-token contrast checks;
- **Calm Sea** mode and `prefers-reduced-motion` support;
- accessible TOTP anchoring with paste and `autocomplete=one-time-code`.

See [`docs/ACCESSIBILITA.md`](docs/ACCESSIBILITA.md) for the detailed audit.

## Architecture

A Cloudflare Worker serves static assets and routes WebSockets. State lives in
SQLite-backed **Durable Objects**:

- `MareDO` — the real-time sea, capped at 24 players per instance;
- `ContiDO` — anchored profiles and TOTP authentication;
- `AtlanteDO` — per-domain visit counters;
- `GazzettaDO` — public news;
- `CampagneDO` — daily dungeons and weekly campaigns;
- `GildeDO` — Brotherhoods.

`MareDO` stops simulation and save timers as soon as the last connection leaves.
A player with no human activity for 350 seconds is disconnected, preventing a
forgotten tab from keeping the sea alive. R2 caches the NSFW blocklist and
approved billboard images. Two cron triggers generate the daily and weekly
Pathmaster content. The deployment is designed for Cloudflare's free plan.

The authoritative Node server simulates at **30 Hz** and sends snapshots at
**15 Hz** over JSON WebSockets. The same pure `Game` core runs locally under
Node and in `MareDO`; environment-specific modules handle network, storage and
other I/O.

Ships, weapons and liveries are Three.js models baked offscreen into WebP sprite
atlases. The 3D cost is paid at build time, not every frame.

The old Electron desktop browser shell in `shell/` is **deprecated as a product**.
It remains a development/headless tool for screenshots and accessibility tests.
Its Guard Crew implements ad blocking, Global Privacy Control and HTTPS-first;
the public product is now the web browser game. The historical rationale is in
[`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md).

## Repository

```text
game/     PixiJS client, accessible DOM, styles, design tokens and assets
server/   authoritative 30 Hz game and pure shared core modules
cf/       Worker, six Durable Objects, R2 and Wrangler configuration
scripts/  builds, Three.js→WebP bakes, tests and screenshot tooling
shell/    deprecated Electron shell retained for headless tools
docs/     architecture, game design, accessibility, UX audit and roadmap
```

The visual system has one source of truth: `game/tokens.json` generates CSS
custom properties and provides canvas colours. Atkinson Hyperlegible Next is
self-hosted for reading text; Pirata One is reserved for display titles.

## Verification and roadmap

`npm test` runs unit and end-to-end protocol tests against a dedicated server.
`npm run test:a11y` checks WCAG states, while `npm run build` regenerates tokens
and bundles the browser client.

The current v1 is live and multiplayer. The future route is tracked in
[`docs/ROADMAP.md`](docs/ROADMAP.md): more seas, living islands, story mode,
and boarding/platform modes that will reuse the same PixiJS design system.

## Music

Kevin MacLeod (incompetech.com), licensed under
[Creative Commons Attribution 3.0](http://creativecommons.org/licenses/by/3.0/):
“Netherworld Shanty”, “Bushwick Tarantella” and “Stoneworld Battle”. Details are
in `game/assets/musica/LICENZE.md`.
