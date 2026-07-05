// L'arsenale a vista: cannoni degni di questo nome (issue #17).
// Disegno vettoriale in pianta con luce ZENITALE: il colmo chiaro corre
// lungo l'asse della canna, così la luce non "gira" quando la nave vira
// (una luce da NW ruoterebbe con l'affusto e tradirebbe il trucco).
// Ogni bocca da fuoco ha la sua sagoma: colubrina slanciata, cannone da
// marina, carronata su slitta, mortaio a pentola, organo a tre canne,
// colubrina lunga a spillo, carronata pesante a botte.

// Ferro brunito leggibile per i pezzi comuni; il livello 3 è di bronzo
// caldo, la promozione si vede da lontano. Legno dell'affusto dalla
// palette TINTA del bake (estetica Monkey Island).
const FERRO = { fusto: 0x424a54, scuro: 0x242930, colmo: 0x717c88, anello: 0x2c3239 };
const BRONZO = { fusto: 0x94722f, scuro: 0x5b431b, colmo: 0xd7ae52, anello: 0x74581e };
const LEGNO = { piano: 0x77522c, fianco: 0x44301a, ruota: 0x2c1d0e, mozzo: 0x8a6f42 };
const BOCCA = 0x0d0d0f;

export function drawGun(g, cx, cy, dir, type, lvl) {
  const cos = Math.cos(dir), sin = Math.sin(dir);
  const P = (x, y) => [cx + x * cos - y * sin, cy + x * sin + y * cos];
  // fascia rastremata centrata sull'asse (x0,±w0 → x1,±w1)
  const quad = (x0, w0, x1, w1, col) =>
    g.poly([...P(x0, -w0), ...P(x1, -w1), ...P(x1, w1), ...P(x0, w0)]).fill(col);
  const pal = lvl >= 3 ? BRONZO : FERRO;

  // canna da marina: sagoma scura, corpo, colmo zenitale, gioia di volata,
  // bocca e pomo di culatta; gli anelli di rinforzo arrivano col livello 2
  const canna = (x0, x1, w0, w1) => {
    quad(x0, w0, x1, w1, pal.scuro);
    quad(x0, w0 * 0.74, x1, w1 * 0.74, pal.fusto);
    quad(x0, w0 * 0.30, x1, w1 * 0.30, pal.colmo);
    quad(x1 - 0.15, w1 * 1.06, x1 + 1.0, w1 * 1.32, pal.scuro);       // gioia
    quad(x1 - 0.05, w1 * 0.72, x1 + 0.85, w1 * 0.95, pal.fusto);
    if (lvl >= 2) for (const f of [0.32, 0.58]) {
      const x = x0 + (x1 - x0) * f, w = w0 + (w1 - w0) * f;
      quad(x - 0.32, w * 1.10, x + 0.32, w * 1.10, pal.anello);
    }
    const [bx, by] = P(x1 + 0.95, 0);
    g.circle(bx, by, Math.max(0.55, w1 * 0.60)).fill(BOCCA);           // bocca
    const [px, py] = P(x0 - 0.55, 0);
    g.circle(px, py, w0 * 0.55).fill(pal.scuro);                       // pomo
    g.circle(px, py, w0 * 0.28).fill(pal.colmo);
  };

  // carriola da marina: ceppi scuri, piano in legno, quattro ruote
  const carriola = (x0, x1, w) => {
    quad(x0, w, x1, w * 0.82, LEGNO.fianco);
    quad(x0 + 0.3, w * 0.62, x1 - 0.2, w * 0.50, LEGNO.piano);
    for (const [wx, f] of [[x0 + 0.7, 1], [x1 - 0.7, 0.82]]) for (const s of [-1, 1]) {
      const [rx, ry] = P(wx, s * (w * f + 0.35));
      g.circle(rx, ry, 1.0).fill(LEGNO.ruota);
      g.circle(rx, ry, 0.4).fill(LEGNO.mozzo);
    }
  };

  // slitta della carronata: letto massiccio senza ruote, perno di brandeggio
  const slitta = (x0, x1, w) => {
    quad(x0, w, x1, w * 0.9, LEGNO.fianco);
    quad(x0 + 0.35, w * 0.66, x1 - 0.25, w * 0.56, LEGNO.piano);
    const [px, py] = P((x0 + x1) / 2, 0);
    g.circle(px, py, 0.5).fill(LEGNO.ruota);
  };

  const L = { c: 9.6, n: 8.6, r: 6.2, m: 4.5, o: 8.2, l: 12.6, p: 6.8 }[type] + lvl * 0.6;

  if (type === 'o') {
    // Organo di Da Vinci: telaio largo, tre canne sottili, traversa in volata
    carriola(-3.4, 1.4, 3.1);
    for (const off of [-1.85, 0, 1.85]) {
      g.poly([...P(-1.2, off - 0.62), ...P(L, off - 0.5), ...P(L, off + 0.5), ...P(-1.2, off + 0.62)]).fill(pal.scuro);
      g.poly([...P(-1.2, off - 0.28), ...P(L, off - 0.22), ...P(L, off + 0.22), ...P(-1.2, off + 0.28)]).fill(pal.colmo);
      const [bx, by] = P(L + 0.3, off);
      g.circle(bx, by, 0.42).fill(BOCCA);
    }
    quad(L - 1.6, 2.6, L - 0.9, 2.6, LEGNO.fianco); // traversa che lega le canne
  } else if (type === 'm') {
    // mortaio: letto quadrato, pentola panciuta con la bocca verso il cielo
    quad(-2.6, 2.7, 2.9, 2.7, LEGNO.fianco);
    quad(-2.2, 2.05, 2.5, 2.05, LEGNO.piano);
    const [px, py] = P(1.2, 0);
    g.circle(px, py, 2.55).fill(pal.scuro);
    g.circle(px, py, 2.1).fill(pal.fusto);
    if (lvl >= 2) g.circle(px, py, 1.75).fill(pal.anello);
    g.circle(px, py, 1.35).fill(BOCCA);
    const [hx, hy] = P(0.5, 0); // riflesso zenitale sul bordo della pentola
    g.circle(hx, hy, 0.4).fill(pal.colmo);
  } else if (type === 'r' || type === 'p') {
    // carronata (e sorella pesante): tozza, su slitta, bocca che mangia
    const w0 = type === 'p' ? 2.5 : 2.0, w1 = type === 'p' ? 2.2 : 1.7;
    slitta(-3.0, 1.8, w0 + 0.6);
    if (type === 'p') { // la pesante è una botte: pancia al centro
      quad(-1.2, w0 * 0.92, L * 0.45, w0 * 1.08, pal.scuro);
      quad(-1.2, w0 * 0.66, L * 0.45, w0 * 0.80, pal.fusto);
    }
    canna(-1.2, L, w0, w1);
  } else {
    // colubrina 'c', cannone 'n', colubrina lunga 'l': carriola + canna
    const w0 = { c: 1.25, n: 1.6, l: 1.0 }[type];
    const w1 = { c: 0.85, n: 1.1, l: 0.62 }[type];
    carriola(-3.2, L * 0.38, w0 + 1.0);
    canna(-1.4, L, w0, w1);
    if (type === 'l' && lvl >= 2) { // la lunga è tutta anelli, "a spillo"
      for (const f of [0.15, 0.45, 0.75]) {
        const x = -1.4 + (L + 1.4) * f, w = w0 + (w1 - w0) * f;
        quad(x - 0.28, w * 1.12, x + 0.28, w * 1.12, pal.anello);
      }
    }
  }
}
