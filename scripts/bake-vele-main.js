'use strict';

// Guscio Electron del Cantiere delle Vele: carica la pagina di bake con
// ?vele=1 e scrive l'UNICO atlante (tela bianca) in game/assets/vele/.

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const root = path.join(__dirname, '..');
const OUT_DIR = path.join(root, 'game', 'assets', 'vele');

app.whenReady().then(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const win = new BrowserWindow({ width: 300, height: 300, show: true });
  let done = false;
  win.webContents.on('console-message', async (ev, ...args) => {
    const msg = String((ev && typeof ev === 'object' && 'message' in ev) ? ev.message : args[1]);
    if (msg.startsWith('BAKE-ERRORE')) { console.error(msg); app.exit(1); }
    if (msg !== 'BAKE-DONE' || done) return;
    done = true;
    const dataUrl = await win.webContents.executeJavaScript('window.__atlas');
    const meta = await win.webContents.executeJavaScript('window.__meta');
    fs.writeFileSync(path.join(OUT_DIR, 'tela.webp'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT_DIR, 'tela.json'), meta);
    console.log('BAKE 📦 game/assets/vele/tela.webp + tela.json');
    app.exit(0);
  });
  await win.loadFile(path.join(root, 'game', 'labbake.html'), { query: { vele: '1' } });
});
