'use strict';

const { WORLD, PORT, FORT, parseCourse, Archipelago, publicIsland } = require('./world');
const W = require('./weapons');
const { Missions } = require('./missions');
const atlante = require('./atlante-core');

const TICK = 1 / 30;          // simulazione a 30Hz
const SNAP_EVERY = 2;         // snapshot ai client a 15Hz
const START_GOLD = 200;
const RESPAWN_S = 6;
const DISCOVERY_GOLD = 25;
const MAX_SHIP_LVL = 4;       // ogni linea del Cantiere: scafo, vele, timone, ciurma, stiva
const PVE_BOUNTY = { merc: 25, ghost: 60 }; // taglie magre e fisse per tipologia
// L'economia del blocco (issue #15, arrembaggio v1): vita a zero per mano di
// un capitano = nave BLOCCATA, non affondata. Il doppiofondo della Stiva è
// SEMPRE protetto; il resto è "il forziere in gioco": 25% subito al vincitore,
// il tocco prende il resto, il timeout libera col 75% e l'immunità.
const BLOCCO = { durata: 18, immunita: 30, quotaSubito: 0.25, hpRitorno: 0.5, tocco: 46 };
// Approdi preferiti (issue #13): i segnalibri del corsaro
const PREFERITI_MAX = 8;
const DOMINIO_OK = /^[a-z0-9][a-z0-9.-]{2,99}$/i;
const WEAK_FORTS = !!(typeof process !== 'undefined' ? process.env.WEAK_FORTS : undefined); // knob per i test: difese di cartapesta

const GROUP_DIR = { left: -Math.PI / 2, right: Math.PI / 2, bow: 0, stern: Math.PI };

// Le linee di punti nave in vendita al Cantiere: stat pubblica → campo della nave.
const SHIP_LINES = { hull: 'hullLvl', sails: 'sailsLvl', helm: 'helmLvl', crew: 'crewLvl', hold: 'holdLvl' };

// I tipi di nave: identità di build scelta col "varo" al Cantiere.
// Moltiplicatori piccoli (mai oltre ±20%: nessuno scontro va perso in
// partenza), uno sconto di linea, un'arma esclusiva a coronare la scala.
// Il tipo "equilibrato" non ha bonus alle stat: la lezione dei brigantini
// che dominano è già stata scritta da altri mari.
const TIPI = {
  goletta: {
    nome: 'Goletta', hpMul: 0.85, speedMul: 1.12, turnMul: 1,
    sconto: 'helmLvl', motto: 'Veloce e fragile: pungi da lontano, vivi per raccontarlo',
  },
  guerra: {
    nome: 'Brigantino da Guerra', hpMul: 1, speedMul: 1, turnMul: 1,
    sconto: 'crewLvl', motto: 'Equilibrato: bordate fitte e nervi saldi',
  },
  galeone: {
    nome: 'Galeone', hpMul: 1.2, speedMul: 1, turnMul: 0.88,
    sconto: 'hullLvl', motto: 'Lento e corazzato: un castello che naviga',
  },
};
const TIPO_SNAP = { goletta: 1, guerra: 2, galeone: 3 };

// Le abilità attive: una per tipo, tasto R, cooldown lungo rispetto al
// ritmo del duello (TTK ~10-30s). Il fumogeno acceca solo le IA (fantasmi
// e fortezze): i capitani veri possono sempre sparare alla cieca nel fumo.
const ABILITA = {
  goletta: { nome: 'Speronamento', cd: 30, durata: 2.2, dmg: 42, autodanno: 10, spinta: 1.9 },
  guerra: { nome: 'Fumogeno', cd: 40, durata: 10, raggio: 150 },
  galeone: { nome: 'Bordata Doppia', cd: 40, durata: 4 },
};
// catalogo pubblico del varo (statico): quello che il Cantiere espone
const TIPI_PUB = Object.fromEntries(Object.entries(TIPI).map(([k, t]) => [k, {
  nome: t.nome, motto: t.motto, sconto: t.sconto,
  hpMul: t.hpMul, speedMul: t.speedMul, turnMul: t.turnMul,
  esclusiva: W.TYPES[W.EXCLUSIVES[k]].name,
  abilita: ABILITA[k].nome,
}]));

const NPCS = { merc: 3, ghost: 2 };

// L'oro a bordo si perde, i punti nave no: il Cantiere è la banca del corsaro.
function shipStats(ship) {
  const t = TIPI[ship.tipo];
  return {
    maxHp: Math.round((100 + ship.hullLvl * 40) * (t ? t.hpMul : 1)),
    speed: (135 + ship.sailsLvl * 20) * (t ? t.speedMul : 1),
    turnRate: 2.3 * (1 + 0.08 * ship.helmLvl) * (t ? t.turnMul : 1), // timone: virate più strette
    reloadMul: 1 - 0.07 * ship.crewLvl,         // ciurma: ricarica −7% a punto (−28% al tetto)
  };
}

function shipLvlCost(lvl) { return lvl >= MAX_SHIP_LVL ? null : 90 * 2 ** lvl; }

// Prezzo di un gradino per QUESTA nave: il tipo dimezza la sua linea di sconto.
function lineCost(ship, field) {
  const c = shipLvlCost(ship[field]);
  const t = TIPI[ship.tipo];
  return c !== null && t && t.sconto === field ? Math.round(c / 2) : c;
}

function varoCost(ship) { return 90 * 2 ** ship.vari; } // ogni cambio di rotta costa il doppio

class Game {
  constructor(broadcast) {
    this.broadcast = broadcast;
    this.archipelago = new Archipelago();
    this.semina();
    this.missions = new Missions(this);
    this.ships = new Map();
    this.shots = new Map();
    this.smokes = [];
    this.nextId = 1;
    this.nextShotId = 1;
    this.now = Date.now() / 1000;
    this.tickCount = 0;
    this.fxQueue = [];
    for (let i = 0; i < NPCS.merc; i++) this.spawnNpc('merc');
    for (let i = 0; i < NPCS.ghost; i++) this.spawnNpc('ghost');
    this.timer = null;
    this.boardTimer = null;
    this.riprendi();
  }

  stop() { clearInterval(this.timer); clearInterval(this.boardTimer); }

  // Al risveglio il mare si ricorda delle sue isole: le mete condivise
  // dell'Atlante (≥3 approdi) rinascono senza aspettare una nuova rotta,
  // con un tetto per non affollare la mappa prima dell'espansione del mondo.
  semina(cap = 150) {
    for (const dominio of atlante.sopraSoglia().slice(0, cap)) {
      const { island, isNew } = this.archipelago.ensure(dominio);
      if (isNew) this.broadcastIsland(island);
    }
  }

  // --- navi ---

  spawnPoint() {
    const a = Math.random() * Math.PI * 2;
    const d = this.archipelago.get('porto').r + 90 + Math.random() * 90;
    return { x: PORT.x + Math.cos(a) * d, y: PORT.y + Math.sin(a) * d };
  }

  makeShip(id, name, npc) {
    const p = this.spawnPoint();
    return {
      id, name, npc: npc || false, conn: null,
      x: p.x, y: p.y, rot: Math.random() * Math.PI * 2, vel: 0,
      input: { up: false, down: false, left: false, right: false },
      gold: START_GOLD, hullLvl: 0, sailsLvl: 0, helmLvl: 0, crewLvl: 0, holdLvl: 0,
      tipo: null, vari: 0,
      mounts: W.defaultMounts(), ready: { left: [0], right: [0], bow: [], stern: [] },
      hp: 100, kills: 0, deaths: 0,
      docked: null, sunkUntil: 0, lastHitBy: null, lastDamageAt: 0,
      blockedUntil: 0, blockedBy: null, bloccoSalvo: 0, immuneUntil: 0,
      abilityAt: 0, ramUntil: 0, doubleUntil: 0,
      visited: new Set(), conquered: new Set(), preferiti: new Set(),
      mission: null, wp: null, fleeUntil: 0,
    };
  }

  // Il mare dorme quando non c'è nessuno: nei Durable Objects il tempo attivo
  // si paga, e un'onda che nessuno guarda non ha bisogno di esistere.
  pausa() {
    clearInterval(this.timer);
    clearInterval(this.boardTimer);
    this.timer = null;
    this.boardTimer = null;
  }

  riprendi() {
    if (this.timer) return;
    this.now = Date.now() / 1000; // niente salti di simulazione al risveglio
    this.timer = setInterval(() => this.tick(), TICK * 1000);
    this.boardTimer = setInterval(() => this.sendBoard(), 3000);
  }

  spawnNpc(kind) {
    const id = 'n' + this.nextId++;
    const ship = this.makeShip(id, kind === 'merc' ? 'Mercantile' : 'Corsaro Fantasma', kind);
    ship.x = 400 + Math.random() * (WORLD.W - 800);
    ship.y = 400 + Math.random() * (WORLD.H - 800);
    if (kind === 'merc') {
      ship.hp = 70; ship.mounts = { left: [], right: [], bow: [], stern: [] };
      ship.ready = { left: [], right: [], bow: [], stern: [] };
    } else {
      ship.hp = 160; ship.sailsLvl = 0;
      ship.mounts = {
        left: [{ type: 'cannone', lvl: 2 }, { type: 'cannone', lvl: 2 }],
        right: [{ type: 'cannone', lvl: 2 }, { type: 'cannone', lvl: 2 }],
        bow: [], stern: [],
      };
      this.syncReady(ship);
    }
    this.ships.set(id, ship);
    return ship;
  }

  npcMaxHp(ship) { return ship.npc === 'merc' ? 70 : 160; }

  syncReady(ship) {
    for (const g of Object.keys(W.GROUPS)) {
      const n = ship.mounts[g].length;
      const cur = ship.ready[g] || [];
      ship.ready[g] = Array.from({ length: n }, (_, i) => cur[i] || 0);
    }
  }

  join(conn, msg) {
    const id = 'p' + this.nextId++;
    const name = String(msg.name || '').trim().slice(0, 18) || 'Corsaro Anonimo';
    const ship = this.makeShip(id, name, false);
    ship.conn = conn;
    ship.graceUntil = this.now + 5; // tregua d'arrivo: i Fantasmi non toccano i nuovi
    const p = msg.profile || {};
    ship.gold = Math.min(1e7, Math.max(0, (p.gold | 0) || START_GOLD));
    for (const f of Object.values(SHIP_LINES)) ship[f] = Math.min(MAX_SHIP_LVL, Math.max(0, p[f] | 0));
    ship.tipo = TIPI[p.tipo] ? p.tipo : null;
    ship.vari = Math.min(30, Math.max(0, p.vari | 0));
    // grandfathering: chi comprò l'Organo quando era di tutti è Galeone
    // d'ufficio, gratis — nessuno perde un'arma che ha pagato
    if (!ship.tipo && hasOrgano(p.mounts)) ship.tipo = 'galeone';
    ship.mounts = W.sanitizeMounts(p.mounts, ship.tipo);
    ship.kills = Math.min(1e6, Math.max(0, p.kills | 0));
    ship.deaths = Math.min(1e6, Math.max(0, p.deaths | 0));
    if (Array.isArray(p.conquered)) {
      for (const d of p.conquered.slice(0, 500)) if (typeof d === 'string') ship.conquered.add(d.slice(0, 100));
    }
    // approdi preferiti (issue #13): lista sanificata, con tetto
    ship.preferiti = new Set();
    if (Array.isArray(p.preferiti)) {
      for (const d of p.preferiti.slice(0, PREFERITI_MAX)) {
        if (typeof d === 'string' && DOMINIO_OK.test(d)) ship.preferiti.add(d.toLowerCase().slice(0, 100));
      }
    }
    this.syncReady(ship);
    ship.hp = shipStats(ship).maxHp;
    // la scelta del punto di partenza (issue #13, campo ADDITIVO nel join):
    // isola esistente o seminata al volo, mai una fortezza non conquistata
    if (typeof msg.spawn === 'string' && DOMINIO_OK.test(msg.spawn)) {
      const dominio = msg.spawn.toLowerCase();
      const { island } = this.archipelago.ensure(dominio);
      if (!island.fortress || ship.conquered.has(dominio)) {
        const a = Math.random() * Math.PI * 2;
        ship.x = island.x + Math.cos(a) * (island.r + 100);
        ship.y = island.y + Math.sin(a) * (island.r + 100);
        ship.rot = a;
      }
    }
    this.ships.set(id, ship);
    this.sendTo(ship, {
      t: 'welcome', id, world: WORLD, port: PORT,
      islands: this.archipelago.list().map(publicIsland),
      you: this.youFor(ship),
      arsenal: W.publicConfig(),
    });
    // il primo minuto ha UN obiettivo (issue #22): al profilo vergine la
    // missione arriva col primo attracco, non al secondo zero
    if (p.gold == null) ship.senzaMissione = true;
    else this.missions.assign(ship);
    this.missions.broadcastState();
    this.broadcast({ t: 'feed', msg: `⚓ ${name} è salpato nel Mare dell'Internet` });
    return ship;
  }

  youFor(ship) {
    return {
      gold: ship.gold, hullLvl: ship.hullLvl, sailsLvl: ship.sailsLvl,
      helmLvl: ship.helmLvl, crewLvl: ship.crewLvl, holdLvl: ship.holdLvl,
      tipo: ship.tipo, vari: ship.vari,
      mounts: ship.mounts, conquered: [...ship.conquered],
      preferiti: [...ship.preferiti],
      kills: ship.kills, deaths: ship.deaths,
    };
  }

  leave(ship) {
    // scappare staccando la spina non paga: chi resta vince (issue #15)
    if (ship.blockedUntil > this.now) this.abborda(ship);
    this.missions.leave(ship);
    this.ships.delete(ship.id);
    this.broadcast({ t: 'feed', msg: `${ship.name} è tornato sulla terraferma` });
  }

  sendTo(ship, obj) {
    if (ship.conn && ship.conn.readyState === 1) {
      try { ship.conn.send(JSON.stringify(obj)); } catch { /* connessione morente */ }
    }
  }

  broadcastIsland(island) {
    this.broadcast({ t: 'island', island: publicIsland(island) });
  }

  // --- messaggi dai client ---

  handle(ship, msg) {
    switch (msg.t) {
      case 'input':
        for (const k of ['up', 'down', 'left', 'right']) ship.input[k] = !!msg[k];
        break;
      case 'fire': this.fire(ship, msg.group); break;
      case 'course': this.setCourse(ship, msg.q); break;
      case 'dock': this.dock(ship); break;
      case 'preferisci': this.preferisci(ship, msg); break;
      case 'undock': this.undock(ship); break;
      case 'shop': if (ship.docked === 'porto') this.sendShop(ship); break;
      case 'buyShip': this.buyShip(ship, msg.stat); break;
      case 'varo': this.varo(ship, msg.tipo); break;
      case 'abilita': this.abilita(ship); break;
      case 'buySlot': this.buySlot(ship, msg.group); break;
      case 'upgradeWeapon': this.upgradeWeapon(ship, msg.group, msg.slot); break;
      case 'replaceWeapon': this.replaceWeapon(ship, msg.group, msg.slot); break;
      case 'assedio': this.missions.assedioJoin(ship, msg.role); break;
    }
  }

  setCourse(ship, q) {
    const parsed = parseCourse(q);
    if (!parsed) { this.sendTo(ship, { t: 'course', ok: false, error: 'Rotta illeggibile, corsaro.' }); return; }
    let island, isNew = false;
    if (parsed.search) {
      island = this.archipelago.get('oracolo');
    } else {
      const r = this.archipelago.ensure(parsed.domain);
      island = r.island; isNew = r.isNew;
      if (isNew) this.broadcastIsland(island);
    }
    this.sendTo(ship, { t: 'course', ok: true, island: publicIsland(island), url: parsed.url, isNew });
  }

  // --- fuoco ---

  fire(ship, group) {
    if (!GROUP_DIR.hasOwnProperty(group)) return;
    if (ship.docked || this.isSunk(ship) || ship.npc === 'merc') return;
    if (ship.blockedUntil > this.now) return; // bloccata: cannoni muti
    if (!ship.npc) ship.graceUntil = 0; // chi apre il fuoco rinuncia alla tregua
    const mounts = ship.mounts[group];
    if (!mounts.length) return;
    const reloadMul = shipStats(ship).reloadMul;
    const raddoppio = ship.doubleUntil > this.now ? 2 : 1; // Bordata Doppia
    const out = [];
    for (let i = 0; i < mounts.length; i++) {
      if (this.now < ship.ready[group][i]) continue;
      const w = mounts[i];
      const st = W.weaponStats(w);
      ship.ready[group][i] = this.now + st.reload * reloadMul;
      const dir = ship.rot + GROUP_DIR[group];
      // posizione della bocca da fuoco lungo lo scafo
      let along = 0, side = 0;
      if (group === 'left' || group === 'right') {
        along = mounts.length === 1 ? 0 : (i / (mounts.length - 1) - 0.5) * 34;
        side = 14;
      } else if (group === 'bow') { along = 24; side = (i - 0.5) * 8; }
      else { along = -22; side = (i - 0.5) * 8; }
      const px = ship.x + Math.cos(ship.rot) * along + Math.cos(dir) * side;
      const py = ship.y + Math.sin(ship.rot) * along + Math.sin(dir) * side;
      const balle = st.burst * raddoppio;
      for (let b = 0; b < balle; b++) {
        const jitter = (Math.random() - 0.5) * (balle > 1 ? 0.16 : 0.09);
        out.push(this.spawnShot(ship.id, px, py, dir + jitter, st));
      }
    }
    if (out.length) this.broadcast({ t: 'shots', from: ship.id, shots: out });
  }

  spawnShot(owner, x, y, dir, st) {
    const id = this.nextShotId++;
    const shot = {
      id, owner, x, y,
      vx: Math.cos(dir) * st.speed, vy: Math.sin(dir) * st.speed,
      ttl: st.range / st.speed, damage: st.dmg, aoe: st.aoe || 0, arc: !!st.arc,
    };
    this.shots.set(id, shot);
    return { id, x: r1(x), y: r1(y), vx: r1(shot.vx), vy: r1(shot.vy), ttl: r2(shot.ttl), arc: shot.arc ? 1 : 0, aoe: shot.aoe };
  }

  // --- attracco / porto ---

  fortressBlocks(ship, island) {
    if (!island.fortress) return false;
    if (ship.conquered.has(island.id)) return false;
    if (island.fallenUntil > this.now) return false;
    return island.defs.some(d => !d.dead);
  }

  dock(ship) {
    if (ship.docked || this.isSunk(ship) || ship.npc) return;
    if (ship.blockedUntil > this.now) return; // bloccata: niente fughe in banchina
    if (ship.vel > 45) { this.sendTo(ship, { t: 'toast', msg: 'Troppo veloce per attraccare: ammaina le vele!' }); return; }
    let best = null, bestD = Infinity;
    for (const i of this.archipelago.list()) {
      const d = Math.hypot(i.x - ship.x, i.y - ship.y);
      if (d < i.r + 90 && d < bestD) { best = i; bestD = d; }
    }
    if (!best) { this.sendTo(ship, { t: 'toast', msg: 'Nessun approdo in vista.' }); return; }
    if (this.fortressBlocks(ship, best)) {
      this.sendTo(ship, { t: 'toast', msg: '🏰 La Fortezza sbarra l\'approdo: abbatti TUTTE le sue difese!' });
      return;
    }
    ship.docked = best.id; ship.vel = 0;
    const firstVisit = best.id !== 'porto' && !ship.visited.has(best.id);
    if (best.id === 'porto') {
      ship.hp = shipStats(ship).maxHp; // riparazione completa al porto
      this.sendTo(ship, { t: 'docked', island: publicIsland(best) });
      this.sendShop(ship);
    } else {
      if (firstVisit) {
        ship.visited.add(best.id);
        ship.gold += DISCOVERY_GOLD;
        this.sendGold(ship, DISCOVERY_GOLD, 'Terra scoperta!');
      }
      this.sendTo(ship, { t: 'docked', island: publicIsland(best) });
      // Atlante comunitario: l'approdo fa crescere l'isola per tutti
      if (best.kind === 'site' && this.onApprodo) this.onApprodo(best.domain);
    }
    this.missions.onDock(ship, best, firstVisit);
    // il novellino ha attraccato: ora la Bacheca gli parla (issue #22)
    if (ship.senzaMissione) {
      ship.senzaMissione = false;
      this.missions.assign(ship);
    }
  }

  // La stella dell'approdo (issue #13): si segna solo l'isola dove si è
  // attraccati ORA — il segnalibro è un gesto di presenza, non di curl.
  preferisci(ship, msg) {
    if (ship.npc || !ship.docked || ship.docked === 'porto') return;
    const island = this.archipelago.get(ship.docked);
    if (!island || !island.domain || island.domain !== msg.dominio) return;
    if (msg.on) {
      if (ship.preferiti.size >= PREFERITI_MAX && !ship.preferiti.has(island.domain)) {
        this.sendTo(ship, { t: 'toast', msg: `⭐ Hai già ${PREFERITI_MAX} approdi preferiti: togline uno prima` });
        return;
      }
      ship.preferiti.add(island.domain);
      this.sendTo(ship, { t: 'toast', msg: `⭐ ${island.name} è tra i tuoi approdi preferiti` });
    } else {
      ship.preferiti.delete(island.domain);
      this.sendTo(ship, { t: 'toast', msg: `☆ ${island.name} tolta dagli approdi preferiti` });
    }
  }

  undock(ship) {
    if (!ship.docked) return;
    const island = this.archipelago.get(ship.docked);
    ship.docked = null;
    if (island) {
      const a = Math.atan2(ship.y - island.y, ship.x - island.x) || Math.random() * Math.PI * 2;
      ship.x = island.x + Math.cos(a) * (island.r + 100);
      ship.y = island.y + Math.sin(a) * (island.r + 100);
      ship.rot = a;
    }
    ship.vel = 0;
    this.sendTo(ship, { t: 'undocked' });
  }

  // --- cantiere ---

  sendShop(ship) {
    const groups = {};
    for (const g of Object.keys(W.GROUPS)) {
      groups[g] = {
        max: W.GROUPS[g].max,
        nextSlotCost: W.slotCost(g, ship.mounts[g].length),
        slots: ship.mounts[g].map((w, i) => {
          const nt = w.lvl >= W.MAX_WEAPON_LVL ? W.nextTier(w.type, ship.tipo) : null;
          return {
            slot: i, type: w.type, lvl: w.lvl, name: W.TYPES[w.type].name, tier: W.TYPES[w.type].tier,
            upCost: W.upgradeCost(w),
            replace: nt ? { type: nt, name: W.TYPES[nt].name, cost: W.TYPES[nt].cost } : null,
          };
        }),
      };
    }
    this.sendTo(ship, {
      t: 'shop', gold: ship.gold,
      ship: {
        hullLvl: ship.hullLvl, sailsLvl: ship.sailsLvl,
        helmLvl: ship.helmLvl, crewLvl: ship.crewLvl, holdLvl: ship.holdLvl,
        hullCost: lineCost(ship, 'hullLvl'), sailsCost: lineCost(ship, 'sailsLvl'),
        helmCost: lineCost(ship, 'helmLvl'), crewCost: lineCost(ship, 'crewLvl'),
        holdCost: lineCost(ship, 'holdLvl'),
      },
      mounts: ship.mounts,
      groups,
      varo: { tipo: ship.tipo, vari: ship.vari, cost: varoCost(ship), tipi: TIPI_PUB },
    });
  }

  // Il varo: si sceglie (o si cambia) il tipo di nave. Le esclusive
  // dell'altro tipo vengono riscattate al prezzo PIENO pagato: cambiare
  // rotta costa il varo, mai le armi già comprate.
  varo(ship, tipo) {
    if (ship.docked !== 'porto' || !TIPI[tipo]) return;
    if (ship.tipo === tipo) { this.sendTo(ship, { t: 'toast', msg: 'Questa è già la tua nave, capitano.' }); return; }
    if (!this.charge(ship, varoCost(ship))) return;
    ship.vari++;
    ship.tipo = tipo;
    let riscatto = 0;
    for (const g of Object.keys(W.GROUPS)) {
      ship.mounts[g] = ship.mounts[g].map(w => {
        const t = W.TYPES[w.type];
        if (t.tipo && t.tipo !== tipo) { riscatto += W.weaponValue(w); return { type: 'colubrina', lvl: 1 }; }
        return w;
      });
    }
    if (riscatto) {
      ship.gold += riscatto;
      this.sendGold(ship, riscatto, 'Il Cantiere riscatta le armi dell\'altro tipo');
    }
    ship.hp = shipStats(ship).maxHp; // il varo esce dal bacino a scafo asciutto
    this.broadcast({ t: 'feed', msg: `⚓ ${ship.name} ha varato: ora naviga su un ${TIPI[tipo].nome}!` });
    this.sendShop(ship);
  }

  charge(ship, cost) {
    if (cost === null || cost === undefined) { this.sendTo(ship, { t: 'toast', msg: 'Già al massimo, capitano.' }); return false; }
    if (ship.gold < cost) { this.sendTo(ship, { t: 'toast', msg: 'Crediti insufficienti.' }); return false; }
    ship.gold -= cost;
    return true;
  }

  buyShip(ship, stat) {
    const field = SHIP_LINES[stat];
    if (ship.docked !== 'porto' || !field) return;
    if (!this.charge(ship, lineCost(ship, field))) return;
    ship[field]++;
    if (stat === 'hull') ship.hp = shipStats(ship).maxHp;
    this.sendShop(ship);
  }

  buySlot(ship, group) {
    if (ship.docked !== 'porto' || !W.GROUPS[group]) return;
    if (!this.charge(ship, W.slotCost(group, ship.mounts[group].length))) return;
    ship.mounts[group].push({ type: 'colubrina', lvl: 1 }); // lo slot arriva armato
    this.syncReady(ship);
    this.sendShop(ship);
  }

  upgradeWeapon(ship, group, slot) {
    const w = W.GROUPS[group] && ship.mounts[group][slot | 0];
    if (ship.docked !== 'porto' || !w) return;
    if (!this.charge(ship, W.upgradeCost(w))) return;
    w.lvl++;
    this.sendShop(ship);
  }

  replaceWeapon(ship, group, slot) {
    const w = W.GROUPS[group] && ship.mounts[group][slot | 0];
    if (ship.docked !== 'porto' || !w) return;
    if (w.lvl < W.MAX_WEAPON_LVL) { this.sendTo(ship, { t: 'toast', msg: 'Prima porta quest\'arma al livello massimo.' }); return; }
    const nt = W.nextTier(w.type, ship.tipo);
    if (!nt) { this.sendTo(ship, { t: 'toast', msg: 'Non esiste arma più potente di questa.' }); return; }
    if (!this.charge(ship, W.TYPES[nt].cost)) return;
    ship.mounts[group][slot | 0] = { type: nt, lvl: 1 };
    this.sendShop(ship);
  }

  // --- abilità di tipo (tasto R) ---

  abilita(ship) {
    const a = !ship.npc && ABILITA[ship.tipo];
    if (!a || ship.docked || this.isSunk(ship) || ship.blockedUntil > this.now) return;
    if (this.now < ship.abilityAt) {
      this.sendTo(ship, { t: 'toast', msg: `⏳ ${a.nome}: ancora ${Math.ceil(ship.abilityAt - this.now)}s` });
      return;
    }
    ship.abilityAt = this.now + a.cd;
    if (ship.tipo === 'goletta') {
      ship.ramUntil = this.now + a.durata;
      ship.graceUntil = 0; // chi sperona rinuncia alla tregua
      this.fxQueue.push({ k: 'ram', x: r1(ship.x), y: r1(ship.y) }); // telegrafo: la carica si vede partire
    } else if (ship.tipo === 'guerra') {
      this.smokes.push({ x: ship.x, y: ship.y, r: a.raggio, until: this.now + a.durata });
    } else if (ship.tipo === 'galeone') {
      ship.doubleUntil = this.now + a.durata;
      for (const g of Object.keys(W.GROUPS)) ship.ready[g] = ship.ready[g].map(() => 0); // canne fresche
    }
    this.sendTo(ship, { t: 'abilita', nome: a.nome, cd: a.cd });
  }

  inSmoke(ship) {
    return this.smokes.some(s => s.until > this.now && Math.hypot(ship.x - s.x, ship.y - s.y) < s.r);
  }

  // lo Speronamento: prua indurita e vento in poppa; chi viene toccato
  // incassa la mazzata, lo speronatore paga un piccolo pegno di legno
  ramTick(ship) {
    const a = ABILITA.goletta;
    for (const other of this.ships.values()) {
      if (other === ship || other.docked || this.isSunk(other)) continue;
      if (Math.hypot(other.x - ship.x, other.y - ship.y) > 30) continue;
      ship.ramUntil = 0;
      this.fxQueue.push({ k: 'boom', x: r1((ship.x + other.x) / 2), y: r1((ship.y + other.y) / 2), r: 42 });
      this.damageShip(other, a.dmg, ship.id);
      this.damageShip(ship, a.autodanno, other.id);
      break;
    }
  }

  sendGold(ship, delta, reason) {
    if (!ship.npc) this.sendTo(ship, { t: 'gold', gold: ship.gold, delta, reason });
  }

  isSunk(ship) { return ship.sunkUntil > this.now; }

  // --- simulazione ---

  tick() {
    this.now = Date.now() / 1000;
    const dt = TICK;
    if (this.smokes.length) this.smokes = this.smokes.filter(s => s.until > this.now);
    for (const ship of this.ships.values()) {
      if (ship.sunkUntil && this.now >= ship.sunkUntil) this.respawn(ship);
      if (this.isSunk(ship) || ship.docked) continue;
      // il blocco (issue #15): la nave è inerme; si risolve col tocco o col tempo
      if (ship.blockedUntil) {
        if (this.now >= ship.blockedUntil) { this.libera(ship); continue; }
        const p = this.ships.get(ship.blockedBy);
        if (p && !this.isSunk(p) && !p.docked &&
            Math.hypot(p.x - ship.x, p.y - ship.y) < BLOCCO.tocco) this.abborda(ship);
        continue;
      }
      if (ship.npc === 'merc') this.steerMerc(ship);
      else if (ship.npc === 'ghost') this.steerGhost(ship);
      this.move(ship, dt);
      if (ship.ramUntil > this.now) this.ramTick(ship);
      this.regen(ship, dt);
    }
    this.moveShots(dt);
    this.tickForts(dt);
    this.missions.tick(this.now);
    this.tickCount++;
    if (this.fxQueue.length) { this.broadcast({ t: 'fx', list: this.fxQueue }); this.fxQueue = []; }
    if (this.tickCount % SNAP_EVERY === 0) this.sendSnapshot();
  }

  move(ship, dt) {
    const st = shipStats(ship);
    const speed = ship.npc === 'merc' ? 75 : (ship.npc === 'ghost' ? 105 : st.speed);
    const turn = (ship.input.left ? -1 : 0) + (ship.input.right ? 1 : 0);
    ship.rot += turn * st.turnRate * dt;
    // durante lo speronamento la nave carica, vele o non vele
    const desired = ship.ramUntil > this.now ? speed * ABILITA.goletta.spinta
      : ship.input.up ? speed : 0;
    ship.vel += (desired - ship.vel) * Math.min(1, dt * 1.1);
    if (ship.input.down) ship.vel *= Math.max(0, 1 - 2.5 * dt);
    ship.x += Math.cos(ship.rot) * ship.vel * dt;
    ship.y += Math.sin(ship.rot) * ship.vel * dt;
    if (ship.x < 60) { ship.x = 60; ship.vel *= 0.5; }
    if (ship.y < 60) { ship.y = 60; ship.vel *= 0.5; }
    if (ship.x > WORLD.W - 60) { ship.x = WORLD.W - 60; ship.vel *= 0.5; }
    if (ship.y > WORLD.H - 60) { ship.y = WORLD.H - 60; ship.vel *= 0.5; }
    for (const i of this.archipelago.list()) {
      const d = Math.hypot(ship.x - i.x, ship.y - i.y);
      const min = i.r + 18;
      if (d < min && d > 0.001) {
        ship.x = i.x + ((ship.x - i.x) / d) * min;
        ship.y = i.y + ((ship.y - i.y) / d) * min;
        ship.vel *= 0.4;
        if (ship.npc) ship.wp = null;
      }
    }
  }

  steerToward(ship, tx, ty, throttle = true) {
    const want = Math.atan2(ty - ship.y, tx - ship.x);
    let d = want - ship.rot;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    ship.input.left = d < -0.08; ship.input.right = d > 0.08; ship.input.up = throttle;
    return d;
  }

  steerMerc(ship) {
    if (!ship.wp || Math.hypot(ship.wp.x - ship.x, ship.wp.y - ship.y) < 90) {
      ship.wp = { x: 500 + Math.random() * (WORLD.W - 1000), y: 500 + Math.random() * (WORLD.H - 1000) };
    }
    this.steerToward(ship, ship.wp.x, ship.wp.y);
  }

  inSafeWaters(ship) {
    for (const i of this.archipelago.list()) {
      if (Math.hypot(ship.x - i.x, ship.y - i.y) < i.r + 170) return true;
    }
    return false;
  }

  steerGhost(ship) {
    let target = null, bestD = 520; // caccia più miope di un tempo
    for (const s of this.ships.values()) {
      if (s.npc || s.docked || this.isSunk(s)) continue;
      if (s.graceUntil > this.now) continue;          // tregua
      if (this.inSafeWaters(s)) continue;             // acque franche sotto costa
      if (this.inSmoke(s)) continue;                  // il fumogeno acceca i fantasmi
      const d = Math.hypot(s.x - ship.x, s.y - ship.y);
      if (d < bestD) { target = s; bestD = d; }
    }
    if (ship.fleeUntil > this.now) {
      if (target) this.steerToward(ship, ship.x * 2 - target.x, ship.y * 2 - target.y);
      else this.steerMerc(ship);
      return;
    }
    if (!target) { this.steerMerc(ship); return; }
    if (ship.hp < 50) { ship.fleeUntil = this.now + 8; return; }
    const bearing = Math.atan2(target.y - ship.y, target.x - ship.x);
    if (bestD > 240) {
      this.steerToward(ship, target.x, target.y);
    } else {
      // al traverso: scegli la fiancata più comoda e tienila puntata
      const optionL = bearing - GROUP_DIR.left, optionR = bearing - GROUP_DIR.right;
      const diffL = Math.abs(norm(optionL - ship.rot)), diffR = Math.abs(norm(optionR - ship.rot));
      const heading = diffL < diffR ? optionL : optionR;
      const side = diffL < diffR ? 'left' : 'right';
      let d = norm(heading - ship.rot);
      ship.input.left = d < -0.08; ship.input.right = d > 0.08; ship.input.up = bestD > 150;
      if (Math.abs(d) < 0.45 && bestD < 300 && Math.random() < 0.5) this.fire(ship, side);
    }
  }

  regen(ship, dt) {
    const max = ship.npc ? this.npcMaxHp(ship) : shipStats(ship).maxHp;
    if (ship.hp < max && this.now - ship.lastDamageAt > 10) {
      ship.hp = Math.min(max, ship.hp + 1.2 * dt);
    }
  }

  moveShots(dt) {
    const islands = this.archipelago.list();
    for (const shot of this.shots.values()) {
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.ttl -= dt;
      let gone = false;
      if (!shot.arc) {
        for (const ship of this.ships.values()) {
          if (ship.id === shot.owner || ship.docked || this.isSunk(ship)) continue;
          if (Math.hypot(ship.x - shot.x, ship.y - shot.y) < 24) {
            this.damageShip(ship, shot.damage, shot.owner);
            this.fxQueue.push({ k: 'hit', x: r1(shot.x), y: r1(shot.y) });
            gone = true; break;
          }
        }
        if (!gone) {
          for (const i of islands) {
            if (i.defs && !String(shot.owner).startsWith('fort:')) {
              for (const def of i.defs) {
                const rr = def.kind === 't' ? 30 : def.kind === 'b' ? 34 : 40;
                if (!def.dead && Math.hypot(def.x - shot.x, def.y - shot.y) < rr) {
                  this.damageDefense(i, def, shot.damage, shot.owner);
                  this.fxQueue.push({ k: 'hit', x: r1(shot.x), y: r1(shot.y) });
                  gone = true; break;
                }
              }
            }
            if (gone) break;
            if (Math.hypot(i.x - shot.x, i.y - shot.y) < i.r - 6) {
              this.fxQueue.push({ k: 'thud', x: r1(shot.x), y: r1(shot.y) });
              gone = true; break;
            }
          }
        }
      }
      if (!gone && shot.ttl <= 0) {
        if (shot.aoe) this.explode(shot, islands);
        else this.fxQueue.push({ k: 'splash', x: r1(shot.x), y: r1(shot.y) });
        gone = true;
      }
      if (gone) this.shots.delete(shot.id);
    }
  }

  explode(shot, islands) {
    this.fxQueue.push({ k: 'boom', x: r1(shot.x), y: r1(shot.y), r: shot.aoe });
    for (const ship of this.ships.values()) {
      if (ship.id === shot.owner || ship.docked || this.isSunk(ship)) continue;
      if (Math.hypot(ship.x - shot.x, ship.y - shot.y) < shot.aoe + 14) {
        this.damageShip(ship, shot.damage, shot.owner);
      }
    }
    if (!String(shot.owner).startsWith('fort:')) {
      for (const i of islands) {
        if (!i.defs) continue;
        for (const def of i.defs) {
          if (!def.dead && Math.hypot(def.x - shot.x, def.y - shot.y) < shot.aoe + 20) {
            this.damageDefense(i, def, shot.damage, shot.owner);
          }
        }
      }
    }
  }

  damageDefense(island, def, dmg, byId) {
    def.hp -= dmg;
    def.lastHit = this.now;
    if (def.hp <= 0 && !def.dead) {
      def.dead = true; def.deadAt = this.now;
      this.fxQueue.push({ k: 'towerdown', x: r1(def.x), y: r1(def.y) });
      if (island.defs.every(d => d.dead)) this.fortressFalls(island, byId);
    }
  }

  fortressFalls(island, byId) {
    island.fallenUntil = this.now + FORT.fallDuration;
    const hero = this.ships.get(byId);
    if (hero && !hero.npc) {
      hero.gold += FORT.conquestBounty;
      hero.conquered.add(island.id);
      hero.kills++;
      this.sendGold(hero, FORT.conquestBounty, `Hai espugnato ${island.name}!`);
      this.sendTo(hero, { t: 'conquered', island: island.id, list: [...hero.conquered] });
      this.broadcast({ t: 'feed', msg: `🏰⚔️ ${hero.name} ha ESPUGNATO ${island.name}! Il blocco è caduto.` });
    } else {
      this.broadcast({ t: 'feed', msg: `🏰 Le difese di ${island.name} sono cadute!` });
    }
    this.broadcast({ t: 'fortFall', island: island.id });
  }

  tickForts(dt) {
    for (const island of this.archipelago.list()) {
      if (!island.defs) continue;
      if (island.fallenUntil > this.now) continue;
      if (island.fallenUntil && island.fallenUntil <= this.now) {
        island.fallenUntil = 0;
        for (const def of island.defs) { def.dead = false; def.hp = def.max; }
        this.broadcast({ t: 'feed', msg: `🏰 ${island.name} è stata ricostruita. Il blocco è di nuovo attivo.` });
      }
      const volley = [];
      for (const def of island.defs) {
        if (def.dead) {
          if (!WEAK_FORTS && this.now - def.deadAt > FORT.rebuildAfter) { def.dead = false; def.hp = def.max * FORT.rebuildFrac; }
          continue;
        }
        if (!WEAK_FORTS && this.now - def.lastHit > FORT.regenAfter && def.hp < def.max) {
          def.hp = Math.min(def.max, def.hp + FORT.regen * dt);
        }
        if (WEAK_FORTS) continue; // nei test le difese non sparano
        if (this.now < def.fireAt) continue;
        const spec = def.kind === 't' ? FORT.torre : def.kind === 'b' ? FORT.bombarda : FORT.specchio;
        let target = null, bestD = spec.range;
        for (const ship of this.ships.values()) {
          if (ship.docked || this.isSunk(ship) || ship.conquered.has(island.id)) continue;
          if (this.inSmoke(ship)) continue; // le vedette non sparano nel fumo
          const d = Math.hypot(ship.x - def.x, ship.y - def.y);
          if (d < bestD) { target = ship; bestD = d; }
        }
        if (!target) continue;
        if (def.kind === 's') {
          // lo Specchio Ustorio: raggio istantaneo, brucia a cadenza fissa
          def.fireAt = this.now + spec.tick;
          this.damageShip(target, spec.dmg, 'fort:' + island.id);
          this.fxQueue.push({ k: 'beam', x: r1(def.x), y: r1(def.y), x2: r1(target.x), y2: r1(target.y) });
          continue;
        }
        def.fireAt = this.now + spec.reload;
        const speed = def.kind === 'b' ? spec.speed : 430;
        const t = bestD / speed;
        const ax = target.x + Math.cos(target.rot) * target.vel * t;
        const ay = target.y + Math.sin(target.rot) * target.vel * t;
        const dir = Math.atan2(ay - def.y, ax - def.x);
        const st = def.kind === 'b'
          ? { dmg: spec.dmg, range: Math.min(spec.range, Math.hypot(ax - def.x, ay - def.y) + 30), speed, aoe: spec.aoe, arc: true, burst: 1 }
          : { dmg: spec.dmg, range: spec.range + 40, speed, aoe: 0, arc: false, burst: 1 };
        volley.push(this.spawnShot('fort:' + island.id, def.x, def.y, dir, st));
      }
      if (volley.length) this.broadcast({ t: 'shots', from: 'fort', shots: volley });
    }
  }

  damageShip(ship, dmg, byId) {
    if (ship.graceUntil > this.now) return; // tregua: il colpo scivola in mare
    if (ship.immuneUntil > this.now) return; // appena svincolato: intoccabile
    if (ship.blockedUntil > this.now) return; // già vinta: si abborda, non si bombarda
    ship.hp -= dmg;
    ship.lastHitBy = byId;
    ship.lastDamageAt = this.now;
    if (ship.hp <= 0) {
      // fra capitani il colpo di grazia BLOCCA (issue #15); NPC e fortezze
      // affondano come sempre
      const killer = this.ships.get(byId);
      if (!ship.npc && killer && !killer.npc) this.blocca(ship, killer);
      else this.sink(ship, byId);
    }
  }

  // Il blocco: lo scontro navale è vinto QUI — kill, missioni e diario si
  // registrano subito; l'arrembaggio è solo il bottino che manca.
  blocca(vittima, predatore) {
    vittima.hp = 0;
    vittima.vel = 0;
    vittima.input = { up: false, down: false, left: false, right: false };
    vittima.blockedUntil = this.now + BLOCCO.durata;
    vittima.blockedBy = predatore.id;
    vittima.deaths++;
    vittima.bloccoSalvo = Math.round(vittima.gold * 0.10 * vittima.holdLvl);
    const inGioco = vittima.gold - vittima.bloccoSalvo;
    const subito = Math.round(inGioco * BLOCCO.quotaSubito);
    vittima.gold -= subito;
    predatore.gold += subito;
    predatore.kills++;
    this.fxQueue.push({ k: 'boom', x: r1(vittima.x), y: r1(vittima.y), r: 30 });
    this.sendGold(vittima, -subito, 'Bloccato! Un quarto del forziere in gioco è del vincitore');
    this.sendGold(predatore, subito, `Hai bloccato ${vittima.name}: toccala per l'arrembaggio!`);
    this.missions.onKill(predatore, vittima);
    this.broadcast({ t: 'kill', killer: predatore.name, victim: vittima.name, bounty: subito });
  }

  // Il tocco entro il tempo: il predatore prende tutto il forziere in gioco;
  // alla vittima resta il doppiofondo, e la nave affonda (conto già saldato).
  abborda(vittima) {
    const predatore = this.ships.get(vittima.blockedBy);
    const resto = Math.max(0, vittima.gold - vittima.bloccoSalvo);
    if (resto > 0) {
      vittima.gold = vittima.bloccoSalvo;
      if (predatore) {
        predatore.gold += resto;
        this.sendGold(predatore, resto, `Arrembaggio! Il forziere di ${vittima.name} è tuo`);
      }
      this.sendGold(vittima, -resto, vittima.bloccoSalvo > 0
        ? 'Abbordato! Il doppiofondo ha salvato qualcosa' : 'Abbordato! Il forziere è del vincitore');
    }
    this.broadcast({ t: 'feed', msg: `⚔ ${predatore ? predatore.name : 'Il mare'} ha ABBORDATO ${vittima.name}!${resto ? ` (+${resto} 🪙)` : ''}` });
    vittima.blockedUntil = 0;
    vittima.blockedBy = null;
    vittima.sunkUntil = this.now + RESPAWN_S;
    this.fxQueue.push({ k: 'sink', x: r1(vittima.x), y: r1(vittima.y) });
    this.sendTo(vittima, { t: 'dead', respawn: RESPAWN_S });
  }

  // Il timeout: nessuno ha osato — la vittima si svincola col 75% del forziere
  // in gioco (mai toccato dopo il blocco), mezza vita e l'immunità per rientrare.
  libera(vittima) {
    vittima.blockedUntil = 0;
    vittima.blockedBy = null;
    vittima.hp = Math.round(shipStats(vittima).maxHp * BLOCCO.hpRitorno);
    vittima.immuneUntil = this.now + BLOCCO.immunita;
    this.sendTo(vittima, { t: 'toast', msg: `⛵ Nessuno ha osato abbordarti: sei libero, con ${BLOCCO.immunita}s di immunità` });
    this.broadcast({ t: 'feed', msg: `⛵ ${vittima.name} si è svincolato dal blocco` });
  }

  sink(ship, byId) {
    ship.deaths++;
    ship.hp = 0;
    ship.vel = 0;
    ship.sunkUntil = this.now + RESPAWN_S;
    this.fxQueue.push({ k: 'sink', x: r1(ship.x), y: r1(ship.y) });
    const killer = this.ships.get(byId);
    let killerName = 'Il Mare';
    if (typeof byId === 'string' && byId.startsWith('fort:')) {
      const island = this.archipelago.get(byId.slice(5));
      killerName = island ? island.name : 'La Fortezza';
    }
    let bounty = 0;
    if (killer && !killer.npc) {
      killerName = killer.name;
      if (ship.npc) {
        // le prede PvE pagano poco e FISSO: l'oro vero naviga sotto bandiera altrui
        bounty = PVE_BOUNTY[ship.npc] || 0;
      } else {
        // legge del mare: chi affonda un capitano si prende il forziere —
        // meno quel che la Stiva nasconde nel doppiofondo (10% a punto)
        const salvo = Math.round(ship.gold * 0.10 * ship.holdLvl);
        bounty = ship.gold - salvo;
        ship.gold = salvo;
        this.sendGold(ship, -bounty, salvo > 0 ? 'Il doppiofondo della stiva ha salvato qualcosa' : 'Il forziere è del vincitore');
      }
      killer.gold += bounty;
      killer.kills++;
      this.sendGold(killer, bounty, `Hai affondato ${ship.name}!`);
      this.missions.onKill(killer, ship);
    } else if (killer && killer.npc === 'ghost') {
      killerName = killer.name;
    }
    this.broadcast({ t: 'kill', killer: killerName, victim: ship.name, bounty });
    if (!ship.npc) this.sendTo(ship, { t: 'dead', respawn: RESPAWN_S });
  }

  respawn(ship) {
    ship.sunkUntil = 0;
    ship.lastHitBy = null;
    ship.blockedUntil = 0; ship.blockedBy = null; ship.bloccoSalvo = 0; ship.immuneUntil = 0;
    if (ship.npc) {
      ship.x = 400 + Math.random() * (WORLD.W - 800);
      ship.y = 400 + Math.random() * (WORLD.H - 800);
      ship.hp = this.npcMaxHp(ship);
      ship.wp = null; ship.fleeUntil = 0;
    } else {
      const p = this.spawnPoint();
      ship.x = p.x; ship.y = p.y;
      ship.hp = shipStats(ship).maxHp;
      ship.graceUntil = this.now + 8; // niente agguati sul respawn
      this.sendTo(ship, { t: 'respawned' });
    }
  }

  // --- uscita verso i client ---

  sendSnapshot() {
    const ships = [];
    for (const s of this.ships.values()) {
      ships.push({
        id: s.id, name: s.name, x: r1(s.x), y: r1(s.y), rot: r2(s.rot),
        vel: r1(s.vel), hp: Math.ceil(s.hp),
        maxHp: s.npc ? this.npcMaxHp(s) : shipStats(s).maxHp,
        docked: s.docked, sunk: this.isSunk(s),
        k: s.npc === 'merc' ? 'm' : s.npc === 'ghost' ? 'g' : 'p',
        sl: s.npc ? 0 : s.sailsLvl,
        tp: TIPO_SNAP[s.tipo] || 0, // il tipo vestito dal varo (0 = nessuno)
        gp: [s.mounts.left.length, s.mounts.right.length, s.mounts.bow.length, s.mounts.stern.length],
        // armi in chiaro (iniziale+livello per slot): il client disegna i
        // cannoni VERI, non pallini — "n" = cannone, "r" = carronata
        gw: [encW(s.mounts.left), encW(s.mounts.right), encW(s.mounts.bow), encW(s.mounts.stern)],
        // il blocco (issue #15), campi ADDITIVI: bk = secondi al timeout,
        // bb = chi ha diritto d'abbordaggio, im = 1 se immune post-svincolo
        ...(s.blockedUntil > this.now
          ? { bk: Math.ceil(s.blockedUntil - this.now), bb: s.blockedBy } : {}),
        ...(s.immuneUntil > this.now ? { im: 1 } : {}),
      });
    }
    const forts = [];
    for (const i of this.archipelago.list()) {
      if (i.defs) {
        forts.push({
          i: i.id,
          fallen: i.fallenUntil > this.now ? Math.round(i.fallenUntil - this.now) : 0,
          d: i.defs.map(d => [d.kind, r1(d.x), r1(d.y), Math.ceil(d.hp), d.max, d.dead ? 1 : 0]),
        });
      }
    }
    const snap = { t: 'snap', ts: Date.now(), ships, forts };
    // campo additivo: i fumogeni attivi (x, y, raggio, secondi restanti)
    if (this.smokes.length) snap.sm = this.smokes.map(s => [r1(s.x), r1(s.y), s.r, r2(s.until - this.now)]);
    this.broadcast(snap);
  }

  sendBoard() {
    const rows = [...this.ships.values()]
      .filter(s => !s.npc)
      .sort((a, b) => b.kills - a.kills || b.gold - a.gold)
      .slice(0, 10)
      .map(s => ({ name: s.name, kills: s.kills, deaths: s.deaths, gold: s.gold }));
    if (rows.length) this.broadcast({ t: 'board', rows });
  }
}

function norm(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// C'è un Organo di Da Vinci in un profilo GREZZO (non ancora sanificato)?
function hasOrgano(m) {
  return !!m && typeof m === 'object' &&
    Object.values(m).some(list => Array.isArray(list) && list.some(w => w && w.type === 'organo'));
}

function r1(n) { return Math.round(n * 10) / 10; }
function r2(n) { return Math.round(n * 100) / 100; }

function encW(mounts) {
  let out = '';
  for (const m of mounts) out += (m.type === 'cannone' ? 'n' : m.type === 'carronata' ? 'r' : m.type[0]) + m.lvl;
  return out;
}

module.exports = { Game, shipStats, shipLvlCost };
