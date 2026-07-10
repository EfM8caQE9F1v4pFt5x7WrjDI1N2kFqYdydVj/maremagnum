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
import { setNotteChiara } from './daycycle.js';
import QRCode from 'qrcode';
import { initLang, applyI18n, setLang, getLang, onLang } from './i18n.js';
import './dict.js'; // registra le stringhe estratte (issue #33)

const INTERP_DELAY = 120; // ms nel passato: si naviga fra due snapshot certi
const GROUPS = ['left', 'right', 'bow', 'stern'];

// La timoneria: azioni di gioco → tasti, rimappabili nelle Impostazioni
// (WCAG 2.1.4: le scorciatoie a tasto singolo devono potersi cambiare).
// Le frecce governano sempre; ESC, INVIO e TAB restano della navigazione.
const AZIONI = [
  ['su', 'Avanti (vela)', 'KeyW'],
  ['giu', 'Frena (ammaina)', 'KeyS'],
  ['sinistra', 'Vira a sinistra', 'KeyA'],
  ['destra', 'Vira a destra', 'KeyD'],
  ['bordataSin', 'Bordata sinistra', 'KeyQ'],
  ['bordataDes', 'Bordata destra', 'KeyE'],
  ['pruaPoppa', 'Prua e poppa', 'Space'],
  ['munizione', 'Cambia munizione', 'KeyX'],
  ['abilita', 'Abilità del tipo', 'KeyR'],
  ['attracca', 'Attracca / salpa', 'KeyF'],
  ['zoom', 'Cannocchiale', 'KeyZ'],
  ['classifica', 'Classifica (tieni premuto)', 'KeyC'],
];
const TASTI_RISERVATI = ['Escape', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

function keyLabel(code) {
  if (code === 'Space') return 'SPAZIO';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

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
  keymap: {}, tastoDi: {}, rebind: null,
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
    if (dp.get('tipo') != null) p.tipo = dp.get('tipo'); // ?tipo=goletta|guerra|galeone|sciabecco
    // ?armi=n1,n2,n3 (sviluppo): fiancate armate per il collaudo visivo —
    // lettera del tipo + livello; le esclusive vogliono il ?tipo= giusto
    if (dp.get('armi')) {
      const nomi = { c: 'colubrina', n: 'cannone', r: 'carronata', m: 'mortaio', o: 'organo', l: 'lunga', p: 'pesante', f: 'falconetto' };
      const list = dp.get('armi').split(',')
        .map(s => ({ type: nomi[s[0]] || 'cannone', lvl: Math.min(3, Math.max(1, +s.slice(1) || 1)) }));
      p.mounts = { left: list, right: list.map(w => ({ ...w })), bow: [], stern: [] };
    }
    // ?livrea=nera&scia=sciaoro&vessillo=1.2.4.0.5 (sviluppo): guardaroba
    // per il collaudo visivo — il possesso lo aggiunge il knob stesso
    for (const genere of ['livrea', 'scia']) {
      if (dp.get(genere)) {
        p.livree = [...new Set([...(p.livree || []), dp.get(genere)])];
        p[genere] = dp.get(genere);
      }
    }
    if (dp.get('vessillo')) {
      const v = dp.get('vessillo').split('.').map(n => n | 0);
      p.bandiera = { fondo: v[0], taglio: v[1], tinta2: v[2], emblema: v[3], tintaEmblema: v[4] };
    }
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

// il selettore lingua (issue #33): riflette la lingua corrente, la cambia a
// runtime e la ricorda nel profilo (come le altre preferenze di bordo)
function bindLang() {
  const sel = document.getElementById('setLang');
  if (!sel) return;
  sel.value = getLang();
  sel.addEventListener('change', () => setLang(sel.value));
  onLang((l) => { sel.value = l; state.profile.lang = l; saveProfile(); });
}

async function boot() {
  initLang(state.profile.lang);
  applyI18n();
  bindLang();
  // il font di lettura sul canvas (issue #32): PixiJS e Canvas2D disegnano il
  // testo col font GIÀ caricato — lo pre-carichiamo prima di dipingere il mare
  try {
    await Promise.all([
      document.fonts.load('16px "Atkinson Hyperlegible Next"'),
      document.fonts.load('700 16px "Atkinson Hyperlegible Next"'),
      document.fonts.load('italic 16px "Atkinson Hyperlegible Next"'),
    ]);
  } catch { /* si ripiega sul fallback di sistema */ }
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
    onFav: toggleFav,
    onGazzetta: apriGazzetta,
    onFratellanze: apriFratellanze,
    // le Alleanze temporanee (issue #37)
    onAlleanze: apriAlleanze,
    onAlleanzaInvita: (id) => net.send({ t: 'alleanzaInvita', id }),
    onAlleanzaAccetta: (id) => { rimuoviInvitoAlleanza(id); net.send({ t: 'alleanzaAccetta', id }); },
    onAlleanzaRifiuta: (id) => { rimuoviInvitoAlleanza(id); net.send({ t: 'alleanzaRifiuta', id }); },
    onAlleanzaLascia: () => net.send({ t: 'alleanzaLascia' }),
    onAlleanzaApri: () => net.send({ t: 'alleanzaApri' }),
    onAlleanzaChiudi: () => net.send({ t: 'alleanzaChiudi' }),
    onAlleanzaUnisciti: (id) => net.send({ t: 'alleanzaUnisciti', id }),
    // il Negozio delle Livree e il Registro (issue #25)
    onCompraLivrea: (id) => net.send({ t: 'compraLivrea', id }),
    onIndossaLivrea: (id, genere) => net.send({ t: 'indossaLivrea', id, genere }),
    // anteprima fedele della livrea nel Cantiere (issue #34): la nave è
    // invisibile mentre sei attraccato, così il cambio si vede qui
    onLivreaPreview: (livreaId, veleId) => renderer ? renderer.previewLivrea(livreaId, veleId, latestMe()) : Promise.resolve(null),
    onVessillo: (bandiera) => net.send({ t: 'bandiera', bandiera }),
    onRegistro: apriRegistro,
    onGildaFonda: (dati) => net.send({ t: 'gildaFonda', ...dati }),
    onGildaRichiesta: (id) => net.send({ t: 'gildaRichiesta', id }),
    onGildaApprova: (uid) => net.send({ t: 'gildaApprova', uid }),
    onGildaRifiuta: (uid) => net.send({ t: 'gildaRifiuta', uid }),
    onGildaLascia: () => net.send({ t: 'gildaLascia' }),
    onGildaSciogli: () => net.send({ t: 'gildaSciogli' }),
    onGildaPromuovi: (uid) => net.send({ t: 'gildaPromuovi', uid }),
    onGildaEspelli: (uid) => net.send({ t: 'gildaEspelli', uid }),
    onSettings: applySettings,
    onRebind: (azione) => { state.rebind = azione; refreshTimoneria(); },
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
    // il mare di cortesia (issue #21): l'acqua respira già dietro la
    // pergamena del nome; l'interfaccia di bordo aspetta il varo
    document.body.classList.add('benvenuto');
    avviaFrame();
    await benvenuto(); // nome → ancoraggio (QR+chiave) | login | salpa senz'ancora
  }
  // la scelta del punto di partenza (issue #13): chi ha approdi preferiti
  // sceglie da dove salpare; gli altri partono dal Porto senza domande.
  // L'HUD resta a sipario chiuso (body.benvenuto) finché non si è scelto.
  document.body.classList.add('benvenuto');
  avviaFrame();
  state.spawn = await scegliSpawn();
  // ?salpada=dominio (sviluppo): si spawna accanto a quell'isola
  const salpada = new URLSearchParams(location.search).get('salpada');
  if (salpada) state.spawn = salpada;
  document.body.classList.remove('benvenuto');
  ui.setShipName(state.profile.name);
  saveProfile();

  // preferenze audio dal profilo (default: tutto acceso, volume 80%);
  // il mare calmo eredita la preferenza di sistema sul movimento ridotto
  const prefs = {
    music: state.profile.musicOn !== false,
    sfx: state.profile.sfxOn !== false,
    guard: state.profile.guardOn !== false,
    calma: state.profile.calmaOn ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
    notte: state.profile.notteOn === true, // Notte chiara (#40): spenta di default
    volume: state.profile.volume ?? 0.8,
  };
  applySettings(prefs, true);
  applyKeymap();
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
    keys.add(state.keymap.su);
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
  avviaFrame();
}

// il ciclo di frame parte UNA volta sola (anche se il benvenuto lo ha
// già avviato per il mare di cortesia)
let frameAvviato = false;
function avviaFrame() {
  if (frameAvviato) return;
  frameAvviato = true;
  requestAnimationFrame(frame);
}

function setCourse(q) { net.send({ t: 'course', q }); }
function undock() { net.send({ t: 'undock' }); }

// Da dove salpiamo? (issue #13) Porto Franco o un approdo preferito.
function scegliSpawn() {
  const prefs = state.profile.preferiti || [];
  if (!prefs.length) return Promise.resolve(null);
  return new Promise((resolve) => {
    const box = document.getElementById('salpaScelte');
    box.innerHTML = '';
    const scegli = (d) => { ui.hide('salpaOverlay'); resolve(d); };
    const porto = document.createElement('button');
    porto.textContent = '⚓ Porto Franco';
    porto.addEventListener('click', () => scegli(null));
    box.appendChild(porto);
    for (const d of prefs.slice(0, 8)) {
      const b = document.createElement('button');
      b.textContent = '⭐ ' + d;
      b.addEventListener('click', () => scegli(d));
      box.appendChild(b);
    }
    ui.show('salpaOverlay');
  });
}

// La Gazzetta del Corsaro (issue #4): SOLO in gioco — lo storico arriva al
// join, le voci nuove sul WebSocket; i non-letti sono un cursore nel profilo.
function nonLette() {
  const fino = state.profile.gazzettaLetta || 0;
  return (state.gazzetta || []).filter(v => v.t > fino).length;
}

// lo stato che alimenta il Diario del Capitano (issue #39)
function diarioState() {
  return {
    campagna: state.campagna || null,
    dungeon: state.dungeon || null,
    giornaliere: state.giornaliere || null,
    gazzetta: state.gazzetta || [],
    cronache: state.cronache || [],
    lettaFino: state.profile.gazzettaLetta || 0,
  };
}
// il Diario si aggiorna sotto gli occhi se è già aperto (nuovi dati dal server)
function aggiornaDiario() { if (ui) ui.refreshDiario(diarioState()); }
// le mie imprese nelle Cronache: gli incassi (eventi personali, con la ragione)
function registraCronaca(testo) {
  state.cronache = state.cronache || [];
  state.cronache.unshift({ t: Date.now(), testo });
  if (state.cronache.length > 80) state.cronache.length = 80;
  aggiornaDiario();
}

function apriGazzetta() {
  const fino = state.profile.gazzettaLetta || 0;
  ui.showDiario(diarioState());
  const max = (state.gazzetta || []).reduce((a, v) => Math.max(a, v.t), fino);
  if (max > fino) {
    state.profile.gazzettaLetta = max;
    saveProfile();
    net.send({ t: 'gazzettaLetta', fino: max });
    ui.setGazzettaBadge(0);
  }
}

// Il Registro delle Collezioni (issue #25): vetrina del profilo, si apre ovunque.
function apriRegistro() {
  const p = state.profile;
  ui.showRegistro({
    tipo: p.tipo, vari: p.vari, kills: p.kills, deaths: p.deaths,
    mounts: p.mounts, arsenal: state.arsenal,
    conquered: p.conquered || [], preferiti: p.preferiti || [],
    livree: p.livree || [], livrea: p.livrea, vele: p.vele, scia: p.scia,
    catalogo: state.livreeCatalogo || {},
    campagna: p.campagna,
  });
}

// Le Alleanze temporanee (issue #37): il party effimero della sessione.
// L'elenco dei capitani presenti esce dall'ultimo snapshot (il client li
// conosce già tutti); lo stato dell'alleanza e le bandiere dal server.
function alleanzeState() {
  const membri = new Set(((state.alleanza && state.alleanza.membri) || []).map(m => m.id));
  const snap = state.snaps[state.snaps.length - 1];
  const presenti = [];
  if (snap) {
    for (const s of snap.ships.values()) {
      if (s.k === 'p' && s.id !== state.meId && !membri.has(s.id)) presenti.push({ id: s.id, nome: s.name });
    }
  }
  // gli inviti scaduti si tolgono da soli: mai una rada di lettere morte
  state.invitiAlleanza = (state.invitiAlleanza || []).filter(i => !i.fino || i.fino > Date.now());
  return {
    mia: state.alleanza || null,
    inviti: state.invitiAlleanza,
    bandiere: state.alleanzeAperte || [],
    presenti,
    meId: state.meId,
  };
}
function apriAlleanze() { ui.showAlleanze(alleanzeState()); }
function aggiornaAlleanze() {
  ui.setAlleanzaBadge((state.invitiAlleanza || []).filter(i => !i.fino || i.fino > Date.now()).length);
  ui.refreshAlleanze(alleanzeState());
}
function rimuoviInvitoAlleanza(id) {
  state.invitiAlleanza = (state.invitiAlleanza || []).filter(i => i.id !== id);
  aggiornaAlleanze();
}

// Le Fratellanze (issue #5): il pannello vive di due messaggi del server.
function apriFratellanze() {
  net.send({ t: 'gildaElenco' }); // l'elenco fresco arriva subito dopo
  ui.showFratellanze({
    mia: state.gildaMia,
    elenco: state.gildeElenco || [],
    fondazione: state.gildaFondazione || 25000,
  });
}

function rinfrescaFratellanze() {
  if (!document.getElementById('gildaOverlay').classList.contains('hidden')) {
    ui.showFratellanze({
      mia: state.gildaMia,
      elenco: state.gildeElenco || [],
      fondazione: state.gildaFondazione || 25000,
    });
  }
}

// La stella dell'approdo (issue #13): segna/dimentica l'isola dove siamo.
function toggleFav() {
  const d = state.docked && state.docked.domain;
  if (!d) return;
  const list = state.profile.preferiti || [];
  const on = !list.includes(d);
  if (on && list.length >= 8) { ui.toast('⭐ Hai già 8 approdi preferiti: togline uno prima'); return; }
  net.send({ t: 'preferisci', dominio: d, on });
  state.profile.preferiti = on ? [...list, d] : list.filter(x => x !== d);
  saveProfile();
  ui.setFav(on);
}

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

function applySettings({ music: m, sfx: s, guard: g, calma: c, notte: n, volume: v }, skipSave) {
  state.profile.musicOn = m;
  state.profile.sfxOn = s;
  state.profile.guardOn = g;
  state.profile.calmaOn = c;
  state.profile.notteOn = n;
  state.profile.volume = v;
  if (!skipSave) saveProfile();
  sfx.setEnabled(s);
  sfx.setVolume(v);
  music.setEnabled(m);
  music.setVolume(v);
  renderer.setCalma(!!c);
  setNotteChiara(!!n);
  if (shell) shell.setGuard(g);
  ui.setSettings({ music: m, sfx: s, guard: g, calma: c, notte: n, volume: v });
}

// --- la rosa dei venti (issue #41) ---
// Il vento del mare arriva nello snapshot (campo vn) e si legge in HUD:
// freccia + parole, non solo particelle (a11y — lezione di Sea of Thieves,
// dove il vento di notte non si legge). La freccia punta dove il vento
// SOFFIA: prua allineata = vento in poppa.
// ?forcevento=dir,forza (sviluppo): radianti e 0..1, per foto deterministiche.

const PUNTE = ['E', 'SE', 'S', 'SO', 'O', 'NO', 'N', 'NE'];
const PUNTE_ARIA = ['est', 'sud-est', 'sud', 'sud-ovest', 'ovest', 'nord-ovest', 'nord', 'nord-est'];

function setVento(dir, forza) {
  const forced = devParams.get('forcevento');
  if (forced) {
    const [d, f] = forced.split(',').map(Number);
    dir = d || 0; forza = Number.isFinite(f) ? f : 1;
  }
  state.vento = { dir, forza };
  renderer.setVento(dir, forza);
  const hud = document.getElementById('ventoHud');
  if (!hud) return;
  hud.classList.remove('hidden');
  // la freccia gira sempre per la via corta: l'angolo mostrato è CONTINUO,
  // non normalizzato — quando la direzione scavalca lo zero la CSS
  // transition non deve fare il giro completo all'indietro
  if (state._ventoAngolo == null) state._ventoAngolo = dir;
  else {
    let delta = (dir - state._ventoAngolo) % (2 * Math.PI);
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    state._ventoAngolo += delta;
  }
  document.getElementById('ventoFreccia').style.transform = `rotate(${state._ventoAngolo}rad)`;
  // il vento si nomina da dove TIRA (uso marinaro): la dicitura dice da
  // dove arriva, la freccia indica dove spinge
  const da = (dir + Math.PI) % (2 * Math.PI);
  const punta = Math.round(da / (Math.PI / 4)) % 8;
  const forzaNome = forza < 0.65 ? 'brezza' : forza < 0.85 ? 'vento teso' : 'burrasca';
  const chiave = punta + '|' + forzaNome;
  if (state._ventoChiave !== chiave) { // il testo cambia di rado, il DOM pure
    state._ventoChiave = chiave;
    document.getElementById('ventoNome').textContent = `da ${PUNTE[punta]} · ${forzaNome}`;
    hud.setAttribute('aria-label', `Vento da ${PUNTE_ARIA[punta]}, ${forzaNome}`);
    hud.title = `Il vento tira da ${PUNTE_ARIA[punta]} (${forzaNome}); la freccia indica dove spinge: in poppa corri, di bolina freni`;
  }
}

// --- la timoneria: tasti rimappabili ---

function applyKeymap() {
  const scelte = state.profile.tasti || {};
  state.keymap = {};
  state.tastoDi = {};
  for (const [azione, , base] of AZIONI) {
    let code = typeof scelte[azione] === 'string' && /^[A-Za-z0-9]{2,25}$/.test(scelte[azione])
      && !TASTI_RISERVATI.includes(scelte[azione]) ? scelte[azione] : base;
    state.keymap[azione] = code;
  }
  for (const [azione] of AZIONI) state.tastoDi[state.keymap[azione]] = azione;
  const etichette = {};
  for (const [azione] of AZIONI) etichette[azione] = keyLabel(state.keymap[azione]);
  ui.setKeymap(etichette);
  refreshTimoneria();
}

function refreshTimoneria() {
  ui.setTimoneria(AZIONI.map(([azione, nome]) => ({
    azione, nome, label: keyLabel(state.keymap[azione]), inAscolto: state.rebind === azione,
  })));
}

function captureRebind(e) {
  e.preventDefault();
  const azione = state.rebind;
  state.rebind = null;
  if (e.code !== 'Escape') {
    if (TASTI_RISERVATI.includes(e.code)) {
      ui.toast('Quel tasto serve alla navigazione: scegline un altro.');
    } else {
      const occupato = AZIONI.find(([a]) => a !== azione && state.keymap[a] === e.code);
      if (occupato) ui.toast(`«${keyLabel(e.code)}» è già il tasto di ${occupato[1]}.`);
      else {
        state.profile.tasti = { ...(state.profile.tasti || {}), [azione]: e.code };
        saveProfile();
      }
    }
  }
  applyKeymap();
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
    preferiti: you.preferiti ?? state.profile.preferiti ?? [],
    // il cursore dei non-letti: vince il più avanti fra locale e Conti
    gazzettaLetta: Math.max(you.gazzettaLetta || 0, state.profile.gazzettaLetta || 0),
    campagna: you.campagna ?? state.profile.campagna ?? null,
    sfide: you.sfide ?? state.profile.sfide ?? {},
    // il guardaroba (issue #25): livrea/scia possono essere legittimamente null
    livree: you.livree ?? state.profile.livree ?? [],
    livrea: you.livrea !== undefined ? you.livrea : state.profile.livrea ?? null,
    scia: you.scia !== undefined ? you.scia : state.profile.scia ?? null,
    bandiera: you.bandiera !== undefined ? you.bandiera : state.profile.bandiera ?? null,
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
    spawn: state.spawn || undefined, // approdo preferito scelto al varo (#13)
    // identità di sviluppo per il server Node (?uid=): il Worker la ignora,
    // lì l'uid esce SOLO dal token verificato dai Conti
    uid: devParams.get('uid') || undefined,
  }));
  net.on('_close', () => ui.toast('⚠ Il mare si è chiuso: connessione perduta. Ricarica per salpare di nuovo.', 60000));

  net.on('welcome', (m) => {
    state.meId = m.id;
    state.world = m.world;
    state.port = m.port;
    state.arsenal = m.arsenal;
    state.livreeCatalogo = m.livree || {};
    // le tinte delle vele: il render tinge l'atlante unico col catalogo
    renderer.veleTinte = Object.fromEntries(Object.entries(state.livreeCatalogo)
      .filter(([, l]) => l.genere === 'vele' && l.tinta != null).map(([id, l]) => [id, l.tinta]));
    renderer.setWorld(m.world);
    for (const i of m.islands) { state.islands.set(i.id, i); renderer.addIsland(i); }
    applyYou(m.you);
    for (const id of m.you.conquered || []) renderer.markConquered(id);
    // le munizioni (#41 fetta 2): si riparte sempre a palle; l'ack fa fede.
    // ?munizione=catene|mitraglia (sviluppo): carica subito quella per le foto
    state.munizione = 'palle';
    ui.setMunizione('palle', state.arsenal && state.arsenal.munizioni);
    const munForzata = devParams.get('munizione');
    if (munForzata) net.send({ t: 'munizione', tipo: munForzata });
    ui.toast('⚓ Attracca al Porto Franco (tasto F) per il Cantiere e la Bacheca degli Assedi', 6000);
  });

  // l'ack della munizione: lo stato vero è quello del mare
  net.on('munizione', (m) => {
    state.munizione = m.tipo;
    ui.setMunizione(m.tipo, state.arsenal && state.arsenal.munizioni);
  });

  net.on('island', (m) => {
    const known = state.islands.has(m.island.id);
    state.islands.set(m.island.id, m.island);
    renderer.addIsland(m.island);
    if ((state.profile.conquered || []).includes(m.island.id)) renderer.markConquered(m.island.id);
    // un dungeon del Mastro (#38) scaduto: niente più difese, si toglie il disegno
    if (!m.island.fortress && !m.island.dungeon) renderer.clearFort(m.island.id);
    if (!known) ui.feed(`🗺 Nuova isola avvistata: ${m.island.name}`);
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
    if (m.vn) setVento(m.vn[0], m.vn[1]); // il vento del mare (issue #41)
    // il colpo si SENTE: scossone e lampo rosso quando lo scafo incassa;
    // Mare calmo li spegne (issue #19, rilievo F9 dell'audit)
    const io = ships.get(state.meId);
    if (io) {
      if (state._hpPrima != null && io.hp < state._hpPrima && !io.sunk) {
        engage(8000);
        if (!state.profile.calmaOn) {
          renderer.addShake(Math.min(10, (state._hpPrima - io.hp) * 0.4 + 3));
          const fl = document.getElementById('dannoFlash');
          fl.classList.add('acceso');
          clearTimeout(state._flashT);
          state._flashT = setTimeout(() => fl.classList.remove('acceso'), 220);
        }
      }
      state._hpPrima = io.sunk ? null : io.hp;
      // il colpo che menoma si annuncia (#41 fetta 2): toast al debuff
      // fresco, poi il glifo sopra il nome fa da promemoria
      if (io.vt && !state._vtPrima) ui.toast('⛓ Vele tagliate: la nave arranca!', 3500);
      if (io.cf && !state._cfPrima) ui.toast('☠ Ciurma falcidiata: si ricarica piano!', 3500);
      state._vtPrima = !!io.vt;
      state._cfPrima = !!io.cf;
    }
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
    else if (m.island.dungeon) ui.toast('⚔ Il Mastro ha steso un dungeon qui: abbatti le difese per il bottino!', 5000);
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
      ...(m.negozio ? {
        livree: m.negozio.possedute, livrea: m.negozio.livrea,
        scia: m.negozio.scia, bandiera: m.negozio.bandiera,
      } : {}),
    });
    ui.showShop(m);
  });

  net.on('cartellone', (m) => {
    if (typeof m.dominio === 'string') cartelloni.set(m.dominio, m.og || {});
  });

  net.on('gold', (m) => {
    state.gold = m.gold;
    state.profile.gold = m.gold;
    saveProfile();
    ui.setGold(m.gold);
    if (m.delta > 0) { sfx.coin(); ui.toast(`+${m.delta} 🪙 — ${m.reason}`); }
    else if (m.delta < 0) ui.toast(`${m.delta} 🪙 — ${m.reason}`);
    // gli incassi sono eventi personali: finiscono nelle mie Cronache (issue #39)
    if (m.delta > 0 && m.reason) registraCronaca(`🪙 +${m.delta} — ${m.reason}`);
  });

  net.on('conquered', (m) => {
    state.profile.conquered = m.list;
    saveProfile();
    renderer.markConquered(m.island);
    ui.toast('🏰 FORTEZZA ESPUGNATA! Il blocco è caduto per te, per sempre.', 7000);
  });

  net.on('fortFall', (m) => { renderer.addShake(10); });

  net.on('bacheca', (m) => {
    // le tre del giorno: missioni, tris, strike, settimana, scadenza
    state.giornaliere = m;
    aggiornaDiario();
  });
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

  net.on('dead', (m) => {
    ui.showDeath(m.respawn, { da: m.da, perso: m.perso, salvo: m.salvo, holdLvl: state.profile.holdLvl });
    sfx.sink();
    battleUntil = performance.now() + 3000;
  });
  net.on('respawned', () => { ui.hideDeath(); ui.toast('Nave riparata a nuovo. Il mare ti aspetta.'); });
  net.on('board', (m) => ui.setBoard(m.rows));
  net.on('gilda', (m) => {
    state.gildaMia = m.mia || null;
    rinfrescaFratellanze();
  });
  net.on('gildaElenco', (m) => {
    state.gildeElenco = m.gilde || [];
    state.gildaFondazione = m.fondazione || 25000;
    rinfrescaFratellanze();
  });
  // le Alleanze temporanee (issue #37): stato mio, inviti, bandiere aperte
  net.on('alleanza', (m) => {
    state.alleanza = m.membri ? { membri: m.membri, aperta: !!m.aperta, max: m.max || 4 } : null;
    // gli alleati si riconoscono in mare: il render mette il 🤝 sul nome
    renderer.setAlleati(new Set((m.membri || []).map(x => x.id)));
    aggiornaAlleanze();
  });
  net.on('alleanzaInvito', (m) => {
    if (!m.da) return;
    state.invitiAlleanza = (state.invitiAlleanza || []).filter(i => i.id !== m.da.id);
    state.invitiAlleanza.push({ id: m.da.id, nome: m.da.nome, fino: Date.now() + (m.ttl || 90) * 1000 });
    ui.toast(`🤝 ${m.da.nome} ti propone un'alleanza: decidi dal pannello 🤝 lassù`, 6000);
    aggiornaAlleanze();
  });
  net.on('alleanzeAperte', (m) => {
    state.alleanzeAperte = Array.isArray(m.bandiere) ? m.bandiere : [];
    aggiornaAlleanze();
  });
  net.on('campagna', (m) => { state.campagna = m.stato || null; aggiornaDiario(); }); // Imprese del Diario (#36/#39)
  net.on('dungeon', (m) => { state.dungeon = m.stato || null; aggiornaDiario(); });    // (#38/#39)
  net.on('gazzetta', (m) => {
    state.gazzetta = Array.isArray(m.voci) ? m.voci : [];
    ui.setGazzettaBadge(nonLette());
    aggiornaDiario();
  });
  net.on('notifica', (m) => {
    if (!m.voce) return;
    state.gazzetta = state.gazzetta || [];
    state.gazzetta.unshift(m.voce);
    if (state.gazzetta.length > 100) state.gazzetta.length = 100;
    // niente toast: il pallino cresce in silenzio
    ui.setGazzettaBadge(nonLette());
    aggiornaDiario();
  });
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
  ui.setFav((state.profile.preferiti || []).includes(island.domain));
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
  const k = state.keymap;
  return {
    up: keys.has(k.su) || keys.has('ArrowUp'),
    down: keys.has(k.giu) || keys.has('ArrowDown'),
    left: keys.has(k.sinistra) || keys.has('ArrowLeft'),
    right: keys.has(k.destra) || keys.has('ArrowRight'),
  };
}

function pushInput() {
  const inp = currentInput();
  const j = JSON.stringify(inp);
  if (j !== lastInputJson) { lastInputJson = j; net.send({ t: 'input', ...inp }); }
}

// il tasto della munizione (#41 fetta 2) cicla palle → catene → mitraglia;
// l'HUD si aggiorna subito per reattività, ma l'ack del server fa fede
function cicloMunizione() {
  if (state.docked) return;
  const ordine = (state.arsenal && state.arsenal.munizioniOrdine) || ['palle', 'catene', 'mitraglia'];
  const tipo = ordine[(ordine.indexOf(state.munizione || 'palle') + 1) % ordine.length];
  state.munizione = tipo;
  ui.setMunizione(tipo, state.arsenal && state.arsenal.munizioni);
  net.send({ t: 'munizione', tipo });
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
    // la timoneria in ascolto cattura il prossimo tasto (ESC annulla)
    if (state.rebind) { captureRebind(e); return; }
    if (e.code === 'Escape') { ui.escape(); return; }
    // col fuoco su un campo comanda il campo; su un bottone, SPAZIO e INVIO
    // sono suoi; TAB resta SEMPRE della navigazione (WCAG 2.1.1)
    if (ui.typing() || e.code === 'Tab') return;
    if (ui.bottoneAlFuoco() && (e.code === 'Space' || e.code === 'Enter')) return;
    sfx.unlock();
    music.start();
    const azione = state.tastoDi[e.code];
    switch (azione) {
      case 'bordataSin': e.preventDefault(); fireGroup('left'); return;
      case 'bordataDes': e.preventDefault(); fireGroup('right'); return;
      case 'pruaPoppa': e.preventDefault(); fireGroup('bow'); fireGroup('stern'); return;
      case 'attracca':
        e.preventDefault();
        if (state.docked) undock(); else net.send({ t: 'dock' });
        return;
      case 'abilita':
        e.preventDefault();
        if (!state.docked && state.profile.tipo) net.send({ t: 'abilita' });
        return;
      case 'zoom': e.preventDefault(); cycleZoom(); return;
      case 'munizione': e.preventDefault(); cicloMunizione(); return;
      case 'classifica': e.preventDefault(); ui.showBoard(true); return;
    }
    if (e.code === 'Enter') { document.getElementById('courseInput').focus(); e.preventDefault(); return; }
    keys.add(e.code);
    pushInput();
  });
  addEventListener('keyup', (e) => {
    if (state.tastoDi[e.code] === 'classifica') { ui.showBoard(false); return; }
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
if (devParams.get('spia')) window.__spia = { state, latestMe, renderer: () => renderer, ui: () => ui };

// ?forceshop=nave|armi (sviluppo): apre il Cantiere con dati finti chiamando
// direttamente ui.showShop — per fotografare la UI vera SENZA attraccare (dove
// un driver interattivo/CDP non è possibile). Deterministico, niente navigazione.
if (devParams.get('forceshop')) {
  const scheda = devParams.get('forceshop');
  const mock = {
    gold: 2400,
    ship: { hullLvl: 2, sailsLvl: 1, helmLvl: 1, crewLvl: 2, holdLvl: 1, hullCost: 900, sailsCost: 1200, helmCost: 600, crewCost: 1500, holdCost: 800 },
    varo: { tipo: 'guerra', cost: 90, tipi: {
      guerra: { nome: 'Brigantino da Guerra', motto: 'La matrice di sempre', hpMul: 1, speedMul: 1, turnMul: 1, sconto: 'hullLvl', abilita: 'Fumogeno', esclusiva: 'Organo' },
      goletta: { nome: 'Goletta', motto: 'Chi fugge vive per combattere domani', hpMul: 0.8, speedMul: 1.3, turnMul: 1.2, sconto: 'sailsLvl', abilita: 'Scatto', esclusiva: 'Colubrina Lunga' },
      sciabecco: { nome: 'Sciabecco', motto: 'Punge di prua e di poppa', hpMul: 0.9, speedMul: 1.15, turnMul: 1.1, sconto: 'helmLvl', abilita: 'Bordata Doppia', esclusiva: 'Falconetto a Ripetizione' },
      galeone: { nome: 'Galeone', motto: 'La fortezza che naviga', hpMul: 1.4, speedMul: 0.8, turnMul: 0.85, sconto: 'crewLvl', abilita: 'Corazza', esclusiva: 'Organo Multiplo' },
    } },
    negozio: {
      catalogo: {
        indaco: { nome: 'Livrea Indaco', motto: 'Blu di profondità', scia: 0x2a4d8f, genere: 'livrea', prezzo: 15000 },
        scarlatta: { nome: 'Livrea Scarlatta', motto: 'Rosso corsaro', scia: 0x8f2a2a, genere: 'livrea', prezzo: 12000 },
        ombre: { nome: 'Mare delle Ombre', motto: 'Si guadagna col Mastro di Rotte', scia: 0x1a1a2a, genere: 'livrea', prezzo: null },
        velenere: { nome: 'Vele Nere', motto: 'Il terrore viaggia a gonfie vele', scia: 0x4a5560, tinta: 0x3a3a42, genere: 'vele', prezzo: 8000 },
        veledoro: { nome: 'Vele d\'Oro', motto: 'Oro cucito in cielo', scia: 0xf0c14e, tinta: 0xe9c268, genere: 'vele', prezzo: 8000 },
        verderame: { nome: 'Scia Verderame', motto: 'Una coda d\'alghe', scia: 0x3d9944, genere: 'scia', prezzo: 3000 },
      },
      possedute: ['indaco', 'velenere'], livrea: 'indaco', vele: 'velenere', scia: null,
      bandiera: { fondo: 0, taglio: 0, tinta2: 1, emblema: 0, tintaEmblema: 4 },
    },
    groups: {
      left: { max: 3, nextSlotCost: 200, slots: [
        { slot: 0, type: 'colubrina', lvl: 2, name: 'Colubrina', tier: 1, upCost: 1200, replace: null },
        { slot: 1, type: 'carronata', lvl: 1, name: 'Carronata', tier: 2, upCost: 600, replace: { type: 'mortaio', name: 'Mortaio ad Area', cost: 3000 } },
      ] },
      right: { max: 3, nextSlotCost: 200, slots: [
        { slot: 0, type: 'colubrina', lvl: 3, name: 'Colubrina', tier: 1, upCost: null, replace: { type: 'cannone', name: 'Cannone', cost: 900 } },
      ] },
      bow: { max: 2, nextSlotCost: 300, slots: [
        { slot: 0, type: 'cannone', lvl: 1, name: 'Cannone', tier: 2, upCost: 800, replace: null },
      ] },
      stern: { max: 1, nextSlotCost: 0, slots: [] },
    },
  };
  const open = () => {
    if (typeof ui === 'undefined' || !ui || !ui.showShop) { setTimeout(open, 200); return; }
    try {
      document.body.classList.remove('benvenuto');
      ui.hide('nameOverlay'); // la foto headless vuole il Cantiere, non il benvenuto
      ui.showShop(mock);
      const b = document.getElementById({ nave: 'tabNave', armi: 'tabArmi', varo: 'tabVaro', livree: 'tabLivree' }[scheda] || 'tabArmi');
      if (b) b.click();
    } catch (e) { console.error('forceshop err:', e && e.message); }
  };
  setTimeout(open, 700);
}

// ?forcediario=imprese|cronache (sviluppo): apre il Diario del Capitano con dati
// finti, per fotografarlo headless senza salpare (issue #39).
if (devParams.get('forcediario')) {
  const tab = devParams.get('forcediario');
  const openD = () => {
    if (typeof ui === 'undefined' || !ui || !ui.showDiario) { setTimeout(openD, 200); return; }
    document.body.classList.remove('benvenuto');
    ui.hide('nameOverlay'); // la foto headless vuole il Diario, non il benvenuto
    const now = Date.now();
    ui._diarioTab = tab === 'cronache' ? 'cronache' : 'imprese';
    ui.showDiario({
      campagna: {
        nome: 'La Marea dei Corsari delle Nebbie Perdute', lore: 'Tre convogli spariti nel Mare delle Ombre. Il Mastro chiede vendetta.', premio: 700,
        tappe: [{ desc: 'Affonda 2 Mercantili', n: 2 }, { desc: 'Scopri 3 isole mai visitate', n: 3 }, { desc: 'Espugna le difese di wikipedia.org', n: 1 }],
        tappa: 1, fatto: 1, completata: false,
      },
      dungeon: { nome: 'Le Fauci del Kraken', bersaglio: 'openstreetmap.org', premio: 1000, difficolta: 'tosto', fatto: false },
      giornaliere: {
        giornaliere: [
          { id: 'g1-0', desc: 'Affonda 2 mercantili', n: 2, reward: 100, progress: 1, fatta: false },
          { id: 'g1-1', desc: "Attracca a un'isola .org", n: 1, reward: 100, progress: 1, fatta: true },
          { id: 'g1-2', desc: 'Scopri 3 isole mai visitate', n: 3, reward: 100, progress: 0, fatta: false },
        ],
        tris: { fatto: false, premio: 150 },
        strike: { n: 4, bonus: 25, cap: 7 },
        settimana: { pieni: 4, premio: 1000 },
        scadenza: now + 7 * 36e5,
      },
      gazzetta: [
        { t: now - 36e5, testo: '«Barbanera» ha ESPUGNATO archive.org! Il blocco è caduto.' },
        { t: now - 8 * 36e5, testo: 'Fondata la fratellanza «I Corsari del Nord».' },
        { t: now - 26 * 36e5, testo: 'Il Mastro di Rotte traccia la rotta della settimana.' },
      ],
      cronache: [
        { t: now - 5 * 36e4, testo: '🪙 +140 — Missione compiuta: Affonda 2 mercantili' },
        { t: now - 20 * 36e4, testo: '🪙 +1000 — Dungeon del giorno espugnato: "Le Fauci del Kraken"' },
      ],
      lettaFino: now - 5 * 36e5,
    });
  };
  setTimeout(openD, 700);
}

// ?forcealleanza=solo|party (sviluppo): apre il pannello delle Alleanze con dati
// finti, per fotografarlo headless senza un secondo capitano (issue #37).
// «solo» = nessuna alleanza (inviti + bandiere + presenti); «party» = in alleanza.
if (devParams.get('forcealleanza')) {
  const modo = devParams.get('forcealleanza');
  const openA = () => {
    if (typeof ui === 'undefined' || !ui || !ui.showAlleanze) { setTimeout(openA, 200); return; }
    document.body.classList.remove('benvenuto');
    ui.hide('nameOverlay'); // la foto headless vuole il pannello, non il benvenuto
    const dati = modo === 'party' ? {
      mia: { membri: [{ id: 'p1', nome: 'Morgan il Rosso' }, { id: 'p2', nome: 'Anna dei Venti' }], aperta: true, max: 4 },
      inviti: [],
      bandiere: [],
      presenti: [{ id: 'p3', nome: 'Barbanera' }, { id: 'p4', nome: 'La Vedova Nera' }],
      meId: 'p1',
    } : {
      mia: null,
      inviti: [{ id: 'p2', nome: 'Anna dei Venti' }],
      bandiere: [{ id: 'a1', nomi: ['Barbanera', 'Calico Jack'], posti: 2 }],
      presenti: [{ id: 'p2', nome: 'Anna dei Venti' }, { id: 'p3', nome: 'Barbanera' },
        { id: 'p4', nome: 'La Vedova Nera' }, { id: 'p5', nome: 'Silver Gamba di Legno' }],
      meId: 'p1',
    };
    try { ui.setAlleanzaBadge(dati.inviti.length); ui.showAlleanze(dati); }
    catch (e) { console.error('forcealleanza err:', e && e.message); }
  };
  setTimeout(openA, 700);
}

// ?forcepanel=settings|help (sviluppo): apre un overlay senza dati dal server,
// per fotografarlo headless. I data-panel hanno agganci dedicati quando serve.
if (devParams.get('forcepanel')) {
  const which = devParams.get('forcepanel');
  const openP = () => {
    if (typeof ui === 'undefined' || !ui || !ui.show) { setTimeout(openP, 200); return; }
    document.body.classList.remove('benvenuto');
    const now = Date.now();
    try {
      if (which === 'settings') ui.show('settingsOverlay');
      else if (which === 'help') ui.show('helpOverlay');
      // il Diario ha un hook dedicato: ?forcediario=imprese|cronache
      else if (which === 'fratellanze') ui.showFratellanze({ fondazione: 25000, elenco: [
        { id: 'nord', nome: 'I Corsari del Nord', tag: 'CDN', categoria: 'Guerra', membri: new Array(12), aperta: true, sfidabile: true, bandiera: { fondo: 0, taglio: 0, tinta2: 1, emblema: 0, tintaEmblema: 4 } },
        { id: 'fant', nome: 'Flotta Fantasma', tag: 'FF', categoria: 'Caccia', membri: new Array(8), aperta: false, sfidabile: false, bandiera: { fondo: 2, taglio: 1, tinta2: 3, emblema: 2, tintaEmblema: 1 } },
        { id: 'rossa', nome: 'La Compagnia Rossa', tag: 'CR', categoria: 'Commercio', membri: new Array(24), aperta: false, sfidabile: false, bandiera: { fondo: 1, taglio: 2, tinta2: 0, emblema: 1, tintaEmblema: 2 } },
      ] });
      else if (which === 'registro') ui.showRegistro({
        tipo: 'guerra', vari: 3, kills: 42, deaths: 7,
        mounts: { left: [{ type: 'colubrina', lvl: 3 }, { type: 'carronata', lvl: 2 }], right: [{ type: 'colubrina', lvl: 2 }], bow: [{ type: 'cannone', lvl: 1 }] },
        arsenal: { types: { colubrina: { name: 'Colubrina' }, carronata: { name: 'Carronata' }, cannone: { name: 'Cannone' } } },
        conquered: ['pornhub.com', 'xvideos.com'], preferiti: ['wikipedia.org', 'github.com', 'reddit.com'],
        catalogo: { indaco: { nome: 'Livrea Indaco' }, scarlatta: { nome: 'Livrea Scarlatta' }, ombre: { nome: 'Mare delle Ombre', impresa: true } },
        livree: ['indaco'], livrea: 'indaco', scia: null, campagna: { completata: true },
      });
    } catch (e) { console.error('forcepanel err:', e && e.message); }
  };
  setTimeout(openP, 700);
}

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
  // ?forcedebuff=1 (sviluppo): la propria nave posa da colpita — glifi ⛓☠
  // e barre rallentate in foto, senza aspettare una vera bordata
  if (devParams.get('forcedebuff')) {
    const me = out.find(s => s.id === state.meId);
    if (me) { me.vt = 3; me.cf = 4; }
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
  // prima del welcome non c'è porto: il mare di cortesia inquadra il centro
  const cam = me ? { x: me.x, y: me.y } : (state.port || { x: 3000, y: 3000 });

  renderer.updateShips(ships, state.meId, dt);
  renderer.frame(dt, cam, me);

  const rawMe = latestMe();
  if (rawMe) {
    ui.setHp(rawMe.hp, rawMe.maxHp);
    // la ciurma falcidiata (#41 fetta 2) ricarica piano: la barra dice il vero
    const falcidia = rawMe.cf
      ? ((state.arsenal && state.arsenal.munizioni && state.arsenal.munizioni.mitraglia.falcidia.malus) || 1.4)
      : 1;
    ui.setReloads({
      left: Math.min(1, (now - state.lastFire.left) / (state.groupReload.left * falcidia)),
      right: Math.min(1, (now - state.lastFire.right) / (state.groupReload.right * falcidia)),
      axial: Math.min(1, (now - Math.max(state.lastFire.bow, state.lastFire.stern)) / (Math.min(state.groupReload.bow, state.groupReload.stern) * falcidia)),
      ability: state.ability.at > now ? 1 - (state.ability.at - now) / (state.ability.cd * 1000) : 1,
    });
    updateDockHint(rawMe);
    aggiornaCartellone(rawMe);
  }

  if (now > minimapAt) {
    minimap.update({ world: state.world, islands: state.islands, ships, selfId: state.meId, dest: state.dest && state.dest.island });
    minimapAt = now + 120;
  }
  music.setMood(now < battleUntil ? 'battaglia' : 'calma');
  requestAnimationFrame(frame);
}

// Il Cartellone dell'isola (issue #27): come la nave si ACCOSTA parecchio
// a un'isola-sito, dal centro spunta l'anteprima Open Graph — senza F.
// La risposta si chiede una volta e si tiene; il server rifiuta comunque
// le richieste da lontano e non parla mai delle fortezze.
const cartelloni = new Map(); // dominio → og ricevuto ({} = sito muto)
let cartelloneChiesto = 0;
function aggiornaCartellone(me) {
  if (state.docked || me.sunk) { renderer.setCartellone(null); return; }
  let best = null, bestD = Infinity;
  for (const i of state.islands.values()) {
    const d = Math.hypot(i.x - me.x, i.y - me.y);
    if (d < bestD) { best = i; bestD = d; }
  }
  const vicino = best && best.kind === 'site' && !best.fortress && bestD <= best.r + 180;
  if (!vicino) { renderer.setCartellone(null); return; }
  const og = cartelloni.get(best.domain);
  if (og && og !== 'attesa') {
    renderer.setCartellone(best, og);
    return;
  }
  renderer.setCartellone(null);
  const ora = performance.now();
  // 'attesa' scade dopo 8s: se la risposta si è persa, si riprova
  if ((og !== 'attesa' || ora - cartelloneChiesto > 8000) && ora - cartelloneChiesto > 800) {
    cartelloni.set(best.domain, 'attesa');
    cartelloneChiesto = ora;
    net.send({ t: 'cartellone', dominio: best.domain });
  }
}

function updateDockHint(me) {
  if (state.docked) { ui.setDockHint(''); return; }
  // il blocco (issue #15) comanda su tutto: o resisti, o abbordi
  if (me.bk) {
    ui.setDockHint(`⚑ Sei bloccato! Resisti ${me.bk}s o subirai l'arrembaggio`);
    return;
  }
  const snap = state.snaps[state.snaps.length - 1];
  if (snap) {
    for (const s of snap.ships.values()) {
      if (s.bk && s.bb === state.meId) {
        ui.setDockHint(`⚔ Hai bloccato ${s.name}: TOCCALA per l'arrembaggio! (${s.bk}s)`);
        return;
      }
    }
  }
  let best = null, bestD = Infinity;
  for (const i of state.islands.values()) {
    const d = Math.hypot(i.x - me.x, i.y - me.y);
    if (d < bestD) { best = i; bestD = d; }
  }
  if (!best || bestD > best.r + 150) {
    // in mare aperto il timone parla della META, non del porto alle spalle
    if (state.dest && state.dest.island) {
      const d = state.dest.island;
      const leghe = Math.max(1, Math.round(Math.hypot(d.x - me.x, d.y - me.y) / 100));
      ui.setDockHint(`⛵ Rotta per ${d.name}: ${leghe} leghe`);
    } else ui.setDockHint('');
    return;
  }
  const conquered = (state.profile.conquered || []).includes(best.id);
  if (best.fortress && !conquered) {
    ui.setDockHint(`🏰 ${best.name}: l'approdo è sbarrato finché le difese sono in piedi`);
  } else if (best.dungeon) {
    ui.setDockHint(`⚔ ${best.name}: dungeon del Mastro — abbatti le difese per attraccare`);
  } else if (bestD <= best.r + 90) {
    ui.setDockHint(me.vel <= 45 ? `Premi F per attraccare a ${best.name}` : 'Ammaina le vele (S) per attraccare');
  } else {
    ui.setDockHint(`${best.name} a un tiro di sasso…`);
  }
}

boot();
