'use strict';

// Il guscio browser di Maremagnum.
//
// Architettura (vedi docs/ARCHITETTURA.md):
//   BaseWindow
//   ├─ gameView  (WebContentsView privilegiata: il gioco, carica il client PixiJS)
//   └─ siteView  (WebContentsView sandbox, ZERO privilegi: i siti dell'internet)
//
// La siteView non ha preload, né Node, né IPC: un sito compromesso non può
// toccare il gioco. Ogni navigazione verso un ALTRO dominio viene annullata e
// trasformata in una richiesta di rotta: si torna in mare.

const path = require('path');
const { app, BaseWindow, WebContentsView, ipcMain, shell } = require('electron');
const { initGuard, setGuardEnabled, resetGuardCount } = require('./guard.js');
const { decideUpgrade, decideFallback } = require('./https-first.js');

// Senza GAME_URL (app pacchettizzata o `electron .` diretto) il server di
// gioco salpa dentro questo stesso processo; scripts/dev.js invece lo avvia
// a parte e ci passa l'URL.
let GAME_URL = process.env.GAME_URL;
if (!GAME_URL) {
  process.env.PORT = process.env.PORT || '3210';
  process.env.MAREMAGNUM_DATA = app.getPath('userData');
  require('../server/index.js');
  GAME_URL = `http://localhost:${process.env.PORT}`;
}
const TOPBAR_H = 54;   // barra della rotta (nel gioco)
const DOCKBAR_H = 40;  // barra d'attracco (nel gioco)

let win = null;
let gameView = null;
let siteView = null;
let siteVisible = false;
const httpOnlyHosts = new Set(); // porti che non reggono https (per sessione)
let lastUpgradedFrom = null;     // url http originale dell'ultimo upgrade https

// Stesso "sito" = stesso dominio registrabile (euristica semplice da prototipo).
function sameSite(a, b) {
  try {
    const ha = new URL(a).hostname.replace(/^www\./, '');
    const hb = new URL(b).hostname.replace(/^www\./, '');
    return ha === hb || ha.endsWith('.' + hb) || hb.endsWith('.' + ha);
  } catch { return false; }
}

function layout() {
  if (!win) return;
  const { width, height } = win.getContentBounds();
  gameView.setBounds({ x: 0, y: 0, width, height });
  if (siteVisible) {
    const top = TOPBAR_H + DOCKBAR_H;
    siteView.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top) });
  } else {
    siteView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }
}

function sendToGame(channel, data) {
  if (gameView && !gameView.webContents.isDestroyed()) gameView.webContents.send(channel, data);
}

function requestCourse(url) {
  if (!/^https?:/i.test(url)) return;
  sendToGame('nav-request', { url });
}

function createWindow() {
  win = new BaseWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 640,
    title: 'Maremagnum', backgroundColor: '#0e2536',
  });

  gameView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload-game.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  siteView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:mare', // cookie e sessione dei siti sopravvivono al riavvio
    },
  });

  win.contentView.addChildView(gameView);
  win.contentView.addChildView(siteView); // sopra il gioco quando visibile
  siteView.setVisible(false);

  // Il gioco non deve mai navigare altrove.
  gameView.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(GAME_URL)) e.preventDefault();
  });
  gameView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  gameView.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') gameView.webContents.toggleDevTools();
  });

  // Disciplina di navigazione del sito: cambio di dominio ⇒ nuovo viaggio.
  const wc = siteView.webContents;
  wc.on('will-navigate', (e, url) => {
    if (!sameSite(url, wc.getURL())) {
      e.preventDefault();
      requestCourse(url);
      return;
    }
    // link interni http: si prova comunque la rotta cifrata
    const dec = decideUpgrade(url, httpOnlyHosts);
    if (dec.upgraded) {
      e.preventDefault();
      lastUpgradedFrom = url;
      wc.loadURL(dec.url).catch(() => {});
    }
  });
  wc.setWindowOpenHandler(({ url }) => {
    if (sameSite(url, wc.getURL())) return { action: 'allow' };
    requestCourse(url);
    return { action: 'deny' };
  });
  wc.on('did-navigate', (_e, url) => {
    lastUpgradedFrom = null;
    resetGuardCount();
    sendToGame('site-state', { url });
  });
  wc.on('did-navigate-in-page', (_e, url) => sendToGame('site-state', { url }));

  // HTTPS-first: se la rotta cifrata fallisce per colpa del server, si
  // ripiega su http e il porto viene ricordato per il resto della sessione.
  wc.on('did-fail-load', (_e, errorCode, _desc, validatedURL, isMainFrame) => {
    const fallback = decideFallback(validatedURL, errorCode, isMainFrame, lastUpgradedFrom, httpOnlyHosts);
    if (fallback) {
      lastUpgradedFrom = null;
      wc.loadURL(fallback).catch(() => {});
    }
  });

  // La Ciurma di Guardia monta di vedetta sulla sessione dei siti.
  initGuard(wc.session, (data) => sendToGame('guard-report', data))
    .then(() => console.log('🛡 Ciurma di Guardia a bordo (EasyList + EasyPrivacy + uBO)'))
    .catch((e) => console.error('🛡 Ciurma di Guardia ammutinata:', e.message));

  gameView.webContents.loadURL(GAME_URL);
  win.on('resize', layout);
  layout();
}

// --- IPC dal gioco (unica superficie privilegiata) ---

ipcMain.handle('open-site', (_e, url) => {
  if (typeof url !== 'string' || !/^https?:/i.test(url)) return;
  siteVisible = true;
  siteView.setVisible(true);
  const dec = decideUpgrade(url, httpOnlyHosts);
  lastUpgradedFrom = dec.upgraded ? url : null;
  siteView.webContents.loadURL(dec.url).catch(() => { /* siti irraggiungibili: resta la pagina di errore di Chromium */ });
  layout();
});

ipcMain.handle('guard-set', (_e, on) => setGuardEnabled(!!on));

ipcMain.handle('close-site', () => {
  siteVisible = false;
  siteView.setVisible(false);
  siteView.webContents.loadURL('about:blank').catch(() => {});
  layout();
});

ipcMain.handle('nav-back', () => {
  const h = siteView.webContents.navigationHistory;
  if (h && h.canGoBack()) h.goBack();
});
ipcMain.handle('nav-fwd', () => {
  const h = siteView.webContents.navigationHistory;
  if (h && h.canGoForward()) h.goForward();
});
ipcMain.handle('nav-reload', () => siteView.webContents.reload());
ipcMain.handle('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:/i.test(url)) shell.openExternal(url);
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
