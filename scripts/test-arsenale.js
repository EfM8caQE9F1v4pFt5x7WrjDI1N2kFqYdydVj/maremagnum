'use strict';

// L'arsenale delle esclusive (audit Cantiere 2): pagate una volta, tue per
// sempre — il varo non le rimborsa più (le conserva), si rimontano gratis
// al proprio livello, e dal quinto gradino si torna al Mortaio senza tassa.

const assert = require('assert');
const { Game } = require('../server/game');
const W = require('../server/weapons');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = (inbox) => ({ send(s) { if (inbox) inbox.push(JSON.parse(s)); }, readyState: 1 });

const etere = [];
const game = new Game((m) => etere.push(m));
game.pausa();

const inP = [];
const P = game.join(conn(inP), { t: 'join', name: 'Armaiolo', profile: { gold: 50000, tipo: 'goletta' } });
P.docked = 'porto';

// — 1) comprare l'esclusiva la registra nell'arsenale —
P.mounts.left = [{ type: 'mortaio', lvl: 3 }];
game.syncReady(P);
game.replaceWeapon(P, 'left', 0);
assert.strictEqual(P.mounts.left[0].type, 'lunga', 'la Colubrina Lunga è montata');
assert.strictEqual(P.esclusive.lunga, 1, 'e registrata nell\'arsenale');
game.upgradeWeapon(P, 'left', 0); // lvl 2
assert.strictEqual(P.esclusive.lunga, 2, 'l\'arsenale ricorda il livello più alto');
ok('acquisto: l\'esclusiva entra nell\'arsenale col suo livello');

// — 2) ⇄ Mortaio: il ripensamento è gratis e non perde nulla —
const oroPrima = P.gold;
game.tornaMortaio(P, 'left', 0);
assert.strictEqual(P.mounts.left[0].type, 'mortaio', 'il Mortaio è tornato');
assert.strictEqual(P.mounts.left[0].lvl, W.MAX_WEAPON_LVL, 'al livello massimo (gradino già scalato)');
assert.strictEqual(P.gold, oroPrima, 'senza spendere un soldo');
assert.strictEqual(P.esclusive.lunga, 2, 'la Lunga resta in arsenale');
ok('⇄ Mortaio: gratis, l\'esclusiva resta tua');

// — 3) rimontare l'esclusiva posseduta: gratis e al livello pagato —
game.replaceWeapon(P, 'left', 0);
assert.strictEqual(P.mounts.left[0].type, 'lunga', 'la Lunga è rimontata');
assert.strictEqual(P.mounts.left[0].lvl, 2, 'al livello che avevi pagato');
assert.strictEqual(P.gold, oroPrima, 'gratis: era già tua');
ok('rimonta: gratis e al livello pagato');

// — 4) il varo CONSERVA le esclusive invece di rimborsarle —
const oroVaro = P.gold;
game.varo(P, 'galeone');
assert.strictEqual(P.tipo, 'galeone', 'varato Galeone');
assert.strictEqual(P.mounts.left[0].type, 'colubrina', 'la Lunga è smontata (legno sbagliato)');
assert.strictEqual(P.esclusive.lunga, 2, 'ma resta nell\'arsenale');
// niente rimborso della Lunga: l'oro è sceso solo del costo del varo
assert(P.gold < oroVaro, 'il varo si paga, la Lunga non torna oro');
ok('varo: le esclusive si conservano, non si rimborsano');

// — 5) lo shop dichiara il possesso: replace a costo zero —
game.varo(P, 'goletta'); // si torna a casa
P.mounts.left = [{ type: 'mortaio', lvl: 3 }];
game.syncReady(P);
game.sendShop(P);
const shop = [...inP].reverse().find(m => m.t === 'shop');
const slot = shop.groups.left.slots[0];
assert(slot.replace && slot.replace.cost === 0 && slot.replace.posseduta, 'replace gratis e dichiarato');
assert.strictEqual(slot.replace.type, 'lunga', 'verso la Lunga di casa');
ok('shop: il possesso viaggia nel payload (cost 0, posseduta)');

// — 6) il profilo persiste l'arsenale (youFor) e ripristina lo sanifica —
const you = game.youFor(P);
assert.deepStrictEqual(you.esclusive, { lunga: 2 }, 'youFor porta l\'arsenale');
const inQ = [];
const Q = game.join(conn(inQ), {
  t: 'join', name: 'Erede',
  profile: { gold: 0, tipo: 'goletta', esclusive: { lunga: 9, organo: 2, farlocca: 3 } },
});
assert.deepStrictEqual(Q.esclusive, { lunga: 3, organo: 2 }, 'livelli clampati, armi ignote scartate');
ok('persistenza: arsenale nel profilo, sanificato al ritorno');

game.stop();
console.log('ARSENALE OK ⚔🗄');
