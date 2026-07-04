'use strict';

// La blocklist lato Node: scarica la lista oisd NSFW, la tiene in cache su
// disco e riempie il core puro (blocklist-core.js). Nei Cloudflare Workers
// lo stesso core viene riempito da cf/src/mare-do.js via fetch + R2.

const fs = require('fs');
const path = require('path');
const https = require('https');
const core = require('./blocklist-core');

const LIST_URL = 'https://nsfw.oisd.nl/abp';
// Nell'app pacchettizzata la cartella del programma può essere in sola
// lettura: la cache va nella dir dati indicata dal guscio (userData).
const CACHE_DIR = process.env.MAREMAGNUM_DATA
  ? path.join(process.env.MAREMAGNUM_DATA, 'data')
  : path.join(__dirname, 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'oisd-nsfw-abp.txt');
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': 'maremagnum-game/0.6' } }, (res) => {
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
    const fresh = fs.existsSync(CACHE_FILE) && (Date.now() - fs.statSync(CACHE_FILE).mtimeMs) < MAX_AGE_MS;
    if (fresh) {
      core.setFromText(fs.readFileSync(CACHE_FILE, 'utf8'), 'cache');
    } else {
      const text = await download(LIST_URL);
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(CACHE_FILE, text);
      core.setFromText(text, 'download');
    }
  } catch (err) {
    // cache vecchia meglio di niente
    if (fs.existsSync(CACHE_FILE)) {
      try { core.setFromText(fs.readFileSync(CACHE_FILE, 'utf8'), 'cache scaduta'); } catch { /* fallback */ }
    }
    console.warn('⚠ blocklist oisd non scaricabile (%s): fortezze su lista %s (%d domini)', err.message, core.getSource(), core.size());
  }
  console.log(`🏰 Blocklist fortezze: ${core.size()} domini (${core.getSource()})`);
}

module.exports = { init, isBlocked: core.isBlocked, size: core.size };
