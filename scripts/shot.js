'use strict';

// Screenshot di sviluppo: bundle → server → Electron → PNG.
// Uso: node scripts/shot.js "nome=Auditor&ora=0.3::/tmp/giorno.png" [...]
// Ogni argomento è "querystring::file-di-output".

const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const PORT = process.env.SHOT_PORT || 3311;

async function main() {
  const pairs = process.argv.slice(2);
  if (!pairs.length) { console.error('Uso: node scripts/shot.js "query::out.png" [...]'); process.exit(1); }

  require('esbuild').buildSync({
    entryPoints: [path.join(root, 'game/src/main.js')],
    bundle: true,
    outfile: path.join(root, 'game/dist/bundle.js'),
    sourcemap: true,
    logLevel: 'warning',
  });

  const server = spawn(process.execPath, [path.join(root, 'server/index.js')], {
    stdio: 'inherit', env: { ...process.env, PORT },
  });
  const healthy = await waitFor(`http://localhost:${PORT}/health`, 10000);
  if (!healthy) { console.error('Il server non risponde.'); server.kill(); process.exit(1); }

  // --enable-unsafe-swiftshader: nelle sandbox senza GPU il WebGL software va
  // abilitato esplicitamente, altrimenti Pixi ripiega sul CanvasRenderer.
  const extra = (process.env.ELECTRON_FLAGS || '--ozone-platform=wayland --disable-gpu --enable-unsafe-swiftshader').split(' ').filter(Boolean);
  const electron = spawn(require('electron'), [path.join(__dirname, 'shot-main.js'), ...extra, `http://localhost:${PORT}`, ...pairs], {
    stdio: 'inherit', cwd: root, env: { ...process.env },
  });

  electron.on('exit', (code) => { server.kill(); process.exit(code || 0); });
  process.on('SIGINT', () => { server.kill(); electron.kill(); process.exit(0); });
}

async function waitFor(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.ok) return true; } catch { /* riprova */ }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

main();
