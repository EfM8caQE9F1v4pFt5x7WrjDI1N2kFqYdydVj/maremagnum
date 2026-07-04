'use strict';

// Il mare dell'Internet: un mondo condiviso dove ogni dominio diventa un'isola
// posizionata in modo deterministico (stesso dominio -> stessa posizione per tutti).

const blocklist = require('./blocklist');

const WORLD = { W: 6000, H: 6000 };
const PORT = { x: WORLD.W / 2, y: WORLD.H / 2 };

// Arsenale delle Fortezze Proibite: esagerato di proposito (vedi docs/GAME-DESIGN.md).
const FORT = {
  torre: { count: 8, hp: 650, dmg: 55, range: 640, reload: 1.5, ringDist: 85 },
  bombarda: { count: 2, hp: 800, dmg: 85, aoe: 90, range: 820, reload: 5.5, speed: 240, ringDist: 40 },
  specchio: { count: 1, hp: 1000, dmg: 12, tick: 0.35, range: 440 },
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

// Interpreta cosa ha scritto l'utente nella barra della rotta.
function parseCourse(q) {
  q = String(q || '').trim().slice(0, 200);
  if (!q) return null;
  if (/^https?:\/\//i.test(q)) {
    try {
      const url = new URL(q);
      return { domain: url.hostname.toLowerCase().replace(/^www\./, ''), url: url.href };
    } catch { return null; }
  }
  if (!q.includes('.') || /\s/.test(q)) {
    // Testo libero: rotta per il Faro dell'Oracolo (il motore di ricerca).
    return { search: true, domain: null, url: 'https://duckduckgo.com/?q=' + encodeURIComponent(q) };
  }
  const domain = q.toLowerCase().replace(/^www\./, '').split('/')[0];
  if (!/^[a-z0-9.-]+$/.test(domain)) return null;
  return { domain, url: 'https://' + q };
}

// Knob per i test end-to-end: fortezze di cartapesta (WEAK_FORTS=1).
const HPX = process.env.WEAK_FORTS ? 0.05 : 1;

function makeDefense(kind, x, y, hp) {
  hp = Math.max(10, Math.round(hp * HPX));
  return { kind, x, y, hp, max: hp, dead: false, deadAt: 0, fireAt: 0, lastHit: 0 };
}

class Archipelago {
  constructor() {
    this.islands = new Map(); // id -> island
    this._addFixed({
      id: 'porto', kind: 'porto', domain: null, name: 'Porto Franco',
      x: PORT.x, y: PORT.y, r: 130, seed: 42, fortress: false,
    });
    this._addFixed({
      id: 'oracolo', kind: 'oracolo', domain: null, name: "Faro dell'Oracolo",
      x: PORT.x + 560, y: PORT.y - 420, r: 85, seed: 1337, fortress: false,
    });
  }

  _addFixed(island) { this.islands.set(island.id, island); }

  list() { return [...this.islands.values()]; }

  get(id) { return this.islands.get(id); }

  // Crea (o restituisce) l'isola di un dominio. Posizione deterministica dal
  // nome, con spostamenti in caso di sovrapposizione con isole esistenti.
  ensure(domain) {
    if (this.islands.has(domain)) return { island: this.islands.get(domain), isNew: false };
    const fortress = blocklist.isBlocked(domain);
    const seed = hashStr(domain);
    const rng = mulberry32(seed);
    const r = fortress ? 120 + rng() * 40 : 65 + rng() * 55;
    let x = PORT.x, y = PORT.y, placed = false;
    for (let i = 0; i < 60 && !placed; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 900 + rng() * 2000;
      x = PORT.x + Math.cos(angle) * dist;
      y = PORT.y + Math.sin(angle) * dist;
      if (x < 300 || y < 300 || x > WORLD.W - 300 || y > WORLD.H - 300) continue;
      placed = this.list().every(o => Math.hypot(o.x - x, o.y - y) > o.r + r + 260);
    }
    const island = { id: domain, kind: 'site', domain, name: islandName(domain, fortress), x, y, r, seed, fortress };
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
}

// Versione dell'isola sicura da mandare ai client (senza stato interno delle difese).
function publicIsland(i) {
  return { id: i.id, kind: i.kind, domain: i.domain, name: i.name, x: i.x, y: i.y, r: i.r, seed: i.seed, fortress: i.fortress };
}

module.exports = { WORLD, PORT, FORT, hashStr, mulberry32, parseCourse, Archipelago, publicIsland };
