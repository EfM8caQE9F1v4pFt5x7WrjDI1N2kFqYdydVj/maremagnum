'use strict';

// Le Fratellanze (issue #5), cuore alla prova: fondazione e unicità,
// sanificazione (XSS e bandiere), rito aperta/chiusa, galloni e gerarchia,
// tetto membri, scioglimento.

const assert = require('assert');
const gilde = require('../server/gilde-core');

const ok = (m) => console.log(`  ✅ ${m}`);

gilde.setGilde([]);

// — 1) fondazione: sanificazione e unicità —
const r1 = gilde.fonda({
  nome: '<b>Vele</b> Nere ', tag: 've!le', motto: '<script>x</script>Mai domi',
  categoria: 'corsari', bandiera: { fondo: 99, taglio: -3, emblema: 'x' },
  aperta: false, uid: 'capitano1', nomeNave: 'Barbanera',
});
assert(!r1.errore, r1.errore);
const g = r1.gilda;
assert(!/[<>&"'`]/.test(g.nome) && g.nome.includes('Nere'), `il nome perde i denti (niente <>): "${g.nome}"`);
assert.strictEqual(g.tag, 'VELE', 'il tag si raddrizza in maiuscole pulite');
assert(!g.motto.includes('<'), 'il motto è sdentato');
assert(g.bandiera.fondo >= 0 && g.bandiera.fondo <= 7 && g.bandiera.taglio >= 0, 'bandiera sanificata su indici validi');
assert.strictEqual(gilde.ruoloDi(g, 'capitano1'), 'capitano', 'il fondatore è capitano');
ok('fondazione: sanificazione severa e fondatore capitano');

assert(gilde.fonda({ nome: g.nome, tag: 'ALTR', categoria: 'corsari', uid: 'x1', nomeNave: 'X' }).errore, 'nome doppio rifiutato');
assert(gilde.fonda({ nome: 'Altra Ciurma', tag: 'VELE', categoria: 'corsari', uid: 'x1', nomeNave: 'X' }).errore, 'tag doppio rifiutato');
assert(gilde.fonda({ nome: 'Seconda', tag: 'SEC', categoria: 'corsari', uid: 'capitano1', nomeNave: 'B' }).errore, 'chi ha già una gilda non ne fonda altre');
ok('unicità di nome e tag, una gilda a testa');

// — 2) porte chiuse: richiesta in rada, approvazione coi galloni —
const rr = gilde.richiedi(g.id, 'marinaio1', 'Olonese');
assert(!rr.errore && rr.ammesso === false, 'a porte chiuse si resta in rada');
assert(gilde.approva(g.id, 'marinaio1', 'marinaio1').errore, 'non ci si approva da soli');
const ra = gilde.approva(g.id, 'marinaio1', 'capitano1');
assert(!ra.errore && ra.ammesso.nome === 'Olonese', 'il capitano ammette');
assert.strictEqual(gilde.ruoloDi(g, 'marinaio1'), 'marinaio', "l'ammesso è marinaio");
ok('rito a porte chiuse: rada → ammissione dal capitano');

// — 3) galloni: promozione, espulsione, gerarchia —
assert(gilde.promuovi(g.id, 'marinaio1', 'marinaio1').errore, 'i marinai non si autopromuovono');
assert(!gilde.promuovi(g.id, 'marinaio1', 'capitano1').errore, 'il capitano promuove');
assert.strictEqual(gilde.ruoloDi(g, 'marinaio1'), 'ufficiale');
gilde.richiedi(g.id, 'marinaio2', 'Rackham');
assert(!gilde.approva(g.id, 'marinaio2', 'marinaio1').errore, "anche l'ufficiale ammette");
assert(gilde.espelli(g.id, 'marinaio1', 'marinaio2').errore, 'il marinaio non sbarca un ufficiale');
assert(!gilde.espelli(g.id, 'marinaio2', 'marinaio1').errore, "l'ufficiale sbarca il marinaio");
assert(gilde.espelli(g.id, 'capitano1', 'marinaio1').errore, 'nessuno sbarca il capitano');
ok('gerarchia dei galloni: promozioni ed espulsioni al posto giusto');

// — 4) porte aperte + tetto membri —
const r2 = gilde.fonda({ nome: 'Porte Aperte', tag: 'APRT', categoria: 'mercanti', aperta: true, uid: 'cap2', nomeNave: 'Mercurio' });
for (let i = 0; i < 23; i++) {
  const r = gilde.richiedi(r2.gilda.id, 'm' + i, 'Nave' + i);
  assert(!r.errore && r.ammesso === true, 'porte aperte = dentro subito (' + i + ')');
}
assert(gilde.richiedi(r2.gilda.id, 'extra', 'Extra').errore, 'al 25° la ciurma è al completo');
ok('porte aperte e tetto a 24 membri');

// — 5) il capitano non abbandona, ma scioglie —
assert(gilde.lascia(g.id, 'capitano1').errore, 'il capitano non abbandona');
assert(!gilde.lascia(g.id, 'marinaio1').errore, "l'ufficiale sì");
assert(gilde.sciogli(g.id, 'x1').errore, 'gli estranei non sciolgono nulla');
assert(!gilde.sciogli(g.id, 'capitano1').errore, 'il capitano scioglie');
assert.strictEqual(gilde.get(g.id), null, 'la gilda non c\'è più');
assert.strictEqual(gilde.diUid('capitano1'), null, 'il capitano è di nuovo senza bandiera');
ok('scioglimento: solo il capitano, e il registro dimentica');

console.log('\nFRATELLANZE VERDI 🏴');
process.exit(0);
