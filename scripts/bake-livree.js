'use strict';

// Cuoce gli atlanti delle livree (issue #25): bundle della pagina three.js
// → Electron → un WebP per livrea in game/assets/livree/.
// Uso: node scripts/bake-livree.js   (rigenerare se cambiano modelli o palette)

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
const el = spawn(require('electron'), [path.join(__dirname, 'bake-livree-main.js'), ...flags], {
  stdio: 'inherit', cwd: root,
});
el.on('exit', (c) => process.exit(c || 0));
