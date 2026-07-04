'use strict';

// La blocklist delle Fortezze Proibite: oisd NSFW (~370k domini, formato ABP).
// Scaricata al primo avvio e cacheata su disco; refresh se più vecchia di 7 giorni.
// Se la rete manca, si ripiega su una lista minima: il mare non si ferma.

const fs = require('fs');
const path = require('path');
const https = require('https');

const LIST_URL = 'https://nsfw.oisd.nl/abp';
// Nell'app pacchettizzata la cartella del programma può essere in sola
// lettura: la cache va nella dir dati indicata dal guscio (userData).
const CACHE_DIR = process.env.MAREMAGNUM_DATA
  ? path.join(process.env.MAREMAGNUM_DATA, 'data')
  : path.join(__dirname, 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'oisd-nsfw-abp.txt');
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

const FALLBACK = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com',
  'youporn.com', 'onlyfans.com', 'chaturbate.com', 'stripchat.com', 'brazzers.com',
];

let domains = new Set(FALLBACK);
let source = 'fallback';

function parseAbp(text) {
  const out = new Set();
  for (const line of text.split('\n')) {
    // righe ABP: ||dominio.tld^
    if (line.startsWith('||') && line.endsWith('^')) {
      out.add(line.slice(2, -1).toLowerCase());
    }
  }
  return out;
}

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': 'maremagnum-game/0.5' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function init() {
  try {
    let text = null;
    const fresh = fs.existsSync(CACHE_FILE) && (Date.now() - fs.statSync(CACHE_FILE).mtimeMs) < MAX_AGE_MS;
    if (fresh) {
      text = fs.readFileSync(CACHE_FILE, 'utf8');
      source = 'cache';
    } else {
      text = await download(LIST_URL);
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(CACHE_FILE, text);
      source = 'download';
    }
    const parsed = parseAbp(text);
    if (parsed.size > 1000) domains = parsed;
    else source = 'fallback (lista sospettamente vuota)';
  } catch (err) {
    // cache vecchia meglio di niente
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const parsed = parseAbp(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (parsed.size > 1000) { domains = parsed; source = 'cache scaduta'; }
      } catch { /* si resta sul fallback */ }
    }
    console.warn('⚠ blocklist oisd non scaricabile (%s): fortezze su lista %s (%d domini)', err.message, source, domains.size);
  }
  console.log(`🏰 Blocklist fortezze: ${domains.size} domini (${source})`);
}

// Bloccato se il dominio o un suo genitore è in lista (a.b.example.com → example.com).
function isBlocked(domain) {
  if (!domain) return false;
  const parts = String(domain).toLowerCase().split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    if (domains.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}

function size() { return domains.size; }

module.exports = { init, isBlocked, size };
