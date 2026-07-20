'use strict';

// Cuoce l'atlante animato della Ciurma: uno scheletro low-poly, quindici
// vestizioni, quattro animazioni condivise. Uso: npm run bake:pirati.

const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

require('esbuild').buildSync({
  entryPoints: [path.join(root, 'scripts', 'bake-pirati-page.js')],
  bundle: true,
  outfile: path.join(root, 'game', 'dist', 'bake-pirati.js'),
  logLevel: 'warning',
});

if (process.env.SOLO_BUNDLE) {
  console.log('BUNDLE 📦 game/dist/bake-pirati.js');
  process.exit(0);
}

const flags = (process.env.ELECTRON_FLAGS ||
  '--ozone-platform=wayland --disable-gpu --enable-unsafe-swiftshader').split(' ').filter(Boolean);
const el = spawn(require('electron'), [path.join(__dirname, 'bake-pirati-main.js'), ...flags], {
  stdio: 'inherit', cwd: root,
});
el.on('exit', c => process.exit(c || 0));
