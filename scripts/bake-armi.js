'use strict';

// Cuoce l'atlas delle bocche da fuoco: bundle della pagina three.js →
// Electron → WebP. Uso: node scripts/bake-armi.js
// (rigenerare solo se cambia il modello; vedi bake-navi.js per le navi)

const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

require('esbuild').buildSync({
  entryPoints: [path.join(root, 'scripts', 'bake-armi-page.js')],
  bundle: true,
  outfile: path.join(root, 'game', 'dist', 'bake-armi.js'),
  logLevel: 'warning',
});

const flags = (process.env.ELECTRON_FLAGS || '--ozone-platform=wayland --disable-gpu --enable-unsafe-swiftshader').split(' ').filter(Boolean);
const el = spawn(require('electron'), [path.join(__dirname, 'bake-armi-main.js'), ...flags], {
  stdio: 'inherit', cwd: root,
});
el.on('exit', (c) => process.exit(c || 0));
