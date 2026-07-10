'use strict';

// Convogli scortati e resa dei mercantili (issue #41, fetta 3): il mercantile
// mal ridotto ammaina (e chi lo tocca lo saccheggia col bottino FISSO, una
// volta per resa), il convoglio fa quadrato (tocchi uno, rispondono le
// scorte), all'arrivo tutti a terra, e nessun membro del convoglio rispawna.

const assert = require('assert');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = (inbox) => ({ send(s) { if (inbox) inbox.push(JSON.parse(s)); }, readyState: 1 });
const TICK = 1 / 30;

const etere = [];
const game = new Game((m) => etere.push(m));
game.pausa();
game.vento = { dir: 0, forza: 0 };

const inP = [], inQ = [];
const P = game.join(conn(inP), { t: 'join', name: 'Predone', profile: { gold: 0 } });
const Q = game.join(conn(inQ), { t: 'join', name: 'Secondo', profile: { gold: 0 } });
for (const s of [P, Q]) { s.graceUntil = 0; s.docked = null; }
const oroDi = (s) => s.gold;

// — 1) la resa: sotto la soglia il mercantile ammaina (e lo dice a tutti) —
const merc = [...game.ships.values()].find(s => s.npc === 'merc');
merc.hp = game.npcMaxHp(merc); // 140
game.damageShip(merc, 100, P.id); // 140→40 < 42 (soglia 30%)
assert(merc.resaUntil > game.now, 'bandiera ammainata sotto la soglia');
assert(etere.some(m => m.t === 'feed' && /ammaina bandiera/.test(m.msg)), 'la resa va nel feed');
ok('resa: sotto il 30% il mercantile ammaina');

// — 2) arreso ma non intoccabile: la missione resta missione —
const hpResa = merc.hp;
game.damageShip(merc, 5, P.id);
assert.strictEqual(merc.hp, hpResa - 5, 'chi vuole affondarlo può ancora');
ok('resa: un\'offerta, non uno scudo — si può ancora affondare');

// — 3) il saccheggio col tocco: bottino fisso, UNA volta, poi riprende il largo —
P.x = merc.x + 10; P.y = merc.y; // accosto
Q.x = merc.x + 12; Q.y = merc.y; // anche il secondo, ma il tocco premia il primo
const oroPrima = oroDi(P), oroQ = oroDi(Q);
game.tickResa();
assert.strictEqual(oroDi(P) - oroPrima, 150, `bottino fisso dal listino (+${oroDi(P) - oroPrima})`);
assert.strictEqual(oroDi(Q), oroQ, 'il secondo arrivato non becca niente');
assert(merc.saccheggiato && merc.resaCooldownUntil > game.now, 'saccheggiato e in cooldown');
assert(merc.hp >= game.npcMaxHp(merc) * 0.5, 'rattoppato per riprendere il largo');
game.tickResa();
assert.strictEqual(oroDi(P) - oroPrima, 150, 'niente doppio saccheggio');
ok('saccheggio: 150 🪙 al primo tocco, una volta sola, mercantile rattoppato');

// — 4) il cooldown è la diga: niente resa a ripetizione —
merc.resaUntil = 0;
merc.hp = 30; // sotto soglia
game.damageShip(merc, 1, P.id);
assert(merc.resaUntil <= game.now, 'in cooldown non ci si arrende di nuovo');
merc.hp = game.npcMaxHp(merc); merc.resaCooldownUntil = 0; // ripulito per dopo
ok('cooldown: il mare non è un bancomat');

// — 5) il convoglio salpa: capo panciuto, scorte in stazione, Gazzetta avvisata —
game.spawnConvoglio();
assert(game.convoglio, 'il convoglio esiste');
const capo = game.ships.get(game.convoglio.capo);
const scorte = game.convoglio.scorte.map(id => game.ships.get(id));
assert(capo && capo.name === 'Mercantile di Convoglio' && game.npcMaxHp(capo) === 280, 'capo panciuto (280 hp)');
assert(scorte.length === 2 && scorte.every(s => s && s.npc === 'ghost' && s.name === 'Scorta del Convoglio'), 'due scorte');
assert(scorte.every(s => Math.hypot(s.x - capo.x, s.y - capo.y) < 200), 'le scorte nascono in stazione');
assert(etere.some(m => m.t === 'notifica' && /convoglio scortato è salpato/.test(m.voce && m.voce.testo || '')) ||
       etere.some(m => m.t === 'feed' && /convoglio scortato è salpato/.test(m.msg)), 'la rotta è annunciata');
ok('convoglio: capo panciuto + 2 scorte, rotta annunciata');

// — 6) tocchi uno, rispondono tutti: l'aggro è di squadra —
game.damageShip(capo, 10, P.id);
assert(game.convoglio.minaccia && game.convoglio.minaccia.id === P.id, 'la minaccia è annotata');
P.x = capo.x + 400; P.y = capo.y; // a tiro di caccia
const s0 = scorte[0];
s0.input = { up: false, down: false, left: false, right: false };
game.steerScorta(s0);
assert(s0.input.up, 'la scorta molla la stazione e dà la caccia');
ok('mutuo soccorso: la scorta caccia chi ha toccato il capo');

// — 7) l'arrivo: tutti a terra, il mare si svuota, il prossimo è in calendario —
capo.x = game.convoglio.meta.x; capo.y = game.convoglio.meta.y;
game.tickConvoglio();
assert(!game.convoglio, 'convoglio sciolto all\'arrivo');
assert(!game.ships.has(capo.id) && scorte.every(s => !game.ships.has(s.id)), 'capo e scorte a terra');
assert(game.prossimoConvoglio > game.now, 'il prossimo è in calendario');
assert(etere.some(m => m.t === 'feed' && /giunto sano e salvo/.test(m.msg)), 'l\'arrivo si festeggia');
ok('arrivo: convoglio a terra, feed avvisato, calendario aggiornato');

// — 8) capo affondato: le scorte restano (orfane), ma nessuno rispawna —
game.prossimoConvoglio = 0;
game.tickConvoglio(); // ne salpa un altro
const c2 = game.convoglio;
const capo2 = game.ships.get(c2.capo);
const orfana = game.ships.get(c2.scorte[0]);
capo2.hp = 1;
game.damageShip(capo2, 999, P.id); // affonda (il predone incassa la taglia PvE)
game.tickConvoglio();
assert(!game.convoglio, 'convoglio perduto');
assert(game.ships.has(orfana.id), 'la scorta orfana resta in mare');
// il relitto del capo non rinasce: al "respawn" sparisce
capo2.sunkUntil = game.now - 1;
game.respawn(capo2);
assert(!game.ships.has(capo2.id), 'il capo affondato non rispawna');
orfana.hp = 0; orfana.sunkUntil = game.now - 1;
game.respawn(orfana);
assert(!game.ships.has(orfana.id), 'nemmeno l\'orfana rispawna');
ok('capo perduto: scorte orfane a caccia, nessun membro rispawna');

// — 9) lo snapshot porta la bandiera bianca: rs additivo —
const merc2 = [...game.ships.values()].find(s => s.npc === 'merc' && !s.convoglio);
merc2.resaUntil = game.now + 7;
game.sendSnapshot();
const snap = [...etere].reverse().find(m => m.t === 'snap');
const sm = snap.ships.find(x => x.id === merc2.id);
const sp = snap.ships.find(x => x.id === P.id);
assert(sm && Math.abs(sm.rs - 7) < 0.2, 'rs coi secondi restanti');
assert(sp && sp.rs === undefined, 'niente rs su chi non si arrende');
ok('protocollo: rs additivo nello snapshot');

game.stop();
console.log('CONVOGLI OK 🚢🏳');
