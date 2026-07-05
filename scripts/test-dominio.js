'use strict';

// Un sito, un'isola (issue #26): il dominio registrabile è la carta
// d'identità — i sottodomini si fondono, i TLD diversi restano isole.

const assert = require('assert');
const { dominioBase } = require('../server/dominio');
const { parseCourse } = require('../server/world');
const atlante = require('../server/atlante-core');

const ok = (m) => console.log(`  ✅ ${m}`);

// — 1) il dominio registrabile —
assert.strictEqual(dominioBase('it.wikipedia.org'), 'wikipedia.org');
assert.strictEqual(dominioBase('www.WIKIPEDIA.org'), 'wikipedia.org');
assert.strictEqual(dominioBase('a.b.c.example.com'), 'example.com');
assert.strictEqual(dominioBase('wikipedia.org'), 'wikipedia.org');
assert.strictEqual(dominioBase('wikipedia.it'), 'wikipedia.it'); // TLD diverso = isola diversa
assert.strictEqual(dominioBase('news.bbc.co.uk'), 'bbc.co.uk'); // suffisso a due livelli
assert.strictEqual(dominioBase('shop.foo.com.au'), 'foo.com.au');
ok('dominioBase: sottodomini fusi, TLD distinti, suffissi a due livelli rispettati');

// — 2) la rotta resta profonda, l'isola è una —
const r1 = parseCourse('https://it.wikipedia.org/wiki/Isola');
assert.strictEqual(r1.domain, 'wikipedia.org', 'il sottodominio non fa isola');
assert.strictEqual(r1.url, 'https://it.wikipedia.org/wiki/Isola', 'ma la rotta apre la pagina digitata');
const r2 = parseCourse('m.wikipedia.org');
assert.strictEqual(r2.domain, 'wikipedia.org');
const r3 = parseCourse('news.bbc.co.uk/qualcosa');
assert.strictEqual(r3.domain, 'bbc.co.uk');
assert.strictEqual(parseCourse('wikipedia.it').domain, 'wikipedia.it');
ok('parseCourse: stessa isola per ogni sottodominio, URL profondo conservato');

// — 3) l'Atlante fonde le chiavi storiche sommando gli approdi —
atlante.setConteggi({ 'it.wikipedia.org': 5, 'en.wikipedia.org': 3, 'wikipedia.org': 4, 'wikipedia.it': 2 });
assert.strictEqual(atlante.approdiDi('wikipedia.org'), 12, 'i sottodomini si sommano');
assert.strictEqual(atlante.approdiDi('m.wikipedia.org'), 12, 'la lettura è canonica');
assert.strictEqual(atlante.approdiDi('wikipedia.it'), 2, 'il TLD resta suo');
atlante.registraApprodo('de.wikipedia.org');
assert.strictEqual(atlante.approdiDi('wikipedia.org'), 13, 'i nuovi approdi scrivono la chiave base');
atlante.mergeConteggi({ 'fr.wikipedia.org': 20 });
assert.strictEqual(atlante.approdiDi('wikipedia.org'), 20, 'il merge al rialzo è canonico');
assert(atlante.sopraSoglia(3).includes('wikipedia.org') && !atlante.sopraSoglia(3).some(d => d.includes('en.')),
  'la semina vedrà UNA sola isola');
ok('Atlante riconciliato: conteggi fusi, semina senza doppioni');

console.log('\nUN SITO, UN\'ISOLA 🗺');
process.exit(0);
