// L'acqua per il tier canvas (macchine senza GPU): la stessa ricetta
// pittorica dello shader, ma cotta in JavaScript dentro una texture tile
// che scorre con la camera. Si rigenera quando la luce del ciclo cambia
// abbastanza; il costo per fotogramma è un solo blit piastrellato.

import { Texture, TilingSprite } from 'pixi.js';
import { mulberry32 } from './util.js';

const N = 256;      // lato della tile in px
const PERIODO = 8;  // periodo del rumore (unità griglia) — la tile combacia

// griglie di rumore periodiche, una per ottava, generate una volta
function makeGrids() {
  const rng = mulberry32(1097);
  const grids = [];
  for (let o = 0; o < 3; o++) {
    const size = PERIODO << o;
    const g = new Float32Array(size * size);
    for (let i = 0; i < g.length; i++) g[i] = rng();
    grids.push({ size, g });
  }
  return grids;
}
const GRIDS = makeGrids();

function pnoise(grid, x, y) {
  const { size, g } = grid;
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % size) + size) % size, x1 = (x0 + 1) % size;
  const y0 = ((yi % size) + size) % size, y1 = (y0 + 1) % size;
  const a = g[y0 * size + x0], b = g[y0 * size + x1];
  const c = g[y1 * size + x0], d = g[y1 * size + x1];
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const smooth = (e0, e1, v) => {
  const k = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
};

// stessi colori dello shader (uDeep/uMid/uLite)
const DEEP = [14, 37, 53], MID = [25, 60, 82], LITE = [60, 109, 132];

export class CanvasWater {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = N;
    this.texture = Texture.from(this.canvas);
    this.sprite = new TilingSprite({ texture: this.texture, width: 800, height: 600 });
    this.sprite.tileScale.set(2); // tile "morbida": 512 px effettivi
    this.bakedKey = '';
    this.lastBake = 0;
    this.phase = 0;
  }

  get mesh() { return this.sprite; } // stessa interfaccia di Water

  bake(light) {
    const sun = light ? light.sun : [1, 0.9, 0.7];
    const warm = light ? light.warm : 0;
    const glint = light ? light.glint : 0.5;
    const ctx = this.canvas.getContext('2d');
    const img = ctx.createImageData(N, N);
    const d = img.data;
    const rng = mulberry32(7 + this.phase);
    const S0 = PERIODO / N, S1 = (PERIODO * 2) / N, S2 = (PERIODO * 4) / N;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const n = 0.5 * pnoise(GRIDS[0], x * S0, y * S0)
          + 0.3 * pnoise(GRIDS[1], x * S1, y * S1)
          + 0.2 * pnoise(GRIDS[2], x * S2, y * S2);
        // posterizzazione a pennellate (come lo shader)
        const band = n * 5;
        const q = (Math.floor(band) + smooth(0.3, 0.7, band - Math.floor(band))) / 5;
        let r, g, b;
        if (q < 0.72) {
          const k = q / 0.72;
          r = DEEP[0] + (MID[0] - DEEP[0]) * k;
          g = DEEP[1] + (MID[1] - DEEP[1]) * k;
          b = DEEP[2] + (MID[2] - DEEP[2]) * k;
        } else {
          const k = smooth(0.72, 0.95, q);
          r = MID[0] + (LITE[0] - MID[0]) * k;
          g = MID[1] + (LITE[1] - MID[1]) * k;
          b = MID[2] + (LITE[2] - MID[2]) * k;
        }
        // scintille rade sulle creste
        if (n > 0.62 && rng() > 0.9985) {
          r += sun[0] * 200 * glint; g += sun[1] * 200 * glint; b += sun[2] * 200 * glint;
        }
        // riverbero caldo sulle creste (alba/tramonto)
        const w = warm * smooth(0.45, 0.95, q) * 0.65;
        r = r * (1 - w) + sun[0] * 255 * (0.25 + q * 0.55) * w;
        g = g * (1 - w) + sun[1] * 255 * (0.25 + q * 0.55) * w;
        b = b * (1 - w) + sun[2] * 255 * (0.25 + q * 0.55) * w;
        // ambiente giorno/notte + grana
        const gr = (rng() - 0.5) * 5;
        const i = (y * N + x) * 4;
        d[i] = Math.max(0, Math.min(255, r + gr));
        d[i + 1] = Math.max(0, Math.min(255, g + gr));
        d[i + 2] = Math.max(0, Math.min(255, b + gr));
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.texture.source.update();
  }

  update(dt, camX, camY, w, h, light) {
    this.sprite.width = w;
    this.sprite.height = h;
    // scorre col mondo + una deriva lenta di corrente; col cannocchiale
    // (renderer.zoom) anche l'onda si avvicina, non solo le navi
    const z = this.zoom || 1;
    this.phaseT = (this.phaseT || 0) + dt;
    this.sprite.tileScale.set(2 * z);
    this.sprite.tilePosition.set((-camX + this.phaseT * 6) * z, (-camY + Math.sin(this.phaseT * 0.4) * 5) * z);

    // rigenera la tile quando la luce cambia abbastanza (max ~1/s)
    const key = light ? [light.warm.toFixed(2), light.glint.toFixed(2)].join('|') : 'fissa';
    const now = performance.now();
    if (key !== this.bakedKey && now - this.lastBake > 1000) {
      this.bakedKey = key;
      this.lastBake = now;
      this.phase++;
      this.bake(light);
    }
  }
}
