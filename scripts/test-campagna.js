'use strict';

// Il Mastro di Rotte (issue #3 → v2 #38), messo alla prova senza rete: i dungeon
// (giornaliero/settimanale) sono deterministici nel FALLBACK procedurale;
// l'economia è BLINDATA (il premio spendibile esce dal listino, mai dall'LLM);
// il vestito AI è validato (bersaglio reale, difese clampate); l'avanzamento
// sugli eventi veri del Game paga il premio una volta sola e finisce in Gazzetta.

const assert = require('assert');
const campagna = require('../server/campagna-core');
const gazzetta = require('../server/gazzetta-core');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = () => ({ send() {}, readyState: 1 });

// — 1) determinismo e struttura del vestito procedurale (settimanale) —
const a = campagna.genera('settimanale', 2950);
const b = campagna.genera('settimanale', 2950);
assert.deepStrictEqual(a, b, 'stesso seme → stesso dungeon procedurale');
assert(a.tappe.length === 3 && a.tappe[2].tipo === 'espugnazione', 'settimanale: 3 tappe, chiusura in assalto');
assert(a.tipo === 'settimanale' && a.periodo === 2950 && a.settimana === 2950, 'tipo/periodo/compat settimana');
assert(campagna.DIFFICOLTA.includes(a.difficolta) && a.premio === campagna.LISTINO[a.difficolta], 'premio dal listino, per fascia');
assert(a.difese && a.difese.torri >= 3 && a.difese.torri <= 10, 'porta uno spec di difese sano');
assert(a.nome && a.tappe.every(t => t.desc && t.lore), 'vestito procedurale completo senza AI');
ok(`determinismo e struttura: "${a.nome}" [${a.difficolta}, ${a.premio}🪙] (${a.tappe.map(t => t.tipo).join(' → ')})`);

// — 1bis) il giornaliero è a obiettivo singolo (l'assalto del giorno) —
const g = campagna.genera('giornaliero', campagna.giornoDi(), ['wikipedia.org']);
assert(g.tipo === 'giornaliero' && g.tappe.length === 1 && g.tappe[0].tipo === 'espugnazione', 'giornaliero: solo l\'assalto');
assert(g.tappe[0].bersaglio === 'wikipedia.org' && g.bersaglio === 'wikipedia.org', 'bersaglio reale nominato');
assert(typeof g.scadenza === 'number' && g.scadenza === (campagna.giornoDi() + 1) * 24 * 3600 * 1000, 'scadenza a fine giornata');
assert.strictEqual(campagna.periodoDi('settimanale'), campagna.settimanaDi(), 'periodoDi settimanale == settimanaDi');
assert.strictEqual(campagna.periodoDi('giornaliero'), campagna.giornoDi(), 'periodoDi giornaliero == giornoDi');
ok(`giornaliero a obiettivo singolo: «${g.tappe[0].desc}» (scade a fine dì)`);

// — 1ter) bersaglio reale deterministico nel fallback + assicura() —
const isole = ['wikipedia.org', 'archive.org', 'openstreetmap.org'];
const conBersaglio = campagna.genera('settimanale', 2950, isole);
const fin = conBersaglio.tappe[conBersaglio.tappe.length - 1];
assert(isole.includes(fin.bersaglio) && fin.desc.includes(fin.bersaglio), 'la fortezza finale nomina un\'isola reale');
assert.deepStrictEqual(campagna.genera('settimanale', 2950, isole), conBersaglio, 'scelta del bersaglio deterministica');
const senza = campagna.genera('settimanale', 2950, []);
assert(senza.tappe[2].bersaglio === null && /Fortezza Proibita/.test(senza.tappe[2].desc), 'senza isole → Fortezza Proibita');
const wk = campagna.settimanaDi();
const fresco = campagna.assicura(null, 'settimanale', wk, isole);
assert(fresco.daPubblicare && fresco.dungeon.periodo === wk, 'assente → seminato e da pubblicare');
const tenuto = campagna.assicura(fresco.dungeon, 'settimanale', wk, isole);
assert(!tenuto.daPubblicare && tenuto.dungeon === fresco.dungeon, 'stesso periodo → tenuto com\'è');
const vecchio = campagna.assicura(fresco.dungeon, 'settimanale', wk + 1, isole);
assert(vecchio.daPubblicare && vecchio.dungeon.periodo === wk + 1, 'periodo nuovo → rigenerato');
// self-heal: un dungeon del periodo giusto ma senza bersaglio si rigenera se ora ci sono candidati
const monco = campagna.genera('settimanale', wk, []); // Atlante muto → bersaglio null
assert(!monco.bersaglio, 'senza candidati il dungeon nasce senza bersaglio');
const sanato = campagna.assicura(monco, 'settimanale', wk, isole);
assert(sanato.daPubblicare && sanato.dungeon.bersaglio, 'self-heal: bersaglio nullo + candidati → rigenerato con bersaglio');
const restaMonco = campagna.assicura(monco, 'settimanale', wk, []); // ancora nessun candidato → si tiene
assert(!restaMonco.daPubblicare, 'senza candidati non si rigenera a vuoto');
ok(`bersaglio reale + assicura() + self-heal: «${fin.desc}»`);

// — 1ter-bis) il paniere dei bersagli: mai vuoto, isole della gente in testa —
const paniere = campagna.bersagli(['cumino.com', 'wikipedia.org']);
assert(paniere.length >= campagna.BERSAGLI_NOTI.length, 'il paniere contiene sempre i bersagli noti');
assert(paniere[0] === 'cumino.com', 'le isole reali passate vengono prima');
assert(paniere.filter(d => d === 'wikipedia.org').length === 1, 'niente doppioni col paniere noto');
assert(campagna.bersagli().length === campagna.BERSAGLI_NOTI.length && campagna.bersagli().every(d => d.includes('.')),
  'senza isole reali restano i bersagli noti (community piccola)');
ok(`paniere bersagli sempre degno: ${campagna.bersagli().length} noti + isole della gente`);

// — 1quater) ECONOMIA BLINDATA: l'AI riveste, il codice valida (#38) —
const base = campagna.genera('settimanale', 3000, isole);
// l'AI dichiara 'tosto' e prova a iniettare un premio gonfio + difese assurde: ignorati
const vestita = campagna.applicaVestito(base, {
  nome: 'Le Fauci del Kraken', lore: 'Tre convogli inghiottiti dal nulla.',
  nome_en: 'The Kraken\'s Maw', lore_en: 'Three convoys swallowed by nothing.',
  difficolta: 'tosto', premio: 999999, bersaglio: 'archive.org',
  tappe: ['Il mare ribolle.', 'Ombre sotto la chiglia.', 'La resa dei conti.'],
  tappe_en: ['The sea seethes.', 'Shadows beneath the keel.', 'The reckoning.'],
  difese: { torri: 999, bombarde: 99, specchio: true },
}, isole);
assert.strictEqual(vestita.premio, campagna.LISTINO.tosto, 'premio dal LISTINO, MAI dall\'AI (no pay-to-win)');
assert.strictEqual(vestita.bersaglio, 'archive.org', 'bersaglio reale accettato');
assert(vestita.tappe[2].desc.includes('archive.org'), 'la tappa finale si riallinea al bersaglio scelto');
assert(vestita.difese.torri <= 10 && vestita.difese.bombarde <= 3, 'difese clampate a range giocabili');
assert(vestita.nome === 'Le Fauci del Kraken' && vestita.tappe[0].lore === 'Il mare ribolle.', 'nome e narrazione AI adottati');
// i18n fetta 3: il Mastro parla anche inglese — stessa chiamata, stessa blindatura
assert(vestita.nome_en === "The Kraken's Maw" && vestita.lore_en === 'Three convoys swallowed by nothing.', 'nome e lore inglesi adottati');
assert(vestita.tappe[0].lore_en === 'The sea seethes.', 'la narrazione en per tappa viaggia');
assert(vestita.tappe[0].tk && vestita.tappe[0].tp && vestita.tappe[0].tp.n, 'le tappe meccaniche portano chiave e parametri (tk/tp)');
assert.strictEqual(vestita.tappe[2].tk, 'tappa.espugnazione', 'la tappa finale ha la chiave d\'espugnazione');
// bersaglio FINTO → rifiutato, resta un'isola reale (quella procedurale)
const finto = campagna.applicaVestito(base, { bersaglio: 'malware-inventato.xyz', difficolta: 'facile' }, isole);
assert(isole.includes(finto.bersaglio), 'bersaglio inventato rifiutato, resta reale');
assert.strictEqual(finto.premio, campagna.LISTINO.facile, 'premio segue la difficolta clampata');
// difficolta spazzatura → medio; vestito nullo → dungeon procedurale intatto e valido
assert.strictEqual(campagna.applicaVestito(base, { difficolta: 'apocalittico' }, isole).premio, campagna.LISTINO.medio, 'difficolta ignota → medio');
const nullo = campagna.applicaVestito(base, null, isole);
assert(campagna.valida(nullo) && nullo.nome === base.nome, 'vestito nullo → procedurale intatto');
ok('economia blindata: premio dal listino, bersaglio reale, difese clampate, fallback saldo');

// — 2) l'avanzamento sugli eventi veri del Game —
// scelgo una settimana la cui campagna apre coi Mercantili, per pilotarla
let sett = 2950;
while (campagna.genera('settimanale', sett).tappe[0].tipo !== 'mercantili' ||
       campagna.genera('settimanale', sett).tappe[1].tipo !== 'fantasmi') sett++;
const c = campagna.genera('settimanale', sett);
campagna.setCampagna(c);

const game = new Game(() => {});
game.pausa();
const P = game.join(conn(), { t: 'join', name: 'Pellegrino', profile: { gold: 1000 } });
P.graceUntil = 0;

// tappa 1: mercantili (n=2)
const npcs = [...game.ships.values()];
const mercs = npcs.filter(s => s.npc === 'merc');
const ghosts = npcs.filter(s => s.npc === 'ghost');
for (let i = 0; i < c.tappe[0].n; i++) {
  const m = mercs[i];
  m.graceUntil = 0; m.sunkUntil = 0;
  game.damageShip(m, 9999, P.id);
}
assert.strictEqual(P.campagna.tappa, 1, 'tappa 1 compiuta con gli affondamenti PvE');
ok('tappa 1: i Mercantili affondati fanno avanzare la campagna');

// tappa 2: fantasmi (n=2)
for (let i = 0; i < c.tappe[1].n; i++) {
  const gh = ghosts[i];
  gh.graceUntil = 0; gh.sunkUntil = 0;
  game.damageShip(gh, 9999, P.id);
}
assert.strictEqual(P.campagna.tappa, 2, 'tappa 2 compiuta coi Fantasmi');
ok('tappa 2: i Corsari Fantasma contano solo nella tappa giusta');

// tappa 3: espugnazione — si simula il trionfo passando dall'evento vero
const oroPrima = P.gold;
gazzetta.setVoci([]);
game.avanzaCampagna(P, 'espugnazione');
assert(P.campagna.completata, 'campagna compiuta');
assert.strictEqual(P.gold, oroPrima + c.premio, `premio pagato (${c.premio}, dal listino per fascia)`);
assert(gazzetta.ultime(5).some(v => v.tipo === 'campagna' && v.testo.includes('Pellegrino')),
  'il trionfo va in Gazzetta');
ok('tappa 3 + premio per fascia + gloria in Gazzetta');

// — 3) il premio non si paga due volte, e il profilo fa il giro —
game.avanzaCampagna(P, 'espugnazione');
assert.strictEqual(P.gold, oroPrima + c.premio, 'niente doppio premio');
const you = game.youFor(P);
assert(you.campagna && you.campagna.completata && you.campagna.settimana === c.settimana,
  'il progresso viaggia nel profilo');
const P2 = game.join(conn(), { t: 'join', name: 'Redivivo', profile: { gold: 100, campagna: you.campagna } });
assert(P2.campagna.completata, 'al rientro la campagna resta compiuta');
ok('idempotenza del premio e progresso persistente nel profilo');

// — 4) periodo nuovo = campagna nuova: il progresso vecchio si azzera —
campagna.setCampagna(campagna.genera('settimanale', sett + 1));
game.avanzaCampagna(P2, campagna.getCampagna().tappe[0].tipo);
assert(P2.campagna.settimana === sett + 1 && !P2.campagna.completata,
  'la settimana nuova riparte da capo');
ok('il lunedì il Mastro volta pagina');

console.log('\nMASTRO DI ROTTE VERDE ⚔');
process.exit(0);
