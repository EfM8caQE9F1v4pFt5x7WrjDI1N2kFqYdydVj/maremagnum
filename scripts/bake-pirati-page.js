// Il Casting dei Pirati (issue #16, PROTOTIPO): un pirata low-poly in
// Three.js con uno scheletro parametrico — le pose sono keyframe di
// rotazioni, il bake le interpola e le cuoce side-view come la flotta.
// Ispirazione: l'ATMOSFERA di Monkey Island (proporzioni caricate, testa
// grande, arti lunghi), design e nomi tutti nostri.

import * as THREE from 'three';

const FRAME = 160;
const COLS = 8;

const TINTA = {
  pelle: 0xc98e63, camicia: 0xe8dcc0, gilet: 0x5b2a22, pantaloni: 0x2e4053,
  stivali: 0x3a2a18, bandana: 0x8a2418, cintura: 0x2a1a0c, fibbia: 0xc9a23f,
  barba: 0x3a2c1e,
};

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true });
}

// Lo scheletro: gruppi annidati con perni alle giunture. Proporzioni da
// cartone: testa grande (1/4), gambe lunghe, mani a padella.
function buildPirata() {
  const p = { root: new THREE.Group() };

  // bacino e torso
  p.bacino = new THREE.Group();
  p.bacino.position.y = 1.05;
  p.root.add(p.bacino);
  p.torso = new THREE.Group();
  p.bacino.add(p.torso);
  const pancia = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.34), mat(TINTA.camicia));
  pancia.position.y = 0.34;
  p.torso.add(pancia);
  const gilet = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.5, 0.3), mat(TINTA.gilet));
  gilet.position.set(0, 0.4, -0.04);
  p.torso.add(gilet);
  const cintura = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.38), mat(TINTA.cintura));
  cintura.position.y = 0.04;
  p.torso.add(cintura);
  const fibbia = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.02), mat(TINTA.fibbia));
  fibbia.position.set(0, 0.04, 0.2);
  p.torso.add(fibbia);

  // testa con bandana e barba
  p.collo = new THREE.Group();
  p.collo.position.y = 0.68;
  p.torso.add(p.collo);
  const testa = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.46), mat(TINTA.pelle));
  testa.position.y = 0.3;
  p.collo.add(testa);
  const naso = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.12), mat(TINTA.pelle));
  naso.position.set(0, 0.26, 0.27);
  p.collo.add(naso);
  const barba = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.34), mat(TINTA.barba));
  barba.position.set(0, 0.08, 0.1);
  p.collo.add(barba);
  const bandana = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.5), mat(TINTA.bandana));
  bandana.position.y = 0.52;
  p.collo.add(bandana);
  const nodo = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), mat(TINTA.bandana));
  nodo.position.set(-0.26, 0.36, -0.12);
  nodo.rotation.z = 0.5;
  p.collo.add(nodo);

  // braccia: spalla → gomito → mano
  const braccio = (lato) => {
    const spalla = new THREE.Group();
    spalla.position.set(0.33 * lato, 0.58, 0);
    p.torso.add(spalla);
    const sup = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), mat(TINTA.camicia));
    sup.position.y = -0.2;
    spalla.add(sup);
    const gomito = new THREE.Group();
    gomito.position.y = -0.42;
    spalla.add(gomito);
    const avambraccio = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.14), mat(TINTA.pelle));
    avambraccio.position.y = -0.16;
    gomito.add(avambraccio);
    const mano = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.16), mat(TINTA.pelle));
    mano.position.y = -0.4;
    gomito.add(mano);
    return { spalla, gomito };
  };
  p.brD = braccio(1);
  p.brS = braccio(-1);

  // gambe: anca → ginocchio → stivale
  const gamba = (lato) => {
    const anca = new THREE.Group();
    anca.position.set(0.16 * lato, 0, 0);
    p.bacino.add(anca);
    const coscia = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.48, 0.22), mat(TINTA.pantaloni));
    coscia.position.y = -0.24;
    anca.add(coscia);
    const ginocchio = new THREE.Group();
    ginocchio.position.y = -0.5;
    anca.add(ginocchio);
    const stinco = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.36, 0.18), mat(TINTA.pantaloni));
    stinco.position.y = -0.16;
    ginocchio.add(stinco);
    const stivale = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.34), mat(TINTA.stivali));
    stivale.position.set(0, -0.44, 0.06);
    ginocchio.add(stivale);
    return { anca, ginocchio };
  };
  p.gbD = gamba(1);
  p.gbS = gamba(-1);

  return p;
}

// Una posa = rotazioni delle giunture (radianti) + quota del bacino.
// L'asse X piega avanti/indietro (side-view): è l'asse del picchiaduro.
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
  p.gbS.anca.rotation.x = k.ancaS || 0;
  p.gbS.ginocchio.rotation.x = k.ginS || 0;
}

const lerp = (a, b, t) => a + (b - a) * t;
function mescola(k1, k2, t) {
  const out = {};
  for (const chiave of new Set([...Object.keys(k1), ...Object.keys(k2)])) {
    out[chiave] = lerp(k1[chiave] || 0, k2[chiave] || 0, t);
  }
  return out;
}

// Le animazioni del prototipo: idle (respiro) e corsa. I keyframe sono
// pochi e parlanti; il bake interpola in ciclo.
const ANIMAZIONI = {
  idle: {
    frames: 4,
    chiavi: [
      { su: 0, torso: 0.03, testa: -0.03, spallaD: 0.1, gomitoD: 0.25, spallaS: -0.1, gomitoS: 0.2, ancaD: 0.04, ancaS: -0.04, ginD: -0.04, ginS: 0.02 },
      { su: -0.035, torso: 0.06, testa: -0.05, spallaD: 0.14, gomitoD: 0.3, spallaS: -0.13, gomitoS: 0.24, ancaD: 0.05, ancaS: -0.05, ginD: -0.05, ginS: 0.03 },
    ],
  },
  corsa: {
    frames: 6,
    chiavi: [
      { su: 0.02, bacino: 0.12, torso: 0.1, testa: -0.1, spallaD: -0.9, gomitoD: 0.9, spallaS: 0.7, gomitoS: 0.5, ancaD: 0.9, ginD: -0.5, ancaS: -0.7, ginS: -0.9 },
      { su: 0.09, bacino: 0.12, torso: 0.1, testa: -0.1, spallaD: 0.1, gomitoD: 0.6, spallaS: -0.1, gomitoS: 0.5, ancaD: -0.1, ginD: -1.1, ancaS: 0.15, ginS: -0.2 },
      { su: 0.02, bacino: 0.12, torso: 0.1, testa: -0.1, spallaD: 0.7, gomitoD: 0.5, spallaS: -0.9, gomitoS: 0.9, ancaD: -0.7, ginD: -0.9, ancaS: 0.9, ginS: -0.5 },
      { su: 0.09, bacino: 0.12, torso: 0.1, testa: -0.1, spallaD: -0.1, gomitoD: 0.5, spallaS: 0.1, gomitoS: 0.6, ancaD: 0.15, ginD: -0.2, ancaS: -0.1, ginS: -1.1 },
    ],
  },
};

async function main() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(FRAME, FRAME);
  renderer.setClearColor(0x000000, 0);

  // stesse luci della flotta; camera LATERALE (il picchiaduro è side-view)
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xfff2dd, 3.1);
  sun.position.set(-3, 6, -4);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xd8e2ea, 1.9));
  const fill = new THREE.DirectionalLight(0xffe9c9, 0.8);
  fill.position.set(3, 2.5, 4);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const D = 6.4;
  camera.position.set(D, 1.35, 0); // di profilo: +X guarda il pirata
  camera.lookAt(0, 1.15, 0);

  const pirata = buildPirata();
  pirata.root.rotation.y = Math.PI; // di profilo alla camera, corre verso destra
  scene.add(pirata.root);

  const nomi = Object.keys(ANIMAZIONI);
  const totale = nomi.reduce((n, a) => n + ANIMAZIONI[a].frames, 0);
  const rows = Math.ceil(totale / COLS);
  const atlas = document.createElement('canvas');
  atlas.width = FRAME * COLS;
  atlas.height = FRAME * rows;
  const ctx = atlas.getContext('2d');

  let i = 0;
  const meta = { frame: FRAME, cols: COLS, animazioni: {} };
  for (const nome of nomi) {
    const anim = ANIMAZIONI[nome];
    meta.animazioni[nome] = { da: i, frames: anim.frames };
    for (let f = 0; f < anim.frames; f++) {
      const t = f / anim.frames;
      const n = anim.chiavi.length;
      const idx = t * n;
      const k = mescola(anim.chiavi[Math.floor(idx) % n], anim.chiavi[Math.ceil(idx) % n], idx % 1);
      applicaPosa(pirata, k);
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, (i % COLS) * FRAME, Math.floor(i / COLS) * FRAME);
      i++;
    }
  }

  window.__atlas = atlas.toDataURL('image/webp', 0.92);
  window.__meta = JSON.stringify(meta);
  console.log('BAKE-DONE');
}

main().catch(e => console.log('BAKE-ERRORE: ' + e.message));
