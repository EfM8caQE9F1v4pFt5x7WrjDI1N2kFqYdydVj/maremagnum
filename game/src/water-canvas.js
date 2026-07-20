// L'acqua per il tier canvas (macchine senza GPU): la stessa ricetta
// pittorica dello shader, ma cotta in JavaScript dentro una texture tile
// che scorre con la camera. Si rigenera quando la luce del ciclo cambia
// abbastanza; il costo per fotogramma è un solo blit piastrellato.

import { Texture, TilingSprite } from 'pixi.js';
import { mulberry32 } from './util.js';
import { CANVAS } from './palette.js';

const N = 288;      // lato della tile in px
const PASSO_X = 32;
const PASSO_Y = 24; // reticolo triangolare sfalsato: nessun quadrato leggibile

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
const DEEP = rgb(CANVAS.sea), MID = rgb(CANVAS.seaMid), LITE = rgb(CANVAS.seaLight);
const FOAM = CANVAS.foam;
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const css = (c) => `rgb(${c.map(v => Math.max(0, Math.min(255, Math.round(v)))).join(',')})`;

export class CanvasWater {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = N;
    this.texture = Texture.from(this.canvas);
    this.sprite = new TilingSprite({ texture: this.texture, width: 800, height: 600 });
    this.sprite.tileScale.set(2); // tile "morbida": 512 px effettivi
    this.bakedKey = '';
    this.lastBake = 0;
  }

  get mesh() { return this.sprite; } // stessa interfaccia di Water

  bake(light) {
    const sun = light ? light.sun : [1, 0.9, 0.7];
    const warm = light ? light.warm : 0;
    const glint = light ? light.glint : 0.5;
    const ctx = this.canvas.getContext('2d');
    const sole = sun.map(v => v * 255);
    const scalda = (base, luce) => mix(base, sole, warm * luce * 0.28);
    const toni = [scalda(mix(DEEP, MID, 0.22), 0.15), scalda(mix(DEEP, MID, 0.40), 0.28),
      scalda(mix(DEEP, MID, 0.58), 0.42), scalda(mix(MID, LITE, 0.24), 0.68)];

    ctx.clearRect(0, 0, N, N);
    ctx.fillStyle = css(toni[0]);
    ctx.fillRect(0, 0, N, N);

    // Il mare è un piano sfaccettato su file SFALSATE. Nessuna coppia di
    // triangoli ricompone un quadrato: si legge una superficie intagliata,
    // non una texture a scacchiera.
    const rng = mulberry32(1097);
    const tri = (pts) => {
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath(); ctx.fillStyle = css(toni[Math.min(3, (rng() * 4) | 0)]); ctx.fill();
    };
    const righe = N / PASSO_Y, colonne = N / PASSO_X;
    const punto = (row, col) => {
      const rr = ((row % righe) + righe) % righe;
      const cc = ((col % colonne) + colonne) % colonne;
      const jr = mulberry32(7001 + rr * 131 + cc * 977);
      const jx = (jr() - 0.5) * 9;
      const jy = (row === 0 || row === righe) ? 0 : (jr() - 0.5) * 7;
      return [col * PASSO_X + (row & 1) * PASSO_X / 2 + jx, row * PASSO_Y + jy];
    };
    for (let row = 0; row < righe; row++) {
      for (let col = -1; col <= colonne; col++) {
        const a0 = punto(row, col), a1 = punto(row, col + 1);
        const b0 = punto(row + 1, col), b1 = punto(row + 1, col + 1);
        if (((row + 1) & 1) > (row & 1)) {
          tri([...a0, ...a1, ...b0]);
          tri([...a1, ...b0, ...b1]);
        } else {
          tri([...a0, ...a1, ...b1]);
          tri([...a0, ...b1, ...b0]);
        }
      }
    }

    // Poche creste disegnate, tutte nella stessa famiglia di direzioni. La
    // luce le scalda ma non le trasforma in scintillio fotografico.
    const waves = mulberry32(73);
    ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x = waves() * N, y = waves() * N;
      const len = 8 + waves() * 16;
      ctx.beginPath();
      ctx.moveTo(x - len * 0.5, y + 3);
      ctx.quadraticCurveTo(x, y - 3 - waves() * 3, x + len * 0.5, y);
      ctx.strokeStyle = FOAM;
      ctx.globalAlpha = 0.08 + glint * 0.09;
      ctx.lineWidth = waves() > 0.78 ? 1.6 : 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.texture.source.update();
  }

  update(dt, camX, camY, w, h, light) {
    this.sprite.width = w;
    this.sprite.height = h;
    // scorre col mondo + una deriva di corrente; col cannocchiale
    // (renderer.zoom) anche l'onda si avvicina, non solo le navi.
    // La deriva segue il vento del mare (issue #41): stessa direzione per
    // tutti, passo con la forza — senza vento resta il vecchio andare a est.
    const z = this.zoom || 1;
    this.phaseT = (this.phaseT || 0) + dt;
    const vDir = this.vento ? this.vento.dir : 0;
    const vPasso = this.vento ? 3 + 9 * this.vento.forza : 6;
    this.driftX = (this.driftX || 0) + Math.cos(vDir) * vPasso * dt;
    this.driftY = (this.driftY || 0) + Math.sin(vDir) * vPasso * dt;
    this.sprite.tileScale.set(2 * z);
    this.sprite.tilePosition.set((-camX + this.driftX) * z, (-camY + this.driftY + Math.sin(this.phaseT * 0.4) * 5) * z);

    // rigenera la tile quando la luce cambia abbastanza (max ~1/s)
    const key = light ? [light.warm.toFixed(2), light.glint.toFixed(2)].join('|') : 'fissa';
    const now = performance.now();
    if (key !== this.bakedKey && now - this.lastBake > 1000) {
      this.bakedKey = key;
      this.lastBake = now;
      this.bake(light);
    }
  }
}
