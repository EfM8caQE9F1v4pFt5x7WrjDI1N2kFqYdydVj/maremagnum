'use strict';

// Guscio Electron del Cantiere delle Livree (issue #25): carica la pagina
// di bake UNA volta per livrea (?livrea=<id>) e scrive atlas + metadati in
// game/assets/livree/. Le livree arrivano dal catalogo del server.

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const root = path.join(__dirname, '..');
const OUT_DIR = path.join(root, 'game', 'assets', 'livree');
const { CATALOGO } = require(path.join(root, 'server', 'livree.js'));
const IDS = Object.entries(CATALOGO).filter(([, l]) => l.genere === 'livrea').map(([id]) => id);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // UNA finestra riusata: distruggerla e ricrearla fra i load fa ERR_FAILED
  const win = new BrowserWindow({ width: 300, height: 300, show: true });
  for (const id of IDS) {
    const fatto = new Promise((res, rej) => {
      const onMsg = async (ev, ...args) => {
        const msg = String((ev && typeof ev === 'object' && 'message' in ev) ? ev.message : args[1]);
        if (msg.startsWith('BAKE-ERRORE')) { win.webContents.off('console-message', onMsg); return rej(new Error(msg)); }
        if (msg !== 'BAKE-DONE') return;
        win.webContents.off('console-message', onMsg);
        const dataUrl = await win.webContents.executeJavaScript('window.__atlas');
        const meta = await win.webContents.executeJavaScript('window.__meta');
        fs.writeFileSync(path.join(OUT_DIR, id + '.webp'), Buffer.from(dataUrl.split(',')[1], 'base64'));
        fs.writeFileSync(path.join(OUT_DIR, id + '.json'), meta);
        console.log(`BAKE 📦 game/assets/livree/${id}.webp + ${id}.json`);
        res();
      };
      win.webContents.on('console-message', onMsg);
    });
    // un load può fallire di sfuggita (ERR_FAILED) se il precedente sta chiudendo: riprova
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      try { await win.loadFile(path.join(root, 'game', 'labbake.html'), { query: { livrea: id } }); break; }
      catch { await sleep(600); }
    }
    try { await fatto; } catch (e) { console.error(e.message); app.exit(1); }
  }
  app.exit(0);
});
