// Il Casting dei Pirati (issue #16, Fase 5): la Ciurma al completo.
// UNO scheletro parametrico low-poly (Three.js), QUINDICI ricette di
// vestizione: corporatura, tinte, copricapo, capelli, barba e accessori
// sono dati, non rig. Le pose sono keyframe di rotazioni comuni a tutti;
// il bake le interpola e cuoce ogni pirata side-view su una RIGA
// dell'atlante, nell'ordine del ROSTER (fonte unica server/pirati.js).
// Ispirazione: l'ATMOSFERA di Monkey Island (proporzioni caricate, testa
// grande, arti lunghi), design e nomi tutti nostri.

import * as THREE from 'three';
import PIRATI from '../server/pirati.js';

const { ROSTER, ATLANTE } = PIRATI;
const FRAME = ATLANTE.frame;
const COLS = ATLANTE.cols;
const DUMP = typeof location !== 'undefined' && new URLSearchParams(location.search).get('dump') === '1';

const TINTA_BASE = {
  pelle: 0xc98e63, camicia: 0xe8dcc0, gilet: 0x5b2a22, pantaloni: 0x2e4053,
  stivali: 0x3a2a18, bandana: 0x8a2418, cintura: 0x2a1a0c, fibbia: 0xc9a23f,
  barba: 0x3a2c1e, capelli: 0x3a2c1e, occhi: 0x2a1d12,
  legno: 0x8a6a42, metallo: 0x9aa4ad, oro: 0xc9a23f, cuoio: 0x6b4a2a,
};

// Le quindici ricette: SOLO dati. corpo = scala {alt, larg}; copricapo =
// bandana|fazzoletto|tricorno|turbante|nulla; capelli = corti|lunghi|coda;
// barba = folta|corta|baffi; extra = accessori a pezzi (vedi vesti()).
const RICETTE = {
  mozzo: {
    corpo: { alt: 0.88, larg: 0.9 }, copricapo: 'bandana',
    tinte: { bandana: 0x8a2418, camicia: 0xe8dcc0 }, extra: [],
  },
  cuoca: {
    corpo: { alt: 0.96, larg: 1.08 }, copricapo: 'fazzoletto',
    tinte: { bandana: 0x7a3a5a, camicia: 0x6b7a3a, pantaloni: 0x4a3a2a },
    extra: ['grembiule', 'mestolo', 'pappagallo'],
  },
  nostromo: {
    corpo: { alt: 1.0, larg: 1.22 }, capelli: 'corti', barba: 'folta',
    tinte: { camicia: 0x9c5a30, pantaloni: 0x33424e, capelli: 0x2a2018, barba: 0x2a2018 },
    extra: ['orecchino', 'uncino'],
  },
  vedetta: {
    corpo: { alt: 1.05, larg: 0.88 }, capelli: 'coda',
    tinte: { camicia: 0x3a6b7a, pantaloni: 0x2a3440, capelli: 0xa64f24 },
    extra: ['cannocchiale'],
  },
  mastrodascia: {
    corpo: { alt: 0.95, larg: 1.15 }, copricapo: 'fazzoletto', barba: 'corta',
    tinte: { bandana: 0x4a5a2a, camicia: 0xb8a888 },
    extra: ['grembiuleCuoio', 'martello'],
  },
  bucaniera: {
    corpo: { alt: 1.02, larg: 0.95 }, copricapo: 'tricorno', capelli: 'lunghi',
    tinte: { gilet: 0x6b2433, camicia: 0xd8ccb0, capelli: 0x1e1710 },
    extra: ['sciabola'],
  },
  gabbiere: {
    corpo: { alt: 0.94, larg: 0.9 }, copricapo: 'bandana',
    // scalzo come si sta in coffa: gli stivali prendono la tinta della pelle
    tinte: { bandana: 0x2a6b5a, camicia: 0xd8d4c8, pantaloni: 0x8a7a5a, stivali: 0xc98e63 },
    extra: ['orecchino'],
  },
  polena: {
    corpo: { alt: 1.08, larg: 1.0 }, barba: 'baffi',
    tinte: { camicia: 0x4a4a52, pelle: 0xb07a4a },
    extra: ['benda', 'orecchino'],
  },
  mezzamiccia: {
    corpo: { alt: 0.92, larg: 1.0 }, copricapo: 'bandana',
    tinte: { bandana: 0x3a3a3a, camicia: 0x6e6a62, pantaloni: 0x2e3a46 },
    extra: ['miccia'],
  },
  timoniere: {
    corpo: { alt: 1.0, larg: 1.0 }, capelli: 'corti', barba: 'corta',
    tinte: { gilet: 0x2a4468, camicia: 0xd8ccb0, capelli: 0x9aa0a6, barba: 0x9aa0a6 },
    extra: ['cappotto', 'gambalegno'],
  },
  filodifumo: {
    corpo: { alt: 1.0, larg: 0.82 }, copricapo: 'fazzoletto',
    tinte: { bandana: 0x5a5f6a, camicia: 0x3a3f4a, pantaloni: 0x23262e },
    extra: ['pipa'],
  },
  sergente: {
    corpo: { alt: 1.0, larg: 1.05 }, capelli: 'coda',
    tinte: { gilet: 0x8a2a2a, camicia: 0xd8ccb0, pantaloni: 0x2e3440, capelli: 0x4a3018 },
    extra: ['spalline', 'sciabola'],
  },
  ammiraglia: {
    corpo: { alt: 1.04, larg: 0.98 }, copricapo: 'tricorno', capelli: 'lunghi',
    tinte: { gilet: 0xe8e2d4, camicia: 0xd8ccb0, capelli: 0x6b4a2a, bandana: 0x2a3450 },
    extra: ['cappotto', 'spalline'],
  },
  corsaro: {
    corpo: { alt: 1.0, larg: 0.97 }, copricapo: 'turbante', barba: 'corta',
    tinte: { bandana: 0xd8d0c0, gilet: 0x3a6b5a, pelle: 0x9a6b42, barba: 0x2a2018, cintura: 0x8a2418 },
    extra: ['fascia', 'sciabola'],
  },
  senzanome: {
    corpo: { alt: 1.06, larg: 1.0 }, copricapo: 'tricorno', barba: 'folta',
    tinte: {
      gilet: 0x23262e, camicia: 0x2e323c, pantaloni: 0x1e2128, pelle: 0xd8dde2,
      barba: 0xcfd6da, bandana: 0x1a1c22, occhi: 0x7fe3d2, stivali: 0x23262e,
    },
    extra: [],
  },
};

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true });
}

// il mattone della vestizione: un box in un gruppo, con posa opzionale
function box(parent, w, h, d, color, x, y, z, rot) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  if (rot) { m.rotation.x = rot.x || 0; m.rotation.y = rot.y || 0; m.rotation.z = rot.z || 0; }
  parent.add(m);
  return m;
}

// Lo scheletro: gruppi annidati con perni alle giunture. Proporzioni da
// cartone: testa grande (1/4), gambe lunghe, mani a padella. La ricetta
// decide cosa c'è appeso alle ossa; le ossa sono le stesse per tutti.
function buildPirata(ricetta) {
  const r = ricetta || {};
  const T = { ...TINTA_BASE, ...(r.tinte || {}) };
  const extra = new Set(r.extra || []);
  const p = { root: new THREE.Group(), gambalegno: extra.has('gambalegno') };

  // bacino e torso
  p.bacino = new THREE.Group();
  p.bacino.position.y = 1.05;
  p.root.add(p.bacino);
  p.torso = new THREE.Group();
  p.bacino.add(p.torso);
  box(p.torso, 0.52, 0.62, 0.34, T.camicia, 0, 0.34, 0);
  box(p.torso, 0.56, 0.5, 0.3, T.gilet, 0, 0.4, -0.04);
  if (extra.has('cappotto')) {
    // il cappotto lungo: spalle larghe e code dietro le gambe
    box(p.torso, 0.62, 0.66, 0.36, T.gilet, 0, 0.36, -0.05);
    box(p.bacino, 0.5, 0.42, 0.1, T.gilet, 0, -0.2, -0.2);
  }
  if (extra.has('fascia')) box(p.torso, 0.56, 0.2, 0.38, T.cintura, 0, 0.08, 0);
  else {
    box(p.torso, 0.56, 0.12, 0.38, T.cintura, 0, 0.04, 0);
    box(p.torso, 0.14, 0.1, 0.02, T.fibbia, 0, 0.04, 0.2);
  }
  if (extra.has('grembiule')) box(p.torso, 0.5, 0.55, 0.05, 0xe8dcc0, 0, 0.2, 0.2);
  if (extra.has('grembiuleCuoio')) box(p.torso, 0.5, 0.55, 0.05, T.cuoio, 0, 0.2, 0.2);
  if (extra.has('miccia')) {
    // la bandoliera della cannoniera, con le cariche in fila
    const strap = box(p.torso, 0.09, 0.78, 0.05, 0x2a2620, 0, 0.35, 0.19, { z: 0.6 });
    for (const dy of [-0.22, 0, 0.22]) box(strap, 0.06, 0.1, 0.03, T.oro, 0, dy, 0.03);
  }
  if (extra.has('spalline')) {
    box(p.torso, 0.2, 0.06, 0.22, T.oro, 0.32, 0.62, 0);
    box(p.torso, 0.2, 0.06, 0.22, T.oro, -0.32, 0.62, 0);
  }

  // testa: occhi su entrambi i lati (di profilo se ne legge uno)
  p.collo = new THREE.Group();
  p.collo.position.y = 0.68;
  p.torso.add(p.collo);
  box(p.collo, 0.5, 0.5, 0.46, T.pelle, 0, 0.3, 0);
  box(p.collo, 0.09, 0.12, 0.12, T.pelle, 0, 0.26, 0.27);
  if (extra.has('benda')) {
    box(p.collo, 0.53, 0.08, 0.48, 0x1a1410, 0, 0.36, 0);
    box(p.collo, 0.05, 0.13, 0.13, 0x1a1410, 0.25, 0.34, 0.13);
    box(p.collo, 0.05, 0.13, 0.13, 0x1a1410, -0.25, 0.34, 0.13);
  } else {
    box(p.collo, 0.04, 0.07, 0.07, T.occhi, 0.245, 0.34, 0.14);
    box(p.collo, 0.04, 0.07, 0.07, T.occhi, -0.245, 0.34, 0.14);
  }
  if (extra.has('orecchino')) {
    box(p.collo, 0.04, 0.07, 0.04, T.oro, 0.26, 0.18, 0.02);
    box(p.collo, 0.04, 0.07, 0.04, T.oro, -0.26, 0.18, 0.02);
  }
  if (extra.has('pipa')) {
    const stelo = box(p.collo, 0.03, 0.03, 0.16, T.legno, 0.08, 0.16, 0.3, { x: 0.35 });
    box(stelo, 0.07, 0.09, 0.07, T.legno, 0, -0.04, 0.09);
  }
  // barba prima del copricapo: i volumi si impilano dal viso in su
  if (r.barba === 'folta') {
    box(p.collo, 0.4, 0.18, 0.34, T.barba, 0, 0.08, 0.1);
    box(p.collo, 0.34, 0.24, 0.24, T.barba, 0, -0.08, 0.12);
  } else if (r.barba === 'corta') {
    box(p.collo, 0.4, 0.14, 0.32, T.barba, 0, 0.08, 0.1);
  } else if (r.barba === 'baffi') {
    box(p.collo, 0.3, 0.06, 0.12, T.barba, 0, 0.19, 0.24);
  }
  if (r.capelli === 'corti') box(p.collo, 0.52, 0.14, 0.48, T.capelli, 0, 0.56, -0.01);
  if (r.capelli === 'lunghi') {
    box(p.collo, 0.52, 0.14, 0.48, T.capelli, 0, 0.56, -0.01);
    box(p.collo, 0.44, 0.5, 0.14, T.capelli, 0, 0.22, -0.28);
  }
  if (r.capelli === 'coda') {
    box(p.collo, 0.52, 0.14, 0.48, T.capelli, 0, 0.56, -0.01);
    box(p.collo, 0.1, 0.34, 0.1, T.capelli, 0, 0.42, -0.3, { x: -0.5 });
  }
  if (r.copricapo === 'bandana' || r.copricapo === 'fazzoletto') {
    box(p.collo, 0.54, 0.18, 0.5, T.bandana, 0, 0.52, 0);
    box(p.collo, 0.1, 0.2, 0.1, T.bandana, -0.26, 0.36, -0.12, { z: 0.5 });
    if (r.copricapo === 'fazzoletto') box(p.collo, 0.16, 0.3, 0.06, T.bandana, 0, 0.34, -0.28);
  } else if (r.copricapo === 'tricorno') {
    box(p.collo, 0.74, 0.06, 0.7, T.bandana, 0, 0.56, 0);
    const cupola = box(p.collo, 0.44, 0.22, 0.42, T.bandana, 0, 0.68, 0);
    if (extra.has('spalline') || extra.has('cappotto')) box(cupola, 0.46, 0.05, 0.44, T.oro, 0, -0.08, 0);
  } else if (r.copricapo === 'turbante') {
    box(p.collo, 0.56, 0.16, 0.52, T.bandana, 0, 0.52, 0);
    box(p.collo, 0.44, 0.15, 0.4, T.bandana, 0, 0.65, 0);
    box(p.collo, 0.08, 0.1, 0.05, T.fibbia, 0, 0.6, 0.24);
  }

  // braccia: spalla → gomito → mano (o uncino, sul lato in camera)
  const braccio = (lato) => {
    const spalla = new THREE.Group();
    spalla.position.set(0.33 * lato, 0.58, 0);
    p.torso.add(spalla);
    box(spalla, 0.16, 0.42, 0.16, T.camicia, 0, -0.2, 0);
    const gomito = new THREE.Group();
    gomito.position.y = -0.42;
    spalla.add(gomito);
    box(gomito, 0.14, 0.36, 0.14, T.pelle, 0, -0.16, 0);
    if (lato === -1 && extra.has('uncino')) {
      box(gomito, 0.1, 0.1, 0.1, T.cuoio, 0, -0.38, 0);
      box(gomito, 0.05, 0.16, 0.05, T.metallo, 0, -0.5, 0);
      box(gomito, 0.05, 0.05, 0.12, T.metallo, 0, -0.58, 0.05);
    } else {
      box(gomito, 0.18, 0.16, 0.16, T.pelle, 0, -0.4, 0);
    }
    return { spalla, gomito };
  };
  p.brD = braccio(1);
  p.brS = braccio(-1);
  if (extra.has('pappagallo')) {
    // il pappagallo sta in spalla, dal lato che la camera vede
    const pa = new THREE.Group();
    pa.position.set(-0.42, 0.74, 0);
    p.torso.add(pa);
    box(pa, 0.13, 0.18, 0.12, 0x3a8a3a, 0, 0.08, 0);
    const testa = box(pa, 0.1, 0.1, 0.1, 0x4aa04a, 0, 0.22, 0.04);
    box(testa, 0.04, 0.04, 0.09, 0xd88a2a, 0, 0, 0.08);
    box(pa, 0.06, 0.05, 0.2, 0x2a6b3a, 0, 0.02, -0.14, { x: -0.5 });
  }

  // gambe: anca → ginocchio → stivale (o gamba di legno, lato in camera)
  const gamba = (lato) => {
    const anca = new THREE.Group();
    anca.position.set(0.16 * lato, 0, 0);
    p.bacino.add(anca);
    box(anca, 0.2, 0.48, 0.22, T.pantaloni, 0, -0.24, 0);
    const ginocchio = new THREE.Group();
    ginocchio.position.y = -0.5;
    anca.add(ginocchio);
    if (lato === -1 && extra.has('gambalegno')) {
      box(ginocchio, 0.1, 0.44, 0.1, T.legno, 0, -0.22, 0);
      box(ginocchio, 0.14, 0.05, 0.14, T.legno, 0, -0.47, 0);
    } else {
      box(ginocchio, 0.17, 0.36, 0.18, T.pantaloni, 0, -0.16, 0);
      box(ginocchio, 0.2, 0.2, 0.34, T.stivali, 0, -0.44, 0.06);
    }
    return { anca, ginocchio };
  };
  p.gbD = gamba(1);
  p.gbS = gamba(-1);

  // i ferri alla cintura, appesi al bacino così ballano con la corsa
  if (extra.has('sciabola')) {
    const sc = box(p.bacino, 0.05, 0.55, 0.07, T.metallo, -0.3, -0.3, -0.06, { x: 0.3 });
    box(sc, 0.12, 0.07, 0.07, T.oro, 0, 0.3, 0);
  }
  if (extra.has('cannocchiale')) box(p.bacino, 0.09, 0.09, 0.3, T.oro, -0.3, 0.02, 0.08, { x: 0.5 });
  if (extra.has('martello')) {
    const ma = box(p.bacino, 0.05, 0.32, 0.05, T.legno, -0.3, -0.2, 0.05, { x: 0.15 });
    box(ma, 0.09, 0.09, 0.2, T.metallo, 0, 0.14, 0);
  }
  if (extra.has('mestolo')) {
    const me = box(p.bacino, 0.04, 0.28, 0.04, T.metallo, -0.28, -0.16, 0.1, { x: 0.2 });
    box(me, 0.11, 0.06, 0.11, T.metallo, 0, -0.16, 0);
  }

  // la corporatura: la scala non tocca ossa né pose, solo le proporzioni
  const c = r.corpo || {};
  p.root.scale.set(c.larg || 1, c.alt || 1, c.larg || 1);
  return p;
}

// Una posa = rotazioni delle giunture (radianti) + quota del bacino.
// L'asse X piega avanti/indietro (side-view): è l'asse del picchiaduro.
// La gamba di legno non ha ginocchio: resta rigida e l'anca accorcia il
// passo — lo zoppicare del timoniere è vestizione anche lui.
function applicaPosa(p, k) {
  p.bacino.position.y = 1.05 + (k.su || 0);
  p.bacino.rotation.x = k.bacino || 0;
  p.torso.rotation.x = k.torso || 0;
  p.collo.rotation.x = k.testa || 0;
  p.brD.spalla.rotation.x = k.spallaD || 0;
  p.brD.gomito.rotation.x = k.gomitoD || 0;
  p.brS.spalla.rotation.x = k.spallaS || 0;
  p.brS.gomito.rotation.x = k.gomitoS || 0;
  p.gbD.anca.rotation.x = k.ancaD || 0;
  p.gbD.ginocchio.rotation.x = k.ginD || 0;
  p.gbS.anca.rotation.x = p.gambalegno ? (k.ancaS || 0) * 0.55 : (k.ancaS || 0);
  p.gbS.ginocchio.rotation.x = p.gambalegno ? 0 : (k.ginS || 0);
}

const lerp = (a, b, t) => a + (b - a) * t;
function mescola(k1, k2, t) {
  const out = {};
  for (const chiave of new Set([...Object.keys(k1), ...Object.keys(k2)])) {
    out[chiave] = lerp(k1[chiave] || 0, k2[chiave] || 0, t);
  }
  return out;
}

// Le animazioni comuni a tutta la ciurma: idle (respiro) e corsa. I
// keyframe sono pochi e parlanti; il bake interpola in ciclo. I conteggi
// DEVONO combaciare con la convenzione ATLANTE (asserito in main).
const ANIMAZIONI = {
  idle: {
    frames: ATLANTE.animazioni.idle.n,
    chiavi: [
      { su: 0, torso: 0.03, testa: -0.03, spallaD: 0.1, gomitoD: 0.25, spallaS: -0.1, gomitoS: 0.2, ancaD: 0.04, ancaS: -0.04, ginD: -0.04, ginS: 0.02 },
      { su: -0.035, torso: 0.06, testa: -0.05, spallaD: 0.14, gomitoD: 0.3, spallaS: -0.13, gomitoS: 0.24, ancaD: 0.05, ancaS: -0.05, ginD: -0.05, ginS: 0.03 },
    ],
  },
  corsa: {
    frames: ATLANTE.animazioni.corsa.n,
    chiavi: [
      { su: 0.02, bacino: 0.12, torso: 0.1, testa: -0.1, spallaD: -0.9, gomitoD: 0.9, spallaS: 0.7, gomitoS: 0.5, ancaD: 0.9, ginD: -0.5, ancaS: -0.7, ginS: -0.9 },
      { su: 0.09, bacino: 0.12, torso: 0.1, testa: -0.1, spallaD: 0.1, gomitoD: 0.6, spallaS: -0.1, gomitoS: 0.5, ancaD: -0.1, ginD: -1.1, ancaS: 0.15, ginS: -0.2 },
      { su: 0.02, bacino: 0.12, torso: 0.1, testa: -0.1, spallaD: 0.7, gomitoD: 0.5, spallaS: -0.9, gomitoS: 0.9, ancaD: -0.7, ginD: -0.9, ancaS: 0.9, ginS: -0.5 },
      { su: 0.09, bacino: 0.12, torso: 0.1, testa: -0.1, spallaD: -0.1, gomitoD: 0.5, spallaS: 0.1, gomitoS: 0.6, ancaD: 0.15, ginD: -0.2, ancaS: -0.1, ginS: -1.1 },
    ],
  },
};

async function main() {
  const { idle, corsa } = ATLANTE.animazioni;
  if (COLS !== idle.n + corsa.n || corsa.da !== idle.n) {
    throw new Error('la convenzione ATLANTE non torna coi conteggi delle animazioni');
  }
  for (const id of Object.keys(RICETTE)) {
    if (!ROSTER.some(p => p.id === id)) throw new Error('ricetta orfana: ' + id);
  }

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(FRAME, FRAME);
  renderer.setClearColor(0x000000, 0);

  // stesse luci della flotta; camera LATERALE (platform e picchiaduro sono
  // side-view), arretrata quanto basta per il tricorno del più alto
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xfff2dd, 3.1);
  sun.position.set(-3, 6, -4);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xd8e2ea, 1.9));
  const fill = new THREE.DirectionalLight(0xffe9c9, 0.8);
  fill.position.set(3, 2.5, 4);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  // stretta quanto basta: il tricorno del Senzanome (il più alto, col
  // rimbalzo della corsa) sfiora il bordo, nessun pixel di cella sprecato
  const D = 6.2;
  camera.position.set(D, 1.45, 0); // di profilo: +X guarda il pirata
  camera.lookAt(0, 1.25, 0);

  const rows = ROSTER.length;
  const atlas = document.createElement('canvas');
  atlas.width = FRAME * COLS;
  atlas.height = FRAME * rows;
  const ctx = atlas.getContext('2d');

  const meta = { frame: FRAME, cols: COLS, rows, animazioni: ATLANTE.animazioni, pirati: {} };
  ROSTER.forEach((voce, row) => {
    const ricetta = RICETTE[voce.id];
    if (!ricetta) throw new Error('pirata senza ricetta: ' + voce.id);
    meta.pirati[voce.id] = row;
    const pirata = buildPirata(ricetta);
    pirata.root.rotation.y = Math.PI; // di profilo alla camera, corre verso destra
    scene.add(pirata.root);
    for (const nome of ['idle', 'corsa']) {
      const anim = ANIMAZIONI[nome];
      for (let f = 0; f < anim.frames; f++) {
        const t = f / anim.frames;
        const n = anim.chiavi.length;
        const idx = t * n;
        const k = mescola(anim.chiavi[Math.floor(idx) % n], anim.chiavi[Math.ceil(idx) % n], idx % 1);
        applicaPosa(pirata, k);
        renderer.render(scene, camera);
        ctx.drawImage(renderer.domElement, (ATLANTE.animazioni[nome].da + f) * FRAME, row * FRAME);
      }
    }
    scene.remove(pirata.root);
  });

  window.__atlas = atlas.toDataURL('image/webp', 0.92);
  window.__meta = JSON.stringify(meta);
  if (DUMP) {
    const pre = document.createElement('pre');
    pre.id = 'bake-dump';
    pre.textContent = JSON.stringify({ atlas: window.__atlas, meta: window.__meta });
    document.body.appendChild(pre);
  } else {
    atlas.style.cssText = 'image-rendering:auto;background:#1d3a4d;max-width:100%';
    document.body.appendChild(atlas); // la ciurma in vetrina, per l'occhio
  }
  console.log('BAKE-DONE');
}

main().catch(e => {
  if (DUMP) document.body.textContent = 'BAKE-ERRORE: ' + e.message;
  console.log('BAKE-ERRORE: ' + e.message);
});
