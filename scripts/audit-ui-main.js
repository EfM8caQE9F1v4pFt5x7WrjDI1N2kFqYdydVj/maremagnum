'use strict';

// Audit UX/UI interattivo (issue #8): pilota l'app VERA con gli occhi del
// nuovo arrivato — benvenuto, primo minuto, rotta, attracco, combattimento,
// morte, Cantiere, varo, Manuale, ingorghi dell'HUD, notte — e scatta uno
// screenshot per ogni stato. Gli stati irraggiungibili in locale (ancoraggio
// senza Conti, assedio pieno) si mettono in scena via DOM, come nel test a11y.
// Uso: electron scripts/audit-ui-main.js  (server già su 3314; vedi audit-ui.js)

process.env.GAME_URL = process.env.GAME_URL || 'http://localhost:3314/?ora=0.25&spia=1&reset=1';
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

// mette in scena un combattimento leggibile: bordata vera, scafo ammaccato,
// diario che racconta i colpi (i valori sono finti, il LAYOUT è quello vero)
async function stageCombat() {
  await J(`
    document.getElementById('hpBar').style.width = '38%';
    document.getElementById('hpText').textContent = '38 / 100';
    const kf = document.getElementById('killfeed');
    kf.innerHTML = '';
    for (const msg of [
      '💥 Corsaro Fantasma ti ha colpito!',
      '🔥 Hai colpito Corsaro Fantasma',
      "⚓ Olonese è salpato nel Mare dell'Internet",
      '💀 Barbanera ha affondato Olonese',
    ]) {
      const el = document.createElement('div');
      el.className = 'feedItem';
      el.textContent = msg;
      kf.appendChild(el);
    }
  `);
  await key('KeyQ'); await key('KeyQ', 'keyup'); // bordata vera: fumo e palle in volo
  await sleep(350);
}

async function cleanCombat() {
  await J(`
    document.getElementById('hpBar').style.width = '100%';
    document.getElementById('hpText').textContent = '100 / 100';
    document.getElementById('killfeed').innerHTML = '';
  `);
}

app.whenReady().then(async () => {
  await sleep(6000);
  game = webContents.getAllWebContents().find(wc => wc.getURL().startsWith('http://localhost:3314'));
  if (!game) { console.log('AUDIT ❌ gameView non trovata'); return app.exit(1); }

  // ——— IL BENVENUTO, con gli occhi di chi arriva davvero ———
  // b1. la pergamena del nome (reale: si parte senza ?nome)
  await snap(game, 'b1-benvenuto-nome');

  // b2. il passo dell'ancoraggio (irraggiungibile senza Conti: in scena,
  // col QR finto disegnato perché il layout sia quello che vedrà l'utente)
  await J(`
    document.getElementById('benvenutoNome').classList.add('hidden');
    document.getElementById('benvenutoAncora').classList.remove('hidden');
    document.getElementById('benvenutoHandle').textContent = 'auditor';
    document.getElementById('benvenutoSegreto').textContent = 'ABCD EFGH IJKL MNOP';
    const c = document.getElementById('benvenutoQr');
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 168, 168);
    g.fillStyle = '#000';
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
      if ((x * 7 + y * 13 + ((x * y) % 5)) % 3 === 0) g.fillRect(4 + x * 7.6, 4 + y * 7.6, 7, 7);
    }
  `);
  await sleep(500);
  await snap(game, 'b2-benvenuto-ancora');

  // b3. "ho già un ancoraggio"
  await J(`
    document.getElementById('benvenutoAncora').classList.add('hidden');
    document.getElementById('benvenutoEntra').classList.remove('hidden');
  `);
  await sleep(500);
  await snap(game, 'b3-benvenuto-entra');
  await J(`
    document.getElementById('benvenutoEntra').classList.add('hidden');
    document.getElementById('benvenutoNome').classList.remove('hidden');
  `);

  // si salpa col nome vero (in locale, senza /ancora, si salpa in silenzio)
  await J(`
    document.getElementById('nameInput').value = 'Auditor';
    document.getElementById('nameForm').dispatchEvent(new Event('submit', { cancelable: true }));
  `);
  await sleep(1300);

  // ——— IL PRIMO MINUTO ———
  // a0. cosa vede il nuovo arrivato appena tocca l'acqua (toast + missione)
  await snap(game, 'a0-primo-minuto');
  await sleep(6000);

  // 1. plancia base di giorno (il toast se n'è andato)
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

  // 5. attracco al Porto Franco: cantiere (testa e coda) e bacheca assedi
  const docked = await dockAtPort();
  if (docked) {
    await sleep(600);
    await snap(game, 'a7-cantiere');
    // il varo e le armi stanno in fondo: il muro di bottoni va visto tutto
    await J(`document.querySelector('#shopOverlay .panel').scrollTop = 1e6`);
    await sleep(500);
    await snap(game, 'a7b-cantiere-fondo');
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

  // ——— GLI STATI DELLA CONFUSIONE (ipotesi della #8) ———
  // 13. il Manuale del Corsaro (arriva troppo tardi?)
  await J(`document.getElementById('helpBtn').click()`);
  await sleep(600);
  await snap(game, 'a13-manuale-come-apre');
  await J(`document.querySelector('#helpOverlay .panel').scrollTop = 0`);
  await sleep(400);
  await snap(game, 'a13b-manuale-inizio');
  await J(`document.getElementById('helpClose').click()`);
  await sleep(300);

  // 14. l'ingorgo in alto: missione + assedio + diario + toast tutti insieme
  await J(`
    document.getElementById('assedioHud').textContent = '⚔ ASSEDIO IN CORSO su Fortezza di Malware — 47s';
    document.getElementById('assedioHud').classList.remove('hidden');
    document.getElementById('toast').textContent = '🛡 La Ciurma di Guardia ha respinto 25 parassiti su questo sito';
    document.getElementById('toast').classList.remove('hidden');
  `);
  await stageCombat();
  await sleep(400);
  await snap(game, 'a14-ingorgo-in-alto');
  await J(`
    document.getElementById('assedioHud').classList.add('hidden');
    document.getElementById('toast').classList.add('hidden');
  `);
  await cleanCombat();

  // 15. combattimento "pulito": bordata, scafo al 38%, diario dei colpi
  await stageCombat();
  await sleep(400);
  await snap(game, 'a15-combattimento');
  await cleanCombat();

  // 16. due overlay insieme: si sovrappongono davvero?
  await J(`document.getElementById('settingsBtn').click()`);
  await sleep(300);
  await J(`document.getElementById('helpBtn').click()`);
  await sleep(300);
  await snap(game, 'a16-overlay-doppio');
  await key('Escape'); await sleep(200);
  await key('Escape'); await sleep(200);
  await J(`
    document.getElementById('settingsOverlay').classList.add('hidden');
    document.getElementById('helpOverlay').classList.add('hidden');
  `);

  // 12. affondamento
  await J(`
    document.getElementById('deathOverlay').classList.remove('hidden');
    document.getElementById('deathCount').textContent = '4';
  `);
  await sleep(500);
  await snap(game, 'a12-affondato');
  await J(`document.getElementById('deathOverlay').classList.add('hidden')`);

  // 17. il cannocchiale a zoom 2: la plancia regge l'ingrandimento?
  await game.loadURL('http://localhost:3314/?nome=Auditor&ora=0.25&zoom=2&spia=1');
  await sleep(6000);
  await snap(game, 'a17-zoom2');

  // ——— LA NOTTE, dopo il rialzo del pavimento di luce ———
  await game.loadURL('http://localhost:3314/?nome=Auditor&ora=0.87&spia=1');
  await sleep(6000);
  await snap(game, 'n1-plancia-notte');
  await key('KeyW'); await sleep(2200);
  await snap(game, 'n2-vela-notte');
  await key('KeyW', 'keyup');
  await stageCombat();
  await sleep(400);
  await snap(game, 'n3-combattimento-notte');
  await cleanCombat();

  console.log('AUDIT FINITO');
  app.exit(0);
});
