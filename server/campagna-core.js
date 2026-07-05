'use strict';

// Il Mastro di Rotte, cuore puro (issue #3): la campagna PvE della settimana.
// REGOLA DI PROGETTO: i numeri (tappe, quantità, premio) sono procedurali e
// DETERMINISTICI dal numero della settimana — mai delegati a un LLM. L'AI
// (nel worker, quota permettendo) può solo rivestire di lore nome e tappe;
// se manca, il vestito procedurale qui sotto basta e avanza.

// FNV-1a + mulberry32, identici a server/world.js: stesso seme → stessa campagna
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

const PREMIO = 400; // fisso e magro: l'oro vero naviga sotto bandiera altrui

// le tappe riusano meccaniche esistenti; gli eventi sono quelli che il Game
// emette già (sink NPC, prima scoperta, espugnazione)
const TAPPE_APERTURA = [
  { tipo: 'mercantili', n: 2, desc: (n) => `Affonda ${n} Mercantili` },
  { tipo: 'scoperte', n: 2, desc: (n) => `Scopri ${n} isole mai visitate` },
];
const TAPPE_CENTRALI = [
  { tipo: 'fantasmi', n: 2, desc: (n) => `Affonda ${n} Corsari Fantasma` },
  { tipo: 'scoperte', n: 3, desc: (n) => `Scopri ${n} isole mai visitate` },
  { tipo: 'mercantili', n: 3, desc: (n) => `Affonda ${n} Mercantili` },
];
const TAPPA_FINALE = { tipo: 'espugnazione', n: 1, desc: () => 'Espugna una Fortezza Proibita' };

// il vestito procedurale: se l'LLM non c'è, la campagna parla comunque
const TEMI = ['La Flotta Fantasma', 'Il Convoglio Maledetto', 'Le Rotte Perdute',
  'La Marea dei Corsari', "L'Assedio delle Nebbie", 'Il Tesoro degli Abissi',
  'La Vendetta del Mastro', 'Le Vele Nere'];
const LORE_TAPPA = ['Il mare mormora di vele ostili.', 'Le carte parlano di acque mai battute.',
  'Un vecchio nostromo giura di averle viste.', 'La taglia è scritta col catrame.',
  'Nessuno è tornato per raccontarlo.', 'Il vento porta odore di polvere da sparo.'];

function settimanaDi(t = Date.now()) {
  return Math.floor(t / (7 * 24 * 3600 * 1000));
}

// La campagna della settimana: 3 tappe in crescendo, chiusura in fortezza.
function genera(settimana) {
  const rng = mulberry32(hashStr('mastro-di-rotte-' + settimana));
  const t1 = TAPPE_APERTURA[(rng() * TAPPE_APERTURA.length) | 0];
  const t2 = TAPPE_CENTRALI[(rng() * TAPPE_CENTRALI.length) | 0];
  const tappe = [t1, t2, TAPPA_FINALE].map((t) => ({
    tipo: t.tipo, n: t.n, desc: t.desc(t.n),
    lore: LORE_TAPPA[(rng() * LORE_TAPPA.length) | 0],
  }));
  return {
    settimana,
    nome: TEMI[(rng() * TEMI.length) | 0],
    lore: 'Il Mastro di Rotte ha tracciato una nuova campagna sulle carte del Maremagnum.',
    tappe,
    premio: PREMIO,
  };
}

// --- lo stato condiviso (come atlante-core: il DO persiste, qui si vive) ---

let corrente = null;

function valida(c) {
  return !!(c && typeof c.settimana === 'number' && typeof c.nome === 'string' &&
    Array.isArray(c.tappe) && c.tappe.length >= 1 && c.tappe.length <= 5 &&
    c.tappe.every(t => t && typeof t.tipo === 'string' && (t.n | 0) >= 1 && typeof t.desc === 'string'));
}

function setCampagna(c) { corrente = valida(c) ? c : null; }
function getCampagna() { return corrente; }

module.exports = { genera, settimanaDi, setCampagna, getCampagna, valida, PREMIO };
