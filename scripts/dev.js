'use strict';

// Avvio sviluppo: bundle del client → server di gioco → guscio Electron.

const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const PORT = process.env.PORT || 3210;

async function main() {
  console.log('🔨 Bundle del client…');
  require('esbuild').buildSync({
    entryPoints: [path.join(root, 'game/src/main.js')],
    bundle: true,
    outfile: path.join(root, 'game/dist/bundle.js'),
    sourcemap: true,
    logLevel: 'warning',
  });

  console.log('🌊 Avvio del Mare dell\'Internet…');
  const server = spawn(process.execPath, [path.join(root, 'server/index.js')], {
    stdio: 'inherit', env: { ...process.env, PORT },
  });

  const healthy = await waitFor(`http://localhost:${PORT}/health`, 10000);
  if (!healthy) { console.error('Il server non risponde.'); server.kill(); process.exit(1); }

  console.log('⚓ Apertura del guscio browser…');
  const extra = (process.env.ELECTRON_FLAGS || '').split(' ').filter(Boolean);
  const electron = spawn(require('electron'), ['.', ...extra], {
    stdio: 'inherit', cwd: root,
    env: { ...process.env, GAME_URL: `http://localhost:${PORT}` },
  });

  const cleanup = () => { server.kill(); electron.kill(); };
  electron.on('exit', () => { server.kill(); process.exit(0); });
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
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
