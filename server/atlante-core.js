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

// Quante visite perché un sito diventi un'isola STABILE e condivisa (issue
// #26bis): sotto soglia è effimera (la vede solo chi ci naviga), sopra
// entra nella mappa di tutti ed è riseminata al risveglio. Alzata a 20 per
// non riempire il mare di doppioni e siti di passaggio.
const SOGLIA_ISOLA = 20;

// I domini sopra soglia in ORDINE STABILE (approdi decrescenti, spareggio
// alfabetico): la risoluzione delle sovrapposizioni in ensure() dipende
// dall'ordine, e le isole non devono saltellare tra un risveglio e l'altro.
function sopraSoglia(min = SOGLIA_ISOLA) {
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

// Fattore di crescita dell'isola (issue #26bis): ogni SCATTO di raggio costa
// il TRIPLO delle visite del precedente — le isole popolari crescono, ma
// sempre più a fatica (meritocratico, mai un continente). Ancorata a 10
// approdi = 1.3×: 10→1.3, 30→1.6, 90→1.9, 270→2.2, 810→2.5, poi tetto 3×.
function crescita(dominio) {
  const n = approdiDi(dominio);
  const m = 1 + 0.3 * (1 + Math.log(Math.max(1, n) / 10) / Math.log(3));
  return Math.min(3.0, Math.max(1.0, m));
}

module.exports = { setConteggi, mergeConteggi, registraApprodo, approdiDi, crescita, sopraSoglia, SOGLIA_ISOLA };
