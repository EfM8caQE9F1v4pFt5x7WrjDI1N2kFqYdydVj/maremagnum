'use strict';

// Collaudo d'accessibilità: axe-core (WCAG 2.x A+AA) su ogni stato dell'UI.
// Uso: npm run test:a11y  — esce 1 se c'è anche una sola violazione.

const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const PORT = 3316;

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

  const el = spawn(require('electron'), [path.join(__dirname, 'test-a11y-main.js'), '--ozone-platform=wayland', '--disable-gpu'], {
    env: { ...process.env, A11Y_PORT: PORT, GAME_URL: `http://localhost:${PORT}/?ora=0.25&spia=1&reset=1&lang=it` },
  });
  el.stdout.on('data', d => process.stdout.write(d));
  el.stderr.on('data', () => {});
  el.on('exit', (c) => { server.kill(); process.exit(c || 0); });
}

main();
