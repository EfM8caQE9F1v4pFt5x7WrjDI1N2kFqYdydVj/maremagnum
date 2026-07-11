'use strict';

// Cuoce l'atlante dei mostri: bundle della pagina three.js → Electron → webp.
// Uso: node scripts/bake-mostri.js   (rigenerare solo se cambia il bestiario)
// Dove Electron non gira (sandbox): chrome headless su labmostri.html?dump=1
// e poi scripts/estrai-bake.js sul DOM-dump.

const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

require('esbuild').buildSync({
  entryPoints: [path.join(root, 'scripts', 'bake-mostri-page.js')],
  bundle: true,
  outfile: path.join(root, 'game', 'dist', 'bake-mostri.js'),
  logLevel: 'warning',
});

if (process.env.SOLO_BUNDLE) { console.log('BUNDLE 📦 game/dist/bake-mostri.js'); process.exit(0); }

const flags = (process.env.ELECTRON_FLAGS || '--ozone-platform=wayland --disable-gpu --enable-unsafe-swiftshader').split(' ').filter(Boolean);
const el = spawn(require('electron'), [path.join(__dirname, 'bake-mostri-main.js'), ...flags], {
  stdio: 'inherit', cwd: root,
});
el.on('exit', (c) => process.exit(c || 0));
