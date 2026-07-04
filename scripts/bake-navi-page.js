// Il Cantiere di Cottura: modella le navi low-poly in Three.js e le
// pre-renderizza in 36 angolazioni × 3 varianti dentro un unico atlas.
// Gira UNA volta in fase di build (scripts/bake-navi.js): a runtime il
// gioco vede solo sprite — arte cotta prima, blit dopo, come nel '97.

import * as THREE from 'three';

const FRAME = 192;       // px per fotogramma (più dettaglio, stessa resa a schermo)
const STEPS = 36;        // una posa ogni 10°
const COLS = 6;          // griglia 6×6 per variante
const VARIANTS = ['pirata', 'fantasma', 'mercantile'];

const PAL = {
  pirata: { hull: 0x5d4229, deck: 0x8a6d4a, sail: 0xe9ddc0, mast: 0x4a3520, flag: 0x181818 },
  fantasma: { hull: 0x3d4750, deck: 0x55636d, sail: 0x93a7b1, mast: 0x2c353c, flag: 0x27313a },
  mercantile: { hull: 0x5d4229, deck: 0x8a6d4a, sail: 0xcfc9ba, mast: 0x4a3520, flag: null },
};

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true });
}

// La nave è costruita sdraiata lungo +X (prua verso +X), su piano XZ, Y in alto.
function buildShip(variant) {
  const p = PAL[variant];
  const ship = new THREE.Group();

  // scafo: profilo del ponte estruso verso il basso, prua affusolata
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.9, -0.85);
  hullShape.lineTo(0.8, -0.85);
  hullShape.quadraticCurveTo(1.9, -0.45, 2.4, 0);
  hullShape.quadraticCurveTo(1.9, 0.45, 0.8, 0.85);
  hullShape.lineTo(-1.9, 0.85);
  hullShape.quadraticCurveTo(-2.15, 0, -1.9, -0.85);
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.75, bevelEnabled: true, bevelSize: 0.18, bevelThickness: 0.22, bevelSegments: 1 });
  const hull = new THREE.Mesh(hullGeo, mat(p.hull));
  hull.rotation.x = -Math.PI / 2; // il profilo (XY) si sdraia sul piano XZ
  hull.position.y = 0.75;
  ship.add(hull);

  // ponte
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-1.7, -0.62);
  deckShape.lineTo(0.75, -0.62);
  deckShape.quadraticCurveTo(1.75, -0.3, 2.1, 0);
  deckShape.quadraticCurveTo(1.75, 0.3, 0.75, 0.62);
  deckShape.lineTo(-1.7, 0.62);
  deckShape.quadraticCurveTo(-1.9, 0, -1.7, -0.62);
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: 0.1, bevelEnabled: false });
  const deck = new THREE.Mesh(deckGeo, mat(p.deck));
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.86;
  ship.add(deck);

  // castello di poppa
  const stern = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 1.15), mat(p.hull));
  stern.position.set(-1.45, 1.05, 0);
  ship.add(stern);
  const sternDeck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.0), mat(p.deck));
  sternDeck.position.set(-1.45, 1.3, 0);
  ship.add(sternDeck);

  // bompresso
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.4, 5), mat(p.mast));
  bow.rotation.z = -1.15;
  bow.position.set(2.55, 1.05, 0);
  ship.add(bow);

  // parapetto lungo i fianchi (cambia la silhouette del ponte)
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.16, 0.08), mat(p.hull));
    rail.position.set(0.15, 1.02, side * 0.72);
    ship.add(rail);
  }

  // fasciame: banda di chiglia più scura lungo i fianchi
  for (const side of [-1, 1]) {
    const strake = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 0.05), mat(0x3a2a18));
    strake.position.set(0.1, 0.55, side * 0.98);
    ship.add(strake);
  }

  // boccaporto e argano sul ponte
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.5), mat(0x3a2a18));
  hatch.position.set(1.1, 0.95, 0);
  ship.add(hatch);
  const capstan = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.24, 6), mat(p.mast));
  capstan.position.set(-0.15, 1.03, 0);
  ship.add(capstan);

  // timone a ruota sul castello di poppa + lanterna di poppa
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 10), mat(0x3a2a18));
  wheel.rotation.y = Math.PI / 2;
  wheel.position.set(-1.05, 1.5, 0);
  ship.add(wheel);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffc760, emissiveIntensity: 0.9, roughness: 1 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), lampMat);
  lamp.position.set(-1.95, 1.55, 0);
  ship.add(lamp);

  // alberi con pennoni, coffa, vele bombate e sartie
  const mastCount = variant === 'mercantile' ? 1 : 2;
  const mastX = mastCount === 2 ? [0.55, -0.75] : [-0.1];
  const sailScale = [1, 0.82];
  const sailMat = new THREE.MeshStandardMaterial({
    color: p.sail, roughness: 1, metalness: 0, flatShading: false, side: THREE.DoubleSide,
    emissive: p.sail, emissiveIntensity: 0.22, // le vele sono il faro visivo della nave
  });
  const ropeMat = mat(0x2e2318);
  for (let i = 0; i < mastCount; i++) {
    const s = sailScale[i];
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 2.9, 6), mat(p.mast));
    mast.position.set(mastX[i], 2.05, 0);
    ship.add(mast);

    // pennone (il palo orizzontale che regge la vela)
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.15 * s, 5), mat(p.mast));
    yard.rotation.x = Math.PI / 2;
    yard.position.set(mastX[i], 2.15 + 0.85 * s, 0);
    ship.add(yard);

    // vela principale, leggermente rastremata in alto
    const sailGeo = new THREE.CylinderGeometry(0.88 * s, 1.1 * s, 1.75 * s, 10, 1, true, -0.85, 1.7);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.rotation.y = Math.PI / 2;
    sail.position.set(mastX[i] - 0.55 * s, 2.2, 0);
    sail.scale.z = 0.55;
    ship.add(sail);

    // vela di gabbia più piccola sopra
    const topGeo = new THREE.CylinderGeometry(0.5 * s, 0.72 * s, 0.8 * s, 8, 1, true, -0.75, 1.5);
    const top = new THREE.Mesh(topGeo, sailMat);
    top.rotation.y = Math.PI / 2;
    top.position.set(mastX[i] - 0.3 * s, 3.35 * s === 3.35 ? 3.35 : 3.0, 0);
    top.scale.z = 0.5;
    ship.add(top);

    // coffa (vedetta)
    const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.14, 7, 1, true), mat(p.deck));
    nest.position.set(mastX[i], 2.95 * (s === 1 ? 1 : 0.94), 0);
    ship.add(nest);

    // sartie: cavi dall'albero verso prua e poppa
    for (const [tx, ty] of [[2.5, 1.15], [-1.9, 1.35]]) {
      const from = new THREE.Vector3(mastX[i], 3.3 * s, 0);
      const to = new THREE.Vector3(tx, ty, 0);
      const len = from.distanceTo(to);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 4), ropeMat);
      rope.position.copy(from).lerp(to, 0.5);
      rope.lookAt(to);
      rope.rotateX(Math.PI / 2);
      ship.add(rope);
    }
  }

  // fiocco triangolare fra bompresso e trinchetto (solo vascelli armati)
  if (variant !== 'mercantile') {
    // il fiocco vive nel piano prua-poppa: mura al bompresso, penna all'albero
    const jibShape = new THREE.Shape();
    jibShape.moveTo(0, 0);          // mura, in punta al bompresso
    jibShape.lineTo(-1.65, 1.85);   // penna, verso la testa del trinchetto
    jibShape.lineTo(-1.5, 0.15);    // bugna, giù verso il ponte
    jibShape.closePath();
    const jib = new THREE.Mesh(new THREE.ShapeGeometry(jibShape), sailMat);
    jib.rotation.y = -0.16; // appena gonfio sottovento
    jib.position.set(2.95, 1.2, 0.04);
    ship.add(jib);
  }

  // bandiera in testa d'albero (non per il mercantile)
  if (p.flag != null) {
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.34), new THREE.MeshStandardMaterial({
      color: p.flag, roughness: 1, side: THREE.DoubleSide,
    }));
    flag.position.set(mastX[0] - 0.32, 3.32, 0); // attaccata alla testa d'albero
    flag.rotation.y = 0.18; // mai perfettamente di taglio
    ship.add(flag);
  }

  // casse sul ponte del mercantile
  if (variant === 'mercantile') {
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), mat(0x9a7443));
    c1.position.set(0.7, 1.1, 0.15); c1.rotation.y = 0.4;
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.4), mat(0x84623a));
    c2.position.set(1.15, 1.05, -0.2);
    ship.add(c1, c2);
  }

  return ship;
}

async function main() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(FRAME, FRAME);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  // luce da nord-ovest come le isole dipinte, più ambiente morbida
  const sun = new THREE.DirectionalLight(0xfff2dd, 3.0);
  sun.position.set(-3, 6, -4);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xd8e2ea, 1.9));
  const fill = new THREE.DirectionalLight(0xffe9c9, 0.8); // rimbalzo caldo da sud-est
  fill.position.set(3, 2.5, 4);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  // vista quasi zenitale (~62°) con un filo di prospettiva da sud
  const D = 13;
  const elev = 62 * Math.PI / 180;
  camera.position.set(0, D * Math.sin(elev), D * Math.cos(elev));
  camera.lookAt(0, 0.7, 0);

  const rows = STEPS / COLS;
  const atlas = document.createElement('canvas');
  atlas.width = FRAME * COLS;
  atlas.height = FRAME * rows * VARIANTS.length;
  const ctx = atlas.getContext('2d');

  for (let v = 0; v < VARIANTS.length; v++) {
    const ship = buildShip(VARIANTS[v]);
    scene.add(ship);
    for (let k = 0; k < STEPS; k++) {
      // rot di gioco: 0 = prua verso destra (+x schermo), positivo = orario a
      // schermo (y in giù). Nel mondo three (Y su, camera da +Z che guarda -Z):
      // lo schermo x = world x, lo schermo y = world -z ⇒ yaw = +rot.
      ship.rotation.y = (k * 2 * Math.PI) / STEPS;
      renderer.render(scene, camera);
      const col = k % COLS, row = (k / COLS) | 0;
      ctx.drawImage(renderer.domElement, col * FRAME, (v * rows + row) * FRAME);
    }
    scene.remove(ship);
  }

  window.__atlas = atlas.toDataURL('image/png');
  window.__meta = JSON.stringify({
    frame: FRAME, steps: STEPS, cols: COLS, rows,
    variants: Object.fromEntries(VARIANTS.map((name, i) => [name, i])),
  });
  console.log('BAKE-DONE');
}

main().catch(e => console.log('BAKE-ERRORE: ' + e.message));
