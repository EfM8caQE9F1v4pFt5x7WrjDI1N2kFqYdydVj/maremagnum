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
// mezzogiorno inchiodato: il bottino notturno (×1.5, fetta 5) ha i suoi test
game.now = Math.floor(game.now / 480) * 480 + 0.25 * 480;

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
// (il pescaggio delle tappe è casuale: ritenta finché la rotta ha uno scalo)
for (let i = 0; i < 20; i++) {
  game.spawnCarovana('convoglio');
  if (game.carovane.convoglio && game.carovane.convoglio.tappe.length >= 2) break;
  if (game.carovane.convoglio) game.sciogliCarovana('convoglio', null, true);
}
assert(game.carovane.convoglio, 'il convoglio esiste');
const capo = game.ships.get(game.carovane.convoglio.capo);
const scorte = game.carovane.convoglio.scorte.map(id => game.ships.get(id));
assert(capo && capo.name === 'Mercantile di Convoglio' && game.npcMaxHp(capo) === 280, 'capo panciuto (280 hp)');
assert(scorte.length === 2 && scorte.every(s => s && s.npc === 'ghost' && s.name === 'Scorta del Convoglio'), 'due scorte');
assert(scorte.every(s => Math.hypot(s.x - capo.x, s.y - capo.y) < 200), 'le scorte nascono in stazione');
assert(etere.some(m => m.t === 'notifica' && /convoglio scortato è salpato/.test(m.voce && m.voce.testo || '')) ||
       etere.some(m => m.t === 'feed' && /convoglio scortato è salpato/.test(m.msg)), 'la rotta è annunciata');
ok('convoglio: capo panciuto + 2 scorte, rotta annunciata');

// — 6) tocchi uno, rispondono tutti: l'aggro è di squadra —
game.damageShip(capo, 10, P.id);
assert(game.carovane.convoglio.minaccia && game.carovane.convoglio.minaccia.id === P.id, 'la minaccia è annotata');
P.x = capo.x + 400; P.y = capo.y; // a tiro di caccia
const s0 = scorte[0];
s0.input = { up: false, down: false, left: false, right: false };
game.steerScorta(s0);
assert(s0.input.up, 'la scorta molla la stazione e dà la caccia');
ok('mutuo soccorso: la scorta caccia chi ha toccato il capo');

// — 7) audit 3: passo da carico e scalo con sosta —
const c7 = game.carovane.convoglio;
assert(c7.tappe.length >= 2 && c7.tappa === 0, `rotta a più gambe (${c7.tappe.length}): scali + meta`);
assert(c7.tappe[c7.tappe.length - 1].nome === c7.meta.nome, 'l\'ultima tappa È la meta');
// il passo: in acqua libera il capo fila a 42 (carico), non a 75
let lx = 0, ly = 0;
cerca: for (let x = 200; x < 5800; x += 137) {
  for (let y = 200; y < 5800; y += 211) {
    if (game.archipelago.list().every(i => Math.hypot(x - i.x, y - i.y) > i.r + 300)) { lx = x; ly = y; break cerca; }
  }
}
capo.x = lx; capo.y = ly; capo.vel = 0; capo.rot = 0;
c7.tappe[0] = { ...c7.tappe[0], x: lx + 3000, y: ly }; // lo scalo dritto a prua
for (let i = 0; i < 300; i++) { game.steerCapo(capo); game.move(capo, TICK); capo.x = lx; capo.y = ly; }
assert(Math.abs(capo.vel - 42) < 2, `passo da carico (${capo.vel.toFixed(0)} ≈ 42, non 75)`);
// lo scalo: toccata la prima tappa → sosta annunciata, poi la gamba due
capo.x = c7.tappe[0].x; capo.y = c7.tappe[0].y;
game.tickCarovane();
assert(game.carovane.convoglio && c7.tappa === 1, 'lo scalo NON scioglie: si passa alla gamba due');
assert(c7.sostaFino > game.now, 'ancora giù: sosta in rada');
assert(etere.some(m => m.t === 'feed' && /fa scalo a/.test(m.msg)), 'lo scalo è annunciato');
game.steerCapo(capo);
assert(!capo.input.up, 'in sosta le vele sono ferme');
c7.sostaFino = game.now - 1;
game.steerCapo(capo);
assert(capo.input.up, 'sosta finita: si riparte verso la meta');
ok('audit 3: passo da carico (42), scalo con sosta e annuncio');

// — 8) l'arrivo: tutti a terra, il mare si svuota, il prossimo è in calendario —
c7.tappa = c7.tappe.length - 1; c7.sostaFino = 0; // saltiamo alle ultime miglia
capo.x = c7.meta.x; capo.y = c7.meta.y;
game.tickCarovane();
assert(!game.carovane.convoglio, 'convoglio sciolto all\'arrivo');
assert(!game.ships.has(capo.id) && scorte.every(s => !game.ships.has(s.id)), 'capo e scorte a terra');
assert(game.prossimaCarovana.convoglio > game.now, 'il prossimo è in calendario');
assert(etere.some(m => m.t === 'feed' && /giunto sano e salvo/.test(m.msg)), 'l\'arrivo si festeggia');
ok('arrivo: convoglio a terra, feed avvisato, calendario aggiornato');

// — 9) capo affondato: le scorte restano (orfane), ma nessuno rispawna —
game.prossimaCarovana.convoglio = 0;
game.tickCarovane(); // ne salpa un altro
const c2 = game.carovane.convoglio;
const capo2 = game.ships.get(c2.capo);
const orfana = game.ships.get(c2.scorte[0]);
capo2.hp = 1;
game.damageShip(capo2, 999, P.id); // affonda (il predone incassa la taglia PvE)
game.tickCarovane();
assert(!game.carovane.convoglio, 'convoglio perduto');
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
