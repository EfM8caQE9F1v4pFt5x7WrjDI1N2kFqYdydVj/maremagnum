'use strict';

// Le munizioni e la rastrellata (issue #41, fetta 2): tre proiettili a scelta
// (palle piene, catene che tagliano le vele, mitraglia che falcidia la ciurma),
// debuff temporanei che si rinfrescano senza sommarsi, il mortaio che spara
// sempre palle, gli NPC sempre a palle — e il colpo nel settore di poppa che
// morde una volta e mezza. Tutto code-owned, tutto entro i paletti.

const assert = require('assert');
const { Game } = require('../server/game');
const W = require('../server/weapons');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = (inbox) => ({ send(s) { if (inbox) inbox.push(JSON.parse(s)); }, readyState: 1 });
const TICK = 1 / 30;
const ultimo = (inbox, t) => [...inbox].reverse().find(m => m.t === t) || null;

const etere = [];
const game = new Game((m) => etere.push(m));
game.pausa();
game.vento = { dir: 0, forza: 0 }; // bonaccia da laboratorio: fattore vento 1

const inA = [], inB = [];
const A = game.join(conn(inA), { t: 'join', name: 'Artigliere', profile: { gold: 0 } });
const B = game.join(conn(inB), { t: 'join', name: 'Bersaglio', profile: { gold: 0 } });
for (const s of [A, B]) { s.graceUntil = 0; s.docked = null; }

// un punto d'acqua libera per il duello (le isole strozzano vel e shot)
let px = 0, py = 0;
cerca: for (let x = 200; x < 5800; x += 137) {
  for (let y = 200; y < 5800; y += 211) {
    if (game.archipelago.list().every(i => Math.hypot(x - i.x, y - i.y) > i.r + 300)) { px = x; py = y; break cerca; }
  }
}
assert(px > 0, 'nessuna acqua libera trovata');

// piazza l'Artigliere a nord, prua a est: la fiancata destra guarda a sud
const schiera = (rotB) => {
  A.x = px; A.y = py; A.rot = 0; A.vel = 0;
  B.x = px; B.y = py + 60; B.rot = rotB; B.vel = 0; B.hp = 100;
  B.veleTagliateUntil = 0; B.falcidiaUntil = 0; B.immuneUntil = 0;
  A.ready = { left: [0], right: [0], bow: [], stern: [] };
  game.shots.clear();
};
const spara = () => {
  game.fire(A, 'right');
  for (let i = 0; i < 30 && game.shots.size; i++) game.moveShots(TICK);
};

// — 1) lo switch: valido con ack, invalido ignorato, NPC mai —
game.handle(A, { t: 'munizione', tipo: 'catene' });
assert.strictEqual(A.munizione, 'catene', 'lo switch passa');
const ack = ultimo(inA, 'munizione');
assert(ack && ack.tipo === 'catene', 'l\'ack fa fede');
game.handle(A, { t: 'munizione', tipo: 'razzi' });
assert.strictEqual(A.munizione, 'catene', 'il tipo ignoto è respinto');
ok('switch: ack per il tipo valido, silenzio per l\'ignoto');

// — 2) le catene: volano corte, mordono poco, TAGLIANO LE VELE —
schiera(0); // B di fianco: bearing del colpo ~nord, poppa a ovest → NIENTE rastrellata
spara();
const salvaCatene = [...etere].reverse().find(m => m.t === 'shots');
assert(salvaCatene && salvaCatene.shots[0].mn === 'catene', 'lo shot dichiara la catena (campo mn)');
const attesoTtl = (270 * W.MUNIZIONI.catene.range) / (430 * W.MUNIZIONI.catene.speed);
assert(Math.abs(salvaCatene.shots[0].ttl - attesoTtl) < 0.05, `gittata delle catene (ttl ${salvaCatene.shots[0].ttl} vs ${attesoTtl.toFixed(2)})`);
const morso = 100 - B.hp;
assert(Math.abs(morso - 8 * W.MUNIZIONI.catene.dmg) < 0.01, `morso da catene: ${morso} (atteso ${8 * W.MUNIZIONI.catene.dmg})`);
assert(B.veleTagliateUntil > game.now, 'vele tagliate: il debuff è acceso');
ok('catene: gittata corta, morso lieve, vele tagliate');

// — 3) le vele tagliate FRENANO: −25% sull'andatura, poi si riparano da sole —
const velA = (ship) => {
  ship.rot = 0; ship.vel = 0; ship.x = px; ship.y = py;
  ship.input = { up: true, down: false, left: false, right: false };
  for (let i = 0; i < 300; i++) { game.move(ship, TICK); ship.x = px; ship.y = py; }
  return ship.vel;
};
B.veleTagliateUntil = game.now + 999;
const conTaglio = velA(B);
B.veleTagliateUntil = 0;
const senzaTaglio = velA(B);
assert(Math.abs(conTaglio - senzaTaglio * W.MUNIZIONI.catene.taglia.malus) < 2,
  `taglio: ${conTaglio.toFixed(1)} vs ${senzaTaglio.toFixed(1)}×${W.MUNIZIONI.catene.taglia.malus}`);
B.input = { up: false, down: false, left: false, right: false };
ok(`vele tagliate: ${conTaglio.toFixed(0)} px/s contro ${senzaTaglio.toFixed(0)} (−25%)`);

// — 4) la mitraglia FALCIDIA: chi la incassa ricarica piano —
schiera(0);
game.handle(A, { t: 'munizione', tipo: 'mitraglia' });
spara();
assert(B.falcidiaUntil > game.now, 'ciurma falcidiata: il debuff è acceso');
assert(B.veleTagliateUntil <= game.now, 'la mitraglia non taglia le vele');
// e ora B, falcidiato, spara: la sua ricarica si allunga del malus
B.mounts.right = [{ type: 'colubrina', lvl: 1 }];
B.ready = { left: [0], right: [0], bow: [], stern: [] };
game.fire(B, 'right');
const attesa = B.ready.right[0] - game.now;
const base = 2.0 * (1 - 0.07 * B.crewLvl);
assert(Math.abs(attesa - base * W.MUNIZIONI.mitraglia.falcidia.malus) < 0.01,
  `ricarica falcidiata: ${attesa.toFixed(2)}s (base ${base}s)`);
ok(`mitraglia: ciurma falcidiata, ricarica ${attesa.toFixed(1)}s invece di ${base.toFixed(1)}s`);

// — 5) la rastrellata: il colpo in poppa morde ×1.5 (e lo annuncia) —
schiera(Math.PI / 2); // B prua a sud: la poppa guarda il colpo che scende da nord
game.handle(A, { t: 'munizione', tipo: 'palle' });
game.fxQueue.length = 0;
spara();
assert(Math.abs((100 - B.hp) - 8 * 1.5) < 0.01, `rastrellata: −${100 - B.hp} hp (atteso 12)`);
assert(game.fxQueue.some(f => f.k === 'rast'), 'il morso dorato si vede (fx rast)');
// controprova: colpo di fianco (test 2) faceva danno pieno semplice — e le
// torri non rastrellano: un colpo di fortezza in poppa resta normale
schiera(Math.PI / 2);
game.shots.clear();
game.spawnShot('fort:porto', B.x, B.y - 40, Math.PI / 2, { speed: 430, range: 270, dmg: 8 });
for (let i = 0; i < 30 && game.shots.size; i++) game.moveShots(TICK);
assert(Math.abs((100 - B.hp) - 8) < 0.01, `la torre non rastrella: −${100 - B.hp} hp`);
ok('rastrellata: poppa ×1.5 con fx, fianchi e torri no');

// — 6) il mortaio non si incatena: da bombarda, spara sempre palle —
schiera(0);
game.handle(A, { t: 'munizione', tipo: 'catene' });
A.mounts.right = [{ type: 'mortaio', lvl: 1 }];
A.ready = { left: [0], right: [0], bow: [], stern: [] };
game.fire(A, 'right');
const salvaMortaio = [...etere].reverse().find(m => m.t === 'shots');
assert(salvaMortaio.shots[0].arc === 1 && !salvaMortaio.shots[0].mn, 'il mortaio vola ad arco e senza catene');
assert(Math.abs(salvaMortaio.shots[0].ttl - 500 / 250) < 0.05, 'gittata piena: la munizione non lo tocca');
game.shots.clear();
A.mounts.right = [{ type: 'colubrina', lvl: 1 }];
ok('mortaio: sempre palle, gittata piena');

// — 7) gli immuni non si menomano: né danno né debuff —
schiera(0);
B.immuneUntil = game.now + 999;
game.handle(A, { t: 'munizione', tipo: 'catene' });
spara();
assert(B.hp === 100 && B.veleTagliateUntil <= game.now, 'l\'immunità para anche i debuff');
ok('immunità: il colpo scivola, il debuff pure');

// — 8) gli NPC sparano SEMPRE palle, qualunque cosa dica il loro campo —
const ghost = [...game.ships.values()].find(s => s.npc === 'ghost');
assert(ghost && ghost.munizione === 'palle', 'il Fantasma nasce a palle');
ghost.munizione = 'catene'; // nessun messaggio può farlo, ma la guardia regge lo stesso
ghost.ready = { left: [0], right: [0], bow: [], stern: [] };
game.fire(ghost, 'right');
const salvaGhost = [...etere].reverse().find(m => m.t === 'shots');
assert(salvaGhost && !salvaGhost.shots[0].mn, 'il Fantasma spara palle comunque');
ghost.munizione = 'palle';
game.shots.clear();
ok('NPC: mercantili e fantasmi non conoscono le catene');

// — 9) lo snapshot porta i debuff: vt e cf additivi, in secondi —
B.immuneUntil = 0;
B.veleTagliateUntil = game.now + 3;
B.falcidiaUntil = game.now + 4;
game.sendSnapshot();
const snap = [...etere].reverse().find(m => m.t === 'snap');
const sb = snap.ships.find(s => s.id === B.id);
const sa = snap.ships.find(s => s.id === A.id);
assert(sb && Math.abs(sb.vt - 3) < 0.1 && Math.abs(sb.cf - 4) < 0.1, 'vt/cf sul menomato');
assert(sa && sa.vt === undefined && sa.cf === undefined, 'niente campi su chi è sano');
ok('protocollo: vt/cf additivi nello snapshot');

game.stop();
console.log('MUNIZIONI OK ⚫⛓☠');
