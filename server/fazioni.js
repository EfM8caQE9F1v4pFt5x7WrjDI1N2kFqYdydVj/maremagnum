'use strict';

// Catalogo visivo delle tre fazioni. La Ciurma Libera continua a usare
// server/pirati.js per sblocchi e gameplay; Compagnia e Marina restano
// cataloghi autonomi finché non avranno meccaniche proprie.
const pirati = require('./pirati');

function ritratto(cartella, id) {
  return { id, ritratto: 'assets/fazioni/' + cartella + '/' + id + '.webp' };
}

const FAZIONI = {
  ciurma_libera: {
    id: 'ciurma_libera',
    roster: pirati.ROSTER.map(p => ({ id: p.id, ritratto: p.ritratto })),
  },
  compagnia_indie: {
    id: 'compagnia_indie',
    roster: [
      'direttore', 'fattora', 'contabile', 'capitana_mercantile',
      'guardia_avorio', 'moschettiera', 'speziale', 'chirurgo', 'cartografa',
      'esattore', 'palombaro', 'facchino_ottone', 'scrivano_automatico',
      'custode_sigillo', 'mastino_stiva',
    ].map(id => ritratto('compagnia', id)),
  },
  marina_britannica: {
    id: 'marina_britannica',
    roster: [
      'cadetto', 'marinaio_scelto', 'nostromo_reale', 'capitana', 'ammiraglio',
      'fuciliera_marina', 'cannoniere', 'artificiere', 'cartografa_reale',
      'meteorologo', 'medico_navale', 'cappellano', 'ingegnere',
      'palombaro_reale', 'segnalatrice',
    ].map(id => ritratto('marina', id)),
  },
};

module.exports = { FAZIONI };
