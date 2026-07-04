// Il Cantiere di Cottura: la FLOTTA del Maremagnum, modellata in Three.js e
// pre-renderizzata in 36 angolazioni per classe. La progressione si vede:
//   sloop (scafo 0-1) → brigantino (2-3) → galeone (4) → galeone DORATO (tutto al massimo)
// più le varianti degli NPC (fantasma, mercantile).
// Direzione estetica: le battaglie navali di The Curse of Monkey Island —
// vele quadre enormi e candide a più ordini, doppio listello giallo sullo
// scafo, opera morta verdazzurra, sartiame visibile. Con il pre-render il
// dettaglio è gratis: si paga solo UNA volta, in fase di build.

import * as THREE from 'three';

const FRAME = 256; // col cannocchiale a 2x i 192 andavano stretti
const STEPS = 36;
const COLS = 12; // atlas largo e basso: 9216 px di altezza sforavano il limite texture (8192) dei renderer software

const TINTA = {
  legno: {
    hull: 0x7a5230, deck: 0xa08050, mast: 0x5c4326, flag: 0x1d3a24,
    wale: 0x2f2216, trim: 0xe9b93c, accento: 0x2e6b66, sail: 0xffffff,
  },
  fantasma: {
    hull: 0x3d4750, deck: 0x55636d, mast: 0x2c353c, flag: 0x27313a,
    wale: 0x232b32, trim: 0x74919e, accento: 0x31555c, sail: 0xbdd2d7,
  },
  oro: 0xf0c14e,
};

// La flotta: geometria parametrica per classe.
const CLASSI = {
  sloop:      { L: 0.78, alberi: 1, castello: 0, gabbia: false, fiocco: true,  pal: 'legno' },
  brigantino: { L: 1.00, alberi: 2, castello: 1, gabbia: true,  fiocco: true,  pal: 'legno' },
  galeone:    { L: 1.22, alberi: 3, castello: 2, gabbia: true,  fiocco: true,  pal: 'legno' },
  oro:        { L: 1.22, alberi: 3, castello: 2, gabbia: true,  fiocco: true,  pal: 'legno', dorata: true },
  fantasma:   { L: 1.00, alberi: 2, castello: 1, gabbia: true,  fiocco: true,  pal: 'fantasma', spettrale: true },
  mercantile: { L: 1.00, alberi: 1, castello: 1, gabbia: false, fiocco: false, pal: 'legno', casse: true },
};
const VARIANTS = Object.keys(CLASSI);

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true, ...extra });
}

// Tela dipinta: cuciture verticali appena accennate e un'ombra in basso,
// perché la vela non sembri plastica.
function sailTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f8f5ec';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(120,108,86,0.20)';
  g.lineWidth = 1;
  for (let x = 10; x < 64; x += 11) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
  const grad = g.createLinearGradient(0, 34, 0, 64);
  grad.addColorStop(0, 'rgba(96,84,60,0)');
  grad.addColorStop(1, 'rgba(96,84,60,0.16)');
  g.fillStyle = grad;
  g.fillRect(0, 34, 64, 30);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
let SAIL_TEX = null;

// Fasciame dipinto: corsi orizzontali e chiazze di tono, perché lo scafo
// non sia una lastra di marrone piatto.
function plankTexture(base, line) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) {
    const x = (i * 47) % 128, y = (i * 31) % 128;
    g.fillStyle = `rgba(255,235,200,${0.03 + (i % 3) * 0.02})`;
    g.fillRect(x, y, 26, 7);
  }
  g.strokeStyle = line;
  g.lineWidth = 1.5;
  for (let y = 8; y < 128; y += 11) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.55, 0.55); // le UV dell'estrusione sono in unità mondo
  return tex;
}
const PLANK_TEX = {};

function buildShip(nome) {
  const cfg = CLASSI[nome];
  const p = TINTA[cfg.pal];
  const L = cfg.L;
  const oro = !!cfg.dorata;
  const ship = new THREE.Group();

  const matOro = mat(TINTA.oro, { emissive: TINTA.oro, emissiveIntensity: 0.3, metalness: 0.4, roughness: 0.55 });
  const matTrim = oro ? matOro : mat(p.trim, { emissive: p.trim, emissiveIntensity: 0.12 });
  if (!SAIL_TEX) SAIL_TEX = sailTexture();
  // la tela di Monkey Island è dipinta chiara da OGNI lato: l'emissiva alta
  // tiene bianche anche le facce in ombra (niente vele grigie di spalle)
  // l'ammiraglia dorata si riconosce dalla TELA: canapa d'oro, non bianca
  const telaCol = oro ? 0xf0d494 : p.sail;
  const sailMat = new THREE.MeshStandardMaterial({
    color: telaCol, map: SAIL_TEX, roughness: 1, metalness: 0, side: THREE.DoubleSide,
    emissive: telaCol, emissiveMap: SAIL_TEX, emissiveIntensity: 0.48,
  });
  const ropeMat = mat(0x2e2318);

  // scafo: profilo estruso, prua affusolata; lunghezza scalata dalla classe
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.9 * L, -0.85);
  hullShape.lineTo(0.8 * L, -0.85);
  hullShape.quadraticCurveTo(1.9 * L, -0.45, 2.4 * L, 0);
  hullShape.quadraticCurveTo(1.9 * L, 0.45, 0.8 * L, 0.85);
  hullShape.lineTo(-1.9 * L, 0.85);
  hullShape.quadraticCurveTo(-2.15 * L, 0, -1.9 * L, -0.85);
  if (!PLANK_TEX[cfg.pal]) {
    PLANK_TEX[cfg.pal] = cfg.pal === 'fantasma'
      ? plankTexture('#3d4750', 'rgba(20,28,34,0.5)')
      : plankTexture('#7a5230', 'rgba(43,26,12,0.5)');
  }
  const hull = new THREE.Mesh(
    new THREE.ExtrudeGeometry(hullShape, { depth: 0.75, bevelEnabled: true, bevelSize: 0.18, bevelThickness: 0.22, bevelSegments: 1 }),
    mat(0xffffff, { map: PLANK_TEX[cfg.pal] }),
  );
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = 0.75;
  ship.add(hull);

  // ponte
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-1.7 * L, -0.62);
  deckShape.lineTo(0.75 * L, -0.62);
  deckShape.quadraticCurveTo(1.75 * L, -0.3, 2.1 * L, 0);
  deckShape.quadraticCurveTo(1.75 * L, 0.3, 0.75 * L, 0.62);
  deckShape.lineTo(-1.7 * L, 0.62);
  deckShape.quadraticCurveTo(-1.9 * L, 0, -1.7 * L, -0.62);
  const deck = new THREE.Mesh(new THREE.ExtrudeGeometry(deckShape, { depth: 0.1, bevelEnabled: false }), mat(p.deck));
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.86;
  ship.add(deck);

  // l'abito di Monkey Island. Il segno più forte dei reference è il bordo
  // giallo che CONTORNA il ponte visto dall'alto: una piastra a forma di
  // ponte, un filo più larga, che spunta come orlo dorato tutt'attorno.
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(deckShape, { depth: 0.13, bevelEnabled: false }), matTrim);
  rim.scale.set(1.05, 1.2, 1);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.985;
  ship.add(rim);
  // …più i listelli di fiancata: giallo basso, fascia verdazzurra, incinta scura
  for (const side of [-1, 1]) {
    const trimBasso = new THREE.Mesh(new THREE.BoxGeometry(3.65 * L, 0.08, 0.05), matTrim);
    trimBasso.position.set(0.1 * L, 0.68, side * 1.02);
    ship.add(trimBasso);
    if (cfg.castello >= 1) {
      const fascia = new THREE.Mesh(new THREE.BoxGeometry(3.5 * L, 0.22, 0.05), oro ? mat(0x7a4a14) : mat(p.accento));
      fascia.position.set(0.1 * L, 0.84, side * 1.0);
      ship.add(fascia);
    }
    const wale = new THREE.Mesh(new THREE.BoxGeometry(3.7 * L, 0.14, 0.05), mat(p.wale));
    wale.position.set(0.08 * L, 0.48, side * 1.04);
    ship.add(wale);
  }

  // castello di poppa: 0 (sloop), 1 (brigantino), 2 piani (galeone)
  if (cfg.castello >= 1) {
    const stern = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 1.15), oro ? mat(0x7a4a14) : mat(p.accento));
    stern.position.set(-1.45 * L, 1.05, 0);
    ship.add(stern);
    const sternDeck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.0), mat(p.deck));
    sternDeck.position.set(-1.45 * L, 1.3, 0);
    ship.add(sternDeck);
    const bordo = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 1.17), matTrim);
    bordo.position.set(-1.45 * L, 1.29, 0);
    ship.add(bordo);
  }
  if (cfg.castello >= 2) {
    const alto = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.9), oro ? mat(0x7a4a14) : mat(p.accento));
    alto.position.set(-1.62 * L, 1.5, 0);
    ship.add(alto);
    const altoDeck = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.8), mat(p.deck));
    altoDeck.position.set(-1.62 * L, 1.7, 0);
    ship.add(altoDeck);
    const bordo2 = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.05, 0.92), matTrim);
    bordo2.position.set(-1.62 * L, 1.69, 0);
    ship.add(bordo2);
    // specchio di poppa ornato
    const fregio = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.0), oro ? matOro : matTrim);
    fregio.position.set(-2.08 * L, 1.15, 0);
    ship.add(fregio);
  }
  // galleria di poppa illuminata: finestrelle calde sullo specchio
  if (cfg.castello >= 1) {
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xffe2a0, emissive: 0xffcf70, emissiveIntensity: 0.55, roughness: 1,
    });
    const n = cfg.castello >= 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.13, 0.16), winMat);
      w.position.set(-1.88 * L, 1.02, (i - (n - 1) / 2) * 0.32);
      ship.add(w);
    }
  }

  // bompresso
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.6, 5), mat(p.mast));
  bow.rotation.z = -1.12;
  bow.position.set(2.6 * L, 1.1, 0);
  ship.add(bow);
  // polena dorata sulle classi alte
  if (cfg.castello >= 2) {
    const polena = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), matOro);
    polena.position.set(2.42 * L, 0.95, 0);
    ship.add(polena);
  }

  // boccaporto, timone, lanterna
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.5), mat(p.wale));
  hatch.position.set(1.1 * L, 0.95, 0);
  ship.add(hatch);
  if (cfg.castello >= 1) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 10), mat(p.wale));
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(-1.05 * L, 1.5, 0);
    ship.add(wheel);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffd98a, emissive: 0xffc760, emissiveIntensity: oro ? 1.3 : 0.9, roughness: 1,
    });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(oro ? 0.12 : 0.09, 6, 5), lampMat);
    lamp.position.set(-1.95 * L, cfg.castello >= 2 ? 1.85 : 1.55, 0);
    ship.add(lamp);
  }

  // alberatura: più alta e a più ordini di vele quadre — è la vela, non lo
  // scafo, a dare la stazza di Monkey Island. royale solo sul galeone.
  const posAlberi = cfg.alberi === 1 ? [0.1] : cfg.alberi === 2 ? [0.55, -0.75] : [1.15, 0.05, -1.05];
  const scale = cfg.alberi === 3 ? [0.85, 1.05, 0.8] : cfg.alberi === 2 ? [1, 0.82] : [1];
  const royale = cfg.alberi === 3;
  const hAlbero = royale ? 5.0 : 4.0;
  for (let i = 0; i < posAlberi.length; i++) {
    const x = posAlberi[i] * L;
    const s = scale[i];
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.085, hAlbero * s, 6), mat(p.mast));
    mast.position.set(x, 0.9 + (hAlbero / 2) * s, 0);
    ship.add(mast);
    if (oro) {
      const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), matOro);
      pomo.position.set(x, 0.9 + hAlbero * s + 0.05, 0);
      ship.add(pomo);
    }

    // ordini di vele: [raggio alto, raggio basso, altezza, quota centro].
    // I pennoni sporgono OLTRE il baglio: nei reference è la vela, larga e
    // panciuta, a dominare la sagoma — non lo scafo.
    const ordini = [
      [1.2 * s, 1.5 * s, 1.7 * s, 0.9 + 1.5 * s],
      [0.85 * s, 1.1 * s, 1.15 * s, 0.9 + 3.0 * s],
    ];
    if (royale) ordini.push([0.55 * s, 0.75 * s, 0.85 * s, 0.9 + 4.1 * s]);
    const tiers = cfg.casse ? 1 : cfg.gabbia ? ordini.length : 2;
    // pennoni BRACCIATI (~28°): nei reference le vele quadre restano piene
    // da ogni inquadratura perché i pennoni non sono mai perpendicolari
    // alla chiglia — di traverso una vela squadrata sparirebbe di taglio.
    const rig = new THREE.Group();
    rig.position.set(x, 0, 0);
    rig.rotation.y = 0.38;
    ship.add(rig);
    for (let t = 0; t < tiers; t++) {
      const [rTop, rBot, h, cy] = ordini[t];
      const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, rTop * 2.2, 5), mat(p.mast));
      yard.rotation.x = Math.PI / 2;
      yard.position.set(0, cy + h * 0.55, 0);
      rig.add(yard);
      const sailGeo = new THREE.CylinderGeometry(rTop, rBot, h, 14, 1, true, -1.1, 2.2);
      const sail = new THREE.Mesh(sailGeo, sailMat);
      sail.rotation.y = Math.PI / 2;
      sail.position.set(-0.5 * s, cy, 0);
      sail.scale.z = 0.4;
      rig.add(sail);
    }

    const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.14, 7, 1, true), mat(p.deck));
    nest.position.set(x, 0.9 + (royale ? 3.9 : 2.5) * s, 0);
    ship.add(nest);

    // straglio di prua e di poppa
    for (const [tx, ty] of [[2.55 * L, 1.2], [-1.9 * L, 1.35]]) {
      const from = new THREE.Vector3(x, 0.9 + (hAlbero - 0.25) * s, 0);
      const to = new THREE.Vector3(tx, ty, 0);
      const len = from.distanceTo(to);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, len, 4), ropeMat);
      rope.position.copy(from).lerp(to, 0.5);
      rope.lookAt(to);
      rope.rotateX(Math.PI / 2);
      ship.add(rope);
    }
    // sartie: dalle coffe al capodibanda, due per lato
    for (const side of [-1, 1]) {
      for (const dx of [-0.28, 0.28]) {
        const from = new THREE.Vector3(x, 0.9 + 2.6 * s, 0);
        const to = new THREE.Vector3(x + dx + 0.1, 1.02, side * 0.74);
        const len = from.distanceTo(to);
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, len, 4), ropeMat);
        rope.position.copy(from).lerp(to, 0.5);
        rope.lookAt(to);
        rope.rotateX(Math.PI / 2);
        ship.add(rope);
      }
    }
  }

  // fiocco fra bompresso e trinchetto
  if (cfg.fiocco) {
    const jibShape = new THREE.Shape();
    jibShape.moveTo(0, 0);
    jibShape.lineTo(-1.85 * L, 2.5);
    jibShape.lineTo(-1.7 * L, 0.15);
    jibShape.closePath();
    const jib = new THREE.Mesh(new THREE.ShapeGeometry(jibShape), sailMat);
    jib.rotation.y = -0.16;
    jib.position.set(3.05 * L, 1.2, 0.04);
    ship.add(jib);
  }

  // bandiera in testa all'albero maestro (non per il mercantile)
  if (p.flag != null && !cfg.casse) {
    const iMaestro = cfg.alberi === 3 ? 1 : 0;
    const fx = posAlberi[iMaestro] * L - 0.34;
    const fy = 0.9 + hAlbero * scale[iMaestro] - 0.16;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.24), new THREE.MeshStandardMaterial({
      color: oro ? 0x2a1004 : p.flag, roughness: 1, side: THREE.DoubleSide,
    }));
    flag.position.set(fx, fy, 0);
    flag.rotation.y = 0.18;
    ship.add(flag);
    // il teschio è un punto chiaro: a questa scala basta e avanza
    const teschio = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshStandardMaterial({
      color: 0xe8e4d8, emissive: 0xe8e4d8, emissiveIntensity: 0.4, roughness: 1, side: THREE.DoubleSide,
    }));
    teschio.position.set(fx, fy, 0.012);
    teschio.rotation.y = 0.18;
    ship.add(teschio);
    if (oro) {
      const orlo = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.05, 0.02), matOro);
      orlo.position.set(fx, fy - 0.19, 0);
      orlo.rotation.y = 0.18;
      ship.add(orlo);
    }
  }

  // casse sul ponte del mercantile
  if (cfg.casse) {
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), mat(0x9a7443));
    c1.position.set(0.7, 1.1, 0.15); c1.rotation.y = 0.4;
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.4), mat(0x84623a));
    c2.position.set(1.15, 1.05, -0.2);
    ship.add(c1, c2);
  }

  // il fantasma è traslucido di suo (l'alpha finale la dà il client)
  if (cfg.spettrale) {
    ship.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = 0.92; } });
  }

  return ship;
}

async function main() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(FRAME, FRAME);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xfff2dd, 3.1);
  sun.position.set(-3, 6, -4);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xd8e2ea, 1.9));
  const fill = new THREE.DirectionalLight(0xffe9c9, 0.8);
  fill.position.set(3, 2.5, 4);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const D = 17.2; // il bompresso del galeone sfiorava il bordo del fotogramma
  const elev = 58 * Math.PI / 180; // un filo più radente: si vede la fiancata coi listelli
  camera.position.set(0, D * Math.sin(elev), D * Math.cos(elev));
  camera.lookAt(0, 0.9, 0);

  const rows = STEPS / COLS;
  const atlas = document.createElement('canvas');
  atlas.width = FRAME * COLS;
  atlas.height = FRAME * rows * VARIANTS.length;
  const ctx = atlas.getContext('2d');

  for (let v = 0; v < VARIANTS.length; v++) {
    const ship = buildShip(VARIANTS[v]);
    scene.add(ship);
    for (let k = 0; k < STEPS; k++) {
      ship.rotation.y = (k * 2 * Math.PI) / STEPS;
      renderer.render(scene, camera);
      const col = k % COLS, row = (k / COLS) | 0;
      ctx.drawImage(renderer.domElement, col * FRAME, (v * rows + row) * FRAME);
    }
    scene.remove(ship);
  }

  // webp: stessa trasparenza morbida del png, un sesto del peso
  window.__atlas = atlas.toDataURL('image/webp', 0.92);
  window.__meta = JSON.stringify({
    frame: FRAME, steps: STEPS, cols: COLS, rows,
    // fattore di scala a schermo: la stazza di gioco non dipende da D o FRAME
    scala: Math.round(79 * (D / 13) * 10) / 10,
    variants: Object.fromEntries(VARIANTS.map((name, i) => [name, i])),
  });
  console.log('BAKE-DONE');
}

main().catch(e => console.log('BAKE-ERRORE: ' + e.message));
