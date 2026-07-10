'use strict';

// Il Negozio delle Livree (issue #25): SOLO estetica, mai vantaggio —
// pay to show, mai pay to win. Vendita diretta a dobloni (il modello
// economico vero è la #28: finché non è chiaro, niente denaro reale),
// niente casse cieche. Unica fonte di verità: prezzi e catalogo li fa
// rispettare il server, il client riceve questo catalogo nel welcome.

// Le livree complete hanno un atlante dedicato (assets/livree/<id>.webp,
// stessa geometria dell'atlante navi) che il client scarica solo quando
// serve; le VELE sono un overlay di tela (assets/vele/tela.webp, UNO per
// tutti) tinto dal client con `tinta` — una vela nuova è solo una riga qui;
// le scie sono un colore e basta. `impresa` = non si compra: si GUADAGNA
// (la campagna del Mastro della settimana).
const CATALOGO = {
  // livree complete (scafo, finiture E vele insieme: l'abito di gala)
  nera: { nome: 'Livrea della Notte', genere: 'livrea', prezzo: 15000, scia: 0x4a5560, motto: 'La notte non chiede permesso' },
  scarlatta: { nome: 'Livrea Scarlatta', genere: 'livrea', prezzo: 15000, scia: 0xc2453a, motto: 'Che ti vedano arrivare — e tremino' },
  verderame: { nome: 'Verderame', genere: 'livrea', prezzo: 15000, scia: 0x3f9a8d, motto: 'Il colore del bronzo che ha vissuto' },
  indaco: { nome: 'Avorio e Indaco', genere: 'livrea', prezzo: 30000, scia: 0x5a6fd4, motto: 'Eleganza da ammiragliato, cuore da corsaro' },
  ombre: { nome: 'Mare delle Ombre', genere: 'livrea', prezzo: null, impresa: 'campagna', scia: 0x8a7bd6, motto: 'Solo chi ha compiuto la campagna del Mastro la indossa' },
  // vele sciolte: la tela si tinge sopra qualunque livrea (o legno nudo)
  velenere: { nome: 'Vele Nere', genere: 'vele', prezzo: 8000, tinta: 0x3a3a42, scia: 0x4a5560, motto: 'Il terrore viaggia a gonfie vele' },
  velescarlatte: { nome: 'Vele Scarlatte', genere: 'vele', prezzo: 8000, tinta: 0xc65545, scia: 0xc2453a, motto: 'All\'orizzonte, un tramonto che morde' },
  veledoro: { nome: 'Vele d\'Oro', genere: 'vele', prezzo: 8000, tinta: 0xe9c268, scia: 0xf0c14e, motto: 'Chi ha oro da sperperare lo cuce in cielo' },
  velesmeraldo: { nome: 'Vele di Smeraldo', genere: 'vele', prezzo: 8000, tinta: 0x9fd8b8, scia: 0x39c98e, motto: 'Il mare invidia il tuo verde' },
  // scie sciolte (si comprano da sole, vincono su vele e livrea)
  sciaoro: { nome: 'Scia d\'Oro', genere: 'scia', prezzo: 5000, scia: 0xf0c14e, motto: 'Una strada d\'oro dietro la poppa' },
  sciasmeraldo: { nome: 'Scia di Smeraldo', genere: 'scia', prezzo: 5000, scia: 0x39c98e, motto: 'Il mare si accende di verde al tuo passaggio' },
  sciasangue: { nome: 'Scia di Sangue', genere: 'scia', prezzo: 5000, scia: 0xb03030, motto: 'Per chi non lascia domande, solo leggende' },
};
// i generi indossabili: uno slot ciascuno, mai collassare l'uno nell'altro
// (client e server DEVONO leggere questa stessa mappa: genere ignoto = no)
const GENERI = ['livrea', 'vele', 'scia'];

// La bandiera personale (issue #25, v1): stesso DATO delle bandiere di
// gilda — indici su set fissi, niente upload né moderazione. Si mostra in
// targhetta solo per chi NON ha una Fratellanza (la gilda vince).
function sanificaBandiera(b) {
  if (!b || typeof b !== 'object') return null;
  const idx = (v, n) => Math.abs(v | 0) % n;
  return {
    fondo: idx(b.fondo, 8), taglio: idx(b.taglio, 4), tinta2: idx(b.tinta2, 8),
    emblema: idx(b.emblema, 8), tintaEmblema: idx(b.tintaEmblema, 8),
  };
}

// Il guardaroba dal profilo client: mai fidarsi. Possedute = solo id a
// catalogo (le imprese passano: si riscattano dal profilo come tutto il
// resto — la fiducia è la stessa dell'oro); indossata = solo se posseduta
// e del genere giusto.
function sanificaGuardaroba(p) {
  const possedute = new Set();
  if (Array.isArray(p && p.livree)) {
    for (const id of p.livree.slice(0, 50)) {
      if (typeof id === 'string' && CATALOGO[id]) possedute.add(id);
    }
  }
  const indossa = (id, genere) =>
    (typeof id === 'string' && possedute.has(id) && CATALOGO[id].genere === genere) ? id : null;
  return {
    livree: possedute,
    livrea: indossa(p && p.livrea, 'livrea'),
    vele: indossa(p && p.vele, 'vele'),
    scia: indossa(p && p.scia, 'scia'),
    bandiera: sanificaBandiera(p && p.bandiera),
  };
}

// Il colore di scia effettivo: la scia comprata vince, poi le vele (sono la
// firma più visibile), poi la livrea, poi niente.
function sciaDi(ship) {
  if (ship.scia && CATALOGO[ship.scia]) return CATALOGO[ship.scia].scia;
  if (ship.vele && CATALOGO[ship.vele]) return CATALOGO[ship.vele].scia;
  if (ship.livrea && CATALOGO[ship.livrea]) return CATALOGO[ship.livrea].scia;
  return null;
}

// Catalogo pubblico per il client (welcome): tutto tranne i campi interni.
function publicCatalogo() {
  return Object.fromEntries(Object.entries(CATALOGO).map(([id, l]) => [id, {
    nome: l.nome, genere: l.genere, prezzo: l.prezzo, scia: l.scia,
    tinta: l.tinta ?? null, motto: l.motto, impresa: l.impresa || null,
  }]));
}

module.exports = { CATALOGO, GENERI, sanificaGuardaroba, sanificaBandiera, sciaDi, publicCatalogo };
