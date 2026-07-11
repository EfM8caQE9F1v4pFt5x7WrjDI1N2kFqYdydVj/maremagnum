'use strict';

// Il Galeone del Tesoro e i Cacciatori di Taglie (issue #41, fetta 4):
// la carovana rara e corazzata col bottino grosso che si prende col TOCCO,
// e l'infamia che ogni tre prede manda un Cacciatore a bracciarti.

const assert = require('assert');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = (inbox) => ({ send(s) { if (inbox) inbox.push(JSON.parse(s)); }, readyState: 1 });

const etere = [];
const game = new Game((m) => etere.push(m));
game.pausa();
game.vento = { dir: 0, forza: 0 };
// mezzogiorno inchiodato: il bottino notturno (×1.5, fetta 5) ha i suoi test
game.now = Math.floor(game.now / 480) * 480 + 0.25 * 480;

const inP = [];
const P = game.join(conn(inP), { t: 'join', name: 'Infame', profile: { gold: 0 } });
P.graceUntil = 0; P.docked = null;

// — 1) il Galeone del Tesoro: stazza tripla, tre Guardie coi cannoni pesanti —
game.spawnCarovana('tesoro');
const flotta = game.carovane.tesoro;
assert(flotta, 'la flotta esiste');
const galeone = game.ships.get(flotta.capo);
const guardie = flotta.scorte.map(id => game.ships.get(id));
assert(galeone.name === 'Galeone del Tesoro' && game.npcMaxHp(galeone) === 420, 'galeone da 420 hp');
assert(guardie.length === 3 && guardie.every(g => g.name === 'Guardia del Tesoro'), 'tre Guardie');
assert(guardie.every(g => g.mounts.left.every(w => w.lvl === 3)), 'le Guardie sparano al livello 3');
assert(etere.some(m => (m.t === 'feed' && /GALEONE DEL TESORO/.test(m.msg || '')) ||
  (m.t === 'notifica' && /GALEONE DEL TESORO/.test((m.voce && m.voce.testo) || ''))), 'annuncio in grande stile');
ok('Galeone del Tesoro: 420 hp, 3 Guardie al livello 3, annuncio 👑');

// — 2) convoglio e flotta convivono: due carovane, calendari separati —
game.prossimaCarovana.convoglio = 0;
game.tickCarovane();
assert(game.carovane.convoglio && game.carovane.tesoro, 'due carovane in mare insieme');
ok('convivenza: convoglio e flotta sullo stesso mare');

// — 3) l'oro del tesoro si prende col tocco: 1000 fissi, una volta —
galeone.hp = 100; // sotto il 30% di 420
game.damageShip(galeone, 1, P.id);
assert(galeone.resaUntil > game.now, 'anche il Galeone ammaina sotto la soglia');
P.x = galeone.x + 10; P.y = galeone.y;
const oroPrima = P.gold;
game.tickResa();
assert.strictEqual(P.gold - oroPrima, 1000, `bottino del tesoro (+${P.gold - oroPrima})`);
ok('saccheggio del tesoro: 1000 🪙 col tocco, dal listino');

// — 4) l'infamia chiama: alla terza preda spawna il Cacciatore —
P.kills = 0; P.tagliaCacciata = 0;
const prede = [...game.ships.values()].filter(s => s.npc === 'merc' && !s.convoglio);
game.sink(prede[0], P.id); // kills 1
assert(game.cacciatori === 0, 'una preda non basta');
P.kills = 2; // scorciatoia: seconda preda già a diario
game.sink(prede[0], P.id); // kills 3 → mandato
const cacciatore = [...game.ships.values()].find(s => s.caccia);
assert(cacciatore && cacciatore.name === 'Cacciatore di Taglie', 'il Cacciatore è salpato');
assert(cacciatore.caccia.bersaglio === P.id, 'e ha fiutato l\'Infame');
assert(game.npcMaxHp(cacciatore) === 480, 'stazza da 480 hp');
assert(cacciatore.mounts.left.every(w => w.lvl === 3), 'cannoni al livello 3');
assert(etere.some(m => m.t === 'feed' && /taglia pende su Infame/.test(m.msg || '')), 'il mandato è pubblico');
assert.strictEqual(P.tagliaCacciata, P.kills, 'il conto riparte dal mandato');
ok('infamia: 3 prede → Cacciatore di Taglie alle costole');

// — 5) niente doppioni: un mandato alla volta per pirata —
P.kills += 3;
game.valutaTaglia(P);
assert.strictEqual([...game.ships.values()].filter(s => s.caccia).length, 1, 'un solo Cacciatore per l\'Infame');
ok('un mandato alla volta: niente mute di cacciatori');

// — 6) il Cacciatore insegue SOLO il suo uomo, e nel fumo aspetta —
P.x = cacciatore.x + 400; P.y = cacciatore.y;
cacciatore.input = { up: false, down: false, left: false, right: false };
game.steerCacciatore(cacciatore);
assert(cacciatore.input.up, 'vele piene verso il braccato');
game.smokes.push({ x: P.x, y: P.y, r: 150, until: game.now + 10 });
game.steerCacciatore(cacciatore);
assert(!cacciatore.input.up && game.ships.has(cacciatore.id), 'nel fumo aspetta, non rinuncia');
game.smokes.length = 0;
ok('caccia: insegue il bersaglio, il fumo lo fa solo aspettare');

// — 7) mandato scaduto: il Cacciatore rinuncia e sparisce, il conto riparte —
cacciatore.caccia.fino = game.now - 1;
P.kills += 1; // un'altra preda a diario, per vedere il reset
game.steerCacciatore(cacciatore);
assert(!game.ships.has(cacciatore.id), 'il Cacciatore leva l\'ancora');
assert.strictEqual(game.cacciatori, 0, 'il posto si libera');
assert.strictEqual(P.tagliaCacciata, P.kills, 'il conto dell\'infamia riparte');
assert(etere.some(m => m.t === 'feed' && /rinuncia/.test(m.msg || '')), 'la rinuncia è pubblica');
ok('mandato scaduto: rinuncia pubblica, conto azzerato');

// — 8) la testa del Cacciatore vale 120: ucciderlo paga e libera —
P.tagliaCacciata = P.kills - CACCIA_OGNI(); // pronto per un nuovo mandato
function CACCIA_OGNI() { return 3; }
game.valutaTaglia(P);
const c2 = [...game.ships.values()].find(s => s.caccia);
assert(c2, 'nuovo mandato spiccato');
c2.hp = 1;
game.damageShip(c2, 999, P.id);
// l'oro totale può includere premi di missione (onKill fa il suo mestiere):
// la TAGLIA dichiarata nel broadcast è la misura giusta
const killMsg = [...etere].reverse().find(m => m.t === 'kill' && m.victim === 'Cacciatore di Taglie');
assert(killMsg && killMsg.bounty === 120, `taglia del Cacciatore nel broadcast (${killMsg && killMsg.bounty})`);
assert.strictEqual(game.cacciatori, 0, 'mandato chiuso a cannonate');
assert.strictEqual(P.tagliaCacciata, P.kills, 'pace comprata: conto azzerato');
c2.sunkUntil = game.now - 1;
game.respawn(c2);
assert(!game.ships.has(c2.id), 'il Cacciatore affondato non rispawna');
ok('taglia sul Cacciatore: 120 🪙, pace comprata, niente respawn');

// — 9) il tetto: mai più di 2 Cacciatori sul mare —
game.cacciatori = 2;
P.tagliaCacciata = 0; P.kills = 30;
game.valutaTaglia(P);
assert.strictEqual([...game.ships.values()].filter(s => s.caccia).length, 0, 'col mare pieno nessun mandato nuovo');
game.cacciatori = 0;
ok('tetto: 2 cacciatori al massimo, è un mare non un tribunale');

game.stop();
console.log('TESORO E CACCIA OK 👑⚔');
