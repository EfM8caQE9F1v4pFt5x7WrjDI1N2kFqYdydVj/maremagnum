'use strict';

// Estrae atlante+metadati dal DOM-dump della pagina di bake (?dump=1):
// la via per cuocere SENZA Electron (sandbox: chrome headless --dump-dom).
// Uso: node scripts/estrai-bake.js <dump.html> <outdir> <nome>
//   es. node scripts/estrai-bake.js /tmp/dump.html game/assets/vele tela

const fs = require('fs');
const path = require('path');

const [dumpPath, outDir, nome] = process.argv.slice(2);
if (!dumpPath || !outDir || !nome) {
  console.error('Uso: node scripts/estrai-bake.js <dump.html> <outdir> <nome>');
  process.exit(2);
}

const html = fs.readFileSync(dumpPath, 'utf8');
if (html.includes('BAKE-ERRORE')) {
  console.error(html.match(/BAKE-ERRORE[^<]*/)[0]);
  process.exit(1);
}
const m = html.match(/<pre id="bake-dump">([\s\S]*?)<\/pre>/);
if (!m) { console.error('dump senza <pre id="bake-dump">: bake non completato?'); process.exit(1); }
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const { atlas, meta } = JSON.parse(unescape(m[1]));

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, nome + '.webp'), Buffer.from(atlas.split(',')[1], 'base64'));
fs.writeFileSync(path.join(outDir, nome + '.json'), meta);
console.log(`ESTRATTO 📦 ${path.join(outDir, nome)}.webp + .json (${JSON.parse(meta).steps} pose)`);
