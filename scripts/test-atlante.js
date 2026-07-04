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

console.log('\nATLANTE VERDE 🗺');
process.exit(0);
