'use strict';

// Burrasche vaganti e notte tattica (issue #41, fetta 5): le tempeste sono
// del MARE (deterministiche dall'orologio, come il vento), dentro si naviga
// a vento pieno e si spara corto; di notte il bottino rende di più e i
// fantasmi cacciano più larghi — rischio E ricompensa, mai solo penalità.

const assert = require('assert');
const vento = require('../server/vento');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = (inbox) => ({ send(s) { if (inbox) inbox.push(JSON.parse(s)); }, readyState: 1 });
const TICK = 1 / 30;

// — 1) le burrasche sono dell'orologio: stesse, lisce, dentro il mondo —
const t0 = 1780000000000;
assert.deepStrictEqual(vento.burrascheAl(t0), vento.burrascheAl(t0), 'stesso istante, stesse tempeste');
assert.strictEqual(vento.burrascheAl(t0).length, vento.BURRASCHE.n, 'due burrasche, sempre');
for (let i = 0; i < 1500; i++) {
  const a = vento.burrascheAl(t0 + i * 200), b = vento.burrascheAl(t0 + (i + 1) * 200);
  for (let k = 0; k < a.length; k++) {
    assert(Math.hypot(b[k].x - a[k].x, b[k].y - a[k].y) < 25, 'la tempesta deriva, non teletrasporta');
    assert(a[k].x > 500 && a[k].x < 5500 && a[k].y > 500 && a[k].y < 5500, 'dentro il mondo');
  }
}
ok('burrasche: deterministiche, lisce, nel mondo');

// — 2) dentro la burrasca il vento morde a forza PIENA —
const etere = [];
const game = new Game((m) => etere.push(m));
game.pausa();
const inP = [];
const P = game.join(conn(inP), { t: 'join', name: 'Tempestoso', profile: { gold: 0 } });
P.graceUntil = 0; P.docked = null;

let px = 0, py = 0;
cerca: for (let x = 200; x < 5800; x += 137) {
  for (let y = 200; y < 5800; y += 211) {
    if (game.archipelago.list().every(i => Math.hypot(x - i.x, y - i.y) > i.r + 300)) { px = x; py = y; break cerca; }
  }
}
const velA = (dentro) => {
  game.vento = { dir: 0, forza: 0.5 };
  game.burrasche = dentro ? [{ x: px, y: py, r: 600 }] : [];
  P.rot = 0; P.vel = 0; P.x = px; P.y = py;
  P.input = { up: true, down: false, left: false, right: false };
  for (let i = 0; i < 300; i++) { game.move(P, TICK); P.x = px; P.y = py; }
  return P.vel;
};
const fuori = velA(false); // poppa a mezza forza: 135 × 1.075
const dentro = velA(true); // poppa a forza piena: 135 × 1.15
assert(Math.abs(fuori - 135 * 1.075) < 2, `fuori: ${fuori.toFixed(1)} (atteso ~145)`);
assert(Math.abs(dentro - 135 * 1.15) < 2, `dentro: ${dentro.toFixed(1)} (atteso ~155)`);
P.input = { up: false, down: false, left: false, right: false };
ok(`vento in tempesta: ${fuori.toFixed(0)} px/s fuori, ${dentro.toFixed(0)} dentro (forza piena)`);

// — 3) nella pioggia le palle volano corte: gittata ×0.7 —
P.x = px; P.y = py;
P.mounts.right = [{ type: 'colubrina', lvl: 1 }];
P.ready = { left: [0], right: [0], bow: [], stern: [] };
game.burrasche = [];
game.fire(P, 'right');
const asciutto = [...etere].reverse().find(m => m.t === 'shots').shots[0].ttl;
game.burrasche = [{ x: px, y: py, r: 600 }];
P.ready = { left: [0], right: [0], bow: [], stern: [] };
game.fire(P, 'right');
const bagnato = [...etere].reverse().find(m => m.t === 'shots').shots[0].ttl;
assert(Math.abs(bagnato / asciutto - vento.BURRASCHE.gittata) < 0.02,
  `gittata in tempesta: ${bagnato}/${asciutto}`);
ok(`palle corte sotto la pioggia: gittata ×${vento.BURRASCHE.gittata}`);

// — 4) lo snapshot porta le tempeste: campo additivo br —
game.sendSnapshot();
const snap = [...etere].reverse().find(m => m.t === 'snap');
assert(Array.isArray(snap.br) && snap.br.length === 1 && snap.br[0][2] === 600, 'br = [[x,y,r]]');
ok('protocollo: br nello snapshot');

// — 5) la notte del server: stessa finestra del ciclo client —
const giorno = Math.floor(game.now / 480) * 480;
game.now = giorno + 0.25 * 480;
assert(!game.eNotte(), 'a mezzogiorno è giorno');
game.now = giorno + 0.8 * 480;
assert(game.eNotte(), 'a t=0.8 è notte fonda');
ok('eNotte: il server conosce il ciclo di 8 minuti');

// — 6) il bottino notturno rende una volta e mezza —
const merc = [...game.ships.values()].find(s => s.npc === 'merc' && !s.convoglio);
const saccheggia = () => {
  merc.resaUntil = game.now + 10; merc.saccheggiato = false; merc.resaCooldownUntil = 0;
  P.x = merc.x + 10; P.y = merc.y;
  const prima = P.gold;
  game.tickResa();
  return P.gold - prima;
};
game.now = giorno + 0.25 * 480;
assert.strictEqual(saccheggia(), 150, 'di giorno il listino');
game.now = giorno + 0.8 * 480;
assert.strictEqual(saccheggia(), 225, 'di notte una volta e mezza');
ok('bottino notturno: 150 di giorno, 225 di notte');

// — 7) di notte i fantasmi cacciano più larghi (520 → 650) —
const ghost = [...game.ships.values()].find(s => s.npc === 'ghost' && !s.convoglio && !s.caccia);
const provaCaccia = (t) => {
  game.now = giorno + t * 480;
  ghost.x = px; ghost.y = py; ghost.wp = null; ghost.fleeUntil = 0; ghost.hp = 320;
  P.x = px + 600; P.y = py; P.graceUntil = 0;
  game.smokes.length = 0;
  ghost.input = { up: false, down: false, left: false, right: false };
  game.steerGhost(ghost);
  // se vagabonda ha scelto un waypoint; se caccia il waypoint resta nullo
  return ghost.wp === null;
};
assert(!provaCaccia(0.25), 'di giorno a 600 leghe non ti vede');
assert(provaCaccia(0.8), 'di notte a 600 leghe ti fiuta');
ok('fantasmi notturni: la caccia si allarga a 650');

game.stop();
console.log('METEO E NOTTE OK ⛈🌙');
