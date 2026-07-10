'use strict';

// Le Alleanze temporanee (issue #37): il party effimero della sessione.
// Si verifica senza rete guidando il Game: formazione (invito e bandiera
// aperta), tetto, scadenza degli inviti, scioglimento, e il cuore — la
// spartizione del dungeon fra la SQUADRA (quota code-owned + gating per-nave),
// il settimanale che avanza la campagna di ognuno, il fuoco amico che resta
// acceso e la Fortezza vera che resta winner-take-all.

const assert = require('assert');
const campagna = require('../server/campagna-core');
const { Game } = require('../server/game');
const { ALLEANZA, quotaAlleanza } = require('../server/alleanze');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = (inbox) => ({ send(s) { if (inbox) inbox.push(JSON.parse(s)); }, readyState: 1 });
const abbatti = (game, isola, byId) => { for (const d of isola.defs) game.damageDefense(isola, d, 99999, byId); };
const ultimo = (inbox, t) => [...inbox].reverse().find(m => m.t === t) || null;

// — 0) la quota è code-owned e prevedibile: mai in perdita da soli —
assert.strictEqual(quotaAlleanza(400, 1), 400, 'da soli il premio resta pieno');
assert.strictEqual(quotaAlleanza(400, 2), 300, 'in due: 400/2 + 25% = 300 a testa');
assert.strictEqual(quotaAlleanza(1000, 4), 500, 'in quattro sul tosto: 250 + 250 = 500 a testa');
ok('quotaAlleanza: solo=pieno, 2→300/400, 4→500/1000');

// — 1) invito diretto: invita → accetta → alleanza di due, stato ai membri —
const game = new Game(() => {});
game.pausa();
campagna.setDungeon('giornaliero', null);
campagna.setDungeon('settimanale', null);

const inA = [], inB = [], inC = [], inD = [], inE = [];
const A = game.join(conn(inA), { t: 'join', name: 'Alfa', profile: { gold: 0 } });
const B = game.join(conn(inB), { t: 'join', name: 'Bravo', profile: { gold: 0 } });
const C = game.join(conn(inC), { t: 'join', name: 'Charlie', profile: { gold: 0 } });
const D = game.join(conn(inD), { t: 'join', name: 'Delta', profile: { gold: 0 } });
const E = game.join(conn(inE), { t: 'join', name: 'Echo', profile: { gold: 0 } });
for (const s of [A, B, C, D, E]) s.graceUntil = 0;

game.handle(A, { t: 'alleanzaInvita', id: B.id });
const invito = ultimo(inB, 'alleanzaInvito');
assert(invito && invito.da.id === A.id && invito.da.nome === 'Alfa', 'l\'invito arriva al destinatario');
game.handle(B, { t: 'alleanzaAccetta', id: A.id });
assert(A.alleanzaId && A.alleanzaId === B.alleanzaId, 'accettando si naviga sotto la stessa alleanza');
const statoB = ultimo(inB, 'alleanza');
assert(statoB && statoB.membri.length === 2 && statoB.max === ALLEANZA.max, 'lo stato arriva ai membri (2 vele)');
ok('invito diretto: invita → accetta → alleanza di 2 con stato ai membri');

// il freno agli inviti: due nello stesso secondo, il secondo cade nel vuoto
// (il mare è in pausa: game.now è fermo, quindi il freno va sciolto a mano)
A.invitoAt = 0;
game.handle(A, { t: 'alleanzaInvita', id: C.id });
assert.strictEqual(inC.filter(m => m.t === 'alleanzaInvito').length, 1, 'il primo invito passa');
game.handle(A, { t: 'alleanzaInvita', id: C.id });
assert.strictEqual(inC.filter(m => m.t === 'alleanzaInvito').length, 1, 'la grandine di inviti è frenata');
ok('freno anti-spam sugli inviti');

// — 2) invito scaduto: la marea se lo porta via —
C.invitiAlleanza.set(A.id, game.now - 1); // forza la scadenza
game.handle(C, { t: 'alleanzaAccetta', id: A.id });
assert(!C.alleanzaId, 'un invito scaduto non arruola');
ok('invito scaduto: niente arruolamento');

// — 3) bandiera aperta: unisciti fino al tetto, mai oltre —
A.invitoAt = 0;
game.handle(A, { t: 'alleanzaApri' });
const a = game.alleanze.di(A);
assert(a.aperta, 'la bandiera sventola');
game.handle(C, { t: 'alleanzaUnisciti', id: a.id });
game.handle(D, { t: 'alleanzaUnisciti', id: a.id });
assert.strictEqual(a.membri.size, 4, 'con la bandiera aperta si sale fino al tetto');
game.handle(E, { t: 'alleanzaUnisciti', id: a.id });
assert(!E.alleanzaId && a.membri.size === 4, `il tetto (${ALLEANZA.max}) tiene`);
assert.strictEqual(game.alleanze.bandiereAperte().length, 0, 'un\'alleanza piena non sventola più fra le aperte');
ok(`bandiera aperta: si sale fino a ${ALLEANZA.max}, il quinto resta a riva`);

// — 4) chi lascia esce; in uno (senza bandiera) l'alleanza si scioglie —
game.handle(D, { t: 'alleanzaLascia' });
game.handle(C, { t: 'alleanzaLascia' });
assert(!D.alleanzaId && !C.alleanzaId && a.membri.size === 2, 'chi lascia è fuori');
game.handle(A, { t: 'alleanzaChiudi' });
game.handle(B, { t: 'alleanzaLascia' });
assert(!A.alleanzaId && !B.alleanzaId && !game.alleanze.alleanze.has(a.id), 'in uno, senza bandiera, si scioglie');
ok('lascia/scioglimento: in uno senza bandiera l\'alleanza svanisce');

// — 5) il dungeon in SQUADRA: quota a testa a chi ha battuto le difese —
const giorno = campagna.giornoDi();
const dg = campagna.genera('giornaliero', giorno, ['wikipedia.org']);
dg.difficolta = 'tosto'; dg.premio = campagna.LISTINO.tosto;
campagna.setDungeon('giornaliero', dg);
game.applicaDungeoni();
const isola = game.archipelago.get('wikipedia.org');
assert(isola && isola.defs && isola.defs.length, 'le difese del dungeon sono in piedi');

// A+B alleati, C in acque libere: tutti e tre sparano, D guarda da lontano
A.invitoAt = 0;
game.handle(A, { t: 'alleanzaInvita', id: B.id });
game.handle(B, { t: 'alleanzaAccetta', id: A.id });
const oroA = A.gold, oroB = B.gold, oroC = C.gold, oroD = D.gold;
game.damageDefense(isola, isola.defs[0], 1, B.id); // B partecipa (un colpo basta)
game.damageDefense(isola, isola.defs[0], 1, C.id); // C partecipa ma NON è alleato
abbatti(game, isola, A.id);                        // A dà il colpo di grazia
const quota2 = quotaAlleanza(dg.premio, 2);
assert.strictEqual(A.gold - oroA, quota2, `l'eroe incassa la quota (${quota2})`);
assert.strictEqual(B.gold - oroB, quota2, `l'alleato che ha sparato incassa la quota (${quota2})`);
assert.strictEqual(C.gold - oroC, 0, 'chi non è alleato non spartisce (winner-take-all come prima)');
assert.strictEqual(D.gold - oroD, 0, 'chi non ha sparato non è in squadra');
assert.strictEqual(A.dungeonGiorno, giorno, 'il giorno di A risulta incassato');
assert.strictEqual(B.dungeonGiorno, giorno, 'il giorno di B risulta incassato');
assert(!isola.assalitori, 'il registro dell\'assalto si azzera alla caduta');
ok(`squadra di 2: quota ${quota2} a testa, l'estraneo e il lontano restano a bocca asciutta`);

// niente doppio incasso: si rialzano le difese, si riabbattono in alleanza
const oroA2 = A.gold, oroB2 = B.gold;
isola.fallenUntil = 0;
for (const d of isola.defs) { d.dead = false; d.hp = d.max; }
game.damageDefense(isola, isola.defs[0], 1, B.id);
abbatti(game, isola, A.id);
assert.strictEqual(A.gold, oroA2, 'stesso giorno: A non incassa due volte');
assert.strictEqual(B.gold, oroB2, 'stesso giorno: B non incassa due volte');
ok('il tetto per-nave-per-periodo tiene anche in squadra');

// l'alleato "fresco" (mai incassato oggi) viene trainato: incassa la SUA quota
game.handle(A, { t: 'alleanzaLascia' }); // si riparte puliti
A.invitoAt = 0;
game.handle(A, { t: 'alleanzaInvita', id: C.id });
game.handle(C, { t: 'alleanzaAccetta', id: A.id });
C.dungeonGiorno = 0; // C oggi non ha ancora incassato
const oroC2 = C.gold, oroA3 = A.gold;
isola.fallenUntil = 0;
for (const d of isola.defs) { d.dead = false; d.hp = d.max; }
game.damageDefense(isola, isola.defs[0], 1, C.id);
abbatti(game, isola, A.id);
assert.strictEqual(A.gold, oroA3, 'A ha già incassato oggi: zero');
assert.strictEqual(C.gold - oroC2, quotaAlleanza(dg.premio, 2), 'C trainato incassa la quota di squadra');
ok('il trainato fresco incassa la quota; chi ha già incassato resta il tetto');

// — 6) il SETTIMANALE avanza la campagna di OGNI alleato in squadra —
campagna.setDungeon('giornaliero', null);
const sett = campagna.settimanaDi();
const dw = campagna.genera('settimanale', sett, ['archive.org']);
campagna.setDungeon('settimanale', dw);
game.applicaDungeoni();
const isolaW = game.archipelago.get('archive.org');
assert(isolaW && isolaW.defs && isolaW.defs.length, 'le difese del settimanale sono in piedi');
// A e C (già alleati) arrivano alla tappa d'espugnazione
const ultima = dw.tappe.length - 1;
A.campagna = { settimana: sett, tappa: ultima, fatto: 0, completata: false };
C.campagna = { settimana: sett, tappa: ultima, fatto: 0, completata: false };
game.damageDefense(isolaW, isolaW.defs[0], 1, C.id);
abbatti(game, isolaW, A.id);
assert(A.campagna.completata, 'l\'eroe compie la campagna');
assert(C.campagna.completata, 'l\'alleato in squadra compie la SUA campagna');
ok('settimanale in squadra: ognuno avanza la propria campagna');

// — 7) la polvere non guarda in faccia: il fuoco amico RESTA acceso —
A.invitoAt = 0;
const hpB = B.hp;
game.handle(A, { t: 'alleanzaInvita', id: B.id });
game.handle(B, { t: 'alleanzaAccetta', id: A.id });
game.damageShip(B, 10, A.id);
assert.strictEqual(B.hp, hpB - 10, 'i colpi dell\'alleato feriscono (tradimento possibile)');
ok('fuoco amico acceso: anche fra alleati la polvere morde');

// — 8) chi sbarca (disconnessione) esce dall'alleanza —
// qui l'alleanza è di tre (A+C dal traino, più B appena arruolato)
const aFinale = game.alleanze.di(A);
assert.strictEqual(aFinale.membri.size, 3, 'si parte in tre');
game.leave(B);
assert(!B.alleanzaId && !aFinale.membri.has(B.id), 'il congedo toglie dall\'alleanza');
assert(A.alleanzaId && C.alleanzaId, 'gli altri due restano alleati');
game.leave(C);
assert(!A.alleanzaId && !game.alleanze.alleanze.has(aFinale.id), 'rimasto solo (senza bandiera), anche l\'ultimo è libero');
ok('lo sbarco scioglie: il party è di sessione, mai persistito');

// — 9) la Fortezza vera resta winner-take-all: nessuna spartizione —
const F = game.join(conn(), { t: 'join', name: 'Foxtrot', profile: { gold: 0 } });
const G = game.join(conn(), { t: 'join', name: 'Golf', profile: { gold: 0 } });
F.invitoAt = 0;
game.handle(F, { t: 'alleanzaInvita', id: G.id });
game.handle(G, { t: 'alleanzaAccetta', id: F.id });
const fortezza = game.archipelago.ensure('fortezza-vera-collaudo.example').island;
fortezza.fortress = true;
fortezza.defs = [{ kind: 't', x: fortezza.x, y: fortezza.y, hp: 10, max: 10, dead: false, lastHit: 0, fireAt: 0 }];
const oroF = F.gold, oroG = G.gold;
game.damageDefense(fortezza, fortezza.defs[0], 1, G.id); // G partecipa…
abbatti(game, fortezza, F.id);                            // …ma la Fortezza paga solo F
const { FORT } = require('../server/world');
assert.strictEqual(F.gold - oroF, FORT.conquestBounty, 'la Fortezza paga il solo eroe (invariata)');
assert.strictEqual(G.gold - oroG, 0, 'nessuna spartizione sulle Fortezze Proibite (fuori dal #37)');
assert(F.conquered.has(fortezza.id) && !G.conquered.has(fortezza.id), 'la conquista permanente resta personale');
ok('Fortezza Proibita invariata: winner-take-all, conquista personale');

// — 10) lo stato per il client: membri null fuori, elenco dentro —
const st = game.alleanze.statoPer(D);
assert.strictEqual(st.membri, null, 'fuori da un\'alleanza lo stato dice membri null');
assert.strictEqual(st.max, ALLEANZA.max, 'il tetto viaggia nello stato');
ok('protocollo: statoPer fuori/dentro coerente');

campagna.setDungeon('giornaliero', null);
campagna.setDungeon('settimanale', null);
game.stop();
console.log('\nTest delle Alleanze temporanee: TUTTO VERDE ⚓🤝');
