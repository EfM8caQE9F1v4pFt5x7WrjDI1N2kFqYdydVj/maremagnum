'use strict';

// Genera game/tokens.css (il blocco :root) dalla fonte di verità game/tokens.json.
// Un colore si aggiunge/modifica SOLO in tokens.json: qui si limita a proiettarlo
// in custom property CSS. Il canvas (render/guns/mapgen) pesca dagli stessi valori
// via game/src/palette.js. La parità è verificata da scripts/test-tokens.js.
//
// Uso: node scripts/gen-tokens.js   (incluso nel build)

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const tokens = require(path.join(root, 'game/tokens.json'));

function righe(gruppo) {
  return Object.entries(gruppo)
    .map(([nome, val]) => `  --${nome}: ${val};`)
    .join('\n');
}

// I gruppi di tokens.json proiettati in :root, in ordine, con la loro didascalia.
// tokens.canvas NON è qui: è servito al canvas come interi 0x da palette.js.
// scripts/test-tokens.js usa la STESSA lista per non segnalare deriva.
const GRUPPI_CSS = [
  ['color',  'colori'],
  ['wash',   'veli e fondali (rgba)'],
  ['radius', 'raggi (il righello, issue #32)'],
  ['type',   'scala tipografica (corpi-font)'],
  ['space',  'spaziatura (spine modulari)'],
  ['z',      'strati (z-index)'],
  ['elev',   'elevazione (ombre e placche)'],
];

const blocchi = GRUPPI_CSS
  .map(([chiave, nota]) => `  /* ${nota} */\n${righe(tokens[chiave])}`)
  .join('\n\n');

const css = `/* GENERATO da scripts/gen-tokens.js — NON modificare a mano.
   Fonte di verità: game/tokens.json (${tokens.$palette}). */
:root {
${blocchi}
}
`;

const out = path.join(root, 'game/tokens.css');
fs.writeFileSync(out, css);
const n = GRUPPI_CSS.reduce((s, [k]) => s + Object.keys(tokens[k]).length, 0);
console.log(`  ✅ tokens.css generato (${n} token) → ${path.relative(root, out)}`);
