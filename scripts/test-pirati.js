'use strict';

// La Ciurma (issue #16, Fase 5): il roster si arruola CON LA NAVE — scafo
// e punti Ciurma allargano l'equipaggio, il varo porta l'esclusivo del
// tipo, la campagna del Mastro il leggendario. Il set è MONOTONO come
// l'arsenale delle esclusive: una volta a bordo nessuno sbarca, nemmeno
// cambiando nave. La dottrina è di server/pirati.js, fonte unica.

const assert = require('assert');
const { Game } = require('../server/game');
const pirati = require('../server/pirati');

const ok = (m) => console.log(`  ✅ ${m}`);
// connessione che REGISTRA: i messaggi personali (welcome, ciurma) servono
const inboxDi = new Map();
const conn = (nome) => {
  const inbox = [];
  inboxDi.set(nome, inbox);
  return { send: (s) => inbox.push(JSON.parse(s)), readyState: 1 };
};

const etere = [];
const game = new Game((m) => etere.push(m));
game.pausa();
game.vento = { dir: 0, forza: 0 };

// — 0) il catalogo è sano: 15 pirati, id unici, vie note —
assert.strictEqual(pirati.ROSTER.length, 15, 'quindici pirati a catalogo');
assert.strictEqual(new Set(pirati.ROSTER.map(p => p.id)).size, 15, 'id tutti diversi');
const VIE = new Set(['base', 'scafo', 'ciurma', 'varo', 'campagna']);
assert(pirati.ROSTER.every(p => VIE.has(p.sblocco.via)), 'ogni sblocco ha una via nota');
assert.strictEqual(pirati.ATLANTE.cols, pirati.ATLANTE.animazioni.idle.n + pirati.ATLANTE.animazioni.corsa.n,
  'la convenzione atlante torna coi conteggi');
ok('catalogo: 15 pirati, vie d\'arruolo note, convenzione atlante coerente');

// — 1) la ciurma di partenza: due facce e un prescelto —
const A = game.join(conn('A'), { t: 'join', name: 'Novellino', profile: { gold: 100000 } });
assert.deepStrictEqual([...A.ciurma].sort(), ['cuoca', 'mozzo'], 'si parte in due');
assert.strictEqual(A.pirata, 'mozzo', 'il prescelto è il primo del roster');
const welcome = inboxDi.get('A').find(m => m.t === 'welcome');
assert(Array.isArray(welcome.you.ciurma) && welcome.you.ciurma.length === 2, 'il profilo dichiara la ciurma');
const arruolo = inboxDi.get('A').find(m => m.t === 'ciurma');
assert(arruolo && arruolo.nuovi && arruolo.nuovi.length === 2, 'l\'arruolo è annunciato (additivo, con i nuovi)');
ok('partenza: mozzo e cuoca a bordo, prescelto il mozzo, messaggio additivo');

// — 2) scafo più grande, ciurma più grande —
A.docked = 'porto';
game.buyShip(A, 'hull'); game.buyShip(A, 'hull');
assert(A.ciurma.has('nostromo') && A.ciurma.has('vedetta'), 'a scafo 2 salgono nostromo e vedetta');
game.buyShip(A, 'hull'); game.buyShip(A, 'hull');
assert(A.ciurma.has('mastrodascia') && A.ciurma.has('bucaniera'), 'a scafo 4 il mastro d\'ascia e la bucaniera');
ok('scafo: livello 2 → +2, livello 4 → +2 (sei a bordo col legno grosso)');

// — 3) ogni punto Ciurma è una faccia —
game.buyShip(A, 'crew');
assert(A.ciurma.has('gabbiere') && !A.ciurma.has('polena'), 'punto 1: il gabbiere (e solo lui)');
game.buyShip(A, 'crew'); game.buyShip(A, 'crew'); game.buyShip(A, 'crew');
for (const id of ['polena', 'mezzamiccia', 'timoniere']) assert(A.ciurma.has(id), id + ' a bordo');
ok('punti Ciurma: uno a punto, fino al timoniere');

// — 4) il varo arruola l'esclusivo del tipo, e nessuno sbarca mai —
game.varo(A, 'goletta');
assert(A.ciurma.has('filodifumo'), 'la goletta porta Filo di Fumo');
game.varo(A, 'guerra');
assert(A.ciurma.has('sergente'), 'il brigantino porta la Sergente');
assert(A.ciurma.has('filodifumo'), 'e Filo di Fumo RESTA: il varo aggiunge, mai confisca');
assert(A.varati.has('goletta') && A.varati.has('guerra'), 'i vari di carriera sono agli atti');
assert.strictEqual(A.ciurma.size, 12, 'dodici: mancano galeone, sciabecco e leggendario');
ok('varo: esclusivi di tipo additivi, come l\'arsenale delle esclusive');

// — 5) la scelta del prescelto: libera fra gli arruolati, mai fuori —
game.scegliPirata(A, 'sergente');
assert.strictEqual(A.pirata, 'sergente', 'la Sergente al timone');
game.scegliPirata(A, 'senzanome');
assert.strictEqual(A.pirata, 'sergente', 'il leggendario non ancora arruolato NON si sceglie');
game.scegliPirata(A, { via: 'iniezione' });
assert.strictEqual(A.pirata, 'sergente', 'la porcheria non passa');
ok('prescelto: solo tra gli arruolati, input sporchi respinti');

// — 6) la campagna del Mastro vale anche d'archivio (la livrea Ombre fa fede) —
const B = game.join(conn('B'), { t: 'join', name: 'Veterano', profile: { gold: 500, livree: ['ombre'], livrea: 'ombre' } });
assert(B.ciurma.has('senzanome'), 'chi compì il Mastro in passato trova il Senzanome a bordo');
ok('leggendario: la campagna d\'archivio arruola (traccia = livrea Ombre)');

// — 7) il profilo: monotonia, sanificazione, round-trip —
const C = game.join(conn('C'), {
  t: 'join', name: 'Reduce',
  profile: { gold: 500, ciurma: ['senzanome', 'farlocco'], pirata: 'senzanome', varati: ['sciabecco', 'zattera'], tipo: 'galeone' },
});
assert(C.ciurma.has('senzanome'), 'il set è monotono: l\'arruolato d\'un tempo resta anche senza i requisiti di oggi');
assert(![...C.ciurma].includes('farlocco'), 'gli id farlocchi non salgono a bordo');
assert(C.ciurma.has('corsaro'), 'lo sciabecco varato in passato vale ancora');
assert(C.ciurma.has('ammiraglia') && C.varati.has('galeone'), 'il tipo ATTUALE conta come varato (grandfathering)');
assert(!C.varati.has('zattera'), 'i tipi ignoti si buttano');
assert.strictEqual(C.pirata, 'senzanome', 'il prescelto torna dal profilo');
const you = game.youFor(C);
assert(Array.isArray(you.ciurma) && Array.isArray(you.varati) && you.pirata === 'senzanome',
  'youFor dichiara ciurma, varati e prescelto');
ok('profilo: monotono, sanificato, round-trip completo');

console.log('\n🏴‍☠️ La Ciurma s\'arruola come deve: %d casi verdi.', 8);
