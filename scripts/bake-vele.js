'use strict';

// Cuoce l'atlante delle VELE: bundle della pagina three.js → Electron → UN
// solo WebP di tela bianca (bandiera OCCLUSA: resta quella colorata dello
// scafo) in game/assets/vele/tela.webp. La tinta la dà il client dal catalogo
// (vele comprate) o da tela.json `tinte` (variante/livrea): una vela nuova
// NON richiede bake. Gli atlanti base/livree sono SCAFI NUDI: senza questa
// tela la flotta è un relitto — vedi labscafi.html per il collaudo visivo.
// Uso: node scripts/bake-vele.js   (rigenerare se cambiano i modelli)
// Dove Electron non gira (sandbox): chrome headless con ?vele=1&dump=1 e
// --dump-dom, poi scripts/estrai-bake.js sul dump.

const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

require('esbuild').buildSync({
  entryPoints: [path.join(root, 'scripts', 'bake-navi-page.js')],
  bundle: true,
  outfile: path.join(root, 'game', 'dist', 'bake-navi.js'),
  logLevel: 'warning',
});

const flags = (process.env.ELECTRON_FLAGS || '--ozone-platform=wayland --disable-gpu --enable-unsafe-swiftshader').split(' ').filter(Boolean);
const el = spawn(require('electron'), [path.join(__dirname, 'bake-vele-main.js'), ...flags], {
  stdio: 'inherit', cwd: root,
});
el.on('exit', (c) => process.exit(c || 0));
