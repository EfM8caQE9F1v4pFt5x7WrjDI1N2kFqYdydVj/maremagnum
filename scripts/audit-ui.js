'use strict';

// Orchestrazione dell'audit UX/UI: bundle → server → Electron pilotato.
// Uso: AUDIT_OUT=/percorso node scripts/audit-ui.js

const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const PORT = 3314;

async function main() {
  require('esbuild').buildSync({
    entryPoints: [path.join(root, 'game/src/main.js')],
    bundle: true,
    outfile: path.join(root, 'game/dist/bundle.js'),
    sourcemap: true,
    logLevel: 'warning',
  });

  const server = spawn(process.execPath, [path.join(root, 'server/index.js')], {
    env: { ...process.env, PORT },
  });
  await new Promise(r => setTimeout(r, 2500));

  const el = spawn(require('electron'), [path.join(__dirname, 'audit-ui-main.js'), '--ozone-platform=wayland', '--disable-gpu'], {
    env: { ...process.env, GAME_URL: `http://localhost:${PORT}/?nome=Auditor&ora=0.25&spia=1&reset=1` },
  });
  el.stdout.on('data', d => process.stdout.write(d));
  el.stderr.on('data', () => {});
  el.on('exit', (c) => { server.kill(); process.exit(c || 0); });
}

main();
