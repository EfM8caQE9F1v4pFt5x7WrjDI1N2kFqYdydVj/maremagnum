'use strict';

// Il Negozio delle Livree (issue #25): SOLO estetica, mai vantaggio —
// pay to show, mai pay to win. Vendita diretta a dobloni (il modello
// economico vero è la #28: finché non è chiaro, niente denaro reale),
// niente casse cieche. Unica fonte di verità: prezzi e catalogo li fa
// rispettare il server, il client riceve questo catalogo nel welcome.

// Le livree complete hanno un atlante dedicato (assets/livree/<id>.webp,
// stessa geometria dell'atlante navi) che il client scarica solo quando
// serve; le scie sono un colore e basta. `impresa` = non si compra: si
// GUADAGNA (la campagna del Mastro della settimana).
const CATALOGO = {
  // livree di scafo e vele
  nera: { nome: 'Vele Nere', genere: 'livrea', prezzo: 15000, scia: 0x4a5560, motto: 'La notte non chiede permesso' },
  scarlatta: { nome: 'Vele Scarlatte', genere: 'livrea', prezzo: 15000, scia: 0xc2453a, motto: 'Che ti vedano arrivare — e tremino' },
  verderame: { nome: 'Verderame', genere: 'livrea', prezzo: 15000, scia: 0x3f9a8d, motto: 'Il colore del bronzo che ha vissuto' },
  indaco: { nome: 'Avorio e Indaco', genere: 'livrea', prezzo: 30000, scia: 0x5a6fd4, motto: 'Eleganza da ammiragliato, cuore da corsaro' },
  ombre: { nome: 'Mare delle Ombre', genere: 'livrea', prezzo: null, impresa: 'campagna', scia: 0x8a7bd6, motto: 'Solo chi ha compiuto la campagna del Mastro la indossa' },
  // scie sciolte (si comprano da sole, vincono sulla scia della livrea)
  sciaoro: { nome: 'Scia d\'Oro', genere: 'scia', prezzo: 5000, scia: 0xf0c14e, motto: 'Una strada d\'oro dietro la poppa' },
  sciasmeraldo: { nome: 'Scia di Smeraldo', genere: 'scia', prezzo: 5000, scia: 0x39c98e, motto: 'Il mare si accende di verde al tuo passaggio' },
  sciasangue: { nome: 'Scia di Sangue', genere: 'scia', prezzo: 5000, scia: 0xb03030, motto: 'Per chi non lascia domande, solo leggende' },
};

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
    scia: indossa(p && p.scia, 'scia'),
    bandiera: sanificaBandiera(p && p.bandiera),
  };
}

// Il colore di scia effettivo: la scia comprata vince, poi la livrea, poi niente.
function sciaDi(ship) {
  if (ship.scia && CATALOGO[ship.scia]) return CATALOGO[ship.scia].scia;
  if (ship.livrea && CATALOGO[ship.livrea]) return CATALOGO[ship.livrea].scia;
  return null;
}

// Catalogo pubblico per il client (welcome): tutto tranne i campi interni.
function publicCatalogo() {
  return Object.fromEntries(Object.entries(CATALOGO).map(([id, l]) => [id, {
    nome: l.nome, genere: l.genere, prezzo: l.prezzo, scia: l.scia,
    motto: l.motto, impresa: l.impresa || null,
  }]));
}

module.exports = { CATALOGO, sanificaGuardaroba, sanificaBandiera, sciaDi, publicCatalogo };
