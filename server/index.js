'use strict';

// Il Mare dell'Internet: server di gioco autoritativo + hosting statico del client
// (l'hosting serve per lo sviluppo nel browser; il guscio Electron carica gli stessi file).

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Game } = require('./game');
const blocklist = require('./blocklist');
const campagna = require('./campagna-core');

// il Mastro di Rotte in locale: campagna della settimana, vestito procedurale
// (in produzione la genera il cron del worker, con l'AI solo per il lore)
campagna.setCampagna(campagna.genera(campagna.settimanaDi()));

const PORT = process.env.PORT || 3210;
const GAME_DIR = path.join(__dirname, '..', 'game');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Il proxy delle immagini del Cartellone (issue #27): serve SOLO i domini
// che il gioco ha approvato per prossimità reale (mai un proxy aperto).
// dominio → { url } oppure { url, tipo, dati } una volta scaricata.
const ogImmagini = new Map();
async function serviOgImg(dominio, res) {
  const voce = ogImmagini.get(dominio);
  if (!voce) { res.writeHead(404); res.end(); return; }
  if (!voce.dati) {
    try {
      const r = await fetch(voce.url, { signal: AbortSignal.timeout(8000), redirect: 'follow' });
      const tipo = r.headers.get('content-type') || '';
      if (!r.ok || !tipo.startsWith('image/')) throw new Error('niente immagine');
      const dati = Buffer.from(await r.arrayBuffer());
      if (dati.length > 3 * 1024 * 1024) throw new Error('troppo pesante');
      voce.tipo = tipo; voce.dati = dati;
    } catch { ogImmagini.delete(dominio); res.writeHead(404); res.end(); return; }
  }
  res.writeHead(200, { 'content-type': voce.tipo, 'cache-control': 'public, max-age=604800' });
  res.end(voce.dati);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ships: game.ships.size, islands: game.archipelago.list().length, blocklist: blocklist.size() }));
    return;
  }
  const og = (req.url || '').match(/^\/og-img\/([a-z0-9.-]{3,100})$/i);
  if (og) { serviOgImg(og[1].toLowerCase(), res); return; }
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(GAME_DIR, rel));
  if (!file.startsWith(GAME_DIR)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Qui finisce l\'Internet conosciuto.'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

function broadcast(obj) {
  const s = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
}

let game = null;

wss.on('connection', (ws) => {
  let ship = null;
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg.t !== 'string' || !game) return;
    if (!ship) {
      if (msg.t === 'join') ship = game.join(ws, msg);
      return;
    }
    game.handle(ship, msg);
  });
  ws.on('close', () => { if (ship && game) game.leave(ship); });
  ws.on('error', () => { /* la chiusura fa pulizia */ });
});

async function main() {
  await blocklist.init(); // la blocklist decide quali isole nascono fortificate
  game = new Game(broadcast);
  // il gioco annota l'immagine approvata; il proxy la scarica al primo sguardo
  game.onCartellone = (dominio, url) => { ogImmagini.set(dominio, { url }); };
  server.on('error', (e) => {
    // porto già occupato (es. server di sviluppo attivo): il guscio userà quello
    console.error('⚓ Porto occupato:', e.code || e.message);
  });
  server.listen(PORT, () => {
    console.log(`🏴‍☠️  Il Mare dell'Internet è aperto su http://localhost:${PORT}`);
  });
}

main();
