// Maremagnum — il client del Mare dell'Internet.
// Gira identico nel guscio Electron (che espone window.navigareShell) e in un
// normale browser per lo sviluppo (con fallback "apri in nuova scheda").

import { Renderer } from './render.js';
import { Minimap } from './minimap.js';
import { UI } from './ui.js';
import { Net, serverUrl } from './net.js';
import { sfx } from './audio.js';
import { music } from './music.js';
import { lerp, anglerp, pirateName } from './util.js';
import QRCode from 'qrcode';

const INTERP_DELAY = 120; // ms nel passato: si naviga fra due snapshot certi
const GROUPS = ['left', 'right', 'bow', 'stern'];

const shell = window.navigareShell || null;

// Parametri di sviluppo (?nome=X salta la pergamena del nome, ?ora=0..1 blocca
// l'ora del ciclo, ?autofuoco=1 spara da solo): servono a test e audit visivi.
const devParams = new URLSearchParams(location.search);

const state = {
  meId: null, world: null, port: null,
  islands: new Map(),
  snaps: [], offset: 0, offsetInit: false,
  dest: null, docked: null, siteUrl: null,
  gold: 0,
  arsenal: null,
  lastFire: { left: 0, right: 0, bow: 0, stern: 0 },
  groupReload: { left: 2000, right: 2000, bow: 2000, stern: 2000 },
  ability: { at: 0, cd: 30 }, // il cooldown vero lo detta il server con l'ack
  mounts: null,
  profile: loadProfile(),
};

function loadProfile() {
  try {
    // ?reset=1 (sviluppo): riparti come un pirata mai visto
    if (new URLSearchParams(location.search).get('reset')) localStorage.removeItem('niw_profile');
    const p = JSON.parse(localStorage.getItem('niw_profile')) || {};
    if (p.up) { // migrazione dal vecchio schema
      p.hullLvl = p.up.hull | 0;
      p.sailsLvl = p.up.sails | 0;
      delete p.up;
    }
    // ?scafo=0..4&vele=&timone=&ciurma=&stiva= (sviluppo): salpa con la build da collaudare
    const dp = new URLSearchParams(location.search);
    const linee = { scafo: 'hullLvl', vele: 'sailsLvl', timone: 'helmLvl', ciurma: 'crewLvl', stiva: 'holdLvl' };
    for (const [param, field] of Object.entries(linee)) {
      if (dp.get(param) != null) p[field] = Math.min(4, Math.max(0, dp.get(param) | 0));
    }
    if (dp.get('tipo') != null) p.tipo = dp.get('tipo'); // ?tipo=goletta|guerra|galeone
    return p;
  } catch { return {}; }
}
function saveProfile() {
  try { localStorage.setItem('niw_profile', JSON.stringify(state.profile)); } catch { /* pazienza */ }
}

const net = new Net(serverUrl());
let renderer, minimap, ui;

// La musica passa al tema di battaglia quando si combatte davvero: ogni
// evento bellicoso vicino alla nave estende la finestra di "ingaggio".
let battleUntil = 0;
const engage = (ms = 8000) => { battleUntil = Math.max(battleUntil, performance.now() + ms); };

async function boot() {
  renderer = new Renderer();
  await renderer.init(document.getElementById('stage'));
  initZoom();
  minimap = new Minimap(document.getElementById('minimap'));
  ui = new UI({
    onCourse: setCourse,
    onSearch: setCourse,
    onUndock: undock,
    onBuyShip: (stat) => net.send({ t: 'buyShip', stat }),
    onVaro: (tipo) => net.send({ t: 'varo', tipo }),
    onBuySlot: (group) => net.send({ t: 'buySlot', group }),
    onUpgradeWeapon: (group, slot) => net.send({ t: 'upgradeWeapon', group, slot }),
    onReplaceWeapon: (group, slot) => net.send({ t: 'replaceWeapon', group, slot }),
    onAssedioJoin: (role) => net.send({ t: 'assedio', role }),
    onHelp: () => {
      let dominio = '';
      try { if (state.siteUrl) dominio = new URL(state.siteUrl).hostname.replace(/^www\./, ''); } catch { /* rotta senza porto */ }
      ui.showHelp(dominio);
    },
    onRiscatto: riscattaIsola,
    onSettings: applySettings,
    onNavBack: () => shell && shell.navBack(),
    onNavFwd: () => shell && shell.navFwd(),
    onNavReload: () => shell && shell.navReload(),
    onOpenExt: () => shell && state.siteUrl && shell.openExternal(state.siteUrl),
  });
  if (!shell) {
    document.getElementById('dockNav').classList.add('hidden');
    document.getElementById('openExt').classList.add('hidden');
  }

  const forcedName = devParams.get('nome');
  if (forcedName) state.profile.name = forcedName.slice(0, 18);
  else if (!state.profile.name || (!state.profile.ancora && !state.profile.senzaAncora)) {
    await benvenuto(); // nome → ancoraggio (QR+chiave) | login | salpa senz'ancora
  }
  ui.setShipName(state.profile.name);
  saveProfile();

  // preferenze audio dal profilo (default: tutto acceso, volume 80%)
  const prefs = {
    music: state.profile.musicOn !== false,
    sfx: state.profile.sfxOn !== false,
    guard: state.profile.guardOn !== false,
    volume: state.profile.volume ?? 0.8,
  };
  applySettings(prefs, true);
  wireAncora();

  wireNet();
  net.connect();
  wireInput();
  wireShell();
  if (devParams.get('pannello')) ui.show(devParams.get('pannello') + 'Overlay');
  if (devParams.get('fps')) {
    let frames = 0;
    const t0 = performance.now();
    const count = () => { frames++; requestAnimationFrame(count); };
    requestAnimationFrame(count);
    setTimeout(() => {
      console.log(`FPS medi su 6s: ${(frames / ((performance.now() - t0) / 1000)).toFixed(1)} (tier: ${renderer.lowSpec ? 'basso' : 'alto'})`);
    }, 6000);
  }
  if (devParams.get('vela')) {
    keys.add('KeyW');
    setInterval(pushInput, 500);
  }
  if (devParams.get('autofuoco')) {
    sfx.unlock();
    music.start();
    setInterval(() => { fireGroup('left'); fireGroup('right'); }, 1500);
  }
  if (devParams.get('autoabilita')) {
    setInterval(() => net.send({ t: 'abilita' }), 3000);
  }
  requestAnimationFrame(frame);
}

function setCourse(q) { net.send({ t: 'course', q }); }
function undock() { net.send({ t: 'undock' }); }

// --- Benvenuto: nome → ancoraggio (signup) | login | senza ancora ---

function handleDaNome(nome) {
  let h = nome.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9@._+-]/g, '');
  if (h.length < 3) h = 'capitano-' + Math.random().toString(36).slice(2, 6);
  return h.slice(0, 40);
}

function benvenuto() {
  return new Promise((resolve) => {
    const fine = (nome) => {
      state.profile.name = (nome || state.profile.name || pirateName()).slice(0, 18);
      saveProfile();
      ui.hide('nameOverlay');
      resolve();
    };
    const mostra = (passo) => {
      for (const p of ['benvenutoNome', 'benvenutoAncora', 'benvenutoEntra']) {
        $id(p).classList.toggle('hidden', p !== passo);
      }
    };
    let nomeScelto = state.profile.name || '';
    let handleProposto = null;

    // passo ancoraggio: propone il QR per il nome scelto
    const proponiAncora = async (nome) => {
      nomeScelto = nome;
      let handle = handleDaNome(nome);
      try {
        let r = await ancoraChiama('nuovo', { handle });
        if (r.errore && String(r.errore).includes('già')) {
          handle = handle.slice(0, 34) + '-' + Math.random().toString(36).slice(2, 6);
          r = await ancoraChiama('nuovo', { handle });
        }
        if (r.errore) { ui.toast('⚓ ' + r.errore); return; }
        handleProposto = r.uid;
        $id('benvenutoHandle').textContent = r.uid;
        QRCode.toCanvas($id('benvenutoQr'), r.otpauth, { width: 168, margin: 1 });
        $id('benvenutoSegreto').textContent = r.segreto;
        mostra('benvenutoAncora');
        $id('benvenutoCodice').focus();
      } catch {
        // server locale senza Conti (es. Electron offline): si salpa e basta
        state.profile.senzaAncora = true;
        fine(nome);
      }
    };

    $id('nameForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = $id('nameInput').value.trim().slice(0, 18) || $id('nameInput').value || pirateName();
      proponiAncora(nome);
    });
    $id('benvenutoConfermaForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await ancoraChiama('conferma', {
        handle: handleProposto,
        codice: $id('benvenutoCodice').value.trim(),
        profilo: { ...state.profile, name: nomeScelto },
      }).catch(() => ({ errore: 'mare irraggiungibile' }));
      if (r.errore) { ui.toast('⚓ ' + r.errore); return; }
      state.profile.ancora = { token: r.token, uid: r.uid };
      ui.toast('⚓ Ancora gettata: il bottino è al sicuro in mare aperto.', 4000);
      fine(nomeScelto);
    });
    $id('benvenutoSalta').addEventListener('click', () => {
      state.profile.senzaAncora = true;
      fine(nomeScelto);
    });
    $id('benvenutoLogin').addEventListener('click', () => {
      mostra('benvenutoEntra');
      $id('benvenutoEntraHandle').focus();
    });
    $id('benvenutoIndietro').addEventListener('click', () => mostra('benvenutoNome'));
    $id('benvenutoEntraForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await ancoraChiama('entra', {
        handle: $id('benvenutoEntraHandle').value.trim(),
        codice: $id('benvenutoEntraCodice').value.trim(),
      }).catch(() => ({ errore: 'mare irraggiungibile' }));
      if (r.errore) { ui.toast('⚓ ' + r.errore); return; }
      state.profile.ancora = { token: r.token, uid: r.uid };
      if (r.profilo) Object.assign(state.profile, r.profilo);
      ui.toast('⚓ Bentornato a bordo, capitano.', 3000);
      fine((r.profilo && r.profilo.name) || r.uid);
    });

    // ingresso: se il nome c'è già (vecchi lupi di mare) si propone subito l'ancora
    ui.show('nameOverlay');
    if (state.profile.name) {
      proponiAncora(state.profile.name);
    } else {
      $id('nameInput').value = pirateName();
      mostra('benvenutoNome');
      $id('nameInput').focus();
      $id('nameInput').select();
    }
  });
}

// --- Ancoraggio del profilo (nome + TOTP, vive sul Maremagnum online) ---

const $id = (x) => document.getElementById(x);
let ancoraModo = null; // 'crea' | 'entra'

function ancoraAggiornaStato() {
  const a = state.profile.ancora;
  if (a && a.token) {
    $id('ancoraStato').innerHTML = `Ancorato come <b>${a.uid}</b>. Il bottino è al sicuro in mare aperto.`;
    $id('ancoraForm').classList.add('hidden');
    $id('ancoraQr').classList.add('hidden');
    $id('ancoraCodiceForm').classList.add('hidden');
  }
}

async function ancoraChiama(rotta, corpo) {
  const res = await fetch('/ancora/' + rotta, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return res.json();
}

function wireAncora() {
  ancoraAggiornaStato();
  $id('ancoraCrea').addEventListener('click', async () => {
    const handle = $id('ancoraHandle').value.trim();
    if (!handle) return;
    try {
      const r = await ancoraChiama('nuovo', { handle });
      if (r.errore) { ui.toast('⚓ ' + r.errore); return; }
      ancoraModo = 'crea';
      state._ancoraHandle = r.uid;
      QRCode.toCanvas($id('ancoraQrCanvas'), r.otpauth, { width: 168, margin: 1 });
      $id('ancoraSegreto').textContent = r.segreto;
      $id('ancoraQr').classList.remove('hidden');
      $id('ancoraCodiceForm').classList.remove('hidden');
      $id('ancoraCodice').focus();
    } catch {
      ui.toast("⚓ L'Ancoraggio vive sul Maremagnum online, non su questo server locale.");
    }
  });
  $id('ancoraEntraBtn').addEventListener('click', () => {
    const handle = $id('ancoraHandle').value.trim();
    if (!handle) { ui.toast('Scrivi il nome del tuo ancoraggio, poi il codice.'); return; }
    ancoraModo = 'entra';
    state._ancoraHandle = handle;
    $id('ancoraQr').classList.add('hidden');
    $id('ancoraCodiceForm').classList.remove('hidden');
    $id('ancoraCodice').focus();
  });
  $id('ancoraCodiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codice = $id('ancoraCodice').value.trim();
    try {
      const r = await ancoraChiama(ancoraModo === 'crea' ? 'conferma' : 'entra',
        { handle: state._ancoraHandle, codice });
      if (r.errore) { ui.toast('⚓ ' + r.errore); return; }
      state.profile.ancora = { token: r.token, uid: r.uid };
      saveProfile();
      ui.toast("⚓ Ancora gettata! Si rientra in mare col profilo al sicuro…", 4000);
      setTimeout(() => location.reload(), 1600);
    } catch {
      ui.toast("⚓ L'Ancoraggio vive sul Maremagnum online, non su questo server locale.");
    }
  });
}

function applySettings({ music: m, sfx: s, guard: g, volume: v }, skipSave) {
  state.profile.musicOn = m;
  state.profile.sfxOn = s;
  state.profile.guardOn = g;
  state.profile.volume = v;
  if (!skipSave) saveProfile();
  sfx.setEnabled(s);
  sfx.setVolume(v);
  music.setEnabled(m);
  music.setVolume(v);
  if (shell) shell.setGuard(g);
  ui.setSettings({ music: m, sfx: s, guard: g, volume: v });
}

function weaponReloadMs(w) {
  const t = state.arsenal && state.arsenal.types[w.type];
  if (!t) return 2000;
  return Math.max(500, (t.reload + t.upReload * (w.lvl - 1)) * 1000);
}

function recomputeReloads() {
  if (!state.mounts) return;
  const crewMul = 1 - 0.07 * (state.profile.crewLvl || 0); // la Ciurma accorcia, come sul server
  for (const g of GROUPS) {
    const list = state.mounts[g] || [];
    state.groupReload[g] = list.length ? Math.min(...list.map(weaponReloadMs)) * crewMul : 2000;
  }
  ui.setGroupsAvailable({
    left: (state.mounts.left || []).length > 0,
    right: (state.mounts.right || []).length > 0,
    axial: (state.mounts.bow || []).length + (state.mounts.stern || []).length > 0,
  });
}

function applyYou(you) {
  state.gold = you.gold;
  state.mounts = you.mounts;
  Object.assign(state.profile, {
    gold: you.gold, hullLvl: you.hullLvl, sailsLvl: you.sailsLvl,
    helmLvl: you.helmLvl ?? state.profile.helmLvl, crewLvl: you.crewLvl ?? state.profile.crewLvl,
    holdLvl: you.holdLvl ?? state.profile.holdLvl,
    // il tipo può essere legittimamente null: solo undefined significa "server vecchio"
    tipo: you.tipo !== undefined ? you.tipo : state.profile.tipo,
    vari: you.vari !== undefined ? you.vari : state.profile.vari,
    mounts: you.mounts, conquered: you.conquered ?? state.profile.conquered ?? [],
    kills: you.kills ?? state.profile.kills, deaths: you.deaths ?? state.profile.deaths,
  });
  saveProfile();
  ui.setGold(you.gold);
  ui.setAbility(state.profile.tipo);
  recomputeReloads();
}

function wireNet() {
  net.on('_open', () => net.send({
    t: 'join', name: state.profile.name, profile: state.profile,
    token: state.profile.ancora ? state.profile.ancora.token : undefined,
  }));
  net.on('_close', () => ui.toast('⚠ Il mare si è chiuso: connessione perduta. Ricarica per salpare di nuovo.', 60000));

  net.on('welcome', (m) => {
    state.meId = m.id;
    state.world = m.world;
    state.port = m.port;
    state.arsenal = m.arsenal;
    renderer.setWorld(m.world);
    for (const i of m.islands) { state.islands.set(i.id, i); renderer.addIsland(i); }
    applyYou(m.you);
    for (const id of m.you.conquered || []) renderer.markConquered(id);
    ui.toast('⚓ Attracca al Porto Franco (tasto F) per il Cantiere e la Bacheca delle missioni', 6000);
  });

  net.on('island', (m) => {
    state.islands.set(m.island.id, m.island);
    renderer.addIsland(m.island);
    if ((state.profile.conquered || []).includes(m.island.id)) renderer.markConquered(m.island.id);
    ui.feed(`🗺 Nuova isola avvistata: ${m.island.name}`);
  });

  net.on('snap', (m) => {
    const arrivedOffset = m.ts - Date.now();
    state.offset = state.offsetInit ? state.offset * 0.9 + arrivedOffset * 0.1 : arrivedOffset;
    state.offsetInit = true;
    const ships = new Map();
    for (const s of m.ships) ships.set(s.id, s);
    state.snaps.push({ ts: m.ts, ships, list: m.ships });
    if (state.snaps.length > 10) state.snaps.shift();
    for (const f of m.forts) renderer.updateFort(f.i, f.d);
    renderer.updateSmokes(m.sm);
  });

  net.on('abilita', (m) => {
    state.ability = { at: performance.now() + m.cd * 1000, cd: m.cd };
    engage(6000);
  });

  net.on('course', (m) => {
    if (!m.ok) { ui.toast(m.error || 'Rotta illeggibile.'); return; }
    state.islands.set(m.island.id, m.island);
    renderer.addIsland(m.island);
    state.dest = { island: m.island, url: m.url };
    renderer.setDest(m.island);
    const me = latestMe();
    ui.showTreasureMap(me || state.port, m.island, m.url);
    if (m.island.fortress) ui.toast('⚠ Quelle acque sono difese da una Fortezza quasi inespugnabile!', 5000);
  });

  net.on('docked', (m) => {
    state.docked = m.island;
    sfx.dock();
    const island = m.island;
    const arrived = state.dest && state.dest.island.id === island.id;
    const url = arrived ? state.dest.url : (island.domain ? 'https://' + island.domain : null);
    if (island.kind === 'porto') {
      // la bottega arriva col messaggio 'shop'
    } else if (island.kind === 'oracolo') {
      if (arrived && state.dest.url) openSite(island, state.dest.url);
      else ui.showSearch();
    } else if (url) {
      openSite(island, url);
    }
    if (arrived) { state.dest = null; renderer.setDest(null); }
  });

  net.on('undocked', () => {
    state.docked = null;
    state.siteUrl = null;
    ui.closeDockOverlays();
    if (shell) shell.closeSite();
  });

  net.on('shop', (m) => {
    applyYou({
      gold: m.gold, hullLvl: m.ship.hullLvl, sailsLvl: m.ship.sailsLvl,
      helmLvl: m.ship.helmLvl, crewLvl: m.ship.crewLvl, holdLvl: m.ship.holdLvl,
      tipo: m.varo ? m.varo.tipo : undefined, vari: m.varo ? m.varo.vari : undefined,
      mounts: m.mounts,
    });
    ui.showShop(m);
  });

  net.on('gold', (m) => {
    state.gold = m.gold;
    state.profile.gold = m.gold;
    saveProfile();
    ui.setGold(m.gold);
    if (m.delta > 0) { sfx.coin(); ui.toast(`+${m.delta} 🪙 — ${m.reason}`); }
    else if (m.delta < 0) ui.toast(`${m.delta} 🪙 — ${m.reason}`);
  });

  net.on('conquered', (m) => {
    state.profile.conquered = m.list;
    saveProfile();
    renderer.markConquered(m.island);
    ui.toast('🏰 FORTEZZA ESPUGNATA! Il blocco è caduto per te, per sempre.', 7000);
  });

  net.on('fortFall', (m) => { renderer.addShake(10); });

  net.on('mission', (m) => ui.setMission(m));
  net.on('assedio', (m) => { ui.setAssedio(m); if (m && m.phase === 'battle') engage(12000); });

  net.on('shots', (m) => {
    renderer.spawnShots(m.shots);
    const me = latestMe();
    if (me && m.shots.length && Math.hypot(m.shots[0].x - me.x, m.shots[0].y - me.y) < 950) {
      sfx.fire();
      engage(6000);
    }
  });

  net.on('fx', (m) => {
    const me = latestMe();
    for (const f of m.list) {
      renderer.fx(f.k, f.x, f.y, f);
      if (me) {
        const d = Math.hypot(f.x - me.x, f.y - me.y);
        if (d < 950 && sfx[f.k]) sfx[f.k]();
        if (d < 150 && (f.k === 'hit' || f.k === 'boom')) renderer.addShake(f.k === 'boom' ? 9 : 5);
        if (d < 700 && (f.k === 'hit' || f.k === 'boom' || f.k === 'beam')) engage(8000);
      }
    }
  });

  net.on('kill', (m) => {
    ui.feed(`💥 ${m.killer} ha affondato ${m.victim}!${m.bounty ? ` (+${m.bounty} 🪙)` : ''}`);
    if (m.killer === state.profile.name) { state.profile.kills = (state.profile.kills || 0) + 1; saveProfile(); }
    if (m.victim === state.profile.name) { state.profile.deaths = (state.profile.deaths || 0) + 1; saveProfile(); }
  });

  net.on('dead', (m) => { ui.showDeath(m.respawn); sfx.sink(); battleUntil = performance.now() + 3000; });
  net.on('respawned', () => { ui.hideDeath(); ui.toast('Nave riparata a nuovo. Il mare ti aspetta.'); });
  net.on('board', (m) => ui.setBoard(m.rows));
  net.on('toast', (m) => ui.toast(m.msg));
  net.on('feed', (m) => ui.feed(m.msg));
}

function openSite(island, url) {
  state.siteUrl = url;
  if (shell) {
    shell.openSite(url);
    ui.showDockbar(island, url);
  } else {
    ui.showSiteFallback(island, url);
  }
}

function wireShell() {
  if (!shell) return;
  shell.onNavRequest(({ url }) => {
    ui.setCourseInput(url);
    ui.toast('🧭 Nuova rotta richiesta: si salpa!');
    if (state.docked) undock();
    setCourse(url);
  });
  shell.onSiteState(({ url }) => {
    state.siteUrl = url;
    ui.setDockUrl(url);
  });
  // La Ciurma di Guardia riferisce i parassiti respinti sull'isola corrente.
  let nextGuardBrag = 25;
  shell.onGuardReport(({ blocked }) => {
    ui.setGuardCount(blocked);
    if (blocked === 0) { nextGuardBrag = 25; return; }
    if (blocked >= nextGuardBrag) {
      ui.feed(`🛡 La Ciurma di Guardia ha respinto ${blocked} parassiti su quest'isola`);
      nextGuardBrag = blocked >= 100 ? Infinity : 100;
    }
  });
}

// --- input ---

const keys = new Set();
let lastInputJson = '';

function currentInput() {
  return {
    up: keys.has('KeyW') || keys.has('ArrowUp'),
    down: keys.has('KeyS') || keys.has('ArrowDown'),
    left: keys.has('KeyA') || keys.has('ArrowLeft'),
    right: keys.has('KeyD') || keys.has('ArrowRight'),
  };
}

function pushInput() {
  const inp = currentInput();
  const j = JSON.stringify(inp);
  if (j !== lastInputJson) { lastInputJson = j; net.send({ t: 'input', ...inp }); }
}

function fireGroup(group) {
  if (state.docked) return;
  const now = performance.now();
  if (now - state.lastFire[group] < 220) return;
  state.lastFire[group] = now;
  net.send({ t: 'fire', group });
  engage(7000);
}

function wireInput() {
  addEventListener('pointerdown', () => { sfx.unlock(); music.start(); }, { once: true });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape') { ui.escape(); return; }
    if (ui.typing()) return;
    sfx.unlock();
    music.start();
    if (e.code === 'Tab') { e.preventDefault(); ui.showBoard(true); return; }
    if (e.code === 'KeyQ') { e.preventDefault(); fireGroup('left'); return; }
    if (e.code === 'KeyE') { e.preventDefault(); fireGroup('right'); return; }
    if (e.code === 'Space') {
      e.preventDefault();
      fireGroup('bow'); fireGroup('stern');
      return;
    }
    if (e.code === 'KeyF') {
      e.preventDefault();
      if (state.docked) undock(); else net.send({ t: 'dock' });
      return;
    }
    if (e.code === 'KeyR') {
      e.preventDefault();
      if (!state.docked && state.profile.tipo) net.send({ t: 'abilita' });
      return;
    }
    if (e.code === 'Enter') { document.getElementById('courseInput').focus(); e.preventDefault(); return; }
    if (e.code === 'KeyZ') { e.preventDefault(); cycleZoom(); return; }
    keys.add(e.code);
    pushInput();
  });
  addEventListener('keyup', (e) => {
    if (e.code === 'Tab') { ui.showBoard(false); return; }
    keys.delete(e.code);
    pushInput();
  });
  addEventListener('blur', () => { keys.clear(); pushInput(); });
  addEventListener('beforeunload', saveProfile);

  // cannocchiale: rotella o tasto Z, tre scatti (mare aperto → manovra →
  // abbordaggio); la scelta resta nel profilo
  addEventListener('wheel', (e) => {
    if (ui.typing() || state.docked) return;
    stepZoom(e.deltaY < 0 ? 1 : -1);
  }, { passive: true });
}

const ZOOM_STOPS = [1, 1.45, 2];
let zoomIdx = 0;

function applyZoom() {
  renderer.setZoom(ZOOM_STOPS[zoomIdx]);
  state.profile.zoom = zoomIdx;
  saveProfile();
}
function stepZoom(dir) {
  const prev = zoomIdx;
  zoomIdx = Math.max(0, Math.min(ZOOM_STOPS.length - 1, zoomIdx + dir));
  if (zoomIdx !== prev) applyZoom();
}
function cycleZoom() {
  zoomIdx = (zoomIdx + 1) % ZOOM_STOPS.length;
  applyZoom();
}
function initZoom() {
  const forced = devParams.get('zoom');
  zoomIdx = forced != null ? Math.max(0, Math.min(2, forced | 0)) : (state.profile.zoom | 0);
  zoomIdx = Math.max(0, Math.min(ZOOM_STOPS.length - 1, zoomIdx));
  renderer.setZoom(ZOOM_STOPS[zoomIdx]);
  renderer.zoom = ZOOM_STOPS[zoomIdx]; // niente carrellata all'avvio
}

// Il riscatto dell'isola: il proprietario del sito vero lascia un segnale
// e verrà chiamato quando l'Editor dell'Isola aprirà la banchina.
async function riscattaIsola(dominio, contatto) {
  if (!dominio || !dominio.includes('.')) { ui.setRiscattoEsito('Serve il dominio della tua isola (es. iltuosito.it).'); return; }
  if (!contatto) { ui.setRiscattoEsito('Lascia un recapito: senza, non sapremmo chi chiamare.'); return; }
  try {
    const r = await fetch('/riscatto', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dominio, contatto }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) ui.setRiscattoEsito(`⚓ Segnale ricevuto per ${j.dominio || dominio}: sei il n° ${j.posto || '—'} in rada. Ti chiameremo.`);
    else ui.setRiscattoEsito(j.errore || 'Il mare ha respinto il segnale: riprova.');
  } catch {
    ui.setRiscattoEsito('Il riscatto si firma nel mare aperto: maremagnum.maremagnum.workers.dev');
  }
}

// --- interpolazione e frame ---

function latestMe() {
  const last = state.snaps[state.snaps.length - 1];
  return last ? last.ships.get(state.meId) : null;
}

// ?spia=1 (sviluppo): espone posizione e porto ai driver di audit, che così
// governano col rilevamento vero invece di veleggiare alla cieca
if (devParams.get('spia')) window.__spia = { state, latestMe };

function interpolatedShips() {
  const snaps = state.snaps;
  if (!snaps.length) return [];
  const rt = Date.now() + state.offset - INTERP_DELAY;
  let a = snaps[0], b = snaps[snaps.length - 1];
  for (let i = snaps.length - 1; i > 0; i--) {
    if (snaps[i - 1].ts <= rt) { a = snaps[i - 1]; b = snaps[i]; break; }
  }
  const span = Math.max(1, b.ts - a.ts);
  const t = Math.max(0, Math.min(1, (rt - a.ts) / span));
  const out = [];
  for (const sb of b.list) {
    const sa = a.ships.get(sb.id) || sb;
    out.push({
      ...sb,
      x: lerp(sa.x, sb.x, t),
      y: lerp(sa.y, sb.y, t),
      rot: anglerp(sa.rot, sb.rot, t),
      vel: lerp(sa.vel, sb.vel, t),
    });
  }
  return out;
}

let lastFrame = performance.now();
let minimapAt = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  const ships = interpolatedShips();
  const me = ships.find(s => s.id === state.meId) || null;
  const cam = me ? { x: me.x, y: me.y } : (state.port || { x: 0, y: 0 });

  renderer.updateShips(ships, state.meId, dt);
  renderer.frame(dt, cam, me);

  const rawMe = latestMe();
  if (rawMe) {
    ui.setHp(rawMe.hp, rawMe.maxHp);
    ui.setReloads({
      left: Math.min(1, (now - state.lastFire.left) / state.groupReload.left),
      right: Math.min(1, (now - state.lastFire.right) / state.groupReload.right),
      axial: Math.min(1, (now - Math.max(state.lastFire.bow, state.lastFire.stern)) / Math.min(state.groupReload.bow, state.groupReload.stern)),
      ability: state.ability.at > now ? 1 - (state.ability.at - now) / (state.ability.cd * 1000) : 1,
    });
    updateDockHint(rawMe);
  }

  if (now > minimapAt) {
    minimap.update({ world: state.world, islands: state.islands, ships, selfId: state.meId, dest: state.dest && state.dest.island });
    minimapAt = now + 120;
  }
  music.setMood(now < battleUntil ? 'battaglia' : 'calma');
  requestAnimationFrame(frame);
}

function updateDockHint(me) {
  if (state.docked) { ui.setDockHint(''); return; }
  let best = null, bestD = Infinity;
  for (const i of state.islands.values()) {
    const d = Math.hypot(i.x - me.x, i.y - me.y);
    if (d < bestD) { best = i; bestD = d; }
  }
  if (!best || bestD > best.r + 150) { ui.setDockHint(''); return; }
  const conquered = (state.profile.conquered || []).includes(best.id);
  if (best.fortress && !conquered) {
    ui.setDockHint(`🏰 ${best.name}: l'approdo è sbarrato finché le difese sono in piedi`);
  } else if (bestD <= best.r + 90) {
    ui.setDockHint(me.vel <= 45 ? `Premi F per attraccare a ${best.name}` : 'Ammaina le vele (S) per attraccare');
  } else {
    ui.setDockHint(`${best.name} a un tiro di sasso…`);
  }
}

boot();
