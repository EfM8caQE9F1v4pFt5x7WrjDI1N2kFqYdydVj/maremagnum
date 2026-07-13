'use strict';

// Issue #44: quando il tiratore sparisce, nessun suo proiettile deve restare
// nel mare. La pulizia non deve però toccare il piombo degli altri proprietari.

const assert = require('assert');
const { Game } = require('../server/game');

const game = new Game(() => {});
game.pausa();

const conn = { readyState: 1, send() {}, close() {} };
const superstite = game.join(conn, { t: 'join', name: 'Vedetta', profile: {} });
const st = { speed: 100, range: 300, dmg: 10 };

function spara(owner) {
  return game.spawnShot(owner, 500, 500, 0, st).id;
}

// Disconnessione di un capitano: spariscono solo i suoi colpi.
const corsaro = game.join(conn, { t: 'join', name: 'Fuggiasco', profile: {} });
const suo = spara(corsaro.id);
const altrui = spara(superstite.id);
const forte = spara('fort:prova');
game.leave(corsaro);
assert(!game.ships.has(corsaro.id), 'il capitano disconnesso è ancora nel mare');
assert(!game.shots.has(suo), 'il colpo del capitano disconnesso è rimasto senza padrone');
assert(game.shots.has(altrui), 'la pulizia ha cancellato il colpo di un altro capitano');
assert(game.shots.has(forte), 'la pulizia ha cancellato il colpo di una fortezza');

// Arrivo di una carovana: nave e sua ultima bordata sbarcano insieme.
const carovana = game.spawnNpc('ghost');
carovana.convoglio = { tipo: 'convoglio', ruolo: 'capo' };
game.carovane.convoglio = { capo: carovana.id, scorte: [] };
const colpoCarovana = spara(carovana.id);
game.sciogliCarovana('convoglio', null, true);
assert(!game.ships.has(carovana.id), 'la carovana arrivata è ancora nel mare');
assert(!game.shots.has(colpoCarovana), 'la carovana arrivata ha lasciato un colpo fantasma');

// Congedo del Cacciatore di Taglie.
const cacciatore = game.spawnNpc('ghost');
cacciatore.caccia = { bersaglio: superstite.id, fino: game.now + 10 };
game.cacciatori = 1;
const colpoCacciatore = spara(cacciatore.id);
game.congedaCacciatore(cacciatore, null);
assert(!game.ships.has(cacciatore.id), 'il Cacciatore congedato è ancora nel mare');
assert(!game.shots.has(colpoCacciatore), 'il Cacciatore congedato ha lasciato un colpo fantasma');

// Un relitto di carovana rimosso al respawn segue la stessa regola.
const relitto = game.spawnNpc('ghost');
relitto.convoglio = { tipo: 'tesoro', ruolo: 'scorta' };
const colpoRelitto = spara(relitto.id);
game.respawn(relitto);
assert(!game.ships.has(relitto.id), 'il relitto di carovana è rinato invece di sparire');
assert(!game.shots.has(colpoRelitto), 'il relitto ha lasciato un colpo fantasma');

game.stop();
console.log('COLPI FANTASMA ESORCIZZATI 👻⚫');
