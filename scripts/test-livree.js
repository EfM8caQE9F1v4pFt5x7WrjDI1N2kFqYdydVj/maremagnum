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
ok(voci.length >= 9, `il negozio ha merce (${voci.length} voci)`);
ok(voci.every(([, l]) => L.GENERI.includes(l.genere)), 'ogni voce ha un genere noto (livrea/vele/scia)');
ok(voci.every(([, l]) => typeof l.scia === 'number'), 'ogni voce ha il colore di scia');
ok(voci.filter(([, l]) => l.genere === 'vele').every(([, l]) => typeof l.tinta === 'number'),
  'ogni vela ha la tinta della tela (il client tinge l\'atlante unico)');
ok(voci.every(([, l]) => l.prezzo === null ? !!l.impresa : l.prezzo > 0), 'prezzo in chiaro, o impresa dichiarata');
ok(L.CATALOGO.ombre.impresa === 'campagna', 'il Mare delle Ombre si guadagna con la campagna');
const pub = L.publicCatalogo();
ok(pub.nera.nome === 'Livrea della Notte' && pub.ombre.prezzo === null, 'il catalogo pubblico è fedele');
ok(pub.velenere.genere === 'vele' && pub.velenere.tinta === L.CATALOGO.velenere.tinta,
  'le vele viaggiano con genere e tinta ("Vele Nere" ora è tela, non abito intero)');

console.log('— Il guardaroba dal profilo: mai fidarsi —');
const g = L.sanificaGuardaroba({
  livree: ['nera', 'sciaoro', 'velenere', 'farlocca', 42, 'nera'],
  livrea: 'nera', vele: 'velenere', scia: 'sciaoro', bandiera: { fondo: 99, taglio: -3, tinta2: 4, emblema: 0, tintaEmblema: 5 },
});
ok(g.livree.size === 3 && g.livree.has('nera') && g.livree.has('velenere'), 'le livree farlocche non salgono a bordo');
ok(g.livrea === 'nera' && g.vele === 'velenere' && g.scia === 'sciaoro', 'tre slot indipendenti, ognuno del suo genere');
ok(g.bandiera.fondo === 3 && g.bandiera.taglio === 3, 'gli indici del vessillo si piegano ai set (99→3, −3→3)');
const g2 = L.sanificaGuardaroba({ livree: ['nera', 'velenere'], livrea: 'velenere', vele: 'nera', scia: 'nera' });
ok(g2.livrea === null && g2.vele === null && g2.scia === null,
  'i generi non si scambiano gli slot (era la trappola livree/vele)');
ok(L.sanificaGuardaroba(null).livree.size === 0, 'profilo marcio → guardaroba vuoto');
ok(L.sanificaGuardaroba({ bandiera: 'x' }).bandiera === null, 'vessillo non-oggetto → niente vessillo');

console.log('— Gli atlanti a scafi nudi: la tela DEVE coprire tutta la flotta —');
// col fix "cannoni sopra le vele" gli atlanti base/livree sono SENZA vele:
// se una variante manca in tela.json (o una livrea non ha la sua tinta),
// quella nave naviga da relitto — il contratto si controlla qui, senza browser
{
  const fs = require('fs');
  const path = require('path');
  const leggi = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));
  const navi = leggi('game/assets/navi.json');
  const tela = leggi('game/assets/vele/tela.json');
  ok(Object.keys(navi.variants).every(v => tela.variants[v] !== undefined),
    'ogni variante della flotta (NPC compresi) ha la sua tela nell\'atlante');
  ok(tela.tinte && Object.keys(navi.variants).every(v => Number.isInteger(tela.tinte.base[v])),
    'ogni variante ha la tinta di tela di default (dal bake, fonte unica)');
  const livree = Object.entries(L.CATALOGO).filter(([, v]) => v.genere === 'livrea').map(([id]) => id);
  ok(tela.tinte && livree.every(id => Number.isInteger(tela.tinte.livree[id])),
    'ogni livrea del catalogo ha la tinta di tela (le vele della livrea)');
  ok(livree.every(id => {
    const lj = leggi('game/assets/livree/' + id + '.json');
    return Object.keys(lj.variants).every(v => tela.variants[v] !== undefined);
  }), 'ogni variante di ogni livrea è coperta dalla tela');
  ok(navi.frame === tela.frame && navi.steps === tela.steps && navi.scala === tela.scala,
    'scafo e tela sono cotti alla stessa scala e passo (pixel-perfect)');
}

console.log('— La scia effettiva: comprata > vele > livrea —');
ok(L.sciaDi({ livrea: 'nera', vele: 'velenere', scia: 'sciaoro' }) === L.CATALOGO.sciaoro.scia, 'scia comprata > tutto');
ok(L.sciaDi({ livrea: 'nera', vele: 'veledoro', scia: null }) === L.CATALOGO.veledoro.scia, 'le vele colorano prima della livrea');
ok(L.sciaDi({ livrea: 'nera', scia: null }) === L.CATALOGO.nera.scia, 'senza scia comprata né vele, colora la livrea');
ok(L.sciaDi({ livrea: null, scia: null }) === null, 'legno nudo → spuma del mare');

console.log(failures ? `\n${failures} FALLIMENTI ❌` : '\nTutto in ordine ✅');
process.exit(failures ? 1 : 0);
