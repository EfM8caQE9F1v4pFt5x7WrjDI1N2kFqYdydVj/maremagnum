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
};

// La scala comune sale fino al mortaio; il quinto gradino dipende dal varo.
const TIER_ORDER = ['colubrina', 'cannone', 'carronata', 'mortaio'];
const EXCLUSIVES = { goletta: 'lunga', guerra: 'pesante', galeone: 'organo' };
const MAX_WEAPON_LVL = 3;

// Gruppi di fuoco e slot: base → massimo. Anche gli slot sono esponenziali:
// ogni bocca in più sulla fiancata costa ×2.5 della precedente.
const GROUPS = {
  left: { base: 1, max: 5, slotCosts: [null, 200, 500, 1250, 3125] },
  right: { base: 1, max: 5, slotCosts: [null, 200, 500, 1250, 3125] },
  bow: { base: 0, max: 2, slotCosts: [400, 1200] },
  stern: { base: 0, max: 2, slotCosts: [400, 1200] },
};

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
  const i = TIER_ORDER.indexOf(type);
  if (i >= 0 && i < TIER_ORDER.length - 1) return TIER_ORDER[i + 1];
  // sopra il mortaio c'è solo l'esclusiva del proprio tipo di nave
  return type === 'mortaio' ? EXCLUSIVES[tipo] || null : null;
}

function slotCost(group, currentCount) {
  const g = GROUPS[group];
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

// Valida (e ripara) i mount arrivati da un profilo client: mai fidarsi.
// Le armi esclusive passano solo se il tipo di nave è quello giusto.
function sanitizeMounts(m, tipo) {
  const out = defaultMounts();
  if (!m || typeof m !== 'object') return out;
  for (const g of Object.keys(GROUPS)) {
    if (!Array.isArray(m[g])) continue;
    const list = m[g].slice(0, GROUPS[g].max)
      .filter(w => w && TYPES[w.type] && (!TYPES[w.type].tipo || TYPES[w.type].tipo === tipo))
      .map(w => ({ type: w.type, lvl: Math.min(MAX_WEAPON_LVL, Math.max(1, w.lvl | 0)) }));
    if (list.length >= GROUPS[g].base) out[g] = list;
  }
  return out;
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
  TYPES, TIER_ORDER, EXCLUSIVES, MAX_WEAPON_LVL, GROUPS,
  weaponStats, upgradeCost, nextTier, slotCost, defaultMounts, sanitizeMounts,
  weaponValue, fleetValue, publicConfig,
};
