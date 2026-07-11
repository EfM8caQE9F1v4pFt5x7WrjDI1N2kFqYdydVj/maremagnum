'use strict';

// I mostri marini (audit 2, rifusi nell'audit 3): tre bestie ENORMI che
// vagano sommerse (intoccabili, solo sagoma), decidono l'agguato a caso ma
// EMERGONO TELEGRAFATE (l'ombra si gonfia per 2.5s: chi guarda il mare può
// virare), attaccano ognuna col suo kit (drago = raffica a ventaglio,
// kraken = presa che inchioda, serpente = mordi-e-fuggi alle spalle),
// mollano chi scappa, pagano taglie fisse e non scomodano i Cacciatori.
// Vento e burrasche non li riguardano: nuotano sotto.

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
assert.strictEqual(game.npcMaxHp(kraken), 2800, 'il Kraken è una montagna (2800 hp, audit 3)');
assert.strictEqual(game.npcMaxHp(drago), 1500, 'il Drago è una leggenda (1500 hp)');
ok('gli abissi: Drago di Mare, Kraken e Serpente Abissale, sommersi e RIFONDATI');

// — 2) sommerso non si tocca: né colpi diretti né mortaio —
kraken.x = px; kraken.y = py;
game.damageShip(kraken, 100, P.id);
assert.strictEqual(kraken.hp, 2800, 'il danno scivola sulla sagoma');
ok('sommerso: intoccabile');

// — 3) l'agguato TELEGRAFATO: la decisione è a caso, poi l'ombra si gonfia —
P.x = px + 100; P.y = py;
let deciso = false;
for (let i = 0; i < 60000 && !deciso; i++) {
  game.steerMostro(kraken);
  kraken.x = px; kraken.y = py; // resta sul posto per il test
  deciso = kraken.emersioneA > 0;
}
assert(deciso, 'il Kraken ha deciso l\'agguato (probabilità ~1 su 60k mancati)');
assert(kraken.sommerso, 'ma è ANCORA sotto: l\'ombra si sta gonfiando');
assert.strictEqual(kraken.predaId, P.id, 'e ha scelto la SUA preda');
assert(etere.some(m => m.t === 'feed' && /ombra enorme si gonfia sotto la chiglia di Ammazzadraghi/.test(m.msg || '')), 'il telegrafo è pubblico');
game.damageShip(kraken, 100, P.id);
assert.strictEqual(kraken.hp, 2800, 'mentre si gonfia è ancora intoccabile');
// il gonfiarsi finisce: EMERGE
game.now = kraken.emersioneA;
game.steerMostro(kraken);
assert(!kraken.sommerso, 'ombra piena: il Kraken è FUORI');
assert(etere.some(m => m.t === 'feed' && /EMERGE dagli abissi sotto Ammazzadraghi/.test(m.msg || '')), 'l\'emersione è pubblica');
assert(game.fxQueue.some(f => f.k === 'emersione'), 'e si vede (fx)');
ok('agguato: telegrafo di 2.5s (ombra che si gonfia), poi emersione pubblica');

// — 4) il Kraken: PRIMA l'inchiostro (che inchioda), POI i tentacoli —
// da lontano SPUTA il getto nero: lento, dichiarato, schivabile
kraken.sputoAt = 0; kraken.rot = 0;
P.x = kraken.x + 350; P.y = kraken.y; // fra presa (230) e gittata (480)
game.steerMostro(kraken);
const sputo = [...etere].reverse().find(m => m.t === 'shots' && m.from === kraken.id);
assert(sputo && sputo.shots[0].mn === 'inchiostro', 'il getto nero è dichiarato (mn)');
assert(kraken.sputoAt > game.now + 5, 'e si ricarica (7s)');
// il getto che COLPISCE inchioda: presa ~2.5s, poi tregua
game.damageShip(P, 6, kraken.id, { mun: 'inchiostro', owner: kraken.id });
assert(P.presaUntil > game.now && P.presaUntil <= game.now + 2.51, 'INCHIODATO dal nero (~2.5s)');
assert(P.presaImmuneUntil > game.now + 5, 'poi tregua: non è una tomba');
assert(game.fxQueue.some(f => f.k === 'presa'), 'l\'inchiodamento si vede (fx)');
// inchiodato: la nave non riparte finché l'inchiostro stringe
P.vel = 120; P.input = { up: true, down: false, left: false, right: false };
for (let i = 0; i < 45; i++) { game.move(P, TICK); P.x = kraken.x + 350; P.y = kraken.y; }
assert(P.vel < 15, `vele piene ma ferma (vel ${P.vel.toFixed(0)})`);
// secondo getto nella tregua: bagna ma NON re-inchioda
const presaPrima = P.presaUntil;
game.damageShip(P, 6, kraken.id, { mun: 'inchiostro', owner: kraken.id });
assert.strictEqual(P.presaUntil, presaPrima, 'nella tregua il nero non si rinnova');
// al CONTATTO i tentacoli TORCONO: danno e vele, ma NIENTE pin (è
// mestiere dell'inchiostro) — e arrivano fin dove sono lunghi: 200 sì, 320 no
P.presaUntil = 0; P.presaImmuneUntil = 0; P.hp = 200;
kraken.morsoAt = 0;
P.x = kraken.x + 30; P.y = kraken.y;
game.steerMostro(kraken);
assert.strictEqual(200 - P.hp, 30, 'la torsione morde da 30');
assert(P.veleTagliateUntil > game.now, 'i tentacoli avviluppano le vele');
assert.strictEqual(P.presaUntil, 0, 'i tentacoli non inchiodano: quello lo fa il nero');
kraken.morsoAt = 0; P.hp = 200;
P.x = kraken.x + 200; P.y = kraken.y;
game.steerMostro(kraken);
assert.strictEqual(200 - P.hp, 30, 'agguantato a 200 (punta dei tentacoli)');
kraken.morsoAt = 0; P.hp = 200;
P.x = kraken.x + 320;
game.steerMostro(kraken);
assert.strictEqual(P.hp, 200, 'a 320 i tentacoli non arrivano');
P.presaUntil = 0; P.presaImmuneUntil = 0; P.hp = 200; // ripulito per dopo
ok('Kraken: inchiostro che inchioda (~2.5s, tregua 9), tentacoli che torcono senza pin');

// — 5) la raffica del Drago: TRE fiammate a ventaglio (mn=fuoco), dalla GOLA —
drago.sommerso = false; drago.predaId = P.id; drago.morsoAt = 0;
drago.x = px + 600; drago.y = py + 600; drago.rot = 0; // gola a +150
P.x = drago.x + 250; P.y = drago.y;
game.steerMostro(drago);
const soffio = [...etere].reverse().find(m => m.t === 'shots' && m.from === drago.id);
assert(soffio && soffio.shots.length === 3, `raffica da 3 (${soffio && soffio.shots.length})`);
assert(soffio.shots.every(s => s.mn === 'fuoco'), 'tutto fuoco dichiarato');
const dirs = soffio.shots.map(s => Math.atan2(s.vy, s.vx));
assert(Math.abs(Math.max(...dirs) - Math.min(...dirs)) > 0.2, 'il ventaglio si apre');
game.shots.clear();
ok('Drago: raffica di 3 fiammate a ventaglio, a distanza');

// — 6) la preda scappa (>1100) → il mostro si rituffa e dorme un poco —
P.x = drago.x + 1300; P.y = drago.y;
game.steerMostro(drago);
assert(drago.sommerso && !drago.predaId, 'il Drago si è rituffato');
assert(drago.agguatoDorme > game.now, 'e digerisce la delusione');
assert(etere.some(m => m.t === 'feed' && /si rituffa negli abissi/.test(m.msg || '')), 'il tuffo è pubblico');
ok('fuga: oltre le 1100 leghe il mostro molla e si rituffa');

// — 7) il Serpente morde con la TESTA, mai col baricentro (audit 5) —
serpente.sommerso = false; serpente.predaId = P.id; serpente.morsoAt = 0;
serpente.x = px; serpente.y = py; serpente.rot = 0; // testa a +150
// la preda sulla PANCIA del serpente: niente morso (era il baco segnalato)
P.x = px + 20; P.y = py; P.rot = 0; P.hp = 200;
game.steerMostro(serpente);
assert.strictEqual(P.hp, 200, 'dal mezzo non si morde: la bocca è a prua');
assert(!serpente.sommerso, 'e infatti resta fuori, a inseguire');
// la preda davanti alla TESTA: adesso sì
P.x = px + 180;
game.steerMostro(serpente);
assert.strictEqual(200 - P.hp, 22, 'morso da 22, dalla testa');
assert(serpente.sommerso, 'e GIÙ: mordi-e-fuggi');
assert.strictEqual(serpente.predaId, P.id, 'ma la preda resta agganciata');
assert(serpente.riposizionaFino > game.now, 'il riposizionamento ha una scadenza');
// sott'acqua a caccia nuota SVELTO (160, non i 40 del vagabondo)
serpente.vel = 0; serpente.input = { up: true, down: false, left: false, right: false };
const sx = serpente.x, sy = serpente.y;
for (let i = 0; i < 300; i++) { game.move(serpente, TICK); serpente.x = sx; serpente.y = sy; }
assert(Math.abs(serpente.vel - 160) < 3, `caccia subacquea a 160 (${serpente.vel.toFixed(0)})`);
// raggiunte le spalle della preda: telegrafo RAPIDO e riemersione muta
serpente.x = P.x - Math.cos(P.rot) * 240; serpente.y = P.y - Math.sin(P.rot) * 240;
game.steerMostro(serpente);
assert(serpente.emersioneA > game.now && serpente.emersioneDurata < 2, 'telegrafo rapido alle spalle');
const feedPrima = etere.filter(m => m.t === 'feed' && /EMERGE/.test(m.msg || '')).length;
game.now = serpente.emersioneA;
game.steerMostro(serpente);
assert(!serpente.sommerso, 'riemerso dietro la poppa');
const feedDopo = etere.filter(m => m.t === 'feed' && /EMERGE/.test(m.msg || '')).length;
assert.strictEqual(feedDopo, feedPrima, 'le riemersioni del Serpente non intasano il feed');
ok('Serpente: mordi-e-fuggi, caccia subacquea a 160, riemersione rapida alle spalle');

// — 7-bis) la sagoma: il piombo colpisce testa, pancia e coda — non un
// cerchio astratto nel baricentro (audit 5, rilievo degli utenti)
serpente.sommerso = false; serpente.rot = 0; serpente.x = px; serpente.y = py;
assert(game.distanzaMostro(serpente, px + 150, py) <= 0, 'la TESTA si colpisce');
assert(game.distanzaMostro(serpente, px - 150, py) <= 0, 'la CODA si colpisce');
assert(game.distanzaMostro(serpente, px, py) <= 0, 'la pancia pure');
assert(game.distanzaMostro(serpente, px + 340, py) > 0, 'oltre la testa è acqua');
assert(game.distanzaMostro(serpente, px, py + 140) > 0, 'di fianco è acqua');
ok('sagoma: il corpo si colpisce dove si vede, testa e coda comprese');

// — 8) abbatterlo paga la taglia FISSA, va in Gazzetta, niente Cacciatori —
serpente.x = px; serpente.y = py; P.x = px + 50; P.y = py;
P.kills = 2; P.tagliaCacciata = 0; // la prossima preda farebbe scattare il mandato…
serpente.hp = 1;
game.damageShip(serpente, 999, P.id);
const killMsg = [...etere].reverse().find(m => m.t === 'kill' && m.victim === 'Serpente Abissale');
assert(killMsg && killMsg.bounty === 650, `taglia del Serpente (${killMsg && killMsg.bounty})`);
assert(etere.some(m => (m.t === 'notifica' && /abbattuto il Serpente Abissale/.test((m.voce || {}).testo || ''))), 'la Gazzetta canta');
assert.strictEqual(game.cacciatori, 0, '…ma i mostri non sono pirateria: nessun Cacciatore');
assert(serpente.sunkUntil - game.now > 100, 'riposa a lungo negli abissi');
ok('taglia: 650 fissi (audit 3), Gazzetta, niente infamia, lungo riposo');

// — 9) rinasce sommerso, altrove, senza rancori —
serpente.sunkUntil = game.now - 1;
game.respawn(serpente);
assert(game.ships.has(serpente.id) && serpente.sommerso && !serpente.predaId, 'rinato sommerso e quieto');
assert.strictEqual(serpente.hp, 1200, 'a piena salute (1200)');
assert(!serpente.emersioneA && !serpente.riposizionaFino, 'telegrafi azzerati');
ok('respawn: sommerso, altrove, pieno di salute');

// — 10) vento e BURRASCHE non li riguardano: nuotano sotto —
serpente.sommerso = false; serpente.predaId = null;
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
// una burrasca proprio lì sopra: la bestia non rallenta di un nodo
game.burrasche = [{ x: px, y: py, r: 5000 }];
const nelTemporale = nuoto(Math.PI);
assert(Math.abs(nelTemporale - 130) < 2, `mare grosso ignorato (${nelTemporale.toFixed(0)})`);
game.burrasche = [];
ok('vento e burrasche ignorati: le bestie nuotano sotto');

// — 11) lo snapshot dichiara specie e stato: mo/so/pr additivi, k=x —
serpente.sommerso = true;
serpente.emersioneA = game.now + 1.25; serpente.emersioneDurata = 2.5; // a metà del gonfiarsi
P.presaUntil = game.now + 1.5;
game.sendSnapshot();
const snap = [...etere].reverse().find(m => m.t === 'snap');
const sm = snap.ships.find(s => s.id === serpente.id);
assert(sm && sm.k === 'x' && sm.mo === 'serpente', 'k=x e specie nello snap');
assert(sm.so > 0.3 && sm.so < 0.8, `so frazionario mentre emerge (${sm.so})`);
const sp = snap.ships.find(s => s.id === P.id);
assert(sp && sp.mo === undefined, 'niente campi mostro sui capitani');
assert(sp.pr > 1 && sp.pr <= 1.5, `la presa è dichiarata (pr=${sp.pr})`);
serpente.emersioneA = 0; P.presaUntil = 0;
game.sendSnapshot();
const snap2 = [...etere].reverse().find(m => m.t === 'snap');
const sm2 = snap2.ships.find(s => s.id === serpente.id);
assert.strictEqual(sm2.so, 1, 'sommerso pieno: so=1');
assert.strictEqual(snap2.ships.find(s => s.id === P.id).pr, undefined, 'presa finita: pr sparisce');
ok('protocollo: mo, so frazionario e pr additivi');

game.stop();
console.log('MOSTRI OK 🐉🐙🐍');
