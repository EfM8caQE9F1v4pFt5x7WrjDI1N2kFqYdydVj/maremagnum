'use strict';

// Guscio Electron minimale per gli screenshot di sviluppo (audit visivi).
// Uso: electron scripts/shot-main.js <baseUrl> <query1::out1.png> [query2::out2.png ...]
// Ogni coppia apre il gioco con quella query string, attende il rendering e
// salva un PNG. Vedi scripts/shot.js per l'orchestrazione completa.

const fs = require('fs');
const { app, BrowserWindow } = require('electron');

// I flag Chromium (--ozone-platform=…) restano in argv: teniamo solo i nostri.
const [baseUrl, ...pairs] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const WAIT_MS = parseInt(process.env.SHOT_WAIT || '5000', 10);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  let failed = false;
  for (const pair of pairs) {
    const [query, out] = pair.split('::');
    const win = new BrowserWindow({
      width: 1440, height: 900, show: true,
      webPreferences: { backgroundThrottling: false },
    });
    win.webContents.on('console-message', (ev, ...args) => {
      if (!process.env.SHOT_LOG) return;
      const msg = (ev && typeof ev === 'object' && 'message' in ev) ? ev.message : args[1];
      console.log(`[pagina] ${String(msg).slice(0, 1200)}`);
    });
    try {
      const sep = baseUrl.endsWith('.html') ? '?' : '/?';
      await win.loadURL(query ? `${baseUrl}${sep}${query}` : baseUrl);
      await sleep(WAIT_MS);
      const img = await win.webContents.capturePage();
      fs.writeFileSync(out, img.toPNG());
      console.log(`📸 ${out} (${query})`);
    } catch (e) {
      failed = true;
      console.error(`✗ ${out}: ${e.message}`);
    }
    win.destroy();
  }
  app.exit(failed ? 1 : 0);
});
