'use strict';

// Il cuore puro della blocklist: nessun accesso a rete o disco, così gira
// identico in Node e nei Cloudflare Workers. Chi ci mette il testo dentro
// (download, cache, R2) è affare dell'ambiente (vedi blocklist.js e cf/).

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

// Carica una lista ABP; ritorna true se accettata (abbastanza grande da fidarsi).
function setFromText(text, label) {
  const parsed = parseAbp(text);
  if (parsed.size > 1000) {
    domains = parsed;
    source = label || 'testo';
    return true;
  }
  return false;
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
function getSource() { return source; }

module.exports = { parseAbp, setFromText, isBlocked, size, getSource, FALLBACK };
