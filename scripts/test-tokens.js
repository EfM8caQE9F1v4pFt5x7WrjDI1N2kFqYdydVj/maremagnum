'use strict';

// Guardia del ponte token (issue #32): la fonte di verità (game/tokens.json),
// il :root generato (game/tokens.css) e l'uso in game/style.css devono restare
// in parità. Cattura: colori scritti a mano nel CSS, var(--x) senza definizione,
// tokens.css non rigenerato dopo una modifica a tokens.json.
//
// Uso: node scripts/test-tokens.js   (incluso in npm test)

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

let failures = 0;
function ok(cond, label) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + label);
  if (!cond) failures++;
}

const tokens = require(path.join(root, 'game/tokens.json'));
const css = fs.readFileSync(path.join(root, 'game/tokens.css'), 'utf8');
const style = fs.readFileSync(path.join(root, 'game/style.css'), 'utf8');

const tutti = { ...tokens.color, ...tokens.wash };

// 1) tokens.css definisce ESATTAMENTE i token della fonte, coi valori giusti
let defiOk = true;
for (const [nome, val] of Object.entries(tutti)) {
  if (!css.includes(`--${nome}: ${val};`)) { defiOk = false; console.log(`      manca/diverge --${nome}: ${val}`); }
}
ok(defiOk, `tokens.css riflette tutti i ${Object.keys(tutti).length} token di tokens.json (rigenerato?)`);

// 2) nessun token di troppo in tokens.css (deriva)
const definiti = [...css.matchAll(/--([a-z0-9-]+):/g)].map(m => m[1]);
const extra = definiti.filter(n => !(n in tutti));
ok(extra.length === 0, 'tokens.css non ha token orfani' + (extra.length ? ' — di troppo: ' + extra.join(', ') : ''));

// 3) ogni var(--x) usata in style.css è definita — nei token generati O come
//    helper strutturale nello stesso style.css (es. --studs, che compone i
//    token colore in un gradiente riusabile)
const usate = [...style.matchAll(/var\(--([a-z0-9-]+)\)/g)].map(m => m[1]);
const localVars = new Set([...style.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m => m[1]));
const dangling = [...new Set(usate)].filter(n => !(n in tutti) && !localVars.has(n));
ok(dangling.length === 0, `le ${new Set(usate).size} var(--x) usate in style.css sono tutte definite` + (dangling.length ? ' — orfane: ' + dangling.join(', ') : ''));

// 4) nessun colore di palette scritto a mano in style.css (hex a 6 cifre o rgba colorato)
const hex6 = [...new Set([...style.matchAll(/#[0-9a-fA-F]{6}\b/g)].map(m => m[0]))];
ok(hex6.length === 0, 'style.css non ha hex a 6 cifre scritti a mano' + (hex6.length ? ' — trovati: ' + hex6.join(' ') : ''));

const rgbaColor = [...new Set([...style.matchAll(/rgba?\([^)]*\)/g)].map(m => m[0]))]
  // ombre nere e lucentezze bianche restano inline: sono ELEVAZIONE, non palette
  .filter(s => !/^rgba?\(\s*0\s*,\s*0\s*,\s*0/.test(s) && !/^rgba?\(\s*255\s*,\s*255\s*,\s*255/.test(s));
ok(rgbaColor.length === 0, 'style.css non ha rgba colorati scritti a mano' + (rgbaColor.length ? ' — trovati: ' + rgbaColor.join('  ') : ''));

// 6) ponte canvas: ogni COL.x usato in render.js è servito da palette.js
//    (tokens.canvas ∪ 'gold', che è condiviso con la UI)
const render = fs.readFileSync(path.join(root, 'game/src/render.js'), 'utf8');
const colUsate = [...new Set([...render.matchAll(/COL\.([a-zA-Z]+)/g)].map(m => m[1]))];
const colDef = new Set([...Object.keys(tokens.canvas), 'gold']);
const colMancanti = colUsate.filter(k => !colDef.has(k));
ok(colMancanti.length === 0, `le ${colUsate.length} COL.x usate in render.js sono servite da tokens.canvas` + (colMancanti.length ? ' — mancanti: ' + colMancanti.join(', ') : ''));

console.log('');
if (failures) { console.log(`  ${failures} controllo/i falliti.`); process.exit(1); }
console.log('  Ponte token in parità. ⚓');
