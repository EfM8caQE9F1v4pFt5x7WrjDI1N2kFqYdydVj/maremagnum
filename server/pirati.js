'use strict';

// La Ciurma (issue #16, Fase 5): il roster unico — gli stessi pirati sono
// ciurma della nave, personaggi del platform e lottatori del picchiaduro.
// FONTE UNICA condivisa da server e client (CJS, esbuild la ingloba come
// lingua-mare.js). Ordine del capitano (11/7): «più grande è la barca, più
// grande la ciurma; non puoi sbloccare un pirata se non cambi nave» — gli
// sblocchi sono agganciati a leve che il Cantiere ha già: scafo, punti
// Ciurma, varo dei tipi, campagna del Mastro. Una volta arruolato un
// pirata resta TUO (precedente dell'arsenale delle esclusive): il set nel
// profilo è monotono, si allarga e mai si restringe.

// La convenzione dell'atlante (game/assets/pirati.webp): una RIGA per
// pirata nell'ordine del ROSTER, prima l'idle poi la corsa. Il bake la
// rispetta e la asserisce; il client ci compone le carte.
const ATLANTE = {
  frame: 160, cols: 10,
  animazioni: { idle: { da: 0, n: 4 }, corsa: { da: 4, n: 6 } },
};

// sblocco.via: 'base' (ciurma di partenza) | 'scafo' (livello scafo) |
// 'ciurma' (punti Ciurma del Cantiere: ogni punto è una faccia che sale a
// bordo) | 'varo' (esclusivo del tipo: si arruola VARANDO quel tipo) |
// 'campagna' (si guadagna col Mastro di Rotte, mai si compra).
const ROSTER = [
  { id: 'mozzo', ritratto: 'assets/pirati/mozzo.webp', sblocco: { via: 'base' } },
  { id: 'cuoca', ritratto: 'assets/pirati/cuoca.webp', sblocco: { via: 'base' } },
  { id: 'nostromo', ritratto: 'assets/pirati/nostromo.webp', sblocco: { via: 'scafo', lvl: 2 } },
  { id: 'vedetta', ritratto: 'assets/pirati/vedetta.webp', sblocco: { via: 'scafo', lvl: 2 } },
  { id: 'mastrodascia', ritratto: 'assets/pirati/mastrodascia.webp', sblocco: { via: 'scafo', lvl: 4 } },
  { id: 'bucaniera', ritratto: 'assets/pirati/bucaniera.webp', sblocco: { via: 'scafo', lvl: 4 } },
  { id: 'gabbiere', ritratto: 'assets/pirati/gabbiere.webp', sblocco: { via: 'ciurma', lvl: 1 } },
  { id: 'polena', ritratto: 'assets/pirati/polena.webp', sblocco: { via: 'ciurma', lvl: 2 } },
  { id: 'mezzamiccia', ritratto: 'assets/pirati/mezzamiccia.webp', sblocco: { via: 'ciurma', lvl: 3 } },
  { id: 'timoniere', ritratto: 'assets/pirati/timoniere.webp', sblocco: { via: 'ciurma', lvl: 4 } },
  { id: 'filodifumo', ritratto: 'assets/pirati/filodifumo.webp', sblocco: { via: 'varo', tipo: 'goletta' } },
  { id: 'sergente', ritratto: 'assets/pirati/sergente.webp', sblocco: { via: 'varo', tipo: 'guerra' } },
  { id: 'ammiraglia', ritratto: 'assets/pirati/ammiraglia.webp', sblocco: { via: 'varo', tipo: 'galeone' } },
  { id: 'corsaro', ritratto: 'assets/pirati/corsaro.webp', sblocco: { via: 'varo', tipo: 'sciabecco' } },
  { id: 'senzanome', ritratto: 'assets/pirati/senzanome.webp', sblocco: { via: 'campagna' } },
];

const IDS = new Set(ROSTER.map(p => p.id));

// Chi ha DIRITTO all'arruolo con lo stato attuale della nave. Puro e
// code-owned: stato = { hullLvl, crewLvl, varati (Set/array di tipi),
// campagna (bool: il Mastro compiuto, di questa settimana o d'archivio) }.
function sbloccati(stato) {
  const varati = stato.varati instanceof Set ? stato.varati : new Set(stato.varati || []);
  return ROSTER.filter(p => {
    const b = p.sblocco;
    if (b.via === 'base') return true;
    if (b.via === 'scafo') return (stato.hullLvl | 0) >= b.lvl;
    if (b.via === 'ciurma') return (stato.crewLvl | 0) >= b.lvl;
    if (b.via === 'varo') return varati.has(b.tipo);
    if (b.via === 'campagna') return !!stato.campagna;
    return false;
  }).map(p => p.id);
}

module.exports = { ROSTER, IDS, ATLANTE, sbloccati };
