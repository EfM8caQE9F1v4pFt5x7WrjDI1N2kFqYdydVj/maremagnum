'use strict';
// Test della flotta (issue #11): la matrice del legno in weapons.js —
// scala per tipo, slot per tipo, riscatti e contrabbando. Unit test puro.
//
// Uso: node scripts/test-flotta.js

const W = require('../server/weapons');

let failures = 0;
function ok(cond, label) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + label);
  if (!cond) failures++;
}

console.log('— La scala salta i gradini vietati —');
ok(W.nextTier('cannone', 'guerra') === 'carronata', 'guerra: cannone → carronata (scala piena)');
ok(W.nextTier('cannone', 'goletta') === 'mortaio', 'goletta: cannone → mortaio (la carronata si salta)');
ok(W.nextTier('cannone', 'sciabecco') === 'mortaio', 'sciabecco: cannone → mortaio (idem)');
ok(W.nextTier('mortaio', 'goletta') === 'lunga', 'goletta: in cima la Colubrina Lunga');
ok(W.nextTier('mortaio', 'sciabecco') === 'falconetto', 'sciabecco: in cima il Falconetto a Ripetizione');
ok(W.nextTier('mortaio', null) === null, 'senza varo niente quinto gradino');
ok(W.nextTier('carronata', 'goletta') === 'mortaio', 'una carronata d\'annata sale comunque al mortaio');

console.log('— Gli slot non sono uguali per tutti —');
const gGal = W.groupsPer('galeone'), gSci = W.groupsPer('sciabecco'), gGue = W.groupsPer('guerra'), gGol = W.groupsPer('goletta');
ok(gGal.left.max === 6 && gGal.bow.max === 0 && gGal.stern.max === 0, 'galeone: fiancate a 6, niente assiali');
ok(gGol.left.max === 4 && gGol.bow.max === 3 && gGol.stern.max === 2, 'goletta: fiancate corte, prua a 3');
ok(gSci.left.max === 3 && gSci.bow.max === 3 && gSci.stern.max === 3, 'sciabecco: poco per lato, punge davanti e dietro');
ok(gGue.left.max === 5 && gGue.bow.max === 2, 'guerra: la matrice di sempre');
ok(W.slotCost('left', 5, 'galeone') === 7800, 'la sesta bocca del galeone costa 7800');
ok(W.slotCost('left', 4, 'goletta') === null, 'la goletta si ferma a 4 per lato');
ok(W.slotCost('bow', 2, 'sciabecco') === 3000, 'il terzo assiale dello sciabecco costa 3000');
ok(W.slotCost('bow', 0, 'galeone') === null, 'niente slot di prua per il galeone');
ok(W.slotCost('left', 1, 'guerra') === 200, 'la seconda bocca di fiancata resta a 200');

console.log('— Il riscatto: mai confische —');
// il varo (fonte fidata): esclusiva altrui, assiali e vietate tornano oro pieno
const varo = W.sanitizeConRiscatto({
  left: [{ type: 'pesante', lvl: 2 }],
  right: [{ type: 'colubrina', lvl: 1 }],
  bow: [{ type: 'cannone', lvl: 2 }],
  stern: [{ type: 'colubrina', lvl: 1 }, { type: 'colubrina', lvl: 1 }],
}, 'galeone', true);
const attesi = W.weaponValue({ type: 'pesante', lvl: 2 })   // 14550
  + W.weaponValue({ type: 'cannone', lvl: 2 })              // 540
  + 400                                                     // slot di prua
  + W.weaponValue({ type: 'colubrina', lvl: 1 }) * 2 + 400 + 1200; // poppa: armi e slot
ok(varo.riscatto === attesi, `varo a galeone: riscatto pieno (${varo.riscatto} = ${attesi})`);
ok(varo.mounts.left[0].type === 'colubrina', 'la pesante lascia una colubrina di cortesia');
ok(varo.mounts.bow.length === 0 && varo.mounts.stern.length === 0, 'gli assiali sbarcano');
ok(varo.tolte.length === 4, `il conto elenca le armi tolte (${varo.tolte.length})`);

// il join (fonte NON fidata): la vietata si riscatta (era comprabile), il
// contrabbando d'esclusiva si rifiuta senza pagare
const join = W.sanitizeConRiscatto({
  left: [{ type: 'carronata', lvl: 1 }],
  right: [{ type: 'lunga', lvl: 3 }],
}, 'sciabecco');
ok(join.riscatto === 1080, `carronata d'annata sullo sciabecco: riscattata (${join.riscatto})`);
ok(join.mounts.right[0].type === 'colubrina', 'la Lunga di contrabbando è rifiutata…');
ok(!join.tolte.includes('Colubrina Lunga'), '…e non finisce sul conto');
const casa = W.sanitizeConRiscatto({ left: [{ type: 'falconetto', lvl: 2 }], right: [] }, 'sciabecco');
ok(casa.mounts.left[0].type === 'falconetto' && casa.riscatto === 0, 'il Falconetto sullo sciabecco è di casa');

console.log('— Tetti assoluti e grandfathering —');
const otto = W.sanitizeConRiscatto({
  left: Array.from({ length: 8 }, () => ({ type: 'colubrina', lvl: 1 })),
  right: [{ type: 'colubrina', lvl: 1 }],
}, 'goletta');
ok(otto.mounts.left.length === 6, 'oltre il tetto assoluto (6) si tronca, ma sopra il tetto di tipo (4) si tiene');
ok(W.sanitizeMounts(null, 'goletta').left[0].type === 'colubrina', 'profilo marcio → nave base');

console.log(failures ? `\n${failures} FALLIMENTI ❌` : '\nTutto in ordine ✅');
process.exit(failures ? 1 : 0);
