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
    id: 'ciurma_libera', codice: 'c',
    ruolo: 'Capitani giocanti e corsari senza padrone',
    roster: pirati.ROSTER.map(p => ({ id: p.id, ritratto: p.ritratto })),
  },
  compagnia_indie: {
    id: 'compagnia_indie', codice: 'i',
    ruolo: 'Mercantili, convogli e Galeone del Tesoro',
    roster: [
      'direttore', 'fattora', 'contabile', 'capitana_mercantile',
      'guardia_avorio', 'moschettiera', 'speziale', 'chirurgo', 'cartografa',
      'esattore', 'palombaro', 'facchino_ottone', 'scrivano_automatico',
      'custode_sigillo', 'mastino_stiva',
    ].map(id => ritratto('compagnia', id)),
  },
  marina_britannica: {
    id: 'marina_britannica', codice: 'r',
    ruolo: 'Scorte armate e Cacciatori di Taglie',
    roster: [
      'cadetto', 'marinaio_scelto', 'nostromo_reale', 'capitana', 'ammiraglio',
      'fuciliera_marina', 'cannoniere', 'artificiere', 'cartografa_reale',
      'meteorologo', 'medico_navale', 'cappellano', 'ingegnere',
      'palombaro_reale', 'segnalatrice',
    ].map(id => ritratto('marina', id)),
  },
};

const PER_CODICE = Object.fromEntries(Object.values(FAZIONI).map(f => [f.codice, f]));

function indiceNave(ship, n) {
  const s = String((ship && ship.id) || '0');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  return h % n;
}

// La fazione non è cosmetica: racconta il mestiere che la nave svolge già
// nel mare. I mostri restano forze degli abissi, fuori da ogni bandiera.
function fazioneDellaNave(ship) {
  if (!ship || ship.npc === 'mostro') return null;
  if (!ship.npc) return FAZIONI.ciurma_libera;
  if (ship.npc === 'merc') return FAZIONI.compagnia_indie;
  if (ship.caccia || (ship.convoglio && ship.convoglio.ruolo === 'scorta')) {
    return FAZIONI.marina_britannica;
  }
  return FAZIONI.ciurma_libera; // i Corsari Fantasma non servono alcuna corona
}

function presenzaDellaNave(ship) {
  const fazione = fazioneDellaNave(ship);
  if (!fazione) return null;
  const scelto = !ship.npc && fazione.id === 'ciurma_libera' &&
    fazione.roster.some(p => p.id === ship.pirata) ? ship.pirata : null;
  const personaggio = scelto || fazione.roster[indiceNave(ship, fazione.roster.length)].id;
  return { id: fazione.id, codice: fazione.codice, personaggio };
}

module.exports = { FAZIONI, PER_CODICE, fazioneDellaNave, presenzaDellaNave };
