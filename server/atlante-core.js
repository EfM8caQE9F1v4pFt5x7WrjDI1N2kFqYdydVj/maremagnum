'use strict';

// L'Atlante comunitario: il cuore puro (portabile nei Workers come la
// blocklist). Ogni APPRODO di un capitano a un'isola-sito è una visita:
// più il Maremagnum attracca a un dominio, più la sua isola cresce.
// Niente telemetria di navigazione: contiamo un gesto di gioco.

const { dominioBase } = require('./dominio');

let conteggi = new Map(); // dominio (registrabile) → approdi totali

// le chiavi storiche coi sottodomini (it.wikipedia.org…) si FONDONO nel
// dominio registrabile sommando gli approdi (#26): un sito, un'isola
function canonizza(obj) {
  const fusi = new Map();
  for (const [d, n] of Object.entries(obj || {})) {
    const dom = dominioBase(d);
    fusi.set(dom, (fusi.get(dom) || 0) + (n | 0));
  }
  return fusi;
}

function setConteggi(obj) {
  conteggi = canonizza(obj);
}

// Fusione al rialzo: i conteggi possono solo crescere, quindi tra locale e
// remoto vince il più alto — nessun approdo registrato nel frattempo va perso.
function mergeConteggi(obj) {
  for (const [dom, n] of canonizza(obj)) {
    if ((conteggi.get(dom) || 0) < n) conteggi.set(dom, n);
  }
}

// I domini sopra soglia in ORDINE STABILE (approdi decrescenti, spareggio
// alfabetico): la risoluzione delle sovrapposizioni in ensure() dipende
// dall'ordine, e le isole non devono saltellare tra un risveglio e l'altro.
function sopraSoglia(min = 3) {
  return [...conteggi]
    .filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([d]) => d);
}

function registraApprodo(dominio) {
  if (!dominio) return 0;
  const d = dominioBase(dominio);
  const n = (conteggi.get(d) || 0) + 1;
  conteggi.set(d, n);
  return n;
}

function approdiDi(dominio) {
  return conteggi.get(dominioBase(dominio)) || 0;
}

// Fattore di crescita dell'isola: logaritmico e con un tetto, così Wikipedia
// non diventa un continente. 0 approdi → 1×; 10 → ~1.5×; 1000 → ~2.5× (cap).
function crescita(dominio) {
  const n = approdiDi(dominio);
  return Math.min(2.5, 1 + Math.log10(1 + n) * 0.5);
}

module.exports = { setConteggi, mergeConteggi, registraApprodo, approdiDi, crescita, sopraSoglia };
