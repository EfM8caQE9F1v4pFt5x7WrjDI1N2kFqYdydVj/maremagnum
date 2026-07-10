'use strict';

// La Bacheca del Diario (issue #39), senza rete: offerte da accettare/rifiutare,
// missioni attive col tetto, progresso sugli eventi veri del Game, premio pagato
// una volta e rifornimento, persistenza delle accettate nel profilo.

const assert = require('assert');
const { Game } = require('../server/game');
const { MAX_ATTIVE, BACHECA_N } = require('../server/missions');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = () => ({ send() {}, readyState: 1 });

const game = new Game(() => {});
game.pausa();
const P = game.join(conn(), { t: 'join', name: 'Bacheca', profile: { gold: 1000 } });
P.graceUntil = 0;

// 1) al join: bacheca piena, nessuna attiva
assert(P.bacheca.length === BACHECA_N && (!P.missioni || P.missioni.length === 0), 'al join: bacheca piena, 0 attive');
ok(`bacheca al join: ${P.bacheca.length} offerte, 0 attive`);

// 2) accetta → in corso, bacheca si rifornisce
const primo = P.bacheca[0].id;
game.missions.accetta(P, primo);
assert(P.missioni.length === 1 && P.missioni[0].id === primo, 'accettata → in attive');
assert(P.bacheca.length === BACHECA_N && !P.bacheca.find(m => m.id === primo), 'bacheca rifornita, offerta consumata');
ok('accetta: la rotta passa in corso e la bacheca si rifornisce');

// 3) rifiuta → via e rifornita
const daRifiutare = P.bacheca[0].id;
game.missions.rifiuta(P, daRifiutare);
assert(!P.bacheca.find(m => m.id === daRifiutare) && P.bacheca.length === BACHECA_N, 'rifiutata via, bacheca piena');
ok('rifiuta: l\'offerta sparisce e ne arriva un\'altra');

// 4) tetto delle attive
while (P.missioni.length < MAX_ATTIVE) game.missions.accetta(P, P.bacheca[0].id);
const oltre = P.bacheca[0].id;
game.missions.accetta(P, oltre);
assert(P.missioni.length === MAX_ATTIVE && P.bacheca.find(m => m.id === oltre), 'la quarta non entra (tetto attive)');
ok(`tetto di ${MAX_ATTIVE} rotte in corso rispettato`);

// 5) progresso e premio su una attiva: 2 mercantili affondati
P.missioni = [{ id: 'mtest', key: 'merc', desc: 'Affonda 2 mercantili', n: 2, reward: 140, progress: 0 }];
const oroPrima = P.gold;
const mercs = [...game.ships.values()].filter(s => s.npc === 'merc');
for (let i = 0; i < 2; i++) { const m = mercs[i]; m.graceUntil = 0; m.sunkUntil = 0; game.damageShip(m, 9999, P.id); }
assert(!P.missioni.find(m => m.id === 'mtest'), 'la missione compiuta esce dalle attive');
// oltre al premio missione (140) le due prede pagano anche la loro taglia: delta ≥ 140
assert(P.gold >= oroPrima + 140, 'premio della missione (140) incassato al completamento');
ok('progresso e premio: 2 mercantili → missione compiuta e pagata');

// 6) abbandona una attiva
P.missioni = [{ id: 'mx', key: 'ghost', desc: 'x', n: 1, reward: 50, progress: 0 }];
game.missions.abbandona(P, 'mx');
assert(P.missioni.length === 0, 'abbandonata → via dalle attive');
ok('abbandona: la rotta esce dalle attive');

// 7) persistenza: youFor porta le attive, ripristina le rimette col progresso
P.missioni = [{ id: 'mp', key: 'merc', desc: 'Affonda 2 mercantili', n: 2, reward: 140, progress: 1 }];
const prof = game.youFor(P);
assert(Array.isArray(prof.missioni) && prof.missioni[0].progress === 1, 'il profilo porta le attive col progresso');
const P2 = game.join(conn(), { t: 'join', name: 'Redivivo', profile: { gold: 100, missioni: prof.missioni } });
P2.graceUntil = 0;
assert(P2.missioni.length === 1 && P2.missioni[0].progress === 1 && P2.missioni[0].key === 'merc', 'al rientro la rotta torna col progresso');
assert(P2.bacheca.length === BACHECA_N, 'e la bacheca è fresca');
ok('persistenza: le rotte accettate sopravvivono al rientro, la bacheca si rigenera');

console.log('\nBACHECA DEL DIARIO VERDE 📖');
process.exit(0);
