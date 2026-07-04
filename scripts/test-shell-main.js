'use strict';

// Riproduzione end-to-end del guscio: apre davvero un sito nella siteView?
// Uso: electron scripts/test-shell-main.js (con server già avviato su 3313).

process.env.GAME_URL = process.env.GAME_URL || 'http://localhost:3313/?nome=Tester';
require('../shell/main.js');

const { app, webContents } = require('electron');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  await sleep(7000); // gioco su, guardia in caricamento
  const game = webContents.getAllWebContents().find(wc => wc.getURL().startsWith('http://localhost:3313'));
  if (!game) { console.log('TESTSHELL ❌ gameView non trovata'); return app.exit(1); }

  await game.executeJavaScript("window.navigareShell.openSite('https://example.com/')");
  await sleep(6000);
  const urls = webContents.getAllWebContents().map(wc => wc.getURL());
  console.log('TESTSHELL urls: ' + JSON.stringify(urls));
  const site = urls.find(u => u.includes('example.com'));
  console.log(site ? 'TESTSHELL SITO APERTO ✅' : 'TESTSHELL SITO NON APERTO ❌');

  // e con l'upgrade https-first da un url http?
  await game.executeJavaScript("window.navigareShell.openSite('http://neverssl.com/')");
  await sleep(6000);
  const urls2 = webContents.getAllWebContents().map(wc => wc.getURL());
  console.log('TESTSHELL urls2: ' + JSON.stringify(urls2));
  const site2 = urls2.find(u => u.includes('neverssl.com'));
  console.log(site2 ? `TESTSHELL HTTP APERTO ✅ (${site2.split('/')[0]}//…)` : 'TESTSHELL HTTP NON APERTO ❌');

  app.exit(site && site2 ? 0 : 1);
});
