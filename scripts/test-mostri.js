'use strict';

// I mostri marini (audit 2): tre bestie che vagano sommerse (intoccabili,
// solo sagoma), emergono a caso su chi gli passa sopra, attaccano ognuna
// con la sua indole, mollano chi scappa, pagano taglie fisse e non
// scomodano i Cacciatori. Il vento non li riguarda: nuotano sotto.

const assert = require('assert');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = (inbox) => ({ send(s) { if (inbox) inbox.push(JSON.parse(s)); }, readyState: 1 });
const TICK = 1 / 30;

const etere = [];
const game = new Game((m) => etere.push(m));
game.pausa();
game.vento = { dir: 0, forza: 1 };
game.now = Math.floor(game.now / 480) * 480 + 0.25 * 480; // mezzogiorno

const inP = [];
const P = game.join(conn(inP), { t: 'join', name: 'Ammazzadraghi', profile: { gold: 0 } });
P.graceUntil = 0; P.docked = null;

// acqua libera e LONTANA dalle isole (l'agguato rispetta le rade)
let px = 0, py = 0;
cerca: for (let x = 200; x < 5800; x += 137) {
  for (let y = 200; y < 5800; y += 211) {
    if (game.archipelago.list().every(i => Math.hypot(x - i.x, y - i.y) > i.r + 300)) { px = x; py = y; break cerca; }
  }
}

// — 1) gli abissi sono abitati: tre bestie, sommerse, coi nomi giusti —
const mostri = [...game.ships.values()].filter(s => s.npc === 'mostro');
assert.strictEqual(mostri.length, 3, 'tre mostri in mare');
const drago = mostri.find(m => m.mostro === 'drago');
const kraken = mostri.find(m => m.mostro === 'kraken');
const serpente = mostri.find(m => m.mostro === 'serpente');
assert(drago && kraken && serpente, 'drago, kraken e serpente');
assert(mostri.every(m => m.sommerso), 'tutti sommersi alla nascita');
assert.strictEqual(game.npcMaxHp(kraken), 700, 'il Kraken è una montagna (700 hp)');
ok('gli abissi: Drago di Mare, Kraken e Serpente Abissale, sommersi');

// — 2) sommerso non si tocca: né colpi diretti né mortaio —
kraken.x = px; kraken.y = py;
game.damageShip(kraken, 100, P.id);
assert.strictEqual(kraken.hp, 700, 'il danno scivola sulla sagoma');
ok('sommerso: intoccabile');

// — 3) l'agguato: preda sopra la sagoma → prima o poi emerge (a caso) —
P.x = px + 100; P.y = py;
let emerso = false;
for (let i = 0; i < 60000 && !emerso; i++) {
  game.steerMostro(kraken);
  kraken.x = px; kraken.y = py; // resta sul posto per il test
  emerso = !kraken.sommerso;
}
assert(emerso, 'il Kraken è emerso (probabilità ~1 su 60k mancati)');
assert.strictEqual(kraken.predaId, P.id, 'e ha scelto la SUA preda');
assert(etere.some(m => m.t === 'feed' && /EMERGE dagli abissi sotto Ammazzadraghi/.test(m.msg || '')), 'l\'emersione è pubblica');
assert(game.fxQueue.some(f => f.k === 'emersione'), 'e si vede (fx)');
ok('agguato: emerge a caso sotto la preda, feed e schiuma');

// — 4) il morso del Kraken: danno E vele avviluppate —
P.x = kraken.x + 30; P.y = kraken.y;
kraken.morsoAt = 0;
const hpPrima = P.hp;
game.steerMostro(kraken);
assert.strictEqual(hpPrima - P.hp, 30, `morso da 30 (−${hpPrima - P.hp})`);
assert(P.veleTagliateUntil > game.now, 'i tentacoli avviluppano le vele');
ok('Kraken: morso da 30 e vele avviluppate');

// — 5) il soffio del Drago: palla di fuoco a distanza (mn=fuoco) —
drago.sommerso = false; drago.predaId = P.id; drago.morsoAt = 0;
drago.x = px + 600; drago.y = py + 600;
P.x = drago.x + 250; P.y = drago.y;
game.steerMostro(drago);
const soffio = [...etere].reverse().find(m => m.t === 'shots' && m.from === drago.id);
assert(soffio && soffio.shots[0].mn === 'fuoco', 'il soffio è fuoco dichiarato');
game.shots.clear();
ok('Drago: soffia fuoco a distanza');

// — 6) la preda scappa (>1100) → il mostro si rituffa e dorme un poco —
P.x = drago.x + 1300; P.y = drago.y;
game.steerMostro(drago);
assert(drago.sommerso && !drago.predaId, 'il Drago si è rituffato');
assert(drago.agguatoDorme > game.now, 'e digerisce la delusione');
assert(etere.some(m => m.t === 'feed' && /si rituffa negli abissi/.test(m.msg || '')), 'il tuffo è pubblico');
ok('fuga: oltre le 1100 leghe il mostro molla e si rituffa');

// — 7) abbatterlo paga la taglia FISSA, va in Gazzetta, niente Cacciatori —
serpente.sommerso = false; serpente.predaId = P.id;
serpente.x = px; serpente.y = py; P.x = px + 50; P.y = py;
P.kills = 2; P.tagliaCacciata = 0; // la prossima preda farebbe scattare il mandato…
serpente.hp = 1;
game.damageShip(serpente, 999, P.id);
const killMsg = [...etere].reverse().find(m => m.t === 'kill' && m.victim === 'Serpente Abissale');
assert(killMsg && killMsg.bounty === 350, `taglia del Serpente (${killMsg && killMsg.bounty})`);
assert(etere.some(m => (m.t === 'notifica' && /abbattuto il Serpente Abissale/.test((m.voce || {}).testo || ''))), 'la Gazzetta canta');
assert.strictEqual(game.cacciatori, 0, '…ma i mostri non sono pirateria: nessun Cacciatore');
assert(serpente.sunkUntil - game.now > 100, 'riposa a lungo negli abissi');
ok('taglia: 350 fissi, Gazzetta, niente infamia, lungo riposo');

// — 8) rinasce sommerso, altrove, senza rancori —
serpente.sunkUntil = game.now - 1;
game.respawn(serpente);
assert(game.ships.has(serpente.id) && serpente.sommerso && !serpente.predaId, 'rinato sommerso e quieto');
assert.strictEqual(serpente.hp, 300, 'a piena salute');
ok('respawn: sommerso, altrove, pieno di salute');

// — 9) il vento non lo riguarda: nuota alla SUA velocità, bolina o poppa —
serpente.sommerso = false;
const nuoto = (rot) => {
  serpente.rot = rot; serpente.vel = 0; serpente.x = px; serpente.y = py;
  serpente.input = { up: true, down: false, left: false, right: false };
  for (let i = 0; i < 300; i++) { game.move(serpente, TICK); serpente.x = px; serpente.y = py; }
  return serpente.vel;
};
const controVento = nuoto(Math.PI);
const colVento = nuoto(0);
assert(Math.abs(controVento - 130) < 2 && Math.abs(colVento - 130) < 2,
  `il Serpente nuota a 130 comunque (${controVento.toFixed(0)}/${colVento.toFixed(0)})`);
ok('vento ignorato: le bestie nuotano sotto');

// — 10) lo snapshot dichiara specie e stato: mo/so additivi, k=x —
serpente.sommerso = true;
game.sendSnapshot();
const snap = [...etere].reverse().find(m => m.t === 'snap');
const sm = snap.ships.find(s => s.id === serpente.id);
assert(sm && sm.k === 'x' && sm.mo === 'serpente' && sm.so === 1, 'k=x, mo e so nello snap');
const sp = snap.ships.find(s => s.id === P.id);
assert(sp && sp.mo === undefined, 'niente campi mostro sui capitani');
ok('protocollo: mo/so additivi, specie x');

game.stop();
console.log('MOSTRI OK 🐉🐙🐍');
