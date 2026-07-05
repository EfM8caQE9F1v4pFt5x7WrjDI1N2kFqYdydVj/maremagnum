'use strict';

// La Gazzetta del Corsaro: il cuore puro (portabile nei Workers come
// l'Atlante e la blocklist). Le notizie sono GLOBALI e vivono SOLO in
// gioco — nessun canale fuori-gioco, mai: la consegna è il WebSocket
// già aperto e la lettura al join. I non-letti sono un cursore
// per-utente (timestamp dell'ultima voce vista), non uno stato qui.

let voci = []; // [{t, tipo, testo}], dalla più recente
const CAP = 100;

function setVoci(list) {
  voci = (Array.isArray(list) ? list : [])
    .filter(v => v && typeof v.t === 'number' && typeof v.testo === 'string')
    .sort((a, b) => b.t - a.t)
    .slice(0, CAP);
}

function pubblica(tipo, testo, t = Date.now()) {
  const voce = { t, tipo: String(tipo).slice(0, 24), testo: String(testo).slice(0, 300) };
  voci.unshift(voce);
  if (voci.length > CAP) voci.length = CAP;
  return voce;
}

function ultime(n = 50) { return voci.slice(0, n); }

module.exports = { setVoci, pubblica, ultime, CAP };
