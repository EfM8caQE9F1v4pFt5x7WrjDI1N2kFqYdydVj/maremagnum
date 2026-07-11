// Il Bestiario di Cottura (audit 3): i tre mostri degli abissi, modellati in
// Three.js e pre-renderizzati A PARTI — corpo, ali, tentacoli, gobbe — così
// il client li COMPONE e li ANIMA a runtime (ali che battono, tentacoli che
// si torcono, gobbe che ondeggiano). Camera A PIOMBO: le parti devono poter
// ruotare libere sullo schermo, quindi niente prospettiva di 3/4 (quella
// resta alle navi, che non si piegano). Stessa luce calda della flotta.
// Ogni parte è modellata col PIVOT nell'origine di scena: la cella la
// inquadra centrata, e a runtime l'anchor (0.5, 0.5) ruota attorno al punto
// d'attacco senza contabilità extra.
// Caccia agli asset fatta (ordine «3+2+1» del capitano): niente di spedibile
// là fuori (Kenney = cartoon che stona, OpenGameArt = pixel-art 96px CC-BY-SA)
// — dal Kraken di Stendhal resta solo la POSA: tentacoli a ventaglio, letti
// dall'alto. Il resto è bottega nostra.

import * as THREE from 'three';

const FRAME = 256;
const DUMP = typeof location !== 'undefined' && new URLSearchParams(location.search).get('dump') === '1';

// palette di bottega: cremisi del Drago, inchiostro del Kraken, abisso verde
// del Serpente — le stesse famiglie dei corpi vettoriali dell'audit 2
const P = {
  dragoPelle: 0x93301f, dragoPelle2: 0x7e2418, dragoVentre: 0xb0482a,
  dragoCresta: 0xa1361f, dragoCorno: 0xd9c9a8, dragoMembrana: 0x6e1f16,
  dragoDita: 0x451009, brace: 0xffb03a,
  krakenMantello: 0x4a3862, krakenScuro: 0x352450, krakenChiaro: 0x5c4a78,
  krakenVentosa: 0x8a74ac, occhioBianco: 0xf3e6c2, pupilla: 0x160c26,
  serpePelle: 0x2e5d3a, serpePelle2: 0x27512f, serpeChiaro: 0x3d7a4c,
  serpeCresta: 0x1e4527, oro: 0xffd24a,
};

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.05, ...extra });
const matLucido = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.1, ...extra });
const brace = (color = P.brace) => new THREE.MeshStandardMaterial({
  color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4,
});

// una collana di sfere lungo una curva: il modo più organico di fare un
// corpo serpentino coi soli primitivi (le giunture leggono come vertebre)
function collana(group, curve, n, r0, r1, materiale, squash = 0.55) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = curve.getPoint(t);
    const r = r0 + (r1 - r0) * t;
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), materiale);
    s.position.set(p.x, p.y, p.z);
    s.scale.y = squash; // schiacciate: nuotano al pelo, non sono palloni
    group.add(s);
  }
}

// una placca dorsale a rombo, SDRAIATA sul dorso: le creste in piedi sono
// invisibili a piombo (imparato alla prima infornata) — dall'alto si vede
// solo ciò che è steso
function placca(group, x, z, l, w, materiale, alt = 0.24) {
  const shape = new THREE.Shape();
  shape.moveTo(-l / 2, 0).lineTo(0, -w / 2).lineTo(l / 2, 0).lineTo(0, w / 2).closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
  const m = new THREE.Mesh(g, materiale);
  m.rotation.x = -Math.PI / 2; // steso sul piano dell'acqua
  m.position.set(x, alt, z);
  group.add(m);
}

// --- DRAGO DI MARE ---------------------------------------------------------

// corpo serpentino a S con testa, corna e cresta dorsale; prua a +x
function dragoCorpo() {
  const g = new THREE.Group();
  const spina = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.55, 0, 0),
    new THREE.Vector3(0.9, 0, -0.22),
    new THREE.Vector3(0.1, 0, 0.16),
    new THREE.Vector3(-0.8, 0, -0.14),
    new THREE.Vector3(-1.55, 0, 0.06),
  ]);
  collana(g, spina, 16, 0.34, 0.13, mat(P.dragoPelle));
  // vertebre alternate un filo più scure: squame a risparmio
  const spina2 = new THREE.CatmullRomCurve3(spina.points.map(p => p.clone().setY(0.02)));
  collana(g, spina2, 8, 0.28, 0.1, mat(P.dragoPelle2), 0.5);
  // la TESTA: cranio, muso, arcate, corna all'indietro, occhi di brace
  const testa = new THREE.Group();
  const cranio = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 16), mat(P.dragoPelle));
  cranio.scale.set(1.25, 0.6, 0.95);
  const muso = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), mat(P.dragoPelle2));
  muso.position.set(0.42, -0.02, 0); muso.scale.set(1.5, 0.5, 0.62);
  testa.add(cranio, muso);
  for (const lato of [-1, 1]) {
    const corno = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.55, 10), matLucido(P.dragoCorno));
    corno.position.set(-0.28, 0.1, 0.16 * lato);
    corno.rotation.z = Math.PI / 2 + 0.35; // piegate all'indietro
    corno.rotation.y = -0.25 * lato;
    const occhio = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), brace());
    occhio.position.set(0.22, 0.16, 0.2 * lato);
    const narice = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), mat(0x2a0a05));
    narice.position.set(0.68, 0.08, 0.08 * lato);
    testa.add(corno, occhio, narice);
  }
  testa.position.set(1.75, 0.06, 0);
  g.add(testa);
  // cresta dorsale: placche a rombo digradanti, SDRAIATE (si vedono a piombo)
  // e SCURE — sul cremisi del dorso il tono su tono spariva (2ª infornata)
  for (let i = 0; i < 7; i++) {
    const t = 0.08 + i * 0.13;
    const p = spina.getPoint(t);
    const l = 0.34 - i * 0.028;
    placca(g, p.x, p.z, l, l * 0.62, matLucido(0x4d1208), 0.24 - i * 0.02);
  }
  // due pinne laterali corte a metà corpo: dall'alto danno larghezza al petto
  for (const lato of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0).quadraticCurveTo(0.25, 0.3 * lato, 0.05, 0.55 * lato).quadraticCurveTo(-0.15, 0.3 * lato, -0.2, 0).closePath();
    const pinna = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }), mat(0xb4512e, { side: THREE.DoubleSide, roughness: 0.5 }));
    pinna.rotation.x = -Math.PI / 2;
    pinna.position.set(0.75, 0.05, 0.26 * lato);
    g.add(pinna);
  }
  return g;
}

// ala destra (membrana + dita): RADICE nell'origine, si stende verso +x —
// a runtime la rotazione attorno all'anchor fa il battito
function dragoAla() {
  const g = new THREE.Group();
  // la vela dell'ala: bordo d'attacco teso, tre festoni profondi tra le dita
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.06);
  shape.quadraticCurveTo(0.6, 0.42, 1.3, 0.28);    // bordo d'attacco (avanti)
  shape.quadraticCurveTo(1.46, 0.16, 1.38, 0.02);  // la punta artigliata
  shape.quadraticCurveTo(1.0, -0.02, 0.92, -0.3);  // festone 1
  shape.quadraticCurveTo(0.66, -0.16, 0.5, -0.44); // festone 2
  shape.quadraticCurveTo(0.3, -0.24, 0.14, -0.4);  // festone 3
  shape.quadraticCurveTo(0.04, -0.16, 0, -0.1);
  shape.closePath();
  const membrana = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }),
    mat(0xa03a24, { side: THREE.DoubleSide, roughness: 0.55 }), // più caldo del corpo: si legge
  );
  membrana.rotation.x = -Math.PI / 2; // stesa sul piano dell'acqua
  g.add(membrana);
  // le dita OSSEE, scure sopra la membrana calda: il contrasto fa l'ala
  for (const [ang, len] of [[0.28, 1.32], [0.06, 1.38], [-0.2, 1.0], [-0.42, 0.6]]) {
    const dito = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.012, len, 8), mat(P.dragoDita));
    dito.rotation.z = Math.PI / 2;
    dito.rotation.y = ang;
    dito.position.set(Math.cos(ang) * len / 2, 0.05, -Math.sin(ang) * len / 2);
    g.add(dito);
  }
  // la spalla: un nodo muscolare alla radice
  const spalla = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), mat(P.dragoPelle));
  spalla.scale.y = 0.6;
  g.add(spalla);
  return g;
}

// coda: GIUNTO nell'origine, si stende verso +x e finisce a pinna
function dragoCoda() {
  const g = new THREE.Group();
  const curva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.45, 0, 0.1),
    new THREE.Vector3(0.9, 0, -0.06),
    new THREE.Vector3(1.2, 0, 0.02),
  ]);
  collana(g, curva, 10, 0.14, 0.045, mat(P.dragoPelle));
  // la pinna caudale: rombo piatto
  const shape = new THREE.Shape();
  shape.moveTo(0, 0).lineTo(0.3, -0.22).lineTo(0.42, 0).lineTo(0.3, 0.22).closePath();
  const pinna = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }), mat(P.dragoCresta, { side: THREE.DoubleSide }));
  pinna.rotation.x = -Math.PI / 2;
  pinna.position.set(1.18, 0, 0);
  g.add(pinna);
  return g;
}

// --- KRAKEN ----------------------------------------------------------------

// mantello a cupola con punta avanti e OCCHI enormi; i tentacoli sono a parte
function krakenMantello() {
  const g = new THREE.Group();
  const cupola = new THREE.Mesh(new THREE.SphereGeometry(0.72, 24, 18), mat(P.krakenMantello));
  cupola.scale.set(1.25, 0.55, 1.0);
  g.add(cupola);
  // la punta del mantello: un'ogiva morbida, non una freccia
  const punta = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 14), mat(P.krakenScuro));
  punta.scale.set(1.7, 0.5, 0.7);
  punta.position.set(1.0, 0.0, 0);
  g.add(punta);
  // due pinne romboidali ai lati della punta (le "orecchie" del calamaro)
  for (const lato of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0).quadraticCurveTo(0.4, 0.34 * lato, 0.72, 0.05 * lato).quadraticCurveTo(0.4, -0.05 * lato, 0, 0).closePath();
    const pinna = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }), mat(P.krakenChiaro, { side: THREE.DoubleSide }));
    pinna.rotation.x = -Math.PI / 2;
    pinna.rotation.z = 0.5;
    pinna.position.set(0.95, 0.06, 0.28 * lato);
    g.add(pinna);
  }
  // il velo più chiaro sul dorso
  const dorso = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), mat(P.krakenChiaro));
  dorso.scale.set(1.1, 0.42, 0.72); dorso.position.set(0.15, 0.14, 0);
  g.add(dorso);
  // chiazze d'abisso SDRAIATE sul dorso: la pelle marezzata si vede a piombo
  const chiazze = [[0.45, 0.32, 0.13], [0.1, -0.4, 0.16], [-0.3, 0.28, 0.11], [-0.45, -0.18, 0.09], [0.72, -0.08, 0.1], [0.2, 0.1, 0.08]];
  for (const [x, z, r] of chiazze) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(P.krakenScuro));
    b.scale.y = 0.18; // dischi, non bolle
    b.position.set(x, 0.34, z);
    g.add(b);
  }
  // OCCHI che non promettono niente di buono, verso poppa (dai tentacoli)
  for (const lato of [-1, 1]) {
    const bulbo = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), matLucido(P.occhioBianco));
    bulbo.position.set(-0.55, 0.16, 0.42 * lato);
    const pupilla = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), matLucido(P.pupilla));
    pupilla.position.set(-0.68, 0.22, 0.46 * lato);
    const anello = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.022, 8, 20), brace(0xc9a44a));
    anello.position.copy(pupilla.position);
    anello.rotation.x = Math.PI / 2 - 0.4;
    g.add(bulbo, pupilla, anello);
  }
  return g;
}

// UN tentacolo: BASE nell'origine, curling verso +x — il client ne pianta
// otto a ventaglio con fasi diverse (la posa viene dal Kraken di Stendhal:
// letti dall'alto, i tentacoli a raggiera vendono la bestia)
function krakenTentacolo() {
  const g = new THREE.Group();
  // più lungo e più carnoso della prima infornata: deve VENDERE la bestia
  const curva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.65, 0, 0.24),
    new THREE.Vector3(1.3, 0, -0.18),
    new THREE.Vector3(1.95, 0, 0.16),
    new THREE.Vector3(2.35, 0, 0.52),
    new THREE.Vector3(2.5, 0, 0.86), // il ricciolo finale
  ]);
  collana(g, curva, 20, 0.24, 0.035, mat(P.krakenMantello), 0.62);
  // ventose grandi e pallide lungo il bordo interno: si contano dall'alto
  for (let i = 1; i < 16; i += 2) {
    const t = i / 19;
    const p = curva.getPoint(t);
    const r = 0.085 - t * 0.055;
    const v = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.025, r), 10, 8), matLucido(P.krakenVentosa));
    v.scale.y = 0.4;
    v.position.set(p.x, 0.14 - t * 0.08, p.z - (0.16 - t * 0.1));
    g.add(v);
  }
  return g;
}

// --- SERPENTE ABISSALE -----------------------------------------------------

// testa sul collo lungo: GIUNTO nell'origine (dove finisce la prima gobba),
// collo e testa verso +x
function serpenteTesta() {
  const g = new THREE.Group();
  const collo = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.4, 0.02, 0.08),
    new THREE.Vector3(0.85, 0.04, -0.04),
  ]);
  collana(g, collo, 8, 0.16, 0.12, mat(P.serpePelle), 0.7);
  const testa = new THREE.Group();
  const cranio = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), mat(P.serpeChiaro));
  cranio.scale.set(1.35, 0.6, 0.85);
  const muso = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat(P.serpePelle));
  muso.position.set(0.3, -0.02, 0); muso.scale.set(1.4, 0.5, 0.7);
  testa.add(cranio, muso);
  for (const lato of [-1, 1]) {
    const occhio = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), brace(P.oro));
    occhio.position.set(0.14, 0.12, 0.13 * lato);
    // le pinnette auricolari del "mostro del lago"
    const orecchia = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 8), mat(P.serpeCresta));
    orecchia.rotation.z = 0.8; orecchia.rotation.y = -0.6 * lato;
    orecchia.position.set(-0.12, 0.1, 0.16 * lato);
    testa.add(occhio, orecchia);
  }
  testa.position.set(1.05, 0.08, 0);
  g.add(testa);
  return g;
}

// una gobba che taglia l'acqua (il client ne mette tre, digradanti)
function serpenteGobba() {
  const g = new THREE.Group();
  const gobba = new THREE.Mesh(new THREE.SphereGeometry(0.5, 22, 16), mat(P.serpePelle));
  gobba.scale.set(1.0, 0.5, 0.72);
  g.add(gobba);
  const riflesso = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 12), mat(P.serpeChiaro, { roughness: 0.5 }));
  riflesso.scale.set(1.0, 0.42, 0.62); riflesso.position.y = 0.12;
  g.add(riflesso);
  // la fila di placche dorsali, sdraiate: la schiena che taglia l'acqua
  for (let i = -1; i <= 1; i++) {
    placca(g, i * 0.26, 0, 0.24 - Math.abs(i) * 0.05, 0.13, matLucido(P.serpeCresta), 0.3);
  }
  return g;
}

// coda: GIUNTO nell'origine, verso +x, pinna a rombo in punta
function serpenteCoda() {
  const g = new THREE.Group();
  const curva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.35, 0, 0.1),
    new THREE.Vector3(0.7, 0, -0.04),
  ]);
  collana(g, curva, 8, 0.13, 0.04, mat(P.serpePelle2), 0.6);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0).lineTo(0.24, -0.18).lineTo(0.36, 0).lineTo(0.24, 0.18).closePath();
  const pinna = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }), mat(P.serpeCresta, { side: THREE.DoubleSide }));
  pinna.rotation.x = -Math.PI / 2;
  pinna.position.set(0.68, 0, 0);
  g.add(pinna);
  return g;
}

// --- l'atlante ---------------------------------------------------------------

// span = unità di mondo inquadrate dalla cella (per parte): a runtime la
// scala dello sprite è span·px/FRAME — px è il fattore unità→pixel di gioco
const PARTI = [
  { nome: 'drago-corpo', build: dragoCorpo, span: 4.6 },
  { nome: 'drago-ala', build: dragoAla, span: 3.0 },
  { nome: 'drago-coda', build: dragoCoda, span: 3.6 },
  { nome: 'kraken-mantello', build: krakenMantello, span: 4.2 },
  { nome: 'kraken-tentacolo', build: krakenTentacolo, span: 3.8 },
  { nome: 'serpente-testa', build: serpenteTesta, span: 3.4 },
  { nome: 'serpente-gobba', build: serpenteGobba, span: 2.4 },
  { nome: 'serpente-coda', build: serpenteCoda, span: 2.4 },
];
const COLS = 4;

async function main() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(FRAME, FRAME);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  // la stessa luce calda della flotta (bake-navi): il bestiario vive nello
  // stesso mare, sotto lo stesso sole
  const sun = new THREE.DirectionalLight(0xfff2dd, 3.1);
  sun.position.set(-3, 6, -4);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xd8e2ea, 1.9));
  const fill = new THREE.DirectionalLight(0xffe9c9, 0.8);
  fill.position.set(3, 2.5, 4);
  scene.add(fill);

  const rows = Math.ceil(PARTI.length / COLS);
  const atlas = document.createElement('canvas');
  atlas.width = FRAME * COLS;
  atlas.height = FRAME * rows;
  const ctx = atlas.getContext('2d');

  for (let i = 0; i < PARTI.length; i++) {
    const parte = PARTI[i];
    const gruppo = parte.build();
    scene.add(gruppo);
    // camera A PIOMBO: +x mondo → destra, +z mondo → giù (come il gioco)
    const h = parte.span / 2;
    const camera = new THREE.OrthographicCamera(-h, h, h, -h, 0.1, 50);
    camera.position.set(0, 10, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    ctx.drawImage(renderer.domElement, (i % COLS) * FRAME, ((i / COLS) | 0) * FRAME);
    scene.remove(gruppo);
  }

  window.__atlas = atlas.toDataURL('image/webp', 0.92);
  const meta = {
    frame: FRAME, cols: COLS, rows,
    px: 78, // pixel di gioco per unità di mondo: il Drago intero fa ~360px (4× l'audit 2)
    parti: Object.fromEntries(PARTI.map((p, i) => [p.nome, { i, span: p.span }])),
  };
  window.__meta = JSON.stringify(meta);
  if (DUMP) {
    const pre = document.createElement('pre');
    pre.id = 'bake-dump';
    pre.textContent = JSON.stringify({ atlas: window.__atlas, meta: window.__meta });
    document.body.appendChild(pre);
  } else {
    atlas.style.cssText = 'image-rendering:auto;background:#1d3a4d;max-width:100%';
    document.body.appendChild(atlas); // il bestiario in vetrina, per l'occhio
  }
  console.log('BAKE-DONE');
}

main().catch(e => {
  if (DUMP) document.body.textContent = 'BAKE-ERRORE: ' + e.message;
  console.log('BAKE-ERRORE: ' + e.message);
});
