'use strict';
// Test del Negozio delle Livree (issue #25): catalogo, guardaroba dal
// profilo, precedenza delle scie, vessillo personale. Unit test puro.
//
// Uso: node scripts/test-livree.js

const L = require('../server/livree');

let failures = 0;
function ok(cond, label) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + label);
  if (!cond) failures++;
}

console.log('— Il catalogo: pay to show, mai pay to win —');
const voci = Object.entries(L.CATALOGO);
ok(voci.length >= 5, `il negozio ha merce (${voci.length} voci)`);
ok(voci.every(([, l]) => l.genere === 'livrea' || l.genere === 'scia'), 'ogni voce ha un genere noto');
ok(voci.every(([, l]) => typeof l.scia === 'number'), 'ogni voce ha il colore di scia');
ok(voci.every(([, l]) => l.prezzo === null ? !!l.impresa : l.prezzo > 0), 'prezzo in chiaro, o impresa dichiarata');
ok(L.CATALOGO.ombre.impresa === 'campagna', 'il Mare delle Ombre si guadagna con la campagna');
const pub = L.publicCatalogo();
ok(pub.nera.nome === 'Vele Nere' && pub.ombre.prezzo === null, 'il catalogo pubblico è fedele');

console.log('— Il guardaroba dal profilo: mai fidarsi —');
const g = L.sanificaGuardaroba({
  livree: ['nera', 'sciaoro', 'farlocca', 42, 'nera'],
  livrea: 'nera', scia: 'sciaoro', bandiera: { fondo: 99, taglio: -3, tinta2: 4, emblema: 0, tintaEmblema: 5 },
});
ok(g.livree.size === 2 && g.livree.has('nera') && g.livree.has('sciaoro'), 'le livree farlocche non salgono a bordo');
ok(g.livrea === 'nera' && g.scia === 'sciaoro', 'indossate solo se possedute e del genere giusto');
ok(g.bandiera.fondo === 3 && g.bandiera.taglio === 3, 'gli indici del vessillo si piegano ai set (99→3, −3→3)');
const g2 = L.sanificaGuardaroba({ livree: ['nera'], livrea: 'sciaoro', scia: 'nera' });
ok(g2.livrea === null && g2.scia === null, 'una scia non si indossa da livrea (né viceversa)');
ok(L.sanificaGuardaroba(null).livree.size === 0, 'profilo marcio → guardaroba vuoto');
ok(L.sanificaGuardaroba({ bandiera: 'x' }).bandiera === null, 'vessillo non-oggetto → niente vessillo');

console.log('— La scia effettiva: la comprata vince —');
ok(L.sciaDi({ livrea: 'nera', scia: 'sciaoro' }) === L.CATALOGO.sciaoro.scia, 'scia comprata > scia della livrea');
ok(L.sciaDi({ livrea: 'nera', scia: null }) === L.CATALOGO.nera.scia, 'senza scia comprata, colora la livrea');
ok(L.sciaDi({ livrea: null, scia: null }) === null, 'legno nudo → spuma del mare');

console.log(failures ? `\n${failures} FALLIMENTI ❌` : '\nTutto in ordine ✅');
process.exit(failures ? 1 : 0);
