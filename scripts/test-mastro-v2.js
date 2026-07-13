'use strict';

// Chiusura della #38: calendario mensile PvP, bottino non economico, torneo
// anti-farm e guardia hard del budget Workers AI.
const assert = require('assert');
const campagna = require('../server/campagna-core');
const aiBudget = require('../server/ai-budget-core');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = () => ({ send() {}, readyState: 1 });

// — 1) mese civile UTC, non una finta finestra di 30 giorni —
const gennaio = Date.UTC(2026, 0, 31, 23, 59);
const periodo = campagna.meseDi(gennaio);
assert.strictEqual(campagna.periodoDi('mensile', gennaio), periodo);
assert.strictEqual(campagna.scadenzaDi('mensile', periodo), Date.UTC(2026, 1, 1));
const mensile = campagna.genera('mensile', periodo, ['archive.org']);
assert(mensile.modalita === 'pvp' && mensile.tappe.length === 1 && mensile.tappe[0].tipo === 'assedio');
assert.strictEqual(mensile.bersaglio, 'archive.org');
ok('calendario mensile UTC e obiettivo PvP su isola reale');

// — 2) l'AI inventa i nomi, non gli effetti né l'economia —
const vestito = campagna.applicaVestito(mensile, {
  difficolta: 'tosto', premio: 999999, bersaglio: 'falso.invalid',
  bottino: {
    titolo: 'A'.repeat(500), trofeo: 'Occhio del Kraken', livrea: 'Vele Impossibili',
    livreaId: 'paga-per-vincere',
  },
}, ['archive.org']);
assert.strictEqual(vestito.premio, campagna.LISTINO.tosto);
assert.strictEqual(vestito.bersaglio, 'archive.org');
assert.strictEqual(vestito.bottino.titolo.length, 60);
assert(/^mastro[0-7]$/.test(vestito.bottino.livreaId));
assert.notStrictEqual(vestito.bottino.livreaId, 'paga-per-vincere');
ok('bottino AI clampato: titolo/trofeo/livrea cosmetica, premio code-owned');

// — 3) 500 neuroni/giorno hard: cinque prenotazioni, poi fallback —
let stato = null;
for (let i = 0; i < 5; i++) {
  const r = aiBudget.prenota(stato, `tipo:${i}`, 100, 1234);
  assert(r.ok); stato = r.stato;
}
assert.strictEqual(stato.riservati, 500);
assert.strictEqual(aiBudget.prenota(stato, 'tipo:6', 100, 1234).motivo, 'budget');
assert.strictEqual(aiBudget.prenota(stato, 'tipo:0', 100, 1234).motivo, 'gia-generato');
const domani = aiBudget.prenota(stato, 'tipo:6', 100, 1235);
assert(domani.ok && domani.stato.riservati === 100);
ok('guardia AI: 5% della quota free, niente doppioni, reset UTC');

// — 4) torneo: bersaglio del Mastro, premio e cosmetici una volta al mese —
const meseOra = campagna.meseDi();
const torneo = campagna.genera('mensile', meseOra, ['openstreetmap.org']);
torneo.difficolta = 'tosto';
torneo.premio = campagna.LISTINO.tosto;
campagna.setDungeon('mensile', torneo);
campagna.setDungeon('giornaliero', null);
campagna.setDungeon('settimanale', null);
const game = new Game(() => {});
game.pausa();
const A = game.join(conn(), { t: 'join', name: 'Corridore', profile: { gold: 100 } });
const B = game.join(conn(), { t: 'join', name: 'Bloccatore', profile: { gold: 100 } });
const oroA = A.gold, oroB = B.gold;
game.missions.assedioJoin(A, 'corridori');
game.missions.assedioJoin(B, 'bloccatori');
assert.strictEqual(game.archipelago.get(game.missions.assedio.targetId).domain, torneo.bersaglio);
game.missions.assedio.phase = 'running';
game.missions.finish('corridori', 'collaudo');
assert.strictEqual(A.gold - oroA, torneo.premio);
assert.strictEqual(B.gold, oroB, 'nel torneo la sconfitta non è denaro farmabile');
assert.strictEqual(A.dungeonMese, meseOra);
assert.strictEqual(A.ricordiMastro.length, 1);
assert(A.livree.has(torneo.bottino.livreaId));

// seconda vittoria nello stesso mese: gloria sì, zero nuova moneta o duplicati
game.missions.assedioJoin(A, 'corridori');
game.missions.assedioJoin(B, 'bloccatori');
game.missions.assedio.phase = 'running';
game.missions.finish('corridori', 'rivincita');
assert.strictEqual(A.gold - oroA, torneo.premio);
assert.strictEqual(A.ricordiMastro.length, 1);
assert.strictEqual(game.youFor(A).dungeonMese, meseOra);
assert.strictEqual(game.youFor(A).ricordiMastro.length, 1);
const salvato = game.youFor(A);
const R = game.join(conn(), { t: 'join', name: 'Redivivo', profile: salvato });
assert.strictEqual(R.dungeonMese, meseOra);
assert.strictEqual(R.ricordiMastro.length, 1);
assert(R.livree.has(torneo.bottino.livreaId));
ok('torneo PvP: bersaglio reale, premio mensile anti-farm, collezione persistente');

// — 5) gilda contro gilda: la stessa Fratellanza non occupa i due fronti —
A.gilda = { id: 'g1', tag: 'UNO', nome: 'Uno' };
B.gilda = { id: 'g1', tag: 'UNO', nome: 'Uno' };
game.missions.assedioJoin(A, 'corridori');
game.missions.assedioJoin(B, 'bloccatori');
assert(game.missions.assedio.corridori.has(A.id));
assert(!game.missions.assedio.bloccatori.has(B.id));
ok('torneo fra Fratellanze: una gilda non può combattere contro se stessa');

game.stop();
campagna.setDungeon('mensile', null);
console.log('\nMASTRO DI ROTTE V2 COMPLETO ⚔🏆');
process.exit(0);
