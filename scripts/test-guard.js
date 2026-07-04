'use strict';

// Verifica della Ciurma di Guardia senza aprire il guscio:
//  1) la logica HTTPS-first (pura, shell/https-first.js)
//  2) il motore di blocco con le liste VERE (EasyList+EasyPrivacy+uBO),
//     stesso engine che il guscio carica via @ghostery/adblocker-electron.

const assert = require('assert');
const { FiltersEngine, Request } = require('@ghostery/adblocker');
const { decideUpgrade, decideFallback } = require('../shell/https-first.js');

async function main() {
  // --- HTTPS-first ---
  const hosts = new Set();

  let d = decideUpgrade('http://esempio.it/pagina?x=1', hosts);
  assert.strictEqual(d.url, 'https://esempio.it/pagina?x=1');
  assert.strictEqual(d.upgraded, true);
  ok('upgrade http→https');

  d = decideUpgrade('https://esempio.it/', hosts);
  assert.strictEqual(d.upgraded, false);
  ok('https resta https');

  // il porto rifiuta la cifratura: fallback e memoria
  const back = decideFallback('https://vecchioporto.it/', -107, true, 'http://vecchioporto.it/', hosts);
  assert.strictEqual(back, 'http://vecchioporto.it/');
  assert(hosts.has('vecchioporto.it'));
  ok('fallback su errore TLS + porto ricordato');

  d = decideUpgrade('http://vecchioporto.it/rotta', hosts);
  assert.strictEqual(d.upgraded, false);
  ok('porto ricordato: niente secondo upgrade');

  assert.strictEqual(decideFallback('https://a.it/', -3, true, 'http://a.it/', hosts), null);
  ok('ERR_ABORTED non fa fallback');
  assert.strictEqual(decideFallback('https://b.it/', -201, true, 'http://b.it/', hosts), 'http://b.it/');
  ok('errore certificato fa fallback (l\'origine era comunque http)');
  assert.strictEqual(decideFallback('https://c.it/x.png', -107, false, 'http://c.it/', hosts), null);
  ok('i sottoframe/risorse non fanno fallback');

  // --- Motore con le liste vere ---
  console.log('— Scarico/carico l\'engine (EasyList + EasyPrivacy + uBO)…');
  const engine = await FiltersEngine.fromPrebuiltAdsAndTracking(fetch);
  const blocked = (url, type, sourceUrl) =>
    engine.match(Request.fromRawDetails({ url, type, sourceUrl })).match;

  assert(blocked('https://www.google-analytics.com/analytics.js', 'script', 'https://example.com/'),
    'google-analytics dovrebbe essere respinto');
  ok('parassita respinto: google-analytics');
  assert(blocked('https://static.doubleclick.net/instream/ad_status.js', 'script', 'https://example.com/'),
    'doubleclick dovrebbe essere respinto');
  ok('parassita respinto: doubleclick');
  assert(blocked('https://connect.facebook.net/en_US/fbevents.js', 'script', 'https://example.com/'),
    'fbevents dovrebbe essere respinto');
  ok('parassita respinto: facebook pixel');

  assert(!blocked('https://it.wikipedia.org/w/load.php?modules=startup', 'script', 'https://it.wikipedia.org/'),
    'wikipedia NON va toccata');
  ok('carico legittimo lasciato passare: wikipedia');

  console.log('\nGUARDIA VERDE 🛡');
}

function ok(msg) { console.log(`  ✅ ${msg}`); }

main().catch((e) => { console.error('  ❌', e.message); process.exit(1); });
