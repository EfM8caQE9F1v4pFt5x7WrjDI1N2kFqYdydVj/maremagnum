'use strict';

// Guscio Electron del Cantiere di Cottura: carica la pagina di bake,
// aspetta BAKE-DONE e scrive atlas + metadati in game/assets/.

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const root = path.join(__dirname, '..');
const OUT_DIR = path.join(root, 'game', 'assets');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 300, height: 300, show: true });
  let done = false;
  win.webContents.on('console-message', async (ev, ...args) => {
    const msg = (ev && typeof ev === 'object' && 'message' in ev) ? ev.message : args[1];
    if (String(msg).startsWith('BAKE-ERRORE')) { console.error(msg); app.exit(1); }
    if (String(msg) !== 'BAKE-DONE' || done) return;
    done = true;
    const dataUrl = await win.webContents.executeJavaScript('window.__atlas');
    const meta = await win.webContents.executeJavaScript('window.__meta');
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'navi.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT_DIR, 'navi.json'), meta);
    console.log('BAKE 📦 game/assets/navi.png + navi.json');
    app.exit(0);
  });
  await win.loadFile(path.join(root, 'game', 'labbake.html'));
});
