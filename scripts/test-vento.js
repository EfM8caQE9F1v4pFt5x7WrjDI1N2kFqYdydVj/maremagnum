'use strict';

// Il vento che governa (issue #41, prima fetta): deterministico dall'orologio,
// liscio nel tempo, mai bonaccia, morso entro il ±15%; in move() spinge o
// frena OGNI scafo (NPC compresi) e viaggia nello snapshot col campo vn.

const assert = require('assert');
const vento = require('../server/vento');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = (inbox) => ({ send(s) { if (inbox) inbox.push(JSON.parse(s)); }, readyState: 1 });
const TICK = 1 / 30;

// — 1) determinismo: stesso istante → stesso vento, su qualunque macchina —
const t0 = 1780000000000; // un istante qualsiasi, fisso
const v1 = vento.ventoAl(t0);
const v2 = vento.ventoAl(t0);
assert.deepStrictEqual(v1, v2, 'stesso istante, stesso vento');
const b7 = vento.bersaglio(7);
assert.deepStrictEqual(vento.bersaglio(7), b7, 'stesso periodo, stesso bersaglio');
ok('determinismo: il vento è dell\'orologio, non del caso');

// — 2) i limiti: forza mai sotto FORZA_MIN, direzione normalizzata —
for (let i = 0; i < 500; i++) {
  const v = vento.ventoAl(t0 + i * 7919 * 1000); // istanti sparsi
  assert(v.forza >= vento.FORZA_MIN - 1e-9 && v.forza <= 1 + 1e-9, `forza fuori scala: ${v.forza}`);
  assert(v.dir >= 0 && v.dir < 2 * Math.PI + 1e-9, `direzione fuori giro: ${v.dir}`);
}
ok(`limiti: forza in [${vento.FORZA_MIN}, 1], mai bonaccia totale`);

// — 3) liscio come l'olio: tra un tick e l'altro niente scatti —
for (let i = 0; i < 2000; i++) {
  const a = vento.ventoAl(t0 + i * 100);
  const b = vento.ventoAl(t0 + (i + 1) * 100);
  let dd = Math.abs(b.dir - a.dir);
  if (dd > Math.PI) dd = 2 * Math.PI - dd;
  assert(dd < 0.05, `la direzione scatta (${dd} rad in 100ms)`);
  assert(Math.abs(b.forza - a.forza) < 0.02, 'la forza scatta');
}
ok('continuità: il vento ruota, non salta');

// — 4) ma nel giro di qualche periodo il vento CAMBIA davvero —
let ruota = 0;
for (let n = 0; n < 12; n++) {
  const a = vento.bersaglio(n), b = vento.bersaglio(n + 1);
  let dd = Math.abs(b.dir - a.dir);
  if (dd > Math.PI) dd = 2 * Math.PI - dd;
  ruota = Math.max(ruota, dd);
}
assert(ruota > 0.5, 'in dodici periodi il vento non ha mai girato: che mare piatto');
ok('vivacità: da un periodo all\'altro si cambia andatura');

// — 5) il morso: poppa +15%, bolina −15%, traverso neutro (tetto #11) —
const pieno = { dir: 0, forza: 1 };
assert(Math.abs(vento.fattore(pieno, 0) - (1 + vento.MORSO)) < 1e-9, 'poppa piena');
assert(Math.abs(vento.fattore(pieno, Math.PI) - (1 - vento.MORSO)) < 1e-9, 'bolina piena');
assert(Math.abs(vento.fattore(pieno, Math.PI / 2) - 1) < 1e-9, 'traverso neutro');
for (let i = 0; i < 100; i++) {
  const f = vento.fattore(vento.ventoAl(t0 + i * 31337 * 1000), i * 0.7);
  assert(f >= 1 - vento.MORSO - 1e-9 && f <= 1 + vento.MORSO + 1e-9, `morso oltre il ±15%: ${f}`);
}
assert(vento.MORSO <= 0.20 + 1e-9, 'il tetto di #11 (±20%) è legge');
ok(`morso: ±${vento.MORSO * 100}% a piena forza, dentro il tetto #11`);

// — 6) in mare: la stessa nave corre di più in poppa che di bolina —
const etere = []; // il broadcast del mare finisce qui
const game = new Game((m) => etere.push(m));
game.pausa();
const inA = [];
const A = game.join(conn(inA), { t: 'join', name: 'Eolo', profile: { gold: 0 } });
A.docked = null;

// un punto d'acqua libera: lontano da ogni isola, o la collisione
// strozzerebbe la velocità (vel *= 0.4) falsando la misura
let px = 0, py = 0;
cerca: for (let x = 200; x < 5800; x += 137) {
  for (let y = 200; y < 5800; y += 211) {
    if (game.archipelago.list().every(i => Math.hypot(x - i.x, y - i.y) > i.r + 250)) { px = x; py = y; break cerca; }
  }
}
assert(px > 0, 'nessuna acqua libera trovata: il mare è tutto isole?');

const velAsintotica = (ship, rot) => {
  game.vento = { dir: 0, forza: 1 }; // vento di levante, teso come una sartia
  ship.rot = rot; ship.vel = 0; ship.x = px; ship.y = py;
  ship.input = { up: true, down: false, left: false, right: false };
  for (let i = 0; i < 300; i++) { game.move(ship, TICK); ship.x = px; ship.y = py; }
  return ship.vel;
};
const inPoppa = velAsintotica(A, 0);
const diBolina = velAsintotica(A, Math.PI);
assert(inPoppa > diBolina * 1.2, `in poppa (${inPoppa.toFixed(1)}) non stacca la bolina (${diBolina.toFixed(1)})`);
const base = 135 + A.sailsLvl * 20; // goletta non varata: speedMul 1
assert(Math.abs(inPoppa - base * 1.15) < 3, `poppa attesa ~${base * 1.15}, misurata ${inPoppa.toFixed(1)}`);
assert(Math.abs(diBolina - base * 0.85) < 3, `bolina attesa ~${base * 0.85}, misurata ${diBolina.toFixed(1)}`);
ok(`in mare: poppa ${inPoppa.toFixed(0)} px/s vs bolina ${diBolina.toFixed(0)} px/s (±15%)`);

// — 7) anche gli NPC sono velieri: il vento non li dimentica —
const merc = [...game.ships.values()].find(s => s.npc === 'merc');
assert(merc, 'un mercantile in mare c\'è sempre');
const mPoppa = velAsintotica(merc, 0);
const mBolina = velAsintotica(merc, Math.PI);
assert(Math.abs(mPoppa - 75 * 1.15) < 3, `mercantile in poppa: atteso ~${75 * 1.15}, misurato ${mPoppa.toFixed(1)}`);
assert(Math.abs(mBolina - 75 * 0.85) < 3, `mercantile di bolina: atteso ~${75 * 0.85}, misurato ${mBolina.toFixed(1)}`);
ok('NPC: le velocità fisse dei mercantili sentono il vento come tutti');

// — 8) lo snapshot porta il vento: campo additivo vn = [dir, forza] —
game.vento = { dir: 1.23, forza: 0.87 };
game.sendSnapshot();
const snap = [...etere].reverse().find(m => m.t === 'snap');
assert(snap && Array.isArray(snap.vn), 'lo snap ha il campo vn');
assert(Math.abs(snap.vn[0] - 1.23) < 0.01 && Math.abs(snap.vn[1] - 0.87) < 0.01, 'vn = [dir, forza] arrotondati');
ok('protocollo: vn viaggia nello snapshot, additivo come i fumogeni');

game.stop();
console.log('VENTO OK 🌬');
