'use strict';

// Audit UX/UI interattivo: pilota l'app VERA (click, tastiera, rotta, attracco,
// sito) e scatta uno screenshot per ogni stato dell'interfaccia.
// Uso: electron scripts/audit-ui-main.js  (server già su 3314; vedi audit-ui.js)

process.env.GAME_URL = process.env.GAME_URL || 'http://localhost:3314/?nome=Auditor&ora=0.25';
const LARGHEZZA = parseInt(process.env.AUDIT_W || '1440', 10);
require('../shell/main.js');

const fs = require('fs');
const path = require('path');
const { app, webContents } = require('electron');

const OUT = process.env.AUDIT_OUT || '/tmp';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let game = null;
const J = (code) => game.executeJavaScript(code).catch((e) => { console.log('AUDIT js err: ' + e.message); });
const snap = async (wc, name) => {
  const img = await wc.capturePage();
  fs.writeFileSync(path.join(OUT, name + '.png'), img.toPNG());
  console.log('AUDIT 📸 ' + name);
};
const key = (code, type = 'keydown') =>
  J(`window.dispatchEvent(new KeyboardEvent('${type}', { code: '${code}', cancelable: true }))`);
const hint = () => game.executeJavaScript(`document.getElementById('dockHint').textContent`);

// naviga verso il Porto Franco col rilevamento vero (?spia=1 espone
// posizione e porto): prua sul molo, avanti, e F appena il porto lo consente
async function dockAtPort() {
  const spia = () => game.executeJavaScript(`(() => {
    if (!window.__spia) return null;
    const me = window.__spia.latestMe();
    const port = window.__spia.state.port;
    return me && port ? { x: me.x, y: me.y, rot: me.rot, px: port.x, py: port.y } : null;
  })()`);
  for (let attempt = 0; attempt < 40; attempt++) {
    const s = await spia();
    if (!s) { await sleep(600); continue; }
    const dist = Math.hypot(s.px - s.x, s.py - s.y);
    const bearing = Math.atan2(s.py - s.y, s.px - s.x);
    let err = bearing - s.rot;
    while (err > Math.PI) err -= 2 * Math.PI;
    while (err < -Math.PI) err += 2 * Math.PI;
    const h = await hint();
    if (attempt % 5 === 0) console.log(`AUDIT rotta ${attempt}: dist=${dist | 0} err=${err.toFixed(2)} "${h}"`);
    if (/Premi F per attraccare a Porto Franco/.test(h)) {
      await key('KeyF'); await key('KeyF', 'keyup'); await sleep(900);
      return true;
    }
    if (Math.abs(err) > 0.18) {
      const k = err > 0 ? 'KeyD' : 'KeyA'; // rot cresce in senso orario (y in giù)
      await key(k); await sleep(Math.min(900, Math.abs(err) * 420)); await key(k, 'keyup');
    } else if (dist > 150) {
      await key('KeyW'); await sleep(900); await key('KeyW', 'keyup');
    } else {
      await sleep(500); // vicini e lenti: aspetta che il molo ci "prenda"
    }
  }
  return false;
}

app.whenReady().then(async () => {
  await sleep(7000);
  game = webContents.getAllWebContents().find(wc => wc.getURL().startsWith('http://localhost:3314'));
  if (!game) { console.log('AUDIT ❌ gameView non trovata'); return app.exit(1); }

  // 1. plancia base di giorno
  await snap(game, 'a1-plancia');

  // 2. impostazioni di bordo
  await J(`document.getElementById('settingsBtn').click()`);
  await sleep(500);
  await snap(game, 'a2-impostazioni');
  await J(`document.getElementById('settingsClose').click()`);
  await sleep(300);

  // 3. classifica (C tenuto premuto; TAB ora è della navigazione)
  await key('KeyC'); await sleep(500);
  await snap(game, 'a3-classifica');
  await key('KeyC', 'keyup'); await sleep(300);

  // 4. rotta verso un sito: input + mappa del tesoro
  await J(`document.getElementById('courseInput').value = 'wikipedia.org'`);
  await snap(game, 'a4-rotta-input');
  await J(`document.getElementById('courseForm').dispatchEvent(new Event('submit', { cancelable: true }))`);
  await sleep(1500);
  await snap(game, 'a5-mappa-tesoro');
  await J(`document.getElementById('sailBtn').click()`);
  await sleep(400);
  await snap(game, 'a6-rotta-sul-mare');

  // 5. attracco al Porto Franco: cantiere e bacheca degli assedi
  const docked = await dockAtPort();
  if (docked) {
    await sleep(600);
    await snap(game, 'a7-cantiere');
    await J(`document.getElementById('assedioOpen').click()`);
    await sleep(400);
    await snap(game, 'a8-assedi');
    await J(`document.getElementById('assedioClose').click()`);
    await sleep(200);
    await J(`document.getElementById('shopClose').click()`);
    await sleep(800);
  } else {
    console.log('AUDIT ⚠ attracco fallito: salto cantiere/assedi');
  }

  // 6. attracco a un'isola-sito (stato ricreato + sito vero nella siteView)
  await J(`
    document.getElementById('dockbar').classList.remove('hidden');
    document.getElementById('dockInfo').textContent = '⚓ Wikipedia — Isola di wikipedia.org';
    document.getElementById('dockUrl').textContent = 'https://it.wikipedia.org/';
    document.getElementById('guardInfo').textContent = '🛡 17';
    window.navigareShell.openSite('https://it.wikipedia.org/');
  `);
  await sleep(7000);
  await snap(game, 'a9-dockbar');
  const site = webContents.getAllWebContents().find(wc => wc.getURL().includes('wikipedia'));
  if (site) await snap(site, 'a10-sito');
  await J(`window.navigareShell.closeSite(); document.getElementById('dockbar').classList.add('hidden');`);
  await sleep(500);

  // 7. il Faro dell'Oracolo (ricerca)
  await J(`document.getElementById('searchOverlay').classList.remove('hidden')`);
  await snap(game, 'a11-oracolo');
  await J(`document.getElementById('searchOverlay').classList.add('hidden')`);

  // 8. affondamento
  await J(`
    document.getElementById('deathOverlay').classList.remove('hidden');
    document.getElementById('deathCount').textContent = '4';
  `);
  await snap(game, 'a12-affondato');

  console.log('AUDIT FINITO');
  app.exit(0);
});
