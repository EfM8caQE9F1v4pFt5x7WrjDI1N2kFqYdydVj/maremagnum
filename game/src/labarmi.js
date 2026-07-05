// Laboratorio delle bocche da fuoco (issue #17): griglia di TUTTE le
// combinazioni arma × livello, prima e dopo, alla scala del cannocchiale
// (zoom 2) più un ingrandimento di studio. Colonna a 45° per verificare
// che la luce zenitale non tradisca la rotazione.

import { Application, Container, Graphics, Text, Sprite, Texture, Rectangle, Assets } from 'pixi.js';
import { drawGun as drawGunNuovo } from './guns.js';

const TIPI = [
  ['c', 'Colubrina'], ['n', 'Cannone'], ['r', 'Carronata'], ['m', 'Mortaio'],
  ['o', 'Organo'], ['l', 'Col. lunga'], ['p', 'Carr. pesante'],
];

// Copia fedele del drawGun di render.js com'era PRIMA della #17: serve al
// confronto fianco a fianco (il "prima" della verifica visiva).
function drawGunVecchio(g, cx, cy, dir, type, lvl) {
  const cos = Math.cos(dir), sin = Math.sin(dir);
  const P = (x, y) => [cx + x * cos - y * sin, cy + x * sin + y * cos];
  const rect = (x0, x1, hw, col) =>
    g.poly([...P(x0, -hw), ...P(x1, -hw), ...P(x1, hw), ...P(x0, hw)]).fill(col);
  const ferro = lvl >= 3 ? 0x6e5638 : 0x24272c;
  const len = { c: 9, n: 7.5, r: 5.5, m: 4.5, o: 7, l: 11.5, p: 6 }[type] + lvl * 0.6;
  rect(-3.2, 0.5, 2.6, 0x59401f);
  if (type === 'o') {
    for (const off of [-1.7, 0, 1.7]) {
      g.poly([...P(-1, off - 0.6), ...P(len, off - 0.55), ...P(len, off + 0.55), ...P(-1, off + 0.6)]).fill(ferro);
    }
  } else if (type === 'm') {
    const [px, py] = P(1.6, 0);
    g.circle(px, py, 2.6).fill(ferro);
    g.circle(px, py, 1.3).fill(0x0d0d0f);
  } else {
    const hw = type === 'p' ? 2.5 : type === 'r' ? 1.9 : type === 'n' ? 1.4 : type === 'l' ? 0.9 : 1.05;
    g.poly([...P(-1, -hw), ...P(len, -hw * 0.75), ...P(len, hw * 0.75), ...P(-1, hw)]).fill(ferro);
    const [mx, my] = P(len, 0);
    g.circle(mx, my, hw * 0.62).fill(0x0d0d0f);
    if (lvl >= 2) rect(len * 0.45, len * 0.45 + 0.9, hw * 0.95, lvl >= 3 ? 0x8a6f42 : 0x3a3f46);
  }
}

// Fondo a metà ponte, metà mare: i cannoni sporgono dalla murata, devono
// leggersi su entrambi.
function sfondo(w, h) {
  const g = new Graphics();
  g.rect(0, 0, w, h / 2).fill(0x9d7c4e);
  for (let y = 12; y < h / 2; y += 13) g.rect(0, y, w, 1.4).fill({ color: 0x6b4a26, alpha: 0.5 });
  g.rect(0, h / 2, w, h / 2).fill(0x1c3e55);
  return g;
}

function griglia(draw, scala, labelStyle) {
  const cell = 30 * scala;
  const cont = new Container();
  const H = TIPI.length * cell * 0.62 + 8;
  const W = (3 + 1) * cell + 120; // 3 livelli + colonna a 45°
  cont.addChild(sfondo(W, H));
  const g = new Graphics();
  TIPI.forEach(([t, nome], r) => {
    const cy = (r + 0.5) * cell * 0.62;
    for (let lvl = 1; lvl <= 3; lvl++) {
      const s = new Graphics();
      draw(s, 0, 0, 0, t, lvl);
      s.scale.set(scala);
      s.position.set(90 + (lvl - 0.5) * cell, cy);
      cont.addChild(s);
    }
    const s45 = new Graphics();
    draw(s45, 0, 0, Math.PI / 4, t, 2);
    s45.scale.set(scala);
    s45.position.set(90 + 3.5 * cell, cy);
    cont.addChild(s45);
    const label = new Text({ text: nome, style: labelStyle });
    label.position.set(6, cy - 7);
    cont.addChild(label);
  });
  cont.addChild(g);
  return cont;
}

async function main() {
  const app = new Application();
  await app.init({ width: 1440, height: 900, background: 0x101418, preference: 'webgl' });
  document.body.style.margin = '0';
  document.body.appendChild(app.canvas);

  const stile = { fontFamily: 'sans-serif', fontSize: 13, fill: 0xf0e6d2 };
  const titolo = (txt, x, y) => {
    const t = new Text({ text: txt, style: { ...stile, fontSize: 16, fontWeight: 'bold' } });
    t.position.set(x, y);
    app.stage.addChild(t);
  };

  // colonna sinistra: PRIMA e DOPO alla scala del cannocchiale (zoom 2)
  titolo('PRIMA — zoom 2', 20, 8);
  const prima = griglia(drawGunVecchio, 2, stile);
  prima.position.set(20, 32);
  app.stage.addChild(prima);

  titolo('DOPO (vettoriale) — zoom 2', 20, 452);
  const dopo = griglia(drawGunNuovo, 2, stile);
  dopo.position.set(20, 476);
  app.stage.addChild(dopo);

  // colonna destra in alto: ingrandimento di studio del fallback vettoriale
  titolo('Fallback vettoriale — ingrandimento ×4 (studio)', 620, 8);
  const studio = griglia(drawGunNuovo, 4, stile);
  studio.scale.set(0.75);
  studio.position.set(620, 32);
  app.stage.addChild(studio);

  // colonna destra in basso: le armi COTTE (posa 0 e posa a 45°) dall'atlas
  try {
    const meta = await (await fetch('assets/armi.json')).json();
    const tex = await Assets.load('assets/armi.webp');
    const frameAt = (vi, k) => new Texture({
      source: tex.source,
      frame: new Rectangle((k % meta.cols) * meta.frame, ((k / meta.cols | 0) + vi * meta.rows) * meta.frame, meta.frame, meta.frame),
    });
    titolo('DOPO (cotte, scelta della #17) — zoom 2 e posa 31 (45°)', 620, 400);
    const cont = new Container();
    cont.addChild(sfondo(3 * 90 + 90 + 120, TIPI.length * 38 + 8));
    TIPI.forEach(([t, nome], r) => {
      const cy = (r + 0.5) * 38;
      for (let lvl = 1; lvl <= 3; lvl++) {
        const vi = meta.variants[t + lvl];
        if (vi == null) continue;
        const spr = new Sprite(frameAt(vi, 0));
        spr.anchor.set(0.5);
        spr.scale.set(2 * meta.scala / meta.frame); // la scala vera di gioco, a zoom 2
        spr.position.set(90 + (lvl - 0.5) * 90, cy);
        cont.addChild(spr);
      }
      const s45 = new Sprite(frameAt(meta.variants[t + 2], 31)); // ~45° come la colonna vettoriale
      s45.anchor.set(0.5);
      s45.scale.set(2 * meta.scala / meta.frame);
      s45.position.set(90 + 3.5 * 90, cy);
      cont.addChild(s45);
      const label = new Text({ text: nome, style: stile });
      label.position.set(6, cy - 7);
      cont.addChild(label);
    });
    cont.position.set(620, 424);
    app.stage.addChild(cont);
  } catch (e) {
    console.log('LAB: atlas armi non disponibile (' + e.message + ')');
  }

  console.log('LAB-ARMI-PRONTO');
}

main().catch(e => console.log('LAB-ARMI-ERRORE: ' + e.message));
