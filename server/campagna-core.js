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
// La tappa finale nomina un'isola reale dell'Atlante quando ce n'è una sopra
// soglia; altrimenti ripiega sulla generica Fortezza Proibita. La SCELTA del
// bersaglio è deterministica dalla settimana (la scelta AI è la #38).
function tappaFinale(bersaglio) {
  return bersaglio
    ? { tipo: 'espugnazione', n: 1, desc: `Espugna la fortezza di ${bersaglio}`, bersaglio }
    : { tipo: 'espugnazione', n: 1, desc: 'Espugna una Fortezza Proibita', bersaglio: null };
}

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
// `isole` sono i domini reali sopra soglia dell'Atlante (in ordine stabile):
// se presenti, la fortezza finale ne nomina uno, scelto in modo deterministico.
function genera(settimana, isole = []) {
  const rng = mulberry32(hashStr('mastro-di-rotte-' + settimana));
  const t1 = TAPPE_APERTURA[(rng() * TAPPE_APERTURA.length) | 0];
  const t2 = TAPPE_CENTRALI[(rng() * TAPPE_CENTRALI.length) | 0];
  const bersaglio = isole && isole.length ? isole[(rng() * isole.length) | 0] : null;
  const grezze = [
    { tipo: t1.tipo, n: t1.n, desc: t1.desc(t1.n) },
    { tipo: t2.tipo, n: t2.n, desc: t2.desc(t2.n) },
    tappaFinale(bersaglio),
  ];
  const tappe = grezze.map((t) => ({ ...t, lore: LORE_TAPPA[(rng() * LORE_TAPPA.length) | 0] }));
  return {
    settimana,
    nome: TEMI[(rng() * TEMI.length) | 0],
    lore: 'Il Mastro di Rotte ha tracciato una nuova campagna sulle carte del Maremagnum.',
    tappe,
    premio: PREMIO,
    bersaglio,
  };
}

// Assicura che ci sia la campagna GIUSTA per la settimana: se quella corrente
// manca o è di un'altra settimana, ne genera una nuova col vestito procedurale
// (gratis, deterministico). Funzione pura: la usano il Mare (a freddo e a ogni
// cambio settimana) e il cron del worker. `daPubblicare` dice se va persistita.
function assicura(corrente, settimana, isole = []) {
  if (valida(corrente) && corrente.settimana === settimana) {
    return { campagna: corrente, daPubblicare: false };
  }
  return { campagna: genera(settimana, isole), daPubblicare: true };
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

module.exports = { genera, assicura, settimanaDi, setCampagna, getCampagna, valida, PREMIO };
