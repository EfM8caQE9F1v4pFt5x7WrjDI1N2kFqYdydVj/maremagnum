'use strict';

// L'Atlante comunitario: il cuore puro (portabile nei Workers come la
// blocklist). Ogni APPRODO di un capitano a un'isola-sito è una visita:
// più il Maremagnum attracca a un dominio, più la sua isola cresce.
// Niente telemetria di navigazione: contiamo un gesto di gioco.

let conteggi = new Map(); // dominio → approdi totali

function setConteggi(obj) {
  conteggi = new Map(Object.entries(obj || {}));
}

function registraApprodo(dominio) {
  if (!dominio) return 0;
  const d = String(dominio).toLowerCase();
  const n = (conteggi.get(d) || 0) + 1;
  conteggi.set(d, n);
  return n;
}

function approdiDi(dominio) {
  return conteggi.get(String(dominio || '').toLowerCase()) || 0;
}

// Fattore di crescita dell'isola: logaritmico e con un tetto, così Wikipedia
// non diventa un continente. 0 approdi → 1×; 10 → ~1.5×; 1000 → ~2.5× (cap).
function crescita(dominio) {
  const n = approdiDi(dominio);
  return Math.min(2.5, 1 + Math.log10(1 + n) * 0.5);
}

module.exports = { setConteggi, registraApprodo, approdiDi, crescita };
