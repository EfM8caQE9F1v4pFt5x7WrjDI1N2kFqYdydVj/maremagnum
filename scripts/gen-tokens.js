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

const css = `/* GENERATO da scripts/gen-tokens.js — NON modificare a mano.
   Fonte di verità: game/tokens.json (${tokens.$palette}). */
:root {
  /* colori */
${righe(tokens.color)}

  /* veli e fondali (rgba) */
${righe(tokens.wash)}
}
`;

const out = path.join(root, 'game/tokens.css');
fs.writeFileSync(out, css);
const n = Object.keys(tokens.color).length + Object.keys(tokens.wash).length;
console.log(`  ✅ tokens.css generato (${n} token) → ${path.relative(root, out)}`);
