'use strict';

// Le abilità che si leggono (issue #41, fetta 2-bis): l'ack porta nome e
// DURATA, lo snapshot annuncia l'effetto in corso (campo additivo ab, il tipo
// dice quale), il Colpo di Vento ha il suo telegrafo (non l'anello dello
// sperone), e senza varo il tasto R non fa nulla lato server.

const assert = require('assert');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = (inbox) => ({ send(s) { if (inbox) inbox.push(JSON.parse(s)); }, readyState: 1 });
const ultimo = (inbox, t) => [...inbox].reverse().find(m => m.t === t) || null;

const etere = [];
const game = new Game((m) => etere.push(m));
game.pausa();

const inG = [], inS = [], inD = [], inN = [];
const G = game.join(conn(inG), { t: 'join', name: 'Golettiera', profile: { gold: 0, tipo: 'goletta' } });
const S = game.join(conn(inS), { t: 'join', name: 'Sciabecchiere', profile: { gold: 0, tipo: 'sciabecco' } });
const D = game.join(conn(inD), { t: 'join', name: 'Galeonista', profile: { gold: 0, tipo: 'galeone' } });
const N = game.join(conn(inN), { t: 'join', name: 'SenzaVaro', profile: { gold: 0 } });
for (const s of [G, S, D, N]) s.docked = null;
assert.strictEqual(G.tipo, 'goletta', 'il tipo arriva dal profilo');

// — 1) l'ack porta nome, cooldown E durata: il client mostra quanto resta —
game.handle(G, { t: 'abilita' });
const ackG = ultimo(inG, 'abilita');
assert(ackG && ackG.nome === 'Speronamento' && ackG.cd === 30 && Math.abs(ackG.durata - 2.2) < 0.01,
  `ack completo: ${JSON.stringify(ackG)}`);
assert(G.ramUntil > game.now, 'la carica è partita');
assert(game.fxQueue.some(f => f.k === 'ram'), 'il telegrafo dello sperone c\'è ancora');
ok('Speronamento: ack con durata, carica partita, telegrafo ram');

// — 2) il Colpo di Vento ha la SUA voce: fx vento, non l'anello dello sperone —
game.fxQueue.length = 0;
game.handle(S, { t: 'abilita' });
assert(S.ventoUntil > game.now, 'la raffica è partita');
assert(game.fxQueue.some(f => f.k === 'vento'), 'fx vento presente');
assert(!game.fxQueue.some(f => f.k === 'ram'), 'niente anello dello sperone riciclato');
ok('Colpo di Vento: telegrafo proprio (fx vento)');

// — 3) la Bordata Doppia si annuncia nello snapshot: campo additivo ab —
game.handle(D, { t: 'abilita' });
assert(D.doubleUntil > game.now, 'le canne ardono');
game.sendSnapshot();
const snap = [...etere].reverse().find(m => m.t === 'snap');
const sd = snap.ships.find(x => x.id === D.id);
const sn = snap.ships.find(x => x.id === N.id);
assert(sd && sd.tp === 3 && Math.abs(sd.ab - 4) < 0.2, `ab del galeone ≈ 4s (${sd && sd.ab})`);
assert(sn && sn.ab === undefined, 'chi non ha effetti non porta il campo');
// anche la carica della goletta viaggia (ramUntil è tra i max)
const sg = snap.ships.find(x => x.id === G.id);
assert(sg && sg.ab > 0, 'anche la carica dello sperone si legge');
ok('protocollo: ab additivo con i secondi restanti, tp dice quale abilità');

// — 4) a cooldown caldo: toast d'attesa, nessun secondo effetto —
const doppiaPrima = D.doubleUntil;
game.handle(D, { t: 'abilita' });
const toast = ultimo(inD, 'toast');
assert(toast && /⏳/.test(toast.msg), 'il server spiega l\'attesa');
assert.strictEqual(D.doubleUntil, doppiaPrima, 'l\'effetto non si rinnova gratis');
ok('cooldown: toast d\'attesa, effetto non rinnovato');

// — 5) senza varo il server resta muto (il garbo lo fa il client) —
game.handle(N, { t: 'abilita' });
assert.strictEqual(N.abilityAt, 0, 'nessuna abilità senza tipo');
assert(!ultimo(inN, 'abilita'), 'nessun ack per chi non ha varato');
ok('senza varo: il server ignora, il client spiega (toast suo)');

game.stop();
console.log('ABILITA OK ✦');
