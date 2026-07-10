'use strict';

// Il Mastro di Rotte v2 (#38), la parte grossa: le difese TEMPORANEE su un'isola
// NORMALE. Si verifica senza rete guidando il Game: le difese compaiono, sbarrano
// l'approdo, cadono per un premio SPENDIBILE bounded (dal listino), una volta al
// giorno; a scadenza svaniscono; il dungeon settimanale fa avanzare la campagna
// (senza doppio premio); e l'espugnazione di una vera Fortezza non è toccata.

const assert = require('assert');
const campagna = require('../server/campagna-core');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = () => ({ send() {}, readyState: 1 });
const abbatti = (game, isola, byId) => { for (const d of isola.defs) game.damageDefense(isola, d, 99999, byId); };

// — 1) dungeon GIORNALIERO su un'isola normale: difese, blocco, premio bounded —
const giorno = campagna.giornoDi();
const dg = campagna.genera('giornaliero', giorno, ['wikipedia.org']);
dg.difficolta = 'tosto'; dg.premio = campagna.LISTINO.tosto; // fascia nota → premio prevedibile
campagna.setDungeon('giornaliero', dg);
campagna.setDungeon('settimanale', null);

const game = new Game(() => {});
game.pausa();
const isola = game.archipelago.ensure('wikipedia.org').island;
assert(!isola.fortress, 'wikipedia.org non è una Fortezza Proibita');
game.applicaDungeoni();
assert(isola.dungeon && Array.isArray(isola.defs) && isola.defs.length >= 3, 'difese temporanee stese su isola normale');
ok(`difese temporanee su isola normale: ${isola.defs.length} pezzi (${isola.dungeon.tipo})`);

const P = game.join(conn(), { t: 'join', name: 'Assaltatore', profile: { gold: 0 } });
P.graceUntil = 0;
const oroIniz = P.gold; // una nave fresca parte con un fondo cassa: si conta il delta
assert(game.fortressBlocks(P, isola), 'con le difese in piedi l\'approdo è sbarrato');
abbatti(game, isola, P.id);
assert.strictEqual(P.gold - oroIniz, campagna.LISTINO.tosto, 'premio del dungeon dal LISTINO (bounded), incassato una volta');
assert.strictEqual(P.dungeonGiorno, giorno, 'il giorno risulta incassato nel profilo');
assert(isola.fallenUntil > game.now, 'dopo la caduta scatta la finestra di approdo');
ok(`premio bounded incassato (+${campagna.LISTINO.tosto}), difese cadute`);

// niente doppio premio nello stesso giorno, anche se le difese si ricostruiscono
const oro = P.gold;
for (const d of isola.defs) { d.dead = false; d.hp = d.max; }
abbatti(game, isola, P.id);
assert.strictEqual(P.gold, oro, 'stesso giorno: niente secondo premio');
ok('premio del giorno una volta sola (no doppio incasso)');

// — 2) scadenza: le difese svaniscono e l'isola torna un approdo normale —
isola.dungeon.scadenza = Date.now() - 1; // già scaduto
game.tickForts(0.1);
assert(!isola.dungeon && !isola.defs, 'a scadenza il dungeon si azzera (difese e flag via)');
assert(!game.fortressBlocks(P, isola), 'senza difese l\'approdo è di nuovo libero');
ok('scadenza: difese sparite, isola di nuovo approdo normale');

// — 3) dungeon SETTIMANALE: la caduta avanza la campagna, premio SINGOLO —
const sett = campagna.settimanaDi();
const dw = campagna.genera('settimanale', sett, ['archive.org']);
campagna.setDungeon('settimanale', dw);
campagna.setDungeon('giornaliero', null);
const g2 = new Game(() => {});
g2.pausa();
const isl2 = g2.archipelago.ensure('archive.org').island;
g2.applicaDungeoni();
assert(isl2.dungeon && isl2.dungeon.tipo === 'settimanale', 'il settimanale si stende su archive.org');
const Q = g2.join(conn(), { t: 'join', name: 'Campione', profile: { gold: 0 } });
Q.graceUntil = 0;
Q.campagna = { settimana: sett, tappa: dw.tappe.length - 1, fatto: 0, completata: false }; // all'ultima tappa
const oroPrima = Q.gold;
for (const d of isl2.defs) g2.damageDefense(isl2, d, 99999, Q.id);
assert(Q.campagna.completata, 'la caduta del dungeon settimanale completa la campagna');
assert.strictEqual(Q.gold, oroPrima + dw.premio, 'paga il premio della campagna UNA volta (niente doppio: dungeon+campagna)');
ok('dungeon settimanale → avanza/compie la campagna, premio singolo');

// — 4) le vere Fortezze restano intatte: conquista permanente + taglia piena —
const g3 = new Game(() => {});
g3.pausa();
// una fortezza vera: la si fabbrica a mano (in test la blocklist è vuota)
const fake = { id: 'proibita.example', kind: 'site', domain: 'proibita.example', name: 'Fortezza di Prova',
  x: 5000, y: 5000, r: 120, seed: 7, fortress: true, fallenUntil: 0,
  defs: [{ kind: 't', x: 5000, y: 5000, hp: 10, max: 10, dead: false, deadAt: 0, fireAt: 0, lastHit: 0 }] };
g3.archipelago.islands.set(fake.id, fake);
const R = g3.join(conn(), { t: 'join', name: 'Corsaro', profile: { gold: 0 } });
R.graceUntil = 0;
const oroR = R.gold;
g3.damageDefense(fake, fake.defs[0], 99999, R.id);
assert(R.conquered.has(fake.id), 'la Fortezza vera si conquista in modo permanente');
assert.strictEqual(R.gold - oroR, 1500, 'la Fortezza vera paga la taglia piena (1500), non il listino dungeon');
ok('le vere Fortezze Proibite restano intatte (conquista permanente, taglia 1500)');

console.log('\nDUNGEON DEL MASTRO VERDE ⚔🗺');
process.exit(0);
