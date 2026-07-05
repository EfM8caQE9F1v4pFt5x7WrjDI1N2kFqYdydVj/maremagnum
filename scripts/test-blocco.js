'use strict';

// L'economia del blocco (issue #15), messa alla prova senza rete e senza
// timer: due capitani, un colpo di grazia, e le tre strade del forziere —
// 25% subito, tocco→tutto l'in-gioco, timeout→75% e immunità.

const assert = require('assert');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = () => ({ send() {}, readyState: 1 });

const game = new Game(() => {});
game.pausa(); // niente timer: il tempo lo giriamo a mano col tick()

// — 1) il colpo di grazia fra capitani BLOCCA e preleva il 25% dell'in-gioco —
const A = game.join(conn(), { t: 'join', name: 'Predatore', profile: { gold: 500 } });
const B = game.join(conn(), { t: 'join', name: 'Vittima', profile: { gold: 1000, holdLvl: 2 } });
A.graceUntil = 0; B.graceUntil = 0;
game.damageShip(B, 9999, A.id);
assert(B.blockedUntil > game.now, 'la vittima non è bloccata');
assert(B.sunkUntil === 0, 'la vittima NON deve affondare al blocco');
assert.strictEqual(B.bloccoSalvo, 200, 'doppiofondo (Stiva 2) = 20% di 1000');
assert.strictEqual(B.gold, 800, 'alla vittima restano 1000 − 25% di 800 = 800');
assert.strictEqual(A.gold, 700, 'il predatore incassa subito 200 (25% dell\'in-gioco)');
assert.strictEqual(A.kills, 1, 'il kill si conta al blocco');
assert.strictEqual(B.deaths, 1, 'la morte si conta al blocco');
ok('blocco: 25% dell\'in-gioco subito, doppiofondo protetto, kill contati');

// — 2) il TOCCO del predatore prende tutto il resto dell'in-gioco —
A.x = B.x + 20; A.y = B.y; A.docked = null;
game.tick();
assert(B.sunkUntil > game.now, 'dopo l\'abbordaggio la vittima affonda');
assert.strictEqual(B.gold, 200, 'alla vittima resta solo il doppiofondo');
assert.strictEqual(A.gold, 1300, 'il predatore ha incassato anche il resto (600)');
assert.strictEqual(B.deaths, 1, 'l\'abbordaggio non conta una seconda morte');
ok('tocco: l\'arrembaggio v1 svuota il forziere in gioco (100%)');

// — 3) il TIMEOUT libera col 75% dell'in-gioco, mezza vita e immunità —
const C = game.join(conn(), { t: 'join', name: 'Paziente', profile: { gold: 1000, holdLvl: 2 } });
C.graceUntil = 0;
game.damageShip(C, 9999, A.id);
assert.strictEqual(C.gold, 800, 'al blocco parte il solito 25% dell\'in-gioco');
A.x = C.x + 3000; A.y = C.y + 1000; // il predatore si allontana: niente tocco
C.blockedUntil = game.now - 0.01;   // il tempo è scaduto (lo giriamo a mano)
game.tick();
assert(!C.blockedUntil, 'il blocco è sciolto');
assert(C.sunkUntil === 0, 'la vittima liberata NON affonda');
assert.strictEqual(C.gold, 800, 'liberata col 75% dell\'in-gioco + doppiofondo (800)');
assert(C.hp > 0 && C.immuneUntil > game.now, 'mezza vita e immunità al rientro');
ok('timeout: 75% dell\'in-gioco, mezza vita, immunità');

// — 4) l'immunità regge davvero: il colpo scivola in mare —
const hpPrima = C.hp;
game.damageShip(C, 50, A.id);
assert.strictEqual(C.hp, hpPrima, 'nave immune: nessun danno');
ok('immunità post-svincolo: i colpi scivolano in mare');

// — 5) gli NPC affondano come sempre (niente blocco, taglia fissa) —
const merc = [...game.ships.values()].find(s => s.npc === 'merc');
const oroPrima = A.gold;
merc.graceUntil = 0;
game.damageShip(merc, 9999, A.id);
assert(merc.sunkUntil > game.now, 'il mercantile affonda, non si blocca');
assert.strictEqual(A.gold, oroPrima + 25, 'taglia PvE fissa (25)');
ok('gli NPC affondano come sempre: il blocco è cosa fra capitani');

// — 6) disconnessione durante il blocco: chi resta vince —
const D = game.join(conn(), { t: 'join', name: 'Fuggitivo', profile: { gold: 400, holdLvl: 0 } });
D.graceUntil = 0;
game.damageShip(D, 9999, A.id);
const oroPreFuga = A.gold;
game.leave(D);
assert.strictEqual(A.gold, oroPreFuga + 300, 'staccare la spina regala il resto (300 su 400)');
ok('disconnessione da bloccato = abbordaggio automatico');

console.log('\nBLOCCO VERDE ⚔');
process.exit(0);
