// La bandiera di gilda è DATO, non immagine (issue #5): indici su set fissi,
// disegnata qui in canvas 2D. Niente upload, niente moderazione: ogni
// bandiera è "del mondo" per costruzione, nello spirito Monkey Island.

export const TINTE = [
  ['Nero pece', '#1c1a17'], ['Rosso sangue', '#8a2418'], ['Blu abisso', '#1e3a55'],
  ['Verde alga', '#2e5c38'], ['Oro vecchio', '#c9a23f'], ['Avorio', '#e8dcc0'],
  ['Porpora', '#5b2a52'], ['Ruggine', '#9a5b26'],
];

export const TAGLI = ['Campo pieno', 'Palo (bicolore)', 'Banda diagonale', 'Croce'];

export const EMBLEMI = ['Teschio', 'Àncora', 'Spada', 'Polpo', 'Stella', 'Giglio', 'Vela', 'Cannone'];

// disegna la bandiera (b = {fondo, taglio, tinta2, emblema, tintaEmblema})
// su un canvas 3:2; tutto vettoriale, deterministico.
export function disegnaBandiera(canvas, b) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const c1 = TINTE[b.fondo % 8][1], c2 = TINTE[b.tinta2 % 8][1], ce = TINTE[b.tintaEmblema % 8][1];
  g.clearRect(0, 0, W, H);
  g.fillStyle = c1;
  g.fillRect(0, 0, W, H);
  g.fillStyle = c2;
  switch (b.taglio % 4) {
    case 1: g.fillRect(W / 2, 0, W / 2, H); break;                       // palo
    case 2: g.beginPath(); g.moveTo(0, H); g.lineTo(W, 0); g.lineTo(W, H); g.closePath(); g.fill(); break; // banda
    case 3: { const s = Math.min(W, H) * 0.18;                            // croce
      g.fillRect(W / 2 - s / 2, 0, s, H); g.fillRect(0, H / 2 - s / 2, W, s); break; }
  }
  // l'emblema al centro, in scala col lato corto
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.30;
  g.fillStyle = ce;
  g.strokeStyle = ce;
  g.lineWidth = Math.max(2, r * 0.16);
  g.lineCap = 'round';
  switch (b.emblema % 8) {
    case 0: { // teschio
      g.beginPath(); g.arc(cx, cy - r * 0.15, r * 0.72, Math.PI, 0); // calotta
      g.rect(cx - r * 0.72, cy - r * 0.15, r * 1.44, r * 0.5); g.fill();
      g.fillRect(cx - r * 0.34, cy + r * 0.35, r * 0.68, r * 0.28); // mascella
      const prevOp = g.globalCompositeOperation;
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(cx - r * 0.3, cy - r * 0.05, r * 0.18, 0, 7); g.fill();
      g.beginPath(); g.arc(cx + r * 0.3, cy - r * 0.05, r * 0.18, 0, 7); g.fill();
      g.globalCompositeOperation = prevOp;
      break;
    }
    case 1: { // àncora
      g.beginPath(); g.arc(cx, cy - r * 0.6, r * 0.2, 0, 7); g.stroke();      // anello
      g.beginPath(); g.moveTo(cx, cy - r * 0.4); g.lineTo(cx, cy + r * 0.55); g.stroke(); // fusto
      g.beginPath(); g.moveTo(cx - r * 0.45, cy - r * 0.1); g.lineTo(cx + r * 0.45, cy - r * 0.1); g.stroke(); // traversa
      g.beginPath(); g.arc(cx, cy + r * 0.25, r * 0.55, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); // marre
      break;
    }
    case 2: { // spada
      g.beginPath(); g.moveTo(cx, cy - r * 0.85); g.lineTo(cx + r * 0.18, cy + r * 0.25);
      g.lineTo(cx, cy + r * 0.45); g.lineTo(cx - r * 0.18, cy + r * 0.25); g.closePath(); g.fill(); // lama
      g.beginPath(); g.moveTo(cx - r * 0.4, cy + r * 0.45); g.lineTo(cx + r * 0.4, cy + r * 0.45); g.stroke(); // elsa
      g.beginPath(); g.moveTo(cx, cy + r * 0.45); g.lineTo(cx, cy + r * 0.8); g.stroke(); // impugnatura
      break;
    }
    case 3: { // polpo
      g.beginPath(); g.arc(cx, cy - r * 0.25, r * 0.45, 0, 7); g.fill(); // testa
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + i * 0.45;
        g.beginPath();
        g.moveTo(cx + Math.sin(a) * r * 0.3, cy + r * 0.05);
        g.quadraticCurveTo(cx + Math.sin(a) * r * 0.9, cy + r * 0.5,
          cx + Math.sin(a) * r * 0.7, cy + r * 0.85);
        g.stroke();
      }
      break;
    }
    case 4: { // stella
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.38 : r * 0.9;
        g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath(); g.fill();
      break;
    }
    case 5: { // giglio
      for (const dx of [-r * 0.45, 0, r * 0.45]) {
        g.beginPath();
        g.moveTo(cx + dx, cy + r * 0.35);
        g.quadraticCurveTo(cx + dx - r * 0.28, cy - r * 0.25, cx + dx, cy - (dx === 0 ? r * 0.8 : r * 0.45));
        g.quadraticCurveTo(cx + dx + r * 0.28, cy - r * 0.25, cx + dx, cy + r * 0.35);
        g.fill();
      }
      g.fillRect(cx - r * 0.6, cy + r * 0.35, r * 1.2, r * 0.22);
      break;
    }
    case 6: { // vela
      g.beginPath(); g.moveTo(cx - r * 0.15, cy - r * 0.85); g.lineTo(cx - r * 0.15, cy + r * 0.5); g.stroke(); // albero
      g.beginPath(); g.moveTo(cx - r * 0.1, cy - r * 0.75);
      g.quadraticCurveTo(cx + r * 0.85, cy - r * 0.35, cx - r * 0.1, cy + r * 0.35);
      g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx - r * 0.6, cy + r * 0.6); g.quadraticCurveTo(cx, cy + r * 0.85, cx + r * 0.6, cy + r * 0.6); g.stroke(); // scafo
      break;
    }
    case 7: { // cannone
      g.beginPath(); g.moveTo(cx - r * 0.8, cy - r * 0.05); g.lineTo(cx + r * 0.55, cy - r * 0.3);
      g.lineTo(cx + r * 0.55, cy + r * 0.1); g.lineTo(cx - r * 0.8, cy + r * 0.35); g.closePath(); g.fill(); // canna
      g.beginPath(); g.arc(cx - r * 0.25, cy + r * 0.5, r * 0.28, 0, 7); g.stroke(); // ruota
      g.beginPath(); g.arc(cx + r * 0.75, cy - r * 0.55, r * 0.12, 0, 7); g.fill(); // palla in volo
      break;
    }
  }
  // l'orlo consumato dal vento
  g.strokeStyle = 'rgba(20,13,5,0.55)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, W - 2, H - 2);
}
