'use strict';

// L'arsenale: tipi d'arma, slot della nave, prezzi. Unica fonte di verità —
// il client riceve questo catalogo nel welcome, i prezzi li fa rispettare il server.

const TYPES = {
  colubrina: { name: 'Colubrina', tier: 1, dmg: 8, range: 270, reload: 2.0, speed: 430, cost: 120, upDmg: 3, upRange: 25, upReload: -0.15 },
  cannone: { name: 'Cannone da 24', tier: 2, dmg: 16, range: 330, reload: 2.3, speed: 460, cost: 360, upDmg: 5, upRange: 30, upReload: -0.15 },
  carronata: { name: 'Carronata', tier: 3, dmg: 34, range: 230, reload: 2.6, speed: 400, cost: 1080, upDmg: 9, upRange: 20, upReload: -0.2 },
  mortaio: { name: 'Mortaio', tier: 4, dmg: 28, range: 500, reload: 4.2, speed: 250, cost: 3240, aoe: 70, arc: true, upDmg: 8, upRange: 45, upReload: -0.3 },
  // il quinto gradino è l'ESCLUSIVA del tipo di nave: tre side-grade con
  // profili opposti (spilli da lontano / mazzata da vicino / grandine media)
  organo: { name: 'Organo di Da Vinci', tier: 5, dmg: 9, range: 350, reload: 1.3, speed: 480, cost: 9700, burst: 3, upDmg: 3, upRange: 30, upReload: -0.1, tipo: 'galeone' },
  lunga: { name: 'Colubrina Lunga', tier: 5, dmg: 14, range: 560, reload: 2.2, speed: 560, cost: 9700, upDmg: 4, upRange: 40, upReload: -0.1, tipo: 'goletta' },
  pesante: { name: 'Carronata Pesante', tier: 5, dmg: 62, range: 210, reload: 3.0, speed: 380, cost: 9700, upDmg: 14, upRange: 15, upReload: -0.2, tipo: 'guerra' },
  // l'esclusiva dello Sciabecco (issue #11): pressione costante in corsa —
  // metà del dps di organo/pesante, ma spara mentre sfrecci
  falconetto: { name: 'Falconetto a Ripetizione', tier: 5, dmg: 9, range: 300, reload: 0.9, speed: 500, cost: 9700, upDmg: 2, upRange: 25, upReload: -0.08, tipo: 'sciabecco' },
};

// La scala comune sale fino al mortaio; il quinto gradino dipende dal varo.
const TIER_ORDER = ['colubrina', 'cannone', 'carronata', 'mortaio'];
const EXCLUSIVES = { goletta: 'lunga', guerra: 'pesante', galeone: 'organo', sciabecco: 'falconetto' };
const MAX_WEAPON_LVL = 3;

// La matrice del legno (issue #11, tappa 2): non tutto sta su tutte.
// Goletta e sciabecco non reggono la carronata (la scala la SALTA).
const VIETATE = { goletta: ['carronata'], sciabecco: ['carronata'] };

// Gruppi di fuoco e slot: base → massimo. Anche gli slot sono esponenziali:
// ogni bocca in più sulla fiancata costa ×2.5 della precedente.
const GROUPS = {
  left: { base: 1, max: 5, slotCosts: [null, 200, 500, 1250, 3125] },
  right: { base: 1, max: 5, slotCosts: [null, 200, 500, 1250, 3125] },
  bow: { base: 0, max: 2, slotCosts: [400, 1200] },
  stern: { base: 0, max: 2, slotCosts: [400, 1200] },
};

// …e nemmeno gli SLOT sono uguali per tutti: la goletta punge di prua, il
// galeone rinuncia agli assiali per fiancate piene, lo sciabecco corre e
// spara in fuga. Gli slot già comprati oltre i tetti nuovi restano
// (grandfathering): sono infrastruttura pagata, non armi.
const GRUPPI_TIPO = {
  goletta: {
    left: { max: 4 }, right: { max: 4 },
    bow: { max: 3, slotCosts: [400, 1200, 3000] },
  },
  galeone: {
    left: { max: 6, slotCosts: [null, 200, 500, 1250, 3125, 7800] },
    right: { max: 6, slotCosts: [null, 200, 500, 1250, 3125, 7800] },
    bow: { max: 0, slotCosts: [] }, stern: { max: 0, slotCosts: [] },
  },
  sciabecco: {
    left: { max: 3 }, right: { max: 3 },
    bow: { max: 3, slotCosts: [400, 1200, 3000] },
    stern: { max: 3, slotCosts: [400, 1200, 3000] },
  },
};

// il tetto assoluto fra tutti i tipi: nulla si tronca in silenzio ai join
const MAX_ASSOLUTO = { left: 6, right: 6, bow: 3, stern: 3 };

function groupsPer(tipo) {
  const out = {};
  for (const g of Object.keys(GROUPS)) {
    out[g] = { ...GROUPS[g], ...((GRUPPI_TIPO[tipo] || {})[g] || {}) };
  }
  return out;
}

// Statistiche effettive di un'arma {type, lvl}.
function weaponStats(w) {
  const t = TYPES[w.type];
  const k = w.lvl - 1;
  return {
    dmg: t.dmg + t.upDmg * k,
    range: t.range + t.upRange * k,
    reload: Math.max(0.5, t.reload + t.upReload * k),
    speed: t.speed,
    aoe: t.aoe || 0,
    arc: !!t.arc,
    burst: t.burst || 1,
  };
}

// Prezzi ESPONENZIALI dappertutto: ogni gradino costa il doppio del
// precedente (i tier d'arma triplicano già da catalogo: 120→360→1080→…).
function upgradeCost(w) {
  return w.lvl >= MAX_WEAPON_LVL ? null : Math.round(TYPES[w.type].cost * 0.5 * 2 ** (w.lvl - 1));
}

function nextTier(type, tipo) {
  const vietate = VIETATE[tipo] || [];
  const i = TIER_ORDER.indexOf(type);
  if (i >= 0) {
    // la scala SALTA i gradini che il legno non regge (issue #11)
    for (let j = i + 1; j < TIER_ORDER.length; j++) {
      if (!vietate.includes(TIER_ORDER[j])) return TIER_ORDER[j];
    }
    return EXCLUSIVES[tipo] || null;
  }
  return null;
}

function slotCost(group, currentCount, tipo) {
  const g = groupsPer(tipo)[group];
  if (!g || currentCount >= g.max) return null;
  return g.slotCosts[currentCount];
}

function defaultMounts() {
  return {
    left: [{ type: 'colubrina', lvl: 1 }],
    right: [{ type: 'colubrina', lvl: 1 }],
    bow: [],
    stern: [],
  };
}

// Valida (e ripara) i mount E fa i conti: le armi che il tipo non regge più
// per una regola nuova (vietate della matrice, gruppi a tetto zero) si
// RISCATTANO al prezzo pieno pagato — mai confische, precedente del varo.
// Le esclusive di un ALTRO tipo invece si riscattano solo da fonte FIDATA
// (il varo, dove erano possedute legalmente): da un profilo client sono
// contrabbando, e il contrabbando si rifiuta, non si compra. Gli slot di un
// gruppo perso si riscattano anch'essi; gli slot oltre i tetti nuovi negli
// altri gruppi restano (grandfathering, tetto assoluto a monte).
function sanitizeConRiscatto(m, tipo, fidato) {
  const out = defaultMounts();
  let riscatto = 0;
  const tolte = [];
  if (!m || typeof m !== 'object') return { mounts: out, riscatto, tolte };
  const vietate = VIETATE[tipo] || [];
  const gruppi = groupsPer(tipo);
  const contrabbando = w => !fidato && TYPES[w.type].tipo && TYPES[w.type].tipo !== tipo;
  for (const g of Object.keys(GROUPS)) {
    if (!Array.isArray(m[g])) continue;
    const grezzi = m[g].slice(0, MAX_ASSOLUTO[g]).filter(w => w && TYPES[w.type])
      .map(w => ({ type: w.type, lvl: Math.min(MAX_WEAPON_LVL, Math.max(1, w.lvl | 0)) }));
    if (gruppi[g].max === 0) {
      // il tipo non regge il gruppo: armi E slot riscattati
      for (const w of grezzi) {
        if (contrabbando(w)) continue;
        riscatto += weaponValue(w);
        tolte.push(TYPES[w.type].name);
      }
      const costi = GROUPS[g].slotCosts;
      for (let i = GROUPS[g].base; i < grezzi.length; i++) riscatto += costi[i] ?? costi[costi.length - 1] ?? 0;
      out[g] = [];
      continue;
    }
    const list = grezzi.map(w => {
      const t = TYPES[w.type];
      if ((t.tipo && t.tipo !== tipo) || vietate.includes(w.type)) {
        if (!contrabbando(w)) { riscatto += weaponValue(w); tolte.push(t.name); }
        return { type: 'colubrina', lvl: 1 };
      }
      return w;
    });
    if (list.length >= GROUPS[g].base) out[g] = list;
  }
  return { mounts: out, riscatto, tolte };
}

function sanitizeMounts(m, tipo) {
  return sanitizeConRiscatto(m, tipo).mounts;
}

// Prezzo totale pagato per un'arma {type, lvl}: catalogo più potenziamenti.
function weaponValue(w) {
  let v = TYPES[w.type].cost;
  for (let l = 1; l < w.lvl; l++) v += Math.round(TYPES[w.type].cost * 0.5 * 2 ** (l - 1));
  return v;
}

// Prezzo totale speso in un set di mount (per la taglia proporzionale al valore).
function fleetValue(mounts) {
  let v = 0;
  for (const g of Object.keys(GROUPS)) {
    for (const w of mounts[g] || []) v += weaponValue(w);
  }
  return v;
}

// Catalogo pubblico per il client (welcome).
function publicConfig() {
  return { types: TYPES, tierOrder: TIER_ORDER, maxLvl: MAX_WEAPON_LVL, groups: GROUPS };
}

module.exports = {
  TYPES, TIER_ORDER, EXCLUSIVES, MAX_WEAPON_LVL, GROUPS, VIETATE, GRUPPI_TIPO, MAX_ASSOLUTO,
  weaponStats, upgradeCost, nextTier, slotCost, defaultMounts, sanitizeMounts, sanitizeConRiscatto, groupsPer,
  weaponValue, fleetValue, publicConfig,
};
