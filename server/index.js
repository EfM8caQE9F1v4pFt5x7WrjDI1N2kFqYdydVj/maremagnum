'use strict';

// Il Mare dell'Internet: server di gioco autoritativo + hosting statico del client
// (l'hosting serve per lo sviluppo nel browser; il guscio Electron carica gli stessi file).

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Game } = require('./game');
const blocklist = require('./blocklist');

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

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ships: game.ships.size, islands: game.archipelago.list().length, blocklist: blocklist.size() }));
    return;
  }
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
  server.on('error', (e) => {
    // porto già occupato (es. server di sviluppo attivo): il guscio userà quello
    console.error('⚓ Porto occupato:', e.code || e.message);
  });
  server.listen(PORT, () => {
    console.log(`🏴‍☠️  Il Mare dell'Internet è aperto su http://localhost:${PORT}`);
  });
}

main();
