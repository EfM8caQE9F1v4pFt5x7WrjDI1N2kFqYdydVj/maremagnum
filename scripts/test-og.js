'use strict';
// Test del Cartellone (issue #27): il parser Open Graph di og-core.js.
// Unit test puro, nessuna rete.
//
// Uso: node scripts/test-og.js

const { estraiOG, pulisci, decodifica } = require('../server/og-core');

let failures = 0;
function ok(cond, label) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + label);
  if (!cond) failures++;
}

console.log('— I meta tag, in tutte le grafie del mondo —');
let og = estraiOG(`<html><head>
  <meta property="og:title" content="Wikipedia, l'enciclopedia libera"/>
  <meta property="og:description" content="Il sapere di tutti, per tutti."/>
  <meta property="og:image" content="https://it.wikipedia.org/anteprima.png"/>
</head></html>`, 'https://it.wikipedia.org/');
ok(og.titolo === "Wikipedia, l'enciclopedia libera", 'og:title letto');
ok(og.descrizione === 'Il sapere di tutti, per tutti.', 'og:description letta');
ok(og.immagine === 'https://it.wikipedia.org/anteprima.png', 'og:image letta');

og = estraiOG(`<head><meta content="Prima il content" name="og:title"><title>Titolo di riserva</title></head>`, 'https://x.example/');
ok(og.titolo === 'Prima il content', 'content prima di property: si legge lo stesso');

og = estraiOG(`<head><title>Solo il titolo &amp; poco altro</title><meta name="description" content="La descrizione classica."></head>`, 'https://x.example/');
ok(og.titolo === 'Solo il titolo & poco altro', 'senza og: si ripiega su <title> (entità decodificate)');
ok(og.descrizione === 'La descrizione classica.', 'senza og: si ripiega su meta description');

og = estraiOG(`<head><meta name="twitter:title" content="Dal nido del canarino"><meta name="twitter:image" content="/img/nido.jpg"></head>`, 'https://uccelli.example/');
ok(og.titolo === 'Dal nido del canarino', 'fallback twitter:title');
ok(og.immagine === 'https://uccelli.example/img/nido.jpg', 'immagine RELATIVA risolta sulla base');

console.log('— La sanificazione: mai fidarsi dei siti —');
og = estraiOG(`<head><meta property="og:title" content="Ciao &lt;script&gt;alert(1)&lt;/script&gt; mondo"/></head>`, 'https://x.example/');
ok(!og.titolo.includes('<') && og.titolo.includes('alert(1)'), `niente markup nel titolo ("${og.titolo}")`);
ok(pulisci('x'.repeat(500), 90).length === 90, 'i testi si tagliano al tetto (con l\'ellissi)');
og = estraiOG(`<head><meta property="og:image" content="javascript:alert(1)"/></head>`, 'https://x.example/');
ok(og.immagine === null, 'solo immagini http(s): javascript: rifiutato');
og = estraiOG('', 'https://x.example/');
ok(og.titolo === '' && og.descrizione === '' && og.immagine === null, 'HTML vuoto → cartellone bianco, niente crash');
ok(decodifica('&#72;&#x65;llo &agrave;') === 'Hello à', 'entità numeriche e nominali');

console.log(failures ? `\n${failures} FALLIMENTI ❌` : '\nTutto in ordine ✅');
process.exit(failures ? 1 : 0);
