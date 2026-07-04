'use strict';

// Cuoce l'atlas delle navi: bundle della pagina three.js → Electron → PNG.
// Uso: node scripts/bake-navi.js   (rigenerare solo se cambia il modello)

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
const el = spawn(require('electron'), [path.join(__dirname, 'bake-navi-main.js'), ...flags], {
  stdio: 'inherit', cwd: root,
});
el.on('exit', (c) => process.exit(c || 0));
