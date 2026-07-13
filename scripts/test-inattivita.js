'use strict';

// Il timeout anti-costo: i comandi e il segnale di presenza rinnovano il
// contratto; dopo 350 secondi il server chiude una volta sola col codice 4001.

const assert = require('assert');
const { Game, INACTIVE_SECONDS } = require('../server/game');

const game = new Game(() => {});
game.pausa();

function conn() {
  return {
    sent: [], closed: [], readyState: 1,
    send(s) { this.sent.push(JSON.parse(s)); },
    close(code, reason) { this.closed.push({ code, reason }); this.readyState = 3; },
  };
}

const c = conn();
const ship = game.join(c, { t: 'join', name: 'Dormiglione', profile: {} });

ship.lastActiveAt = Date.now() / 1000 - (INACTIVE_SECONDS - 1);
game.tick();
assert.strictEqual(c.closed.length, 0, 'espulso prima dei 350 secondi');

game.handle(ship, { t: 'activity' });
assert(Date.now() / 1000 - ship.lastActiveAt < 1, 'il segnale umano non rinnova attività');

ship.lastActiveAt = Date.now() / 1000 - (INACTIVE_SECONDS + 1);
game.tick();
assert.deepStrictEqual(c.closed, [{ code: 4001, reason: 'Inattivita' }], 'close inattività errata');
assert(c.sent.some(m => m.t === 'inattivo' && m.secondi === 350), 'preavviso inattività assente');
game.tick();
assert.strictEqual(c.closed.length, 1, 'close inattività ripetuta');

const c2 = conn();
const attivo = game.join(c2, { t: 'join', name: 'Vedetta', profile: {} });
attivo.lastActiveAt = Date.now() / 1000 - (INACTIVE_SECONDS + 1);
game.handle(attivo, { t: 'input', up: true });
game.tick();
assert.strictEqual(c2.closed.length, 0, 'un comando reale non rinnova attività');
assert.strictEqual(attivo.input.up, true, 'il comando usato come attività è stato perso');

game.stop();
console.log('INATTIVITÀ VERDE ⏳⚓');
