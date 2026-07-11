'use strict';

// La tassa del codardo (audit 5-bis): chi è ingaggiato in battaglia con un
// ALTRO CAPITANO e stacca la spina (refresh/chiusura) lascia a mare metà
// del forziere, in un bottino galleggiante che chiunque ripesca col tocco.
// L'ingaggio si segna SOLO fra capitani: NPC, fortezze e dungeon mai.

const assert = require('assert');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = () => ({ send() {}, readyState: 1 });

const etere = [];
const game = new Game((m) => etere.push(m));
game.pausa();
game.vento = { dir: 0, forza: 0 };
game.now = Math.floor(game.now / 480) * 480 + 0.25 * 480; // mezzogiorno

const P = game.join(conn(), { t: 'join', name: 'Predone', profile: { gold: 1000 } });
const Q = game.join(conn(), { t: 'join', name: 'Codardo', profile: { gold: 900 } });
for (const s of [P, Q]) { s.graceUntil = 0; s.docked = null; }

// — 1) il colpo fra capitani SEGNA entrambi; NPC e fortezze mai —
game.damageShip(Q, 10, P.id);
assert(Q.ingaggio && Q.ingaggio.con === P.id && Q.ingaggio.fino > game.now, 'la vittima è ingaggiata');
assert(P.ingaggio && P.ingaggio.con === Q.id, 'e pure l\'attaccante');
const merc = [...game.ships.values()].find(s => s.npc === 'merc');
merc.ingaggio = null; P.ingaggio = null;
game.damageShip(merc, 5, P.id);
assert(!merc.ingaggio && !P.ingaggio, 'gli NPC non ingaggiano nessuno');
game.damageShip(P, 5, 'fort:qualcosa');
assert(!P.ingaggio, 'le difese dei dungeon nemmeno');
ok('ingaggio: solo fra capitani, su entrambi, 15s dal colpo');

// — 2) staccare la spina da ingaggiato: metà forziere A MARE —
game.damageShip(Q, 10, P.id); // ri-ingaggiati
const oroPrima = Q.gold;
Q.x = 2500; Q.y = 2500;
game.leave(Q);
assert.strictEqual(Q.gold, Math.ceil(oroPrima / 2), `al codardo resta metà (${Q.gold})`);
const bottino = [...game.bottini.values()][0];
assert(bottino && bottino.oro === Math.floor(oroPrima / 2), 'l\'altra metà galleggia');
assert(Math.hypot(bottino.x - 2500, bottino.y - 2500) < 2, 'dove ammainava');
assert(etere.some(m => m.t === 'feed' && /FUGGITO dalla battaglia/.test(m.msg || '')), 'la fuga è pubblica');
assert(etere.some(m => m.t === 'notifica' && /FUGGITO/.test((m.voce || {}).testo || '')), 'e va in Gazzetta');
assert(etere.some(m => m.t === 'notifica' && (m.voce || {}).k === 'fuga.annuncio' && (m.voce.p || {}).oro === Math.floor(oroPrima / 2)), 'la voce porta chiave e parametri (i18n fetta 2)');
ok('fuga ingaggiata: 50% a mare in un bottino galleggiante, gogna pubblica');

// — 3) lo snapshot dichiara i bottini (bt additivo) —
game.sendSnapshot();
const snap = [...etere].reverse().find(m => m.t === 'snap');
assert(snap.bt && snap.bt.length === 1 && snap.bt[0].oro === bottino.oro, 'bt nello snap');
ok('protocollo: bt additivo con id, posizione e oro');

// — 4) il primo che lo tocca se lo porta a bordo —
const oroP = P.gold;
P.x = bottino.x + 30; P.y = bottino.y;
game.tickBottini();
assert.strictEqual(P.gold - oroP, bottino.oro, 'ripescato dal primo che passa');
assert.strictEqual(game.bottini.size, 0, 'e il mare è di nuovo pulito');
assert(etere.some(m => m.t === 'feed' && /ripescato il bottino/.test(m.msg || '')), 'il ripescaggio è pubblico');
ok('ripescaggio: col tocco, primo arrivato primo servito');

// — 5) senza ingaggio (o scaduto, o attraccato) non si paga nulla —
const R = game.join(conn(), { t: 'join', name: 'Innocente', profile: { gold: 500 } });
R.graceUntil = 0; R.docked = null;
game.leave(R);
assert.strictEqual(R.gold, 500, 'chi non combatte non paga');
const S = game.join(conn(), { t: 'join', name: 'Paziente', profile: { gold: 500 } });
S.graceUntil = 0; S.docked = null;
game.damageShip(S, 5, P.id);
S.ingaggio.fino = game.now - 1; // l'ingaggio è scaduto: la battaglia è finita
game.leave(S);
assert.strictEqual(S.gold, 500, 'ingaggio scaduto: nessuna tassa');
const T = game.join(conn(), { t: 'join', name: 'Attraccato', profile: { gold: 500 } });
T.graceUntil = 0;
game.damageShip(T, 5, P.id);
T.docked = 'porto'; // ha attraccato: l'uscita di scena legittima
game.leave(T);
assert.strictEqual(T.gold, 500, 'in rada si sbarca senza tasse');
assert.strictEqual(game.bottini.size, 0, 'nessun bottino spurio');
ok('niente tassa: senza ingaggio, a ingaggio scaduto o attraccati');

// — 6) il blocco DECIDE la battaglia: gli ingaggi si azzerano —
const V = game.join(conn(), { t: 'join', name: 'Vittima', profile: { gold: 400 } });
V.graceUntil = 0; V.docked = null;
game.damageShip(V, 5, P.id);
assert(P.ingaggio && V.ingaggio, 'ingaggiati prima del colpo di grazia');
V.hp = 1;
game.damageShip(V, 999, P.id); // blocco, non affondamento (fra capitani)
assert(!P.ingaggio && !V.ingaggio, 'blocco = battaglia decisa, ingaggi azzerati');
ok('blocco: chi vince può sbarcare senza pagare la tassa');

// — 7) il bottino non è eterno: scade e il mare se lo riprende —
const W2 = game.join(conn(), { t: 'join', name: 'Fuggitivo', profile: { gold: 600 } });
W2.graceUntil = 0; W2.docked = null;
game.damageShip(W2, 5, P.id);
game.leave(W2);
const b2 = [...game.bottini.values()][0];
assert(b2, 'il bottino c\'è');
b2.fino = game.now - 1;
game.tickBottini();
assert.strictEqual(game.bottini.size, 0, 'scaduto: inghiottito dagli abissi');
ok('scadenza: dopo 180s il mare si riprende il bottino');

game.stop();
console.log('FUGA OK 💰🏃');
