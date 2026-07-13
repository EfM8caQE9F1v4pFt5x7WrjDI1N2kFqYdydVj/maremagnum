'use strict';

// L'Atlante comunitario, messo alla prova senza rete: un capitano attracca,
// l'approdo viene registrato, e un dominio con molti approdi genera
// un'isola più grande per tutti.

const assert = require('assert');
const atlante = require('../server/atlante-core');
const { Game } = require('../server/game');
const { WORLD, Archipelago, worldForCount, portForWorld } = require('../server/world');

const ok = (m) => console.log(`  ✅ ${m}`);

// 1) crescita: 0 approdi = 1×, ogni scatto costa il TRIPLO delle visite del
//    precedente (issue #26bis), con tetto a 3×
assert.strictEqual(atlante.crescita('mai-visto.it'), 1);
atlante.setConteggi({ 'famoso.it': 100000, 'noto.it': 10 });
assert(atlante.crescita('noto.it') > 1.25 && atlante.crescita('noto.it') < 1.35, `noto ~1.3, ha ${atlante.crescita('noto.it')}`);
assert(atlante.crescita('famoso.it') === 3, `famoso al tetto 3×, ha ${atlante.crescita('famoso.it')}`);
ok('crescita ×3 per scatto con tetto 3× (10 approdi ~1.3×, enorme → 3×)');

// 2) un'isola famosa nasce più grande di una sconosciuta (stesso seme di base)
const game = new Game(() => {});
game.pausa(); // niente timer nel test
const { island: sconosciuta } = game.archipelago.ensure('sconosciuta-xyz.it');
const { island: famosa } = game.archipelago.ensure('famoso.it');
assert(famosa.r > 120, `l'isola famosa dovrebbe superare la stazza base (r=${famosa.r})`);
assert(sconosciuta.r <= 121, `l'isola sconosciuta resta di stazza base (r=${sconosciuta.r})`);
ok(`l'Atlante fa la stazza: famoso.it r=${famosa.r}, sconosciuta r=${sconosciuta.r}`);

// 3) l'approdo di un capitano registra la visita via onApprodo
let registrato = null;
game.onApprodo = (dominio) => { registrato = dominio; };
const conn = { send() {}, readyState: 1 };
const ship = game.join(conn, { t: 'join', name: 'Collaudatore', profile: {} });
ship.x = sconosciuta.x; ship.y = sconosciuta.y + sconosciuta.r + 30; ship.vel = 0;
game.dock(ship);
assert.strictEqual(ship.docked, 'sconosciuta-xyz.it', 'attracco fallito');
assert.strictEqual(registrato, 'sconosciuta-xyz.it', 'approdo non registrato');
ok('approdo registrato nell\'Atlante al momento dell\'attracco');

// 4) il porto NON conta (non è un sito)
registrato = null;
game.undock(ship);
const porto = game.archipelago.get('porto');
ship.x = porto.x; ship.y = porto.y + porto.r + 30; ship.vel = 0;
game.dock(ship);
assert.strictEqual(registrato, null, 'il porto non deve finire nell\'Atlante');
ok('il Porto Franco resta fuori dall\'Atlante');

// 5) la semina al risveglio (issue #12/#26bis): il Game rinasce e le mete
//    condivise (≥ soglia 20) rinascono con lui, in posizioni stabili; sotto
//    soglia no (isole effimere, le vede solo chi ci naviga)
atlante.setConteggi({ 'famoso.it': 1000, 'noto.it': 30, 'timido.it': 10 });
const rinato = new Game(() => {});
rinato.pausa();
assert(rinato.archipelago.get('famoso.it'), 'famoso.it non riseminata al risveglio');
assert(rinato.archipelago.get('noto.it'), 'noto.it (30 approdi) non riseminata al risveglio');
assert(!rinato.archipelago.get('timido.it'), 'sotto soglia (10 < 20) non deve nascere');
const ancora = new Game(() => {});
ancora.pausa();
for (const d of ['famoso.it', 'noto.it']) {
  assert.strictEqual(rinato.archipelago.get(d).x, ancora.archipelago.get(d).x, `${d}: x instabile tra risvegli`);
  assert.strictEqual(rinato.archipelago.get(d).y, ancora.archipelago.get(d).y, `${d}: y instabile tra risvegli`);
}
ok('al risveglio le isole sopra soglia rinascono, in posizioni stabili');

// 6) il percorso completo della issue #12, come lo vive il MareDO: tre approdi
//    → il Game si riavvia sugli stessi conteggi → l'isola c'è, e un secondo
//    giocatore la trova nel welcome
atlante.setConteggi({});
const prima = new Game(() => {});
prima.pausa();
prima.onApprodo = (d) => atlante.registraApprodo(d); // stesso aggancio del MareDO
const { island: meta } = prima.archipelago.ensure('meta-condivisa.it');
const capitano = prima.join(conn, { t: 'join', name: 'Pioniere', profile: {} });
for (let i = 0; i < 20; i++) { // servono 20 approdi perché diventi isola stabile
  capitano.x = meta.x; capitano.y = meta.y + meta.r + 30; capitano.vel = 0;
  prima.dock(capitano);
  assert.strictEqual(capitano.docked, 'meta-condivisa.it', `approdo ${i + 1} fallito`);
  prima.undock(capitano);
}
const dopo = new Game(() => {});
dopo.pausa();
assert(dopo.archipelago.get('meta-condivisa.it'), "l'isola è evaporata al riavvio");
let welcome2 = null;
const conn2 = { send(s) { const m = JSON.parse(s); if (m.t === 'welcome') welcome2 = m; }, readyState: 1 };
dopo.join(conn2, { t: 'join', name: 'Secondo', profile: {} });
assert(welcome2 && welcome2.islands.some(i => i.id === 'meta-condivisa.it'),
  'il secondo giocatore non vede l\'isola nel welcome');
ok('approdo ×3 → riavvio del Game → l\'isola resta e il secondo giocatore la vede');

// 7) espansione #14: fino a 500 isole riseminate, su anelli successivi e
//    senza il vecchio fallback che accettava sovrapposizioni dopo 60 tentativi
const tanti = {};
for (let i = 0; i < 520; i++) tanti[`dominio-${String(i).padStart(3, '0')}.it`] = 20 + (i % 7);
atlante.setConteggi(tanti);
const affollato = new Game(() => {});
affollato.pausa();
const isoleAffollate = affollato.archipelago.list().filter(i => i.kind === 'site');
assert.strictEqual(isoleAffollate.length, 500, `attese 500 isole seminate, trovate ${isoleAffollate.length}`);
assert(affollato.world.W > WORLD.W && affollato.world.level === 3,
  `il mare affollato deve espandersi al livello 3 (world=${JSON.stringify(affollato.world)})`);
for (let i = 0; i < isoleAffollate.length; i++) {
  for (let j = i + 1; j < isoleAffollate.length; j++) {
    const a = isoleAffollate[i], b = isoleAffollate[j];
    assert(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r + 260,
      `sovrapposizione silenziosa fra ${a.domain} e ${b.domain}`);
  }
}
ok('500 isole su quattro anelli, senza sovrapposizioni silenziose');

// anche il caso patologico (tutte già cresciute al tetto 3×) non torna al
// vecchio overlap: il costruttore apre automaticamente l'anello di riserva
const enormi = {};
for (let i = 0; i < 500; i++) enormi[`gigante-${String(i).padStart(3, '0')}.it`] = 100000;
atlante.setConteggi(enormi);
const mareGigante = new Game(() => {});
mareGigante.pausa();
assert.strictEqual(mareGigante.archipelago.list().filter(i => i.kind === 'site').length, 500);
assert(mareGigante.world.level >= 3, 'le isole giganti devono avere spazio aggiuntivo');
ok('caso limite: 500 isole a crescita 3× trovano spazio senza overlap');

// 8) quando il mondo si allarga, la geografia già nota non si sposta rispetto
//    al Porto: cambia solo l'origine del quadrato trasmesso nel welcome
const baseWorld = worldForCount(20), wideWorld = worldForCount(200);
const basePort = portForWorld(baseWorld), widePort = portForWorld(wideWorld);
const baseArcipelago = new Archipelago(baseWorld, basePort);
const wideArcipelago = new Archipelago(wideWorld, widePort);
for (let i = 0; i < 20; i++) {
  const dominio = `stabile-${i}.it`;
  const a = baseArcipelago.ensure(dominio).island;
  const b = wideArcipelago.ensure(dominio).island;
  assert(Math.abs((a.x - basePort.x) - (b.x - widePort.x)) < 1e-9,
    `${dominio}: longitudine relativa cambiata`);
  assert(Math.abs((a.y - basePort.y) - (b.y - widePort.y)) < 1e-9,
    `${dominio}: latitudine relativa cambiata`);
}
ok('l\'espansione conserva la geografia relativa al Porto');

// 9) fusione al rialzo: il merge non perde gli approdi locali più freschi
atlante.setConteggi({ 'viva.it': 5 });
atlante.registraApprodo('viva.it'); // 6 locale
atlante.mergeConteggi({ 'viva.it': 5, 'nuova.it': 4 });
assert.strictEqual(atlante.approdiDi('viva.it'), 6, 'il merge ha regredito un conteggio locale');
assert.strictEqual(atlante.approdiDi('nuova.it'), 4, 'il merge non ha portato la novità');
ok('mergeConteggi fonde al rialzo senza regressioni');

console.log('\nATLANTE VERDE 🗺');
process.exit(0);
