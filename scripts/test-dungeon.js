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

// — LE DIFESE CON CARATTERE (feature del capitano): ogni difesa cade con
// l'arma giusta — lo Specchio sul mastio si prende SOLO ad arco (la terra
// fa scudo ai tiri diretti), la Corazzata fa rimbalzare il piombo leggero,
// i Serventi cadono solo sotto la mitraglia. Una nave sola non basta:
// l'alleanza con armi diverse è il disegno.
{
  const g2 = new Game(() => {});
  g2.pausa();
  const dgS = campagna.genera('giornaliero', campagna.giornoDi() + 1, ['mastio-di-prova.org']);
  dgS.difese = { torri: 3, bombarde: 0, corazzate: 1, serventi: 1, specchio: true };
  campagna.setDungeon('giornaliero', dgS);
  campagna.setDungeon('settimanale', null); // le sezioni sopra lasciano un settimanale in campo
  const isolaS = g2.archipelago.ensure('mastio-di-prova.org').island;
  g2.applicaDungeoni();
  const specchio = isolaS.defs.find(d => d.kind === 's');
  const corazzata = isolaS.defs.find(d => d.kind === 'c');
  const serventi = isolaS.defs.find(d => d.kind === 'v');
  assert(specchio && corazzata && serventi, 'specchio, corazzata e serventi in campo');
  assert(specchio.x === isolaS.x && specchio.y === isolaS.y, 'lo Specchio sta sul mastio (centro esatto)');
  const S = g2.join(conn(), { t: 'join', name: 'Bombardiere', profile: { gold: 0 } });
  S.graceUntil = 0;

  // 1) lo SPECCHIO: il tiro diretto muore sulla spiaggia (la terra fa scudo)
  let hpPrima = specchio.hp;
  g2.fxQueue.length = 0;
  g2.spawnShot(S.id, isolaS.x - isolaS.r - 150, isolaS.y, 0, { speed: 460, range: isolaS.r + 400, dmg: 50 });
  for (let i = 0; i < 300 && g2.shots.size; i++) g2.moveShots(1 / 30);
  // (la palla può morire sulla spiaggia O su una difesa di cinta: in
  // entrambi i casi il mastio resta fuori portata — è questo il punto)
  assert.strictEqual(specchio.hp, hpPrima, 'il tiro diretto NON tocca lo Specchio sul mastio');
  assert.strictEqual(g2.shots.size, 0, 'e la palla è morta per strada');
  // ...ma il MORTAIO (arco + area) lo raggiunge
  g2.spawnShot(S.id, isolaS.x - 60, isolaS.y, 0, { speed: 250, range: 60, dmg: 50, aoe: 70, arc: true });
  for (let i = 0; i < 300 && g2.shots.size; i++) g2.moveShots(1 / 30);
  assert(specchio.hp < hpPrima, `il mortaio ad arco lo scalfisce (hp ${specchio.hp}/${hpPrima})`);
  ok('Specchio Ustorio: immune al tiro diretto, cade solo sotto le armi ad arco');

  // 2) la CORAZZATA: il piombo leggero rimbalza (clang), il pesante morde
  hpPrima = corazzata.hp;
  g2.fxQueue.length = 0;
  g2.damageDefense(isolaS, corazzata, 12, S.id, { damage: 12, mun: 'palle', aoe: 0 });
  assert.strictEqual(corazzata.hp, hpPrima, 'il colpo leggero (12) rimbalza: zero danni');
  assert(g2.fxQueue.some(f => f.k === 'clang'), 'e si sente il CLANG');
  g2.damageDefense(isolaS, corazzata, 34, S.id, { damage: 34, mun: 'palle', aoe: 0 });
  assert.strictEqual(corazzata.hp, hpPrima - 34, 'la carronata (34) la scalfisce');
  g2.damageDefense(isolaS, corazzata, 20, S.id); // il mortaio arriva senza shot: area, passa
  assert.strictEqual(corazzata.hp, hpPrima - 54, 'le armi in area passano la corazza');
  ok('Torre Corazzata: sotto i 28 danni rimbalza, i pezzi pesanti mordono');

  // 3) i SERVENTI: dietro i parapetti solo la mitraglia falcidia
  hpPrima = serventi.hp;
  g2.damageDefense(isolaS, serventi, 20, S.id, { damage: 20, mun: 'palle', aoe: 0 });
  assert.strictEqual(serventi.hp, hpPrima - 3, 'le palle piene mordono pochissimo (×0.15)');
  g2.damageDefense(isolaS, serventi, 20, S.id, { damage: 20, mun: 'mitraglia', aoe: 0 });
  assert.strictEqual(serventi.hp, hpPrima - 3 - 40, 'la mitraglia li falcidia (×2)');
  ok('Batteria dei Serventi: solo la mitraglia li falcidia');
  g2.stop();
}

console.log('\nDUNGEON DEL MASTRO VERDE ⚔🗺');
process.exit(0);
