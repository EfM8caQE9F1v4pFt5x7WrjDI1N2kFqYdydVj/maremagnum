'use strict';

// Il Mastro di Rotte (issue #3), messo alla prova senza rete: la campagna
// è deterministica dal numero della settimana, avanza sugli eventi veri del
// Game, paga il premio fisso una volta sola e finisce in Gazzetta.

const assert = require('assert');
const campagna = require('../server/campagna-core');
const gazzetta = require('../server/gazzetta-core');
const { Game } = require('../server/game');

const ok = (m) => console.log(`  ✅ ${m}`);
const conn = () => ({ send() {}, readyState: 1 });

// — 1) determinismo: stessa settimana → stessa campagna, senza LLM —
const a = campagna.genera(2950);
const b = campagna.genera(2950);
assert.deepStrictEqual(a, b, 'la campagna deve essere deterministica');
assert.notDeepStrictEqual(campagna.genera(2951).tappe, a.tappe.length && undefined, 'sanity');
assert(a.tappe.length === 3 && a.tappe[2].tipo === 'espugnazione', 'tre tappe, chiusura in fortezza');
assert.strictEqual(a.premio, campagna.PREMIO, 'premio fisso e magro');
assert(a.nome && a.tappe.every(t => t.desc && t.lore), 'vestito procedurale completo senza AI');
ok(`determinismo e struttura: "${a.nome}" (${a.tappe.map(t => t.tipo).join(' → ')})`);

// — 1bis) le tappe d'assedio nominano isole reali dell'Atlante (issue #36) —
const isole = ['wikipedia.org', 'archive.org', 'openstreetmap.org'];
const conBersaglio = campagna.genera(2950, isole);
const fin = conBersaglio.tappe[conBersaglio.tappe.length - 1];
assert(fin.tipo === 'espugnazione' && isole.includes(fin.bersaglio),
  'la fortezza finale nomina un\'isola reale sopra soglia');
assert(fin.desc.includes(fin.bersaglio), 'la descrizione della tappa nomina il bersaglio');
assert.deepStrictEqual(campagna.genera(2950, isole), conBersaglio,
  'la scelta del bersaglio è deterministica dalla settimana');
const senza = campagna.genera(2950, []);
assert(senza.tappe[2].bersaglio === null && /Fortezza Proibita/.test(senza.tappe[2].desc),
  'senza isole reali si ripiega sulla generica Fortezza Proibita');
ok(`bersaglio reale deterministico: «${fin.desc}»`);

// — 1ter) assicura(): semina se manca/stantia, tiene se è della settimana —
const wk = campagna.settimanaDi();
const fresco = campagna.assicura(null, wk, isole);
assert(fresco.daPubblicare && fresco.campagna.settimana === wk,
  'campagna assente → seminata al volo e da pubblicare');
const tenuta = campagna.assicura(fresco.campagna, wk, isole);
assert(!tenuta.daPubblicare && tenuta.campagna === fresco.campagna,
  'campagna della settimana giusta → tenuta com\'è, niente ripubblicazione');
const vecchia = { settimana: wk - 1, nome: 'Vecchia', tappe: [{ tipo: 'x', n: 1, desc: 'y' }], premio: 400 };
const rinnovata = campagna.assicura(vecchia, wk, isole);
assert(rinnovata.daPubblicare && rinnovata.campagna.settimana === wk,
  'campagna stantia → rigenerata per la settimana corrente');
ok('assicura(): auto-seed al bisogno, nessuna ripubblicazione inutile');

// — 2) l'avanzamento sugli eventi veri del Game —
// scelgo una settimana la cui campagna apre coi Mercantili, per pilotarla
let sett = 2950;
while (campagna.genera(sett).tappe[0].tipo !== 'mercantili' || campagna.genera(sett).tappe[1].tipo !== 'fantasmi') sett++;
const c = campagna.genera(sett);
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
  const g = ghosts[i];
  g.graceUntil = 0; g.sunkUntil = 0;
  game.damageShip(g, 9999, P.id);
}
assert.strictEqual(P.campagna.tappa, 2, 'tappa 2 compiuta coi Fantasmi');
ok('tappa 2: i Corsari Fantasma contano solo nella tappa giusta');

// tappa 3: espugnazione — si simula il trionfo passando dall'evento vero
const oroPrima = P.gold;
gazzetta.setVoci([]);
game.avanzaCampagna(P, 'espugnazione');
assert(P.campagna.completata, 'campagna compiuta');
assert.strictEqual(P.gold, oroPrima + c.premio, `premio pagato (${c.premio})`);
assert(gazzetta.ultime(5).some(v => v.tipo === 'campagna' && v.testo.includes('Pellegrino')),
  'il trionfo va in Gazzetta');
ok('tappa 3 + premio fisso + gloria in Gazzetta');

// — 3) il premio non si paga due volte, e il profilo fa il giro —
game.avanzaCampagna(P, 'espugnazione');
assert.strictEqual(P.gold, oroPrima + c.premio, 'niente doppio premio');
const you = game.youFor(P);
assert(you.campagna && you.campagna.completata && you.campagna.settimana === c.settimana,
  'il progresso viaggia nel profilo');
// un secondo join con quel profilo NON riparte da zero
const P2 = game.join(conn(), { t: 'join', name: 'Redivivo', profile: { gold: 100, campagna: you.campagna } });
assert(P2.campagna.completata, 'al rientro la campagna resta compiuta');
ok('idempotenza del premio e progresso persistente nel profilo');

// — 4) settimana nuova = campagna nuova: il progresso vecchio si azzera —
campagna.setCampagna(campagna.genera(sett + 1));
game.avanzaCampagna(P2, campagna.getCampagna().tappe[0].tipo);
assert(P2.campagna.settimana === sett + 1 && !P2.campagna.completata,
  'la settimana nuova riparte da capo');
ok('il lunedì il Mastro volta pagina');

console.log('\nMASTRO DI ROTTE VERDE ⚔');
process.exit(0);
