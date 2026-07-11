'use strict';

// Il Mastro di Rotte (issue #3 → v2 #38): i dungeon del Maremagnum su calendario
// rotante — GIORNALIERI e SETTIMANALI. L'AI (nel worker) li scrive liberamente
// (bersaglio reale, narrazione, difese, difficoltà): è il divertimento, NON è
// deterministico. Il codice mette la mano su UNA cosa sola — la ricompensa
// SPENDIBILE (dobloni), agganciata a un listino fisso: paletto "no pay-to-win",
// il mare è uno solo e condiviso. Se l'AI manca, il vestito procedurale qui
// sotto basta e avanza (rete di sicurezza + auto-seed del #36).

// FNV-1a + mulberry32, identici a server/world.js: stesso seme → stesso vestito
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

// --- economia BLINDATA: l'unica cosa che l'AI non tocca (#38) ---
// L'AI dichiara la FASCIA di difficoltà (design); il CODICE la traduce nel
// premio spendibile. Mai la cifra dall'LLM: un premio allucinato gonfierebbe
// l'economia di TUTTI. Il listino è magro e code-owned.
const DIFFICOLTA = ['facile', 'medio', 'tosto'];
const LISTINO = { facile: 400, medio: 700, tosto: 1000 };
const PREMIO = LISTINO.facile; // compat: il vecchio premio fisso del #3/#36
function difficoltaValida(d) { return DIFFICOLTA.includes(d) ? d : 'medio'; }
function premioPer(difficolta) { return LISTINO[difficoltaValida(difficolta)]; }

// Le difese del dungeon: l'AI ne decide la COMPOSIZIONE (design libero), ma il
// codice la CLAMPA a range sani — non è economia, è non-rompere-il-gioco (un
// muro di 1000 torri non è divertente, è ingiocabile).
const DIFESE_BASE = {
  facile: { torri: 4, bombarde: 1, specchio: false },
  medio: { torri: 6, bombarde: 2, specchio: false, serventi: 1 },
  tosto: { torri: 8, bombarde: 2, specchio: true, corazzate: 2, serventi: 2 },
};
function difeseValide(spec, difficolta) {
  const base = DIFESE_BASE[difficoltaValida(difficolta)];
  const s = spec && typeof spec === 'object' ? spec : {};
  const clamp = (v, lo, hi, def) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  };
  return {
    torri: clamp(s.torri, 3, 10, base.torri),
    bombarde: clamp(s.bombarde, 0, 3, base.bombarde),
    corazzate: clamp(s.corazzate, 0, 3, base.corazzate || 0),
    serventi: clamp(s.serventi, 0, 3, base.serventi || 0),
    specchio: typeof s.specchio === 'boolean' ? s.specchio : base.specchio,
  };
}

// le tappe riusano meccaniche esistenti; gli eventi sono quelli che il Game
// emette già (sink NPC, prima scoperta, espugnazione)
const TAPPE_APERTURA = [
  { tipo: 'mercantili', n: 2, desc: (n) => `Affonda ${n} Mercantili`, tk: 'tappa.mercantili' },
  { tipo: 'scoperte', n: 2, desc: (n) => `Scopri ${n} isole mai visitate`, tk: 'tappa.scoperte' },
];
const TAPPE_CENTRALI = [
  { tipo: 'fantasmi', n: 2, desc: (n) => `Affonda ${n} Corsari Fantasma`, tk: 'tappa.fantasmi' },
  { tipo: 'scoperte', n: 3, desc: (n) => `Scopri ${n} isole mai visitate`, tk: 'tappa.scoperte' },
  { tipo: 'mercantili', n: 3, desc: (n) => `Affonda ${n} Mercantili`, tk: 'tappa.mercantili' },
];
// La tappa finale nomina un'isola reale dell'Atlante quando ce n'è una sopra
// soglia; altrimenti ripiega sulla generica Fortezza Proibita.
function tappaFinale(bersaglio) {
  return bersaglio
    ? { tipo: 'espugnazione', n: 1, desc: `Espugna le difese di ${bersaglio}`, tk: 'tappa.espugnazione', tp: { b: bersaglio }, bersaglio }
    : { tipo: 'espugnazione', n: 1, desc: 'Espugna una Fortezza Proibita', tk: 'tappa.espugnazioneFortezza', bersaglio: null };
}

// Bersagli NOTI: siti reali, famosi e sicuri, SEMPRE nel paniere dei candidati
// accanto alle isole popolari dell'Atlante. Garantiscono un bersaglio degno anche
// con una community piccola (poche o zero isole sopra soglia); man mano che il
// Maremagnum cresce, le isole vere della gente si aggiungono al paniere. Come i
// target dell'Assedio (server/missions.js), ma qui condivisi e puri.
const BERSAGLI_NOTI = ['wikipedia.org', 'archive.org', 'openstreetmap.org',
  'gutenberg.org', 'wiktionary.org', 'nasa.gov', 'openlibrary.org', 'wikimedia.org'];

// Il paniere dei candidati bersaglio: le isole reali passate (sopra soglia
// dell'Atlante) PIÙ i bersagli noti, senza doppioni. Sempre non vuoto.
function bersagli(isoleReali = []) {
  return [...new Set([...(Array.isArray(isoleReali) ? isoleReali : []), ...BERSAGLI_NOTI])];
}

// il vestito procedurale: se l'LLM non c'è, il dungeon parla comunque
const TEMI = ['La Flotta Fantasma', 'Il Convoglio Maledetto', 'Le Rotte Perdute',
  'La Marea dei Corsari', "L'Assedio delle Nebbie", 'Il Tesoro degli Abissi',
  'La Vendetta del Mastro', 'Le Vele Nere'];
const LORE_TAPPA = ['Il mare mormora di vele ostili.', 'Le carte parlano di acque mai battute.',
  'Un vecchio nostromo giura di averle viste.', 'La taglia è scritta col catrame.',
  'Nessuno è tornato per raccontarlo.', 'Il vento porta odore di polvere da sparo.'];

// --- il calendario rotante (#38): giornaliero e settimanale ---
const SPAN = { giornaliero: 24 * 3600 * 1000, settimanale: 7 * 24 * 3600 * 1000 };
function settimanaDi(t = Date.now()) { return Math.floor(t / SPAN.settimanale); }
function giornoDi(t = Date.now()) { return Math.floor(t / SPAN.giornaliero); }
function periodoDi(tipo, t = Date.now()) { return Math.floor(t / (SPAN[tipo] || SPAN.settimanale)); }
// fine del periodo, in ms epoch: quando le difese temporanee si azzerano
function scadenzaDi(tipo, periodo) { return (periodo + 1) * (SPAN[tipo] || SPAN.settimanale); }

// Il dungeon del periodo. Il SETTIMANALE è la campagna in crescendo (3 tappe,
// chiusura sull'isola difesa); il GIORNALIERO è a obiettivo singolo (l'assalto
// del giorno). `isole` sono i domini reali sopra soglia dell'Atlante: se ci
// sono, il bersaglio ne nomina uno (scelta deterministica nel fallback; l'AI
// la fa nel worker). Il vestito qui è la rete di sicurezza, non la via maestra.
function genera(tipo, periodo, isole = []) {
  const rng = mulberry32(hashStr('mastro-' + tipo + '-' + periodo));
  const bersaglio = isole && isole.length ? isole[(rng() * isole.length) | 0] : null;
  const difficolta = DIFFICOLTA[(rng() * DIFFICOLTA.length) | 0];
  let grezze;
  if (tipo === 'giornaliero') {
    grezze = [tappaFinale(bersaglio)];
  } else {
    const t1 = TAPPE_APERTURA[(rng() * TAPPE_APERTURA.length) | 0];
    const t2 = TAPPE_CENTRALI[(rng() * TAPPE_CENTRALI.length) | 0];
    grezze = [
      { tipo: t1.tipo, n: t1.n, desc: t1.desc(t1.n), tk: t1.tk, tp: { n: t1.n } },
      { tipo: t2.tipo, n: t2.n, desc: t2.desc(t2.n), tk: t2.tk, tp: { n: t2.n } },
      tappaFinale(bersaglio),
    ];
  }
  const tappe = grezze.map((t) => ({ ...t, lore: LORE_TAPPA[(rng() * LORE_TAPPA.length) | 0] }));
  const d = {
    tipo, periodo,
    scadenza: scadenzaDi(tipo, periodo),
    nome: TEMI[(rng() * TEMI.length) | 0],
    lore: 'Il Mastro di Rotte ha tracciato una nuova rotta sulle carte del Maremagnum.',
    tappe,
    bersaglio,
    difficolta,
    premio: premioPer(difficolta),
    difese: difeseValide(null, difficolta),
  };
  if (tipo === 'settimanale') d.settimana = periodo; // compat #36: ship.campagna.settimana
  return d;
}

// L'AI riveste il dungeon procedurale (#38): nome, lore, narrazione per tappa e
// COMPOSIZIONE delle difese sono liberi (il divertimento); ma il CODICE valida
// tutto ciò che tocca il gioco condiviso — il bersaglio DEVE essere un'isola
// reale fra i candidati, la difficoltà è clampata alle 3 fasce, il premio esce
// dal LISTINO (MAI dall'LLM: no pay-to-win), le difese sono clampate a range
// sani. Ritorna sempre un dungeon valido: se il vestito è spazzatura, resta il
// procedurale sotto. Funzione pura → tutta la blindatura è testabile senza rete.
function applicaVestito(base, vestito, candidati = []) {
  const d = { ...base, tappe: base.tappe.map((t) => ({ ...t })) };
  const v = vestito && typeof vestito === 'object' ? vestito : {};
  if (typeof v.nome === 'string' && v.nome.trim()) d.nome = v.nome.trim().slice(0, 60);
  if (typeof v.lore === 'string' && v.lore.trim()) d.lore = v.lore.trim().slice(0, 200);
  // i18n fetta 3: il Mastro parla anche inglese — stessa chiamata, stessi limiti
  if (typeof v.nome_en === 'string' && v.nome_en.trim()) d.nome_en = v.nome_en.trim().slice(0, 60);
  if (typeof v.lore_en === 'string' && v.lore_en.trim()) d.lore_en = v.lore_en.trim().slice(0, 200);
  // difficoltà (design dell'AI) → premio spendibile (blindato dal codice)
  d.difficolta = difficoltaValida(v.difficolta);
  d.premio = premioPer(d.difficolta);
  // bersaglio: SOLO un'isola reale fra i candidati, altrimenti tieni il procedurale
  if (typeof v.bersaglio === 'string' && candidati.includes(v.bersaglio)) d.bersaglio = v.bersaglio;
  // riallinea la tappa d'espugnazione al bersaglio effettivo
  const fin = d.tappe[d.tappe.length - 1];
  if (fin && fin.tipo === 'espugnazione') {
    fin.bersaglio = d.bersaglio || null;
    fin.desc = d.bersaglio ? `Espugna le difese di ${d.bersaglio}` : 'Espugna una Fortezza Proibita';
    fin.tk = d.bersaglio ? 'tappa.espugnazione' : 'tappa.espugnazioneFortezza';
    fin.tp = d.bersaglio ? { b: d.bersaglio } : undefined;
  }
  // narrazione per tappa (solo testo)
  if (Array.isArray(v.tappe)) {
    v.tappe.forEach((l, i) => {
      if (d.tappe[i] && typeof l === 'string' && l.trim()) d.tappe[i].lore = l.trim().slice(0, 120);
    });
  }
  if (Array.isArray(v.tappe_en)) {
    v.tappe_en.forEach((l, i) => {
      if (d.tappe[i] && typeof l === 'string' && l.trim()) d.tappe[i].lore_en = l.trim().slice(0, 120);
    });
  }
  // difese: composizione libera dell'AI, ma clampata a range giocabili
  d.difese = difeseValide(v.difese, d.difficolta);
  return d;
}

// Assicura che ci sia il dungeon GIUSTO per (tipo, periodo): se quello corrente
// manca o è di un altro periodo, ne genera uno col vestito procedurale (gratis,
// deterministico). Funzione pura: la usano il Mare (a freddo e a ogni cambio
// periodo) e il cron del worker. `daPubblicare` dice se va persistito.
function assicura(corrente, tipo, periodo, isole = []) {
  const buono = valida(corrente) && corrente.tipo === tipo && corrente.periodo === periodo;
  // self-heal: un dungeon del periodo giusto ma SENZA bersaglio reale (seminato
  // quando l'Atlante era muto) si rigenera appena ci sono candidati — così le
  // difese compaiono senza aspettare il prossimo cron.
  const senzaBersaglio = buono && !corrente.bersaglio && Array.isArray(isole) && isole.length > 0;
  if (buono && !senzaBersaglio) {
    return { dungeon: corrente, daPubblicare: false };
  }
  return { dungeon: genera(tipo, periodo, isole), daPubblicare: true };
}

// --- lo stato condiviso (come atlante-core: il DO persiste, qui si vive) ---
// un dungeon per tipo, concorrenti: il giocatore può avere in mare sia il
// bersaglio del giorno sia quello della settimana.
const correnti = { giornaliero: null, settimanale: null };

function valida(d) {
  return !!(d && typeof d.tipo === 'string' && typeof d.periodo === 'number' &&
    typeof d.nome === 'string' && Array.isArray(d.tappe) &&
    d.tappe.length >= 1 && d.tappe.length <= 5 &&
    d.tappe.every(t => t && typeof t.tipo === 'string' && (t.n | 0) >= 1 && typeof t.desc === 'string'));
}

function setDungeon(tipo, d) {
  if (valida(d) && d.tipo === tipo) correnti[tipo] = d;
  else if (d === null) correnti[tipo] = null;
}
function getDungeon(tipo) { return correnti[tipo] || null; }
function getDungeoni() { return { giornaliero: correnti.giornaliero, settimanale: correnti.settimanale }; }

// compat #3/#36: la "campagna" è il dungeon SETTIMANALE (progresso tracciato).
function getCampagna() { return correnti.settimanale; }
function setCampagna(c) { setDungeon('settimanale', c); }

module.exports = {
  genera, assicura, applicaVestito, valida, bersagli, BERSAGLI_NOTI,
  settimanaDi, giornoDi, periodoDi, scadenzaDi,
  DIFFICOLTA, LISTINO, PREMIO, difficoltaValida, premioPer, difeseValide,
  setDungeon, getDungeon, getDungeoni, getCampagna, setCampagna,
  hashStr, mulberry32, // il seme del calendario, riusato dalle giornaliere
};
