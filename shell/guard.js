'use strict';

// La Ciurma di Guardia: blocco di tracker e pubblicità nella vista dei siti.
//
// Motore: @ghostery/adblocker-electron con le liste EasyList + EasyPrivacy +
// uBlock Origin (engine precompilato, ~96-99% dei filtri uBO). Il blocco di
// rete passa da webRequest sulla SOLA sessione dei siti; i filtri cosmetici
// (pagine pulite all'attracco) arrivano da un preload isolato che il motore
// registra da sé su quella sessione. In più: header Global Privacy Control
// (Sec-GPC, standard W3C con valore legale in California/Colorado) e DNT.

const path = require('path');
const { promises: fs } = require('fs');
const { app } = require('electron');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');

let blocker = null;
let sess = null;
let enabled = true;
let pending = false; // richiesta di stato arrivata prima che l'engine fosse pronto

const state = {
  blocked: 0,        // parassiti respinti sulla pagina corrente
  onReport: null,    // callback verso il gioco
};

function report() {
  if (state.onReport) state.onReport({ blocked: state.blocked });
}

async function initGuard(siteSession, onReport) {
  sess = siteSession;
  state.onReport = onReport;

  // GPC + DNT su ogni richiesta dei siti: onBeforeSendHeaders è libero
  // (il motore usa solo onBeforeRequest e onHeadersReceived).
  siteSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['Sec-GPC'] = '1';
    details.requestHeaders['DNT'] = '1';
    callback({ requestHeaders: details.requestHeaders });
  });

  const cachePath = path.join(app.getPath('userData'), 'ciurma-engine.bin');
  blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
    path: cachePath,
    read: fs.readFile,
    write: fs.writeFile,
  });

  const count = () => { state.blocked++; report(); };
  blocker.on('request-blocked', count);
  blocker.on('request-redirected', count);

  if (enabled || pending) setGuardEnabled(enabled);
  return blocker;
}

function setGuardEnabled(on) {
  enabled = !!on;
  if (!blocker || !sess) { pending = true; return; }
  if (enabled) blocker.enableBlockingInSession(sess);
  else blocker.disableBlockingInSession(sess);
}

// Da chiamare a ogni nuova navigazione principale: il conteggio riparte.
function resetGuardCount() {
  state.blocked = 0;
  report();
}

module.exports = { initGuard, setGuardEnabled, resetGuardCount };
