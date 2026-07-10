'use strict';

// Le TRE DEL GIORNO, senza rete: auto-attive e deterministiche (seme = giorno),
// fattibili UNA volta (l'exploit della bacheca infinita è chiuso), tris con lo
// strike dei giorni consecutivi, settimana piena, rollover a mezzanotte,
// persistenza sanificata nel profilo.

const assert = require('assert');
const { Game } = require('../server/game');
const { PREMI, GIORNALIERE_N } = require('../server/missions');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = () => ({ send() {}, readyState: 1 });

// il calendario in mano al test: si viaggia nel tempo stubbando oggi()
const D = 21000; // multiplo di 7: la settimana [21000..21006] è pulita
const game = new Game(() => {});
game.pausa();
game.missions.oggi = () => D;

// tre giornaliere di comodo, coi progressi in mano al test
const tre = (ship) => {
  ship.missioniGiorno = game.missions.oggi();
  ship.giornaliere = ['a', 'b', 'c'].map((k, i) => ({
    id: 'g-' + i, key: k, desc: 'rotta ' + k, n: i === 1 ? 2 : 1,
    reward: PREMI.missione, progress: 0, fatta: false,
  }));
};

const P = game.join(conn(), { t: 'join', name: 'Giornaliero', profile: { gold: 0 } });
P.graceUntil = 0;
const oroBase = P.gold; // il profilo vergine parte con l'oro di leva

// 1) al join: tre giornaliere auto-attive, niente bacheca di offerte
assert(Array.isArray(P.giornaliere) && P.giornaliere.length === GIORNALIERE_N, 'al join: tre giornaliere');
assert(P.giornaliere.every(m => !m.fatta && m.progress === 0), 'tutte da compiere');
assert(P.bacheca === undefined, 'nessuna bacheca di offerte da accettare');
ok('al join: le tre del giorno sono già attive, niente da accettare');

// 2) deterministiche: stesso giorno → stesse missioni per tutti
const P2 = game.join(conn(), { t: 'join', name: 'Gemello', profile: { gold: 0 } });
assert(JSON.stringify(P.giornaliere.map(m => m.id + m.desc)) === JSON.stringify(P2.giornaliere.map(m => m.id + m.desc)),
  'stesse missioni per due capitani');
assert(JSON.stringify(game.missions.genera(123)) === JSON.stringify(game.missions.genera(123)), 'genera è pura');
const chiavi = new Set(game.missions.genera(D).map(m => m.key));
assert(chiavi.size === GIORNALIERE_N, 'tre mestieri distinti');
ok('deterministiche: seme = giorno, mestieri distinti, uguali per tutti');

// 3) l'exploit è chiuso: accetta/rifiuta/abbandona non toccano nulla
const fotografie = JSON.stringify(P.giornaliere);
game.missions.accetta(P, 'g-0');
game.missions.rifiuta(P, 'g-0');
game.missions.abbandona(P, 'g-0');
assert(JSON.stringify(P.giornaliere) === fotografie && P.gold === oroBase, 'accetta/rifiuta/abbandona: no-op');
ok('exploit chiuso: accettare non rifornisce più niente');

// 4) una missione paga UNA volta sola
tre(P);
game.missions.avanza(P, m => m.key === 'a');
assert(P.giornaliere[0].fatta && P.gold === oroBase + PREMI.missione, 'compiuta → +' + PREMI.missione);
game.missions.avanza(P, m => m.key === 'a');
assert(P.gold === oroBase + PREMI.missione, 'rifarla non paga di nuovo');
ok('ogni giornaliera paga una volta sola');

// 5) il tris: tutte e tre → bonus + strike (primo giorno: ×1)
game.missions.avanza(P, m => m.key === 'b');
game.missions.avanza(P, m => m.key === 'b');
game.missions.avanza(P, m => m.key === 'c');
const attesoTris = oroBase + 3 * PREMI.missione + PREMI.tris + PREMI.strike * 1;
assert(P.gold === attesoTris, `tris del giorno: ${P.gold} = ${attesoTris}`);
assert(P.strike.n === 1 && P.strike.giorno === D, 'strike avviato');
assert(P.settimana.pieni === 1, 'primo giorno pieno della settimana');
game.missions.avanza(P, m => true);
assert(P.gold === attesoTris, 'a giornata compiuta non si spilla altro oro');
ok('tris: +' + PREMI.tris + ' e strike ×1, mai due volte nello stesso giorno');

// 6) il giorno dopo: rollover in tick e strike che cresce
game.missions.oggi = () => D + 1;
game.missions.tick(game.now);
assert(P.missioniGiorno === D + 1 && P.giornaliere.every(m => !m.fatta && m.progress === 0),
  'a mezzanotte le tre si rinnovano da sole');
tre(P);
const oroPrima = P.gold;
game.missions.avanza(P, m => true); // 'a' e 'c' (n=1) subito, 'b' a metà
game.missions.avanza(P, m => m.key === 'b');
assert(P.strike.n === 2, 'strike ×2 il secondo giorno di fila');
assert(P.gold === oroPrima + 3 * PREMI.missione + PREMI.tris + PREMI.strike * 2, 'il tris vale di più con lo strike');
assert(P.settimana.pieni === 2, 'secondo giorno pieno');
ok('rollover a mezzanotte e strike consecutivo che cresce');

// 7) un giorno saltato spezza la catena
game.missions.oggi = () => D + 3;
tre(P);
game.missions.avanza(P, m => true);
game.missions.avanza(P, m => m.key === 'b');
assert(P.strike.n === 1, 'catena spezzata: si riparte da ×1');
ok('saltare un giorno azzera lo strike');

// 8) la settimana piena paga il settimanale
game.missions.oggi = () => D + 6; // ultimo giorno della settimana di D
P.settimana = { periodo: Math.floor(D / 7), pieni: 6 };
P.strike = { giorno: D + 5, n: 6 };
tre(P);
const oroPre = P.gold;
game.missions.avanza(P, m => true);
game.missions.avanza(P, m => m.key === 'b');
assert(P.settimana.pieni === 7, 'settimana piena: 7/7');
assert(P.gold === oroPre + 3 * PREMI.missione + PREMI.tris + PREMI.strike * 7 + PREMI.settimana,
  'il settimanale (+' + PREMI.settimana + ') arriva col settimo tris');
ok('settimana piena: tris tutti i giorni → +' + PREMI.settimana);

// 9) persistenza: il profilo porta progressi/strike/settimana, il rientro non ripaga
game.missions.oggi = () => D + 6;
const prof = game.youFor(P);
assert(prof.giornaliere.giorno === D + 6 && prof.giornaliere.fatte.every(Boolean), 'il profilo porta il giorno e le fatte');
assert(prof.strike.n === 7 && prof.settimana.pieni === 7, 'strike e settimana viaggiano nel profilo');
const R = game.join(conn(), { t: 'join', name: 'Redivivo', profile: { gold: 0, giornaliere: prof.giornaliere, strike: prof.strike, settimana: prof.settimana } });
assert(R.giornaliere.every(m => m.fatta), 'al rientro le fatte restano fatte');
const oroR = R.gold;
game.missions.avanza(R, m => true);
assert(R.gold === oroR, 'niente doppio incasso al rientro');
ok('persistenza: fatte, strike e settimana sopravvivono al rientro senza ripagare');

// 10) sanificazione: profili dal futuro o gonfiati si clampano
const T = game.join(conn(), {
  t: 'join', name: 'Baro', profile: {
    gold: 0,
    giornaliere: { giorno: D + 6, progressi: [999, 999, 999], fatte: 'no' },
    strike: { giorno: D + 999, n: -5 },
    settimana: { periodo: Math.floor(D / 7), pieni: 7 },
  },
});
assert(T.giornaliere.every(m => m.progress <= m.n && !m.fatta), 'progressi clampati, fatte non-array ignorate');
assert(T.strike.giorno <= D + 6 && T.strike.n === 0, 'strike mai dal futuro né negativo');
assert(T.settimana.pieni <= (D + 6) % 7 + 1, 'giorni pieni mai più dei giorni passati');
ok('sanificazione: il profilo non detta legge sul calendario');

console.log('\nLE TRE DEL GIORNO VERDI 📖');
process.exit(0);
