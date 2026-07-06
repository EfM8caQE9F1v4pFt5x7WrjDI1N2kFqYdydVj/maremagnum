// La mappa del tesoro: ogni rotta tracciata genera una pergamena in stile
// cartografia piratesca (macchie, bordi bruciati, rosa dei venti, mostri marini).

import { mulberry32 } from './util.js';
import { PAL } from './palette.js';

export function drawTreasureMap(canvas, { from, island, fortress }) {
  const W = canvas.width, H = canvas.height;
  const g = canvas.getContext('2d');
  const rng = mulberry32((island.seed ^ 0x5eabed) >>> 0);

  // pergamena
  g.fillStyle = '#e7d3a1';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(120,90,40,${0.02 + rng() * 0.05})`;
    g.fillRect(rng() * W, rng() * H, 1 + rng() * 2, 1 + rng() * 2);
  }
  for (let i = 0; i < 7; i++) { // macchie d'età
    const x = rng() * W, y = rng() * H, r = 30 + rng() * 90;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(160,120,60,0.16)');
    grad.addColorStop(1, 'rgba(160,120,60,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) { // angoli bruciati
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, 130);
    grad.addColorStop(0, 'rgba(70,40,15,0.5)');
    grad.addColorStop(1, 'rgba(70,40,15,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, 130, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = PAL.edge; g.lineWidth = 3;
  g.strokeRect(14, 14, W - 28, H - 28);
  g.lineWidth = 1;
  g.strokeRect(22, 22, W - 44, H - 44);
  // le borchie d'ottone del cartiglio, come sui pannelli (issue #32)
  g.fillStyle = PAL['gold-deep'];
  for (const [bx, by] of [[28, 28], [W - 28, 28], [28, H - 28], [W - 28, H - 28]]) {
    g.beginPath(); g.arc(bx, by, 3.2, 0, Math.PI * 2); g.fill();
  }

  // titolo
  g.fillStyle = '#4a3010';
  g.textAlign = 'center';
  g.font = `600 ${Math.round(W / 26)}px Atkinson Hyperlegible Next, sans-serif`;
  g.fillText(`Rotta per ${island.name}`, W / 2, 62);
  const leghe = Math.max(1, Math.round(Math.hypot(island.x - from.x, island.y - from.y) / 100));
  g.font = `italic ${Math.round(W / 50)}px Atkinson Hyperlegible Next, sans-serif`;
  g.fillText(`≈ ${leghe} leghe di mare aperto`, W / 2, 92);

  // geometria del viaggio proiettata sulla pergamena
  const m = 110;
  const dx = island.x - from.x, dy = island.y - from.y;
  const flip = dx < 0;
  const sx = flip ? W - m : m, sy = H * 0.62 + (dy < 0 ? 60 : -40);
  const ex = flip ? m + 40 : W - m - 40, ey = H * 0.42 + (dy < 0 ? -30 : 50);

  // rotta tratteggiata con panciata da corsaro
  const bulge = (rng() - 0.5) * 160;
  const mx = (sx + ex) / 2 - (ey - sy) * 0.3 + bulge * 0.3;
  const my = (sy + ey) / 2 + (ex - sx) * 0.18;
  g.setLineDash([9, 8]);
  g.strokeStyle = '#8a2f1d'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
  g.setLineDash([]);

  // punto di partenza: il tuo vascello
  g.save(); g.translate(sx, sy);
  g.fillStyle = '#4a3010';
  g.beginPath(); g.moveTo(-14, 4); g.lineTo(14, 4); g.lineTo(8, 10); g.lineTo(-8, 10); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, 4); g.lineTo(0, -14); g.lineTo(10, -4); g.closePath(); g.fill();
  g.font = 'italic 15px Atkinson Hyperlegible Next, sans-serif'; g.textAlign = 'center';
  g.fillText('Tu sei qui', 0, 30);
  g.restore();

  // isola di destinazione: schizzo a inchiostro
  g.save(); g.translate(ex, ey);
  g.strokeStyle = '#4a3010'; g.lineWidth = 2.5;
  g.beginPath();
  const pts = 14;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const r = 42 * (0.7 + rng() * 0.5);
    const x = Math.cos(a) * r * 1.3, y = Math.sin(a) * r * 0.85;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath(); g.stroke();
  g.fillStyle = 'rgba(140,110,60,0.25)'; g.fill();
  if (island.fortress || fortress) {
    for (let t = 0; t < 3; t++) { // torri minacciose
      const tx = -26 + t * 26;
      g.strokeRect(tx - 6, -30, 12, 22);
      g.beginPath(); g.moveTo(tx - 8, -30); g.lineTo(tx, -40); g.lineTo(tx + 8, -30); g.stroke();
    }
  } else {
    g.beginPath(); g.moveTo(-8, -8); g.quadraticCurveTo(-4, -30, 6, -34); g.stroke(); // palma
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI / 2 + (f - 2) * 0.5;
      g.beginPath(); g.moveTo(6, -34); g.quadraticCurveTo(6 + Math.cos(a) * 16, -34 + Math.sin(a) * 10, 6 + Math.cos(a) * 24, -34 + Math.sin(a) * 16 + 6); g.stroke();
    }
  }
  // la X segna il punto
  g.strokeStyle = '#a1261a'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-12, -12); g.lineTo(12, 12); g.moveTo(12, -12); g.lineTo(-12, 12); g.stroke();
  g.restore();

  if (island.fortress) {
    g.fillStyle = '#a1261a';
    g.font = `bold ${Math.round(W / 42)}px Atkinson Hyperlegible Next, sans-serif`;
    g.textAlign = 'center';
    g.fillText('⚠ Acque sorvegliate dalla Fortezza Proibita ⚠', W / 2, H - 44);
  }

  // rosa dei venti
  drawCompass(g, W - 92, H - 96, 52, rng);

  // mostro marino
  const mxr = W * (0.25 + rng() * 0.2), myr = H * (0.72 + rng() * 0.12);
  g.strokeStyle = 'rgba(74,48,16,0.55)'; g.lineWidth = 2.5;
  for (let s = 0; s < 3; s++) {
    g.beginPath(); g.arc(mxr + s * 26, myr, 12, Math.PI * 1.05, Math.PI * 1.95, s % 2 === 1);
    g.stroke();
  }
  g.beginPath(); g.arc(mxr - 16, myr - 8, 7, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(74,48,16,0.55)';
  g.beginPath(); g.arc(mxr - 18, myr - 10, 1.6, 0, Math.PI * 2); g.fill();

  g.font = `italic ${Math.round(W / 44)}px Atkinson Hyperlegible Next, sans-serif`;
  g.fillStyle = 'rgba(74,48,16,0.5)';
  g.textAlign = 'left';
  g.fillText('Hic Sunt Dracones', 40, H - 44);
}

function drawCompass(g, x, y, r, rng) {
  g.save(); g.translate(x, y);
  g.strokeStyle = '#4a3010'; g.fillStyle = '#4a3010'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(0, 0, r * 0.55, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.18, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const L = i % 2 === 0 ? r : r * 0.55;
    g.beginPath();
    g.moveTo(Math.cos(a) * L, Math.sin(a) * L);
    g.lineTo(Math.cos(a + 0.32) * r * 0.16, Math.sin(a + 0.32) * r * 0.16);
    g.lineTo(Math.cos(a - 0.32) * r * 0.16, Math.sin(a - 0.32) * r * 0.16);
    g.closePath();
    i % 2 === 0 ? g.fill() : g.stroke();
  }
  g.font = 'bold 14px Atkinson Hyperlegible Next, sans-serif'; g.textAlign = 'center';
  g.fillText('N', 0, -r - 6);
  g.fillText('S', 0, r + 16);
  g.fillText('E', r + 12, 5);
  g.fillText('O', -r - 12, 5);
  g.restore();
}
