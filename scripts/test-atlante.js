'use strict';

// L'Atlante comunitario, messo alla prova senza rete: un capitano attracca,
// l'approdo viene registrato, e un dominio con molti approdi genera
// un'isola più grande per tutti.

const assert = require('assert');
const atlante = require('../server/atlante-core');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);

// 1) crescita: 0 approdi = 1×, tanti approdi = più grande, con tetto
assert.strictEqual(atlante.crescita('mai-visto.it'), 1);
atlante.setConteggi({ 'famoso.it': 1000, 'noto.it': 10 });
assert(atlante.crescita('noto.it') > 1.4 && atlante.crescita('noto.it') < 1.7);
assert(atlante.crescita('famoso.it') > 2.4 && atlante.crescita('famoso.it') <= 2.5);
ok('crescita logaritmica con tetto (10 approdi ~1.5×, 1000 ~2.5×)');

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

// 5) la semina al risveglio (issue #12): il Game rinasce e le mete condivise
//    (≥3 approdi) rinascono con lui, in posizioni stabili; sotto soglia no
atlante.setConteggi({ 'famoso.it': 1000, 'noto.it': 10, 'timido.it': 2 });
const rinato = new Game(() => {});
rinato.pausa();
assert(rinato.archipelago.get('famoso.it'), 'famoso.it non riseminata al risveglio');
assert(rinato.archipelago.get('noto.it'), 'noto.it non riseminata al risveglio');
assert(!rinato.archipelago.get('timido.it'), 'sotto soglia (<3) non deve nascere');
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
for (let i = 0; i < 3; i++) {
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

// 7) il cap della semina: mai più di 150 isole riseminate d'un colpo
const tanti = {};
for (let i = 0; i < 160; i++) tanti[`dominio-${String(i).padStart(3, '0')}.it`] = 3 + (i % 7);
atlante.setConteggi(tanti);
const affollato = new Game(() => {});
affollato.pausa();
const seminate = affollato.archipelago.list().filter(i => i.kind === 'site').length;
assert(seminate === 150, `attese 150 isole seminate, trovate ${seminate}`);
ok('la semina rispetta il cap (150 su 160 sopra soglia)');

// 8) fusione al rialzo: il merge non perde gli approdi locali più freschi
atlante.setConteggi({ 'viva.it': 5 });
atlante.registraApprodo('viva.it'); // 6 locale
atlante.mergeConteggi({ 'viva.it': 5, 'nuova.it': 4 });
assert.strictEqual(atlante.approdiDi('viva.it'), 6, 'il merge ha regredito un conteggio locale');
assert.strictEqual(atlante.approdiDi('nuova.it'), 4, 'il merge non ha portato la novità');
ok('mergeConteggi fonde al rialzo senza regressioni');

console.log('\nATLANTE VERDE 🗺');
process.exit(0);
