'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { FAZIONI } = require('../server/fazioni');

const voci = Object.values(FAZIONI);
assert.deepStrictEqual(voci.map(f => f.id), [
  'ciurma_libera', 'compagnia_indie', 'marina_britannica',
]);

for (const fazione of voci) {
  assert.strictEqual(fazione.roster.length, 15, fazione.id + ': roster da 15');
  assert.strictEqual(new Set(fazione.roster.map(p => p.id)).size, 15,
    fazione.id + ': id unici');
  for (const p of fazione.roster) {
    const file = path.join(__dirname, '..', 'game', p.ritratto);
    assert(fs.existsSync(file), fazione.id + '/' + p.id + ': ritratto mancante');
    const buf = fs.readFileSync(file);
    assert(buf.length < 80 * 1024, fazione.id + '/' + p.id + ': oltre 80 KB');
    assert.strictEqual(buf.subarray(0, 4).toString('ascii'), 'RIFF',
      fazione.id + '/' + p.id + ': contenitore WebP non valido');
    assert.strictEqual(buf.subarray(8, 12).toString('ascii'), 'WEBP',
      fazione.id + '/' + p.id + ': firma WebP non valida');
  }
}

assert(FAZIONI.marina_britannica.roster.every(p =>
  !/(fantasma|scheletro|revenant|maledett)/.test(p.id)),
  'la Marina non arruola non-morti');

console.log('  ✅ fazioni: 3 roster da 15, 45 WebP presenti, unici e leggeri');
