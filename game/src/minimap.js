// Minimappa in stile pergamena: il mondo intero in un palmo di mano.

import { mulberry32 } from './util.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.bg.width = canvas.width; this.bg.height = canvas.height;
    this.drawParchment(this.bg.getContext('2d'));
  }

  drawParchment(g) {
    const W = this.bg.width, H = this.bg.height;
    const rng = mulberry32(99);
    g.fillStyle = '#e3cf9e'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 350; i++) {
      g.fillStyle = `rgba(120,90,40,${0.02 + rng() * 0.05})`;
      g.fillRect(rng() * W, rng() * H, 1.5, 1.5);
    }
    g.strokeStyle = '#6d4c22'; g.lineWidth = 3; g.strokeRect(4, 4, W - 8, H - 8);
    g.lineWidth = 1; g.strokeRect(9, 9, W - 18, H - 18);
    // mare interno leggermente più chiaro della carta
    g.fillStyle = 'rgba(122,166,196,0.35)'; g.fillRect(10, 10, W - 20, H - 20);
  }

  update({ world, islands, ships, selfId, dest, notte, burrasche }) {
    if (!world) return;
    const g = this.g, W = this.canvas.width, H = this.canvas.height;
    g.clearRect(0, 0, W, H);
    g.drawImage(this.bg, 0, 0);
    const pad = 12;
    const s = Math.min((W - pad * 2) / world.W, (H - pad * 2) / world.H);
    const px = (x) => pad + x * s, py = (y) => pad + y * s;

    // le burrasche vaganti (fetta 5): il cielo si vede anche da lontano
    for (const b of burrasche || []) {
      g.beginPath();
      g.arc(px(b.x), py(b.y), Math.max(4, b.r * s), 0, Math.PI * 2);
      g.fillStyle = 'rgba(70,90,110,0.35)';
      g.fill();
    }

    for (const i of islands.values()) {
      g.beginPath();
      g.arc(px(i.x), py(i.y), Math.max(2.5, i.r * s * 1.6), 0, Math.PI * 2);
      g.fillStyle = i.fortress ? '#8a4a3a' : (i.kind === 'porto' ? '#c8963c' : i.kind === 'oracolo' ? '#e0d6b5' : '#6f9e5c');
      g.fill();
      g.strokeStyle = 'rgba(60,40,15,0.6)'; g.lineWidth = 1; g.stroke();
    }
    if (dest) {
      g.strokeStyle = '#a1261a'; g.lineWidth = 2.5; g.lineCap = 'round';
      const x = px(dest.x), y = py(dest.y);
      g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5);
      g.moveTo(x + 5, y - 5); g.lineTo(x - 5, y + 5); g.stroke();
    }
    const me = ships.find(sh => sh.id === selfId);
    for (const ship of ships) {
      if (ship.sunk || ship.docked) continue;
      // la notte tattica (fetta 5): di notte la minimappa vede solo vicino —
      // le vele altrui oltre le 900 leghe si perdono nel buio
      if (notte && me && ship.id !== selfId && Math.hypot(ship.x - me.x, ship.y - me.y) > 900) continue;
      const x = px(ship.x), y = py(ship.y);
      if (ship.id === selfId) {
        g.save(); g.translate(x, y); g.rotate(ship.rot);
        g.fillStyle = '#1c4d18';
        g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, -4); g.lineTo(-4, 4); g.closePath(); g.fill();
        g.restore();
      } else {
        g.fillStyle = ship.npc ? 'rgba(70,80,90,0.8)' : '#9e1f12';
        g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill();
      }
    }
  }
}
