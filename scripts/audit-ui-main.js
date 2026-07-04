'use strict';

// Audit UX/UI interattivo: pilota l'app VERA (click, tastiera, rotta, attracco,
// sito) e scatta uno screenshot per ogni stato dell'interfaccia.
// Uso: electron scripts/audit-ui-main.js  (server già su 3314; vedi audit-ui.js)

process.env.GAME_URL = process.env.GAME_URL || 'http://localhost:3314/?nome=Auditor&ora=0.25';
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

// naviga a tentativi verso il Porto Franco usando il suggerimento d'attracco
async function dockAtPort() {
  for (let attempt = 0; attempt < 10; attempt++) {
    await key('KeyW'); await sleep(1000); await key('KeyW', 'keyup');
    await sleep(1400); // decelera
    const h = await hint();
    console.log(`AUDIT rotta ${attempt}: "${h}"`);
    if (/Premi F per attraccare a Porto Franco/.test(h)) { await key('KeyF'); await key('KeyF', 'keyup'); await sleep(900); return true; }
    if (/Ammaina/.test(h) && /Porto Franco/.test((await hint()) || h)) { await key('KeyS'); await sleep(1500); await key('KeyS', 'keyup'); await key('KeyF'); await key('KeyF', 'keyup'); await sleep(900); return true; }
    // fuori rotta: vira e riprova (più deciso se abbiamo perso l'isola)
    const turn = h.includes('tiro di sasso') ? 420 : 850;
    await key('KeyA'); await sleep(turn); await key('KeyA', 'keyup');
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

  // 3. classifica (TAB tenuto premuto)
  await key('Tab'); await sleep(500);
  await snap(game, 'a3-classifica');
  await key('Tab', 'keyup'); await sleep(300);

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
