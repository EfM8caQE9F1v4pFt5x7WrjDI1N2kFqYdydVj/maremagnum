// Il Cantiere di Cottura delle bocche da fuoco (issue #17): l'arsenale
// completo modellato in Three.js e pre-renderizzato in 36 angolazioni per
// variante, con la STESSA camera e le STESSE luci delle navi — prospettiva
// e luce combaciano con lo scafo. 7 sagome × 3 livelli = 21 varianti,
// nominate come le chiavi gw del protocollo (lettera+livello: 'n2', 'p3'…).
//
// Semantica dei livelli, identica al vettoriale di game/src/guns.js:
// il livello allunga la canna, dal 2 compaiono gli anelli di rinforzo,
// il 3 è di bronzo caldo.

import * as THREE from 'three';

const FRAME = 96;
const STEPS = 36;
const COLS = 12;

const LEGNO = 0x6b4526;
const LEGNO_SCURO = 0x33231a;
const FERRO = 0x49525c;
const BRONZO = 0x94722f;

const LVL_LEN = [1, 1.07, 1.14]; // il gradino di livello si vede in canna

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true, ...extra });
}
const metallo = (bronzo) => mat(bronzo ? BRONZO : FERRO, { metalness: 0.45, roughness: 0.5 });

// Canna al tornio, parametrica: pomo di culatta, anello di culatta, fusto
// rastremato con eventuali rinforzi, gioia di volata, labbro, bocca scura.
function canna({ len = 2.3, r0 = 0.24, r1 = 0.15, anelli = [], bronzo = false, botte = 0 }) {
  const prof = [
    [0.001, -0.30 * r0 / 0.24], [0.10 * r0 / 0.24, -0.28 * r0 / 0.24],
    [0.13 * r0 / 0.24, -0.20 * r0 / 0.24], [0.08 * r0 / 0.24, -0.12 * r0 / 0.24],
    [r0 * 0.83, -0.08], [r0, 0.00], [r0, 0.10], [r0 * 0.87, 0.14],
  ];
  const rAt = (t) => {
    let r = r0 * 0.85 + (r1 - r0 * 0.85) * t;
    if (botte) r += botte * Math.sin(Math.PI * t) * r0; // la pancia della pesante
    return r;
  };
  for (const t of anelli) {
    const y = 0.14 + (len - 0.5 - 0.14) * t;
    prof.push([rAt(t) * 0.98, y - 0.05], [rAt(t) + 0.035, y], [rAt(t) + 0.035, y + 0.07], [rAt(t) * 0.95, y + 0.12]);
  }
  prof.push(
    [rAt(1) * 0.97, len - 0.38],
    [r1 * 1.23, len - 0.26], [r1 * 1.27, len - 0.14], [r1 * 1.03, len - 0.06], // gioia di volata
    [r1, len], [r1 * 0.67, len], [0.001, len],
  );
  prof.sort((a, b) => a[1] - b[1]);
  const geo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 22);
  const m = new THREE.Mesh(geo, metallo(bronzo));
  const bocca = new THREE.Mesh(new THREE.CircleGeometry(r1 * 0.67, 12),
    new THREE.MeshBasicMaterial({ color: 0x0a0a0c }));
  bocca.position.y = len + 0.001;
  bocca.rotation.x = -Math.PI / 2;
  m.add(bocca);
  return m;
}

// carriola da marina: letto, ceppi a gradoni, quattro ruote coi mozzi
function carriola(gun, { sc = 1 } = {}) {
  const letto = new THREE.Mesh(new THREE.BoxGeometry(1.55 * sc, 0.10, 0.85 * sc), mat(LEGNO));
  letto.position.y = 0.22;
  gun.add(letto);
  for (const s of [-1, 1]) {
    const ceppo = new THREE.Mesh(new THREE.BoxGeometry(1.25 * sc, 0.34, 0.15), mat(LEGNO));
    ceppo.position.set(-0.06 * sc, 0.42, s * 0.30 * sc);
    gun.add(ceppo);
    const gradone = new THREE.Mesh(new THREE.BoxGeometry(0.6 * sc, 0.22, 0.15), mat(LEGNO));
    gradone.position.set(-0.35 * sc, 0.68, s * 0.30 * sc);
    gun.add(gradone);
  }
  for (const [wx, r] of [[0.52 * sc, 0.20], [-0.52 * sc, 0.17]]) {
    for (const s of [-1, 1]) {
      const ruota = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.09, 14), mat(LEGNO_SCURO));
      ruota.rotation.x = Math.PI / 2;
      ruota.position.set(wx, r, s * 0.50 * sc);
      gun.add(ruota);
    }
    const asse = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.06 * sc, 8), mat(LEGNO_SCURO));
    asse.rotation.x = Math.PI / 2;
    asse.position.set(wx, r, 0);
    gun.add(asse);
  }
  return 0.72; // quota d'appoggio della canna
}

// slitta della carronata: letto massiccio senza ruote, perno di brandeggio
function slitta(gun, { sc = 1 } = {}) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.7 * sc, 0.14, 1.0 * sc), mat(LEGNO_SCURO));
  base.position.y = 0.07;
  gun.add(base);
  const letto = new THREE.Mesh(new THREE.BoxGeometry(1.35 * sc, 0.3, 0.7 * sc), mat(LEGNO));
  letto.position.y = 0.30;
  gun.add(letto);
  const perno = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 10), metallo(false));
  perno.position.set(0.45 * sc, 0.5, 0);
  gun.add(perno);
  return 0.62;
}

function orecchioni(gun, x, y, z, bronzo, largo = 0.72) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, largo, 10), metallo(bronzo));
  o.rotation.x = Math.PI / 2;
  o.position.set(x, y, z);
  gun.add(o);
}

// Ogni sagoma: costruttore (lvl 1..3) → gruppo centrato sul proprio perno.
const SAGOME = {
  // colubrina: slanciata e delicata, la prima compagna del corsaro
  c(lvl) {
    const g = new THREE.Group();
    const h = carriola(g, { sc: 0.85 });
    const c = canna({ len: 2.6 * LVL_LEN[lvl - 1], r0: 0.185, r1: 0.115, bronzo: lvl >= 3, anelli: lvl >= 2 ? [0.4] : [] });
    c.rotation.z = -Math.PI / 2 + 0.05;
    c.position.set(-0.45, h, 0);
    g.add(c);
    orecchioni(g, -0.28, h - 0.02, 0, lvl >= 3, 0.6);
    return { g, cx: 0.55 };
  },
  // cannone da marina: il classico, due rinforzi ben piantati
  n(lvl) {
    const g = new THREE.Group();
    const h = carriola(g);
    const c = canna({ len: 2.35 * LVL_LEN[lvl - 1], r0: 0.24, r1: 0.15, bronzo: lvl >= 3, anelli: lvl >= 2 ? [0.28, 0.6] : [] });
    c.rotation.z = -Math.PI / 2 + 0.05;
    c.position.set(-0.45, h, 0);
    g.add(c);
    orecchioni(g, -0.30, h - 0.02, 0, lvl >= 3);
    return { g, cx: 0.48 };
  },
  // carronata: tozza sulla slitta, la bocca che mangia
  r(lvl) {
    const g = new THREE.Group();
    const h = slitta(g);
    const c = canna({ len: 1.65 * LVL_LEN[lvl - 1], r0: 0.30, r1: 0.24, bronzo: lvl >= 3, anelli: lvl >= 2 ? [0.45] : [] });
    c.rotation.z = -Math.PI / 2 + 0.04;
    c.position.set(-0.5, h, 0);
    g.add(c);
    return { g, cx: 0.28 };
  },
  // mortaio: la pentola che guarda il cielo su un letto quadrato
  m(lvl) {
    const g = new THREE.Group();
    const letto = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 1.15), mat(LEGNO));
    letto.position.y = 0.11;
    g.add(letto);
    for (const s of [-1, 1]) {
      const ceppo = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.14), mat(LEGNO));
      ceppo.position.set(0, 0.32, s * 0.42);
      g.add(ceppo);
    }
    const prof = [
      [0.001, 0], [0.34, 0], [0.42 * LVL_LEN[lvl - 1], 0.32], [0.40 * LVL_LEN[lvl - 1], 0.62],
      [0.44 * LVL_LEN[lvl - 1], 0.68], [0.44 * LVL_LEN[lvl - 1], 0.78], [0.30, 0.78], [0.001, 0.78],
    ];
    const pentola = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 20), metallo(lvl >= 3));
    pentola.position.set(0.08, 0.28, 0);
    pentola.rotation.z = -0.22; // punta appena in avanti: si capisce dove guarda
    g.add(pentola);
    if (lvl >= 2) {
      const cerchio = new THREE.Mesh(new THREE.TorusGeometry(0.42 * LVL_LEN[lvl - 1], 0.035, 8, 20), metallo(lvl >= 3));
      cerchio.rotation.x = Math.PI / 2;
      cerchio.position.set(0.08 + 0.5 * 0.22, 0.75, 0);
      cerchio.rotation.z = -0.22;
      g.add(cerchio);
    }
    const bocca = new THREE.Mesh(new THREE.CircleGeometry(0.26, 14), new THREE.MeshBasicMaterial({ color: 0x0a0a0c }));
    bocca.rotation.x = -Math.PI / 2;
    bocca.rotation.y = -0.22;
    bocca.position.set(0.08 + 0.78 * 0.22, 1.055, 0);
    g.add(bocca);
    return { g, cx: 0.05 };
  },
  // Organo di Da Vinci: tre canne sottili su un telaio largo
  o(lvl) {
    const g = new THREE.Group();
    const h = carriola(g, { sc: 1.05 });
    for (const off of [-0.34, 0, 0.34]) {
      const c = canna({ len: 2.1 * LVL_LEN[lvl - 1], r0: 0.10, r1: 0.075, bronzo: lvl >= 3, anelli: [] });
      c.rotation.z = -Math.PI / 2 + 0.05;
      c.position.set(-0.45, h, off);
      g.add(c);
    }
    // traversa che lega le canne in volata
    const trav = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.95), mat(LEGNO_SCURO));
    trav.position.set(1.15, h + 0.1, 0);
    g.add(trav);
    if (lvl >= 2) {
      const trav2 = trav.clone();
      trav2.position.x = 0.35;
      g.add(trav2);
    }
    return { g, cx: 0.42 };
  },
  // colubrina lunga: lo spillo della goletta, tutta anelli
  l(lvl) {
    const g = new THREE.Group();
    const h = carriola(g, { sc: 0.8 });
    const c = canna({ len: 3.1 * LVL_LEN[lvl - 1], r0: 0.155, r1: 0.09, bronzo: lvl >= 3, anelli: lvl >= 2 ? [0.22, 0.48, 0.74] : [0.4] });
    c.rotation.z = -Math.PI / 2 + 0.04;
    c.position.set(-0.42, h, 0);
    g.add(c);
    orecchioni(g, -0.26, h - 0.02, 0, lvl >= 3, 0.56);
    return { g, cx: 0.75 };
  },
  // carronata pesante: la botte del brigantino da guerra
  p(lvl) {
    const g = new THREE.Group();
    const h = slitta(g, { sc: 1.2 });
    const c = canna({ len: 1.95 * LVL_LEN[lvl - 1], r0: 0.36, r1: 0.27, botte: 0.22, bronzo: lvl >= 3, anelli: lvl >= 2 ? [0.5] : [] });
    c.rotation.z = -Math.PI / 2 + 0.04;
    c.position.set(-0.55, h + 0.06, 0);
    g.add(c);
    return { g, cx: 0.32 };
  },
};

// centrato sul perno orizzontale: nessuna posa esce dal fotogramma
function buildGun(tipo, lvl) {
  const { g, cx } = SAGOME[tipo](lvl);
  const perno = new THREE.Group();
  g.position.x = -cx;
  perno.add(g);
  return perno;
}

const VARIANTI = [];
for (const t of ['c', 'n', 'r', 'm', 'o', 'l', 'p']) {
  for (let lvl = 1; lvl <= 3; lvl++) VARIANTI.push({ nome: t + lvl, tipo: t, lvl });
}

async function main() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(FRAME, FRAME);
  renderer.setClearColor(0x000000, 0);

  // luci e camera IDENTICHE al bake delle navi (solo più vicina: D adatto
  // alla stazza di un cannone, largo abbastanza per la colubrina lunga)
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xfff2dd, 3.1);
  sun.position.set(-3, 6, -4);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xd8e2ea, 1.9));
  const fill = new THREE.DirectionalLight(0xffe9c9, 0.8);
  fill.position.set(3, 2.5, 4);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const D = 9;
  const elev = 58 * Math.PI / 180;
  camera.position.set(0, D * Math.sin(elev), D * Math.cos(elev));
  camera.lookAt(0, 0.35, 0);

  const rows = STEPS / COLS;
  const atlas = document.createElement('canvas');
  atlas.width = FRAME * COLS;
  atlas.height = FRAME * rows * VARIANTI.length;
  const ctx = atlas.getContext('2d');

  for (let v = 0; v < VARIANTI.length; v++) {
    const gun = buildGun(VARIANTI[v].tipo, VARIANTI[v].lvl);
    scene.add(gun);
    for (let k = 0; k < STEPS; k++) {
      gun.rotation.y = (k * 2 * Math.PI) / STEPS;
      renderer.render(scene, camera);
      const col = k % COLS, row = (k / COLS) | 0;
      ctx.drawImage(renderer.domElement, col * FRAME, (v * rows + row) * FRAME);
    }
    scene.remove(gun);
  }

  window.__atlas = atlas.toDataURL('image/webp', 0.92);
  // scala: 3.8 px di mondo per unità-cannone (tarata a occhio sul vettoriale
  // e sulla stazza delle navi); screen px = unità × scala / larghezza-frustum
  const frustum = 2 * D * Math.tan(14 * Math.PI / 180);
  window.__meta = JSON.stringify({
    frame: FRAME, steps: STEPS, cols: COLS, rows,
    scala: Math.round(3.8 * frustum * 10) / 10,
    variants: Object.fromEntries(VARIANTI.map((v, i) => [v.nome, i])),
  });
  console.log('BAKE-DONE');
}

main().catch(e => console.log('BAKE-ERRORE: ' + e.message));
