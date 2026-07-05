'use strict';

// Driver del collaudo d'accessibilità: pilota l'app vera e lancia axe-core
// (WCAG 2.x A + AA) su ogni stato dell'interfaccia. Gli stati difficili da
// raggiungere (morte, ancoraggio, dockbar) vengono mostrati a forza: qui si
// giudica il markup, non il viaggio.
// Uso: npm run test:a11y (via scripts/test-a11y.js)

const fs = require('fs');
const path = require('path');

const PORT = process.env.A11Y_PORT || 3316;
process.env.GAME_URL = process.env.GAME_URL || `http://localhost:${PORT}/?ora=0.25&spia=1&reset=1`;
require('../shell/main.js');

const { app, webContents } = require('electron');
const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let game = null;
let fallimenti = 0;
const visti = new Set(); // dedup: stessa regola sullo stesso nodo conta una volta

const J = (code) => game.executeJavaScript(code).catch((e) => { console.log('A11Y js err: ' + e.message); });

async function axeState(nome) {
  const c = await game.executeJavaScript('!!window.axe').catch(() => false);
  if (!c) await game.executeJavaScript(AXE).catch((e) => console.log('A11Y inject err: ' + e.message));
  const res = await game.executeJavaScript(`
    axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations', 'incomplete'],
    }).then(r => ({
      v: r.violations.map(x => ({ id: x.id, impact: x.impact, help: x.help,
        nodes: x.nodes.map(n => n.target.join(' ')).slice(0, 10) })),
      inc: r.incomplete.map(x => ({ id: x.id, n: x.nodes.length })),
    }))
  `).catch(e => { console.log('A11Y axe err: ' + e.message); return null; });
  if (!res) { fallimenti++; console.log(`  ❌ ${nome}: axe non ha girato`); return; }
  let nuovi = 0;
  for (const v of res.v) {
    for (const target of v.nodes) {
      const chiave = v.id + '|' + target;
      if (visti.has(chiave)) continue;
      visti.add(chiave);
      nuovi++;
      fallimenti++;
      console.log(`  ❌ [${v.impact}] ${v.id} — ${v.help}\n     ↳ ${target}`);
    }
  }
  const inc = res.inc.filter(i => i.id !== 'color-contrast'); // il canvas sotto rende indecidibile: verifica manuale
  console.log(`  ${nuovi === 0 ? '✅' : '❌'} ${nome}: ${nuovi} violazioni nuove` +
    (inc.length ? ` (da rivedere a mano: ${inc.map(i => i.id + '×' + i.n).join(', ')})` : ''));
}

const mostra = (id) => J(`document.getElementById('${id}').classList.remove('hidden')`);
const nascondi = (id) => J(`document.getElementById('${id}').classList.add('hidden')`);

app.whenReady().then(async () => {
  await sleep(7000);
  game = webContents.getAllWebContents().find(wc => wc.getURL().startsWith(`http://localhost:${PORT}`));
  if (!game) { console.log('A11Y ❌ pagina di gioco non trovata'); return app.exit(1); }

  console.log('— axe-core su ogni stato (WCAG 2.x A+AA) —');

  // 1. benvenuto: scelta del nome (l'app parte qui senza ?nome)
  await axeState('benvenuto-nome');

  // 2. benvenuto: passo dell'ancoraggio (irraggiungibile senza Conti: si forza)
  await J(`document.getElementById('benvenutoAncora').classList.remove('hidden')`);
  await axeState('benvenuto-ancora');
  await J(`document.getElementById('benvenutoAncora').classList.add('hidden')`);
  await J(`document.getElementById('benvenutoEntra').classList.remove('hidden')`);
  await axeState('benvenuto-entra');
  await J(`document.getElementById('benvenutoEntra').classList.add('hidden')`);

  // 2b. la pergamena del punto di partenza (issue #13), in scena coi bottoni
  await J(`(() => {
    const box = document.getElementById('salpaScelte');
    box.innerHTML = '';
    for (const label of ['⚓ Porto Franco', '⭐ wikipedia.org']) {
      const b = document.createElement('button');
      b.textContent = label;
      box.appendChild(b);
    }
    document.getElementById('salpaOverlay').classList.remove('hidden');
  })()`);
  await axeState('salpa-da');
  await J(`document.getElementById('salpaOverlay').classList.add('hidden')`);

  // 2c. la Gazzetta del Corsaro (issue #4) con la campagna del Mastro (#3)
  await J(`(() => {
    const box = document.getElementById('gazzettaVoci');
    box.innerHTML = '';
    const cb = document.createElement('div');
    cb.className = 'campagnaBox';
    cb.innerHTML = '<h3>⚔ La campagna della settimana: «Le Vele Nere»</h3>' +
      '<p class="campagnaLore">Il mare mormora di vele ostili.</p>' +
      '<ol class="campagnaTappe"><li class="fatta">✓ Affonda 2 Mercantili</li>' +
      '<li class="corrente">➤ Affonda 2 Corsari Fantasma (1/2)</li>' +
      '<li class="futura">· Espugna una Fortezza Proibita</li></ol>' +
      '<p class="campagnaPremio">Premio del Mastro: 400 🪙</p>';
    box.appendChild(cb);
    for (const [quando, testo, nuova] of [
      ['adesso', "🏰⚔️ Barbanera ha ESPUGNATO la Fortezza di Malware!", true],
      ['2 ore fa', '⚔ Olonese ha ABBORDATO Rackham! (+300 🪙)', false],
    ]) {
      const riga = document.createElement('div');
      riga.className = 'gazzettaVoce' + (nuova ? ' nuova' : '');
      const t = document.createElement('time');
      t.textContent = quando;
      const p = document.createElement('p');
      p.textContent = testo;
      riga.append(t, p);
      box.appendChild(riga);
    }
    const b = document.getElementById('gazzettaBadge');
    b.textContent = '1';
    b.classList.remove('hidden');
    document.getElementById('gazzettaOverlay').classList.remove('hidden');
  })()`);
  await axeState('gazzetta');
  await J(`document.getElementById('gazzettaOverlay').classList.add('hidden')`);

  // 2d. le Fratellanze (issue #5): elenco + fondazione con l'editor di bandiere
  await J(`(() => {
    document.getElementById('gildaSenza').classList.remove('hidden');
    const box = document.getElementById('gildaElencoBox');
    box.innerHTML = '';
    const riga = document.createElement('div');
    riga.className = 'gildaRiga';
    const info = document.createElement('span');
    info.className = 'gildaInfo';
    info.textContent = '«Vele Nere» [VELE] — corsari · 3/24 · aperta';
    const b = document.createElement('button');
    b.textContent = '⚔ Prima il rito';
    b.disabled = true;
    riga.append(info, b);
    box.appendChild(riga);
    document.getElementById('gildaOverlay').classList.remove('hidden');
  })()`);
  await axeState('fratellanze');
  await J(`document.getElementById('gildaOverlay').classList.add('hidden')`);

  // si salpa: nome e via
  await J(`
    document.getElementById('nameInput').value = 'Auditor';
    document.getElementById('nameForm').dispatchEvent(new Event('submit', { cancelable: true }));
  `);
  await sleep(2500);

  // 3. plancia in mare
  await axeState('plancia');

  // 4. classifica (contenuto vero se c'è, altrimenti una riga finta)
  await J(`
    const bt = document.getElementById('boardTable');
    if (!bt.rows.length) bt.innerHTML = '<tr><th scope="col">Corsaro</th><th scope="col">Affondate</th><th scope="col">Perdute</th><th scope="col">🪙</th></tr><tr><td>Auditor</td><td>0</td><td>0</td><td>200</td></tr>';
  `);
  await mostra('board');
  await axeState('classifica');
  await nascondi('board');

  // 5. rotta e mappa del tesoro
  await J(`
    document.getElementById('courseInput').value = 'wikipedia.org';
    document.getElementById('courseForm').dispatchEvent(new Event('submit', { cancelable: true }));
  `);
  await sleep(1800);
  await axeState('mappa-tesoro');
  await J(`document.getElementById('sailBtn').click()`);
  await sleep(400);

  // 6. impostazioni (con la sezione ancoraggio)
  await J(`document.getElementById('settingsBtn').click()`);
  await sleep(400);
  await axeState('impostazioni');
  await J(`document.getElementById('settingsClose').click()`);

  // 7. il Manuale del Corsaro
  await J(`document.getElementById('helpBtn').click()`);
  await sleep(400);
  await axeState('manuale');
  await J(`document.getElementById('helpClose').click()`);

  // 7b. il Registro delle Collezioni (issue #25)
  await J(`document.getElementById('registroBtn').click()`);
  await sleep(400);
  await axeState('registro');
  await J(`document.getElementById('registroClose').click()`);

  // 8. bacheca degli assedi
  await mostra('assedioOverlay');
  await axeState('assedi');
  await nascondi('assedioOverlay');

  // 9. il Faro dell'Oracolo
  await mostra('searchOverlay');
  await axeState('oracolo');
  await nascondi('searchOverlay');

  // 10. barra d'attracco (senza sito vero: conta il markup)
  await J(`
    document.getElementById('dockInfo').textContent = '⚓ Wikipedia';
    document.getElementById('dockUrl').textContent = 'https://it.wikipedia.org/';
  `);
  await mostra('dockbar');
  await axeState('dockbar');
  await nascondi('dockbar');

  // 11. sito di riserva e affondamento
  await mostra('siteOverlay');
  await axeState('sito-riserva');
  await nascondi('siteOverlay');
  await mostra('deathOverlay');
  await axeState('affondato');
  await nascondi('deathOverlay');

  // — verifiche di tastiera: fuoco nei dialoghi, giro del Tab, ESC, rimappatura —
  console.log('— tastiera: dialoghi e timoneria —');
  const ok = (cond, label) => { console.log(`  ${cond ? '✅' : '❌'} ${label}`); if (!cond) fallimenti++; };
  const tasto = (code, key, type = 'keydown') =>
    J(`window.dispatchEvent(new KeyboardEvent('${type}', { code: '${code}', key: '${key}', cancelable: true, bubbles: true }))`);

  await J(`const b = document.getElementById('settingsBtn'); b.focus(); b.click();`);
  await sleep(400);
  ok(await game.executeJavaScript(`document.querySelector('#settingsOverlay .panel').contains(document.activeElement)`),
    'aprendo un dialogo il fuoco entra nel pannello (2.4.3)');
  await game.executeJavaScript(`(() => {
    const p = document.querySelector('#settingsOverlay .panel');
    const f = [...p.querySelectorAll('button, input, select, textarea, a[href]')].filter(el => !el.disabled && el.offsetParent !== null);
    f[f.length - 1].focus();
  })()`);
  await tasto('Tab', 'Tab');
  ok(await game.executeJavaScript(`document.querySelector('#settingsOverlay .panel').contains(document.activeElement) && document.activeElement.id === 'setMusic'`),
    'Tab dall\'ultimo controllo torna al primo: giro, non trappola (2.1.2)');
  await tasto('Escape', 'Escape');
  await sleep(200);
  ok(await game.executeJavaScript(`document.getElementById('settingsOverlay').classList.contains('hidden') && document.activeElement.id === 'settingsBtn'`),
    'ESC chiude e il fuoco torna al bottone che ha aperto (2.4.3)');

  // rimappatura del Cannocchiale su K (2.1.4)
  await J(`document.getElementById('settingsBtn').click()`);
  await sleep(300);
  await J(`[...document.querySelectorAll('#tastiRows button')].find(b => (b.getAttribute('aria-label') || '').includes('Cannocchiale')).click()`);
  await sleep(150);
  await tasto('KeyK', 'k');
  await sleep(150);
  ok(await game.executeJavaScript(`[...document.querySelectorAll('#tastiRows button')].some(b => b.textContent.trim() === 'K')`),
    'il Cannocchiale ora risponde alla K: tasti rimappabili (2.1.4)');
  ok(await game.executeJavaScript(`document.getElementById('hint').textContent.includes('Zoom K')`),
    'la legenda dei comandi segue la rimappatura');
  await J(`document.getElementById('settingsClose').click()`);
  await sleep(200);

  // 12. il Cantiere, con la merce vera (attracco pilotato)
  const spia = () => game.executeJavaScript(`(() => {
    if (!window.__spia) return null;
    const me = window.__spia.latestMe();
    const port = window.__spia.state.port;
    return me && port ? { x: me.x, y: me.y, rot: me.rot, px: port.x, py: port.y } : null;
  })()`);
  const key = (code, type = 'keydown') =>
    J(`window.dispatchEvent(new KeyboardEvent('${type}', { code: '${code}', cancelable: true }))`);
  let cantiere = false;
  for (let i = 0; i < 40 && !cantiere; i++) {
    const s = await spia();
    if (!s) { await sleep(600); continue; }
    const hint = await game.executeJavaScript(`document.getElementById('dockHint').textContent`);
    if (/Premi F per attraccare a Porto Franco/.test(hint)) {
      await key('KeyF'); await key('KeyF', 'keyup'); await sleep(1200);
      cantiere = await game.executeJavaScript(`!document.getElementById('shopOverlay').classList.contains('hidden')`);
      continue;
    }
    let err = Math.atan2(s.py - s.y, s.px - s.x) - s.rot;
    while (err > Math.PI) err -= 2 * Math.PI;
    while (err < -Math.PI) err += 2 * Math.PI;
    if (Math.abs(err) > 0.18) {
      const k = err > 0 ? 'KeyD' : 'KeyA';
      await key(k); await sleep(Math.min(900, Math.abs(err) * 420)); await key(k, 'keyup');
    } else if (Math.hypot(s.px - s.x, s.py - s.y) > 150) {
      await key('KeyW'); await sleep(900); await key('KeyW', 'keyup');
    } else { await sleep(500); }
  }
  if (cantiere) {
    await axeState('cantiere');
    // la scheda Livree (issue #25): negozio + vessillo personale
    await J(`document.getElementById('tabLivree').click()`);
    await sleep(400);
    await axeState('cantiere-livree');
  } else { console.log('  ⚠ attracco fallito: cantiere non verificato'); fallimenti++; }

  console.log(fallimenti === 0 ? '\nACCESSIBILE COME UNA BANCHINA ⚓' : `\n${fallimenti} PROBLEMI ❌`);
  app.exit(fallimenti === 0 ? 0 : 1);
});
