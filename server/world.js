'use strict';

// Il mare dell'Internet: un mondo condiviso dove ogni dominio diventa un'isola
// posizionata in modo deterministico (stesso dominio -> stessa posizione per tutti).

const blocklist = require('./blocklist-core');
const atlante = require('./atlante-core');
const { dominioBase } = require('./dominio');

const WORLD = { W: 6000, H: 6000, level: 0 };
const PORT = { x: WORLD.W / 2, y: WORLD.H / 2 };

// Issue #14: il mare cresce a scaglioni, ma solo fra un risveglio e l'altro.
// Ogni scaglione aggiunge un anello concentrico: le isole già note conservano
// la stessa posizione RELATIVA al Porto, quindi l'espansione non riscrive la
// geografia. Il welcome porta già le dimensioni al client; nessun messaggio di
// resize (e nessun salto a mare caldo) è necessario.
const WORLD_LEVELS = [
  { finoA: 59, size: 6000, ring: [900, 2800] },
  { finoA: 219, size: 12000, ring: [3500, 5600] },
  { finoA: 379, size: 18000, ring: [6300, 8600] },
  { finoA: 500, size: 24000, ring: [9300, 11600] },
  // riserva per il caso patologico in cui centinaia di isole siano già tutte
  // al tetto di crescita 3×: normalmente il livello 3 basta e questo non nasce
  { finoA: 500, size: 30000, ring: [12300, 14600] },
];
const MAX_SEEDED_ISLANDS = 500; // stesso tetto del dump AtlanteDO

function worldForCount(n) {
  n = Math.max(0, n | 0);
  let level = WORLD_LEVELS.findIndex(s => n <= s.finoA);
  if (level < 0) level = WORLD_LEVELS.length - 1;
  const size = WORLD_LEVELS[level].size;
  return { W: size, H: size, level };
}

function worldForLevel(level) {
  level = Math.max(0, Math.min(WORLD_LEVELS.length - 1, level | 0));
  const size = WORLD_LEVELS[level].size;
  return { W: size, H: size, level };
}

function portForWorld(world) {
  return { x: world.W / 2, y: world.H / 2 };
}

// Arsenale delle Fortezze Proibite: esagerato di proposito (vedi docs/GAME-DESIGN.md).
const FORT = {
  torre: { count: 8, hp: 650, dmg: 55, range: 640, reload: 1.5, ringDist: 85 },
  bombarda: { count: 2, hp: 800, dmg: 85, aoe: 90, range: 820, reload: 5.5, speed: 240, ringDist: 40 },
  specchio: { count: 1, hp: 1000, dmg: 12, tick: 0.35, range: 440 },
  // le difese a vulnerabilità specifica (dungeon tosti): la Corazzata
  // ignora il piombo leggero (sotto SOGLIA_CORAZZA rimbalza), i Serventi
  // dietro i parapetti cadono solo sotto la MITRAGLIA
  corazzata: { hp: 550, dmg: 24, reload: 3.4, range: 340 },
  serventi: { hp: 260, dmg: 4, reload: 0.55, range: 300 },
  regen: 4, regenAfter: 10, rebuildAfter: 150, rebuildFrac: 0.4,
  fallDuration: 8 * 60, // dopo l'espugnazione resta caduta per tutti per 8 minuti
  conquestBounty: 1500,
};

// FNV-1a a 32 bit
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TLD_KIND = {
  com: 'Isola', org: 'Atollo', net: 'Arcipelago', it: 'Scoglio',
  edu: 'Accademia', gov: 'Bastione', io: 'Isolotto', dev: 'Cala', ai: 'Laguna',
};

function islandName(domain, fortress) {
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const pretty = base.charAt(0).toUpperCase() + base.slice(1);
  if (fortress) return `Fortezza Proibita di ${pretty}`;
  return `${TLD_KIND[tld] || 'Isola'} di ${pretty}`;
}

// il battesimo A CHIAVE (i18n fetta 2): nk è la chiave del genere d'isola
// (isola.<nk> nei dizionari), nd il nome proprio che riempie {d} — il
// client compone il toponimo nella SUA lingua
function islandNameKey(domain, fortress) {
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const pretty = base.charAt(0).toUpperCase() + base.slice(1);
  return { nk: fortress ? 'fortezza' : 'k.' + (TLD_KIND[tld] ? tld : 'com'), nd: pretty };
}

// Interpreta cosa ha scritto l'utente nella barra della rotta.
function parseCourse(q) {
  q = String(q || '').trim().slice(0, 200);
  if (!q) return null;
  if (/^https?:\/\//i.test(q)) {
    try {
      const url = new URL(q);
      // l'ISOLA è il dominio registrabile (#26); la rotta resta profonda:
      // si salpa verso wikipedia.org, all'attracco si apre l'URL digitato
      return { domain: dominioBase(url.hostname), url: url.href };
    } catch { return null; }
  }
  if (!q.includes('.') || /\s/.test(q)) {
    // Testo libero: rotta per il Faro dell'Oracolo (il motore di ricerca).
    return { search: true, domain: null, url: 'https://duckduckgo.com/?q=' + encodeURIComponent(q) };
  }
  const host = q.toLowerCase().split('/')[0];
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  return { domain: dominioBase(host), url: 'https://' + q };
}

// Knob per i test end-to-end: fortezze di cartapesta (WEAK_FORTS=1).
const HPX = (typeof process !== 'undefined' ? process.env.WEAK_FORTS : undefined) ? 0.05 : 1;

// Le difese temporanee di un dungeon (#38): stesse KIND delle fortezze (stessa
// meccanica e stessi numeri per pezzo — quelli restano del codice), ma la
// COMPOSIZIONE (quante torri/bombarde, se c'è lo specchio) la decide il Mastro,
// già clampata a range sani in campagna-core. Disposizione stabile nel periodo.
function makeDungeonDefs(x, y, r, spec, seed) {
  const rng = mulberry32(seed >>> 0);
  const defs = [];
  const t = FORT.torre, b = FORT.bombarda;
  const nt = Math.max(0, spec.torri | 0), nb = Math.max(0, spec.bombarde | 0);
  const off = rng() * Math.PI * 2;
  for (let k = 0; k < nt; k++) {
    const a = (k / Math.max(1, nt)) * Math.PI * 2 + off;
    defs.push(makeDefense('t', x + Math.cos(a) * (r + t.ringDist), y + Math.sin(a) * (r + t.ringDist), t.hp));
  }
  for (let k = 0; k < nb; k++) {
    const a = (k / Math.max(1, nb)) * Math.PI * 2 + off + 0.7;
    defs.push(makeDefense('b', x + Math.cos(a) * (r * 0.5 + b.ringDist), y + Math.sin(a) * (r * 0.5 + b.ringDist), b.hp));
  }
  // le difese con carattere (feature del capitano): corazzate sull'anello
  // di costa, serventi appostati un filo più dentro la rada
  const nc = Math.max(0, spec.corazzate | 0), nv = Math.max(0, spec.serventi | 0);
  for (let k = 0; k < nc; k++) {
    const a = (k / Math.max(1, nc)) * Math.PI * 2 + off + 1.3;
    defs.push(makeDefense('c', x + Math.cos(a) * (r + t.ringDist), y + Math.sin(a) * (r + t.ringDist), FORT.corazzata.hp));
  }
  for (let k = 0; k < nv; k++) {
    const a = (k / Math.max(1, nv)) * Math.PI * 2 + off + 2.1;
    defs.push(makeDefense('v', x + Math.cos(a) * (r + t.ringDist * 0.6), y + Math.sin(a) * (r + t.ringDist * 0.6), FORT.serventi.hp));
  }
  if (spec.specchio) defs.push(makeDefense('s', x, y, FORT.specchio.hp));
  return defs;
}

function makeDefense(kind, x, y, hp) {
  hp = Math.max(10, Math.round(hp * HPX));
  return { kind, x, y, hp, max: hp, dead: false, deadAt: 0, fireAt: 0, lastHit: 0 };
}

class Archipelago {
  constructor(world = WORLD, port = portForWorld(world)) {
    this.world = world;
    this.port = port;
    this.islands = new Map(); // id -> island
    this._addFixed({
      id: 'porto', kind: 'porto', domain: null, name: 'Porto Franco', nk: 'porto',
      x: port.x, y: port.y, r: 130, seed: 42, fortress: false,
    });
    this._addFixed({
      id: 'oracolo', kind: 'oracolo', domain: null, name: "Faro dell'Oracolo", nk: 'oracolo',
      x: port.x + 560, y: port.y - 420, r: 85, seed: 1337, fortress: false,
    });
  }

  _addFixed(island) { this.islands.set(island.id, island); }

  list() { return [...this.islands.values()]; }

  get(id) { return this.islands.get(id); }

  // Crea (o restituisce) l'isola di un dominio. Posizione deterministica dal
  // nome, con spostamenti in caso di sovrapposizione con isole esistenti.
  ensure(domain) {
    domain = dominioBase(domain); // difesa: chiavi vecchie coi sottodomini (#26)
    if (this.islands.has(domain)) return { island: this.islands.get(domain), isNew: false };
    const fortress = blocklist.isBlocked(domain);
    const seed = hashStr(domain);
    const rng = mulberry32(seed);
    // la base è il seme, la crescita è dell'equipaggio: più approdi, più stazza
    const base = fortress ? 120 + rng() * 40 : 65 + rng() * 55;
    const r = Math.round(base * (fortress ? 1 : atlante.crescita(domain)));
    let x = this.port.x, y = this.port.y, placed = false;
    // I primi 60 domini restano nell'anello storico; i successivi iniziano
    // dall'anello nuovo. Se un anello è pieno si prova quello seguente, mai
    // accettando in silenzio una sovrapposizione come faceva il vecchio
    // fallback dopo 60 tentativi.
    const siteIndex = this.list().filter(i => i.kind === 'site').length;
    const preferito = siteIndex < 60 ? 0 : siteIndex < 220 ? 1 : siteIndex < 380 ? 2 : 3;
    const maxLevel = Math.min(this.world.level | 0, WORLD_LEVELS.length - 1);
    const ordine = [];
    for (let level = Math.min(preferito, maxLevel); level <= maxLevel; level++) ordine.push(level);
    for (let level = 0; level < Math.min(preferito, maxLevel); level++) ordine.push(level);
    for (const level of ordine) {
      const [minDist, maxDist] = WORLD_LEVELS[level].ring;
      for (let i = 0; i < 240 && !placed; i++) {
        const angle = rng() * Math.PI * 2;
        // uniforme per AREA, non per raggio: niente ammasso sul bordo interno
        const dist = Math.sqrt(minDist ** 2 + rng() * (maxDist ** 2 - minDist ** 2));
        x = this.port.x + Math.cos(angle) * dist;
        y = this.port.y + Math.sin(angle) * dist;
        if (x < 300 || y < 300 || x > this.world.W - 300 || y > this.world.H - 300) continue;
        placed = this.list().every(o => Math.hypot(o.x - x, o.y - y) > o.r + r + 260);
      }
      if (placed) break;
    }
    if (!placed) {
      throw new Error(`Mare saturo al livello ${maxLevel}: impossibile collocare ${domain} senza sovrapposizioni`);
    }
    const island = { id: domain, kind: 'site', domain, name: islandName(domain, fortress), ...islandNameKey(domain, fortress), x, y, r, seed, fortress };
    if (fortress) {
      island.defs = [];
      island.fallenUntil = 0;
      const t = FORT.torre;
      for (let k = 0; k < t.count; k++) {
        const a = (k / t.count) * Math.PI * 2 + rng();
        island.defs.push(makeDefense('t', x + Math.cos(a) * (r + t.ringDist), y + Math.sin(a) * (r + t.ringDist), t.hp));
      }
      const b = FORT.bombarda;
      for (let k = 0; k < b.count; k++) {
        const a = (k / b.count) * Math.PI * 2 + rng() + 0.7;
        island.defs.push(makeDefense('b', x + Math.cos(a) * (r * 0.5 + b.ringDist), y + Math.sin(a) * (r * 0.5 + b.ringDist), b.hp));
      }
      island.defs.push(makeDefense('s', x, y, FORT.specchio.hp)); // lo Specchio Ustorio sul mastio
    }
    this.islands.set(domain, island);
    return { island, isNew: true };
  }

  // Il Mastro di Rotte v2 (#38): stende un dungeon TEMPORANEO su un'isola
  // normale — per la durata del periodo riceve difese generate dal Mastro, poi
  // si azzera (clearDungeon). Una fortezza vera non diventa dungeon: ha già le
  // sue. Ritorna l'isola pronta (o null se non applicabile).
  applyDungeon(dungeon) {
    if (!dungeon || !dungeon.bersaglio) return null;
    const { island } = this.ensure(dungeon.bersaglio);
    if (island.fortress) return null; // le acque proibite hanno già un padrone
    if (island.dungeon) {
      // già steso per questo periodo → non ricostruire (non azzerare le difese)
      if (island.dungeon.tipo === dungeon.tipo && island.dungeon.periodo === dungeon.periodo) return island;
      // un altro tipo tiene già l'isola → non scippargliela (il settimanale vince)
      if (island.dungeon.tipo !== dungeon.tipo) return null;
    }
    island.dungeon = {
      tipo: dungeon.tipo, periodo: dungeon.periodo, nome: dungeon.nome,
      premio: dungeon.premio, scadenza: dungeon.scadenza,
    };
    island.dungeonUntil = dungeon.scadenza;
    island.defs = makeDungeonDefs(island.x, island.y, island.r, dungeon.difese || {}, island.seed ^ (dungeon.periodo | 0));
    island.fallenUntil = 0;
    return island;
  }

  clearDungeon(domain) {
    const island = this.islands.get(dominioBase(domain));
    if (!island || !island.dungeon) return null;
    delete island.dungeon;
    delete island.defs;
    island.dungeonUntil = 0;
    island.fallenUntil = 0;
    return island;
  }
}

// Versione dell'isola sicura da mandare ai client (senza stato interno delle difese).
function publicIsland(i) {
  return { id: i.id, kind: i.kind, domain: i.domain, name: i.name, nk: i.nk, nd: i.nd, x: i.x, y: i.y, r: i.r, seed: i.seed, fortress: i.fortress, dungeon: !!i.dungeon };
}

module.exports = {
  WORLD, PORT, WORLD_LEVELS, MAX_SEEDED_ISLANDS, worldForCount, worldForLevel, portForWorld,
  FORT, hashStr, mulberry32, parseCourse, Archipelago, publicIsland,
};
