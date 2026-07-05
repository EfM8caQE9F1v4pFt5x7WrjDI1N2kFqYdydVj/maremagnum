// Lab del Casting (issue #16): il pirata COTTO IN 3D contro il burattino
// VETTORIALE 2D, stesse animazioni, fianco a fianco alle scale vere del
// picchiaduro (~160px) e del platform (~72px). Si sceglie GUARDANDO.

const TINTA = {
  pelle: '#c98e63', camicia: '#e8dcc0', gilet: '#5b2a22', pantaloni: '#2e4053',
  stivali: '#3a2a18', bandana: '#8a2418', cintura: '#2a1a0c', barba: '#3a2c1e',
  ombra: 'rgba(20,13,5,0.25)',
};

// gli stessi keyframe del bake 3D (assi 2D: positivo = avanti/orario)
const ANIMAZIONI = {
  idle: {
    chiavi: [
      { su: 0, torso: 0.03, testa: -0.03, spallaD: 0.1, gomitoD: 0.25, spallaS: -0.1, gomitoS: 0.2, ancaD: 0.04, ancaS: -0.04, ginD: -0.04, ginS: 0.02 },
      { su: -0.035, torso: 0.06, testa: -0.05, spallaD: 0.14, gomitoD: 0.3, spallaS: -0.13, gomitoS: 0.24, ancaD: 0.05, ancaS: -0.05, ginD: -0.05, ginS: 0.03 },
    ],
  },
  corsa: {
    chiavi: [
      { su: 0.02, torso: 0.1, testa: -0.1, spallaD: -0.9, gomitoD: 0.9, spallaS: 0.7, gomitoS: 0.5, ancaD: 0.9, ginD: -0.5, ancaS: -0.7, ginS: -0.9 },
      { su: 0.09, torso: 0.1, testa: -0.1, spallaD: 0.1, gomitoD: 0.6, spallaS: -0.1, gomitoS: 0.5, ancaD: -0.1, ginD: -1.1, ancaS: 0.15, ginS: -0.2 },
      { su: 0.02, torso: 0.1, testa: -0.1, spallaD: 0.7, gomitoD: 0.5, spallaS: -0.9, gomitoS: 0.9, ancaD: -0.7, ginD: -0.9, ancaS: 0.9, ginS: -0.5 },
      { su: 0.09, torso: 0.1, testa: -0.1, spallaD: -0.1, gomitoD: 0.5, spallaS: 0.1, gomitoS: 0.6, ancaD: 0.15, ginD: -0.2, ancaS: -0.1, ginS: -1.1 },
    ],
  },
};

const lerp = (a, b, t) => a + (b - a) * t;
function posa(anim, t) {
  const c = ANIMAZIONI[anim].chiavi;
  const idx = (t % 1) * c.length;
  const k1 = c[Math.floor(idx) % c.length], k2 = c[Math.ceil(idx) % c.length];
  const out = {};
  for (const k of new Set([...Object.keys(k1), ...Object.keys(k2)])) out[k] = lerp(k1[k] || 0, k2[k] || 0, idx % 1);
  return out;
}

// Il burattino 2D: stesse giunture, disegno a pennellate piatte con una
// mezza-ombra per il volume (luce da sinistra-alto, fissa: è side-view).
function disegnaPirata2D(g, x, y, S, k) {
  // unità: 1 = altezza pirata / 2.15 (come il modello 3D)
  const U = S / 2.15;
  g.save();
  g.translate(x, y - (1.05 + (k.su || 0)) * U); // il bacino

  const arto = (ang1, len1, spess1, col1, ang2, len2, spess2, col2, piede) => {
    g.save();
    g.rotate(ang1);
    g.fillStyle = col1;
    g.beginPath();
    g.roundRect(-spess1 / 2, 0, spess1, len1, spess1 / 2);
    g.fill();
    g.translate(0, len1);
    g.rotate(ang2);
    g.fillStyle = col2;
    g.beginPath();
    g.roundRect(-spess2 / 2, 0, spess2, len2, spess2 / 2);
    g.fill();
    if (piede) { // lo stivale punta avanti (a destra)
      g.fillStyle = TINTA.stivali;
      g.beginPath();
      g.roundRect(-spess2 / 2, len2 - 0.16 * U, 0.34 * U, 0.2 * U, 4);
      g.fill();
    } else { // la mano
      g.fillStyle = TINTA.pelle;
      g.beginPath();
      g.arc(0, len2 + 0.05 * U, 0.09 * U, 0, 7);
      g.fill();
    }
    g.restore();
  };

  // braccio e gamba DIETRO (più scuri: profondità senza contorni)
  g.save();
  g.globalAlpha = 0.75;
  g.save(); g.translate(0, 0);
  arto(k.ancaS || 0, 0.5 * U, 0.2 * U, TINTA.pantaloni, k.ginS || 0, 0.44 * U, 0.17 * U, TINTA.pantaloni, true);
  g.restore();
  g.save(); g.translate(0.02 * U, -0.95 * U);
  arto((k.spallaS || 0) + 0.1, 0.42 * U, 0.15 * U, TINTA.camicia, k.gomitoS || 0, 0.4 * U, 0.12 * U, TINTA.pelle, false);
  g.restore();
  g.restore();

  // torso (camicia + gilet + cintura), leggermente inclinato
  g.save();
  g.rotate((k.torso || 0) * 0.7);
  g.fillStyle = TINTA.camicia;
  g.beginPath(); g.roundRect(-0.2 * U, -1.02 * U, 0.46 * U, 1.06 * U, 0.12 * U); g.fill();
  g.fillStyle = TINTA.gilet;
  g.beginPath(); g.roundRect(-0.22 * U, -1.0 * U, 0.3 * U, 0.8 * U, 0.08 * U); g.fill();
  g.fillStyle = TINTA.cintura;
  g.fillRect(-0.24 * U, -0.06 * U, 0.52 * U, 0.14 * U);

  // testa grande di profilo: cranio, naso a becco, barba, bandana col nodo
  g.save();
  g.translate(0.04 * U, -1.02 * U);
  g.rotate((k.testa || 0) * 0.8);
  g.fillStyle = TINTA.pelle;
  g.beginPath(); g.roundRect(-0.22 * U, -0.56 * U, 0.5 * U, 0.52 * U, 0.14 * U); g.fill();
  g.beginPath(); g.arc(0.3 * U, -0.22 * U, 0.07 * U, 0, 7); g.fill(); // naso
  g.fillStyle = TINTA.barba;
  g.beginPath(); g.roundRect(-0.16 * U, -0.18 * U, 0.42 * U, 0.2 * U, 0.08 * U); g.fill();
  g.fillStyle = TINTA.bandana;
  g.beginPath(); g.roundRect(-0.24 * U, -0.62 * U, 0.54 * U, 0.22 * U, 0.1 * U); g.fill();
  g.beginPath(); // il nodo al vento
  g.moveTo(-0.22 * U, -0.5 * U);
  g.quadraticCurveTo(-0.44 * U, -0.42 * U, -0.4 * U, -0.24 * U);
  g.quadraticCurveTo(-0.3 * U, -0.36 * U, -0.2 * U, -0.4 * U);
  g.fill();
  g.fillStyle = '#1c1a17'; // l'occhio
  g.beginPath(); g.arc(0.16 * U, -0.34 * U, 0.035 * U, 0, 7); g.fill();
  g.restore();
  g.restore();

  // gamba e braccio DAVANTI
  arto(k.ancaD || 0, 0.5 * U, 0.21 * U, TINTA.pantaloni, k.ginD || 0, 0.44 * U, 0.18 * U, TINTA.pantaloni, true);
  g.save(); g.translate(0.02 * U, -0.95 * U);
  arto((k.spallaD || 0) - 0.05, 0.42 * U, 0.16 * U, TINTA.camicia, k.gomitoD || 0, 0.4 * U, 0.13 * U, TINTA.pelle, false);
  g.restore();

  g.restore();
}

async function main() {
  const cnv = document.createElement('canvas');
  cnv.width = 1440; cnv.height = 900;
  document.body.appendChild(cnv);
  const g = cnv.getContext('2d');

  // l'atlas del pirata cotto (prototipo, servito da dist/)
  const meta = await (await fetch('dist/pirati-proto.json')).json();
  const img = new Image();
  await new Promise((res) => { img.onload = res; img.src = 'dist/pirati-proto.webp'; });
  const frameDi = (anim, t) => {
    const a = meta.animazioni[anim];
    return a.da + Math.floor((t % 1) * a.frames) % a.frames;
  };
  const disegna3D = (anim, t, x, y, S) => {
    const f = frameDi(anim, t);
    const sx = (f % meta.cols) * meta.frame, sy = Math.floor(f / meta.cols) * meta.frame;
    // il pirata 3D è ~2.15 unità su un frustum che ne copre ~3.1: scala di conseguenza
    const px = S * (meta.frame / (meta.frame * 0.69));
    g.imageSmoothingEnabled = true;
    g.drawImage(img, sx, sy, meta.frame, meta.frame, x - px / 2, y - px * 0.97, px, px);
  };

  const t0 = performance.now();
  function frame() {
    const t = (performance.now() - t0) / 1000;
    g.fillStyle = '#22405a';
    g.fillRect(0, 0, cnv.width, cnv.height);
    g.fillStyle = '#183048';
    g.fillRect(0, 560, cnv.width, 340); // il ponte di scontro
    g.fillStyle = '#f0e6d2';
    g.font = 'bold 20px Georgia';
    g.textAlign = 'center';
    g.fillText('COTTO IN 3D (pipeline della flotta)', 400, 40);
    g.fillText('VETTORIALE 2D (burattino a pennellate)', 1040, 40);
    g.font = '15px Georgia';
    g.fillText('idle · scala picchiaduro (160px)', 400, 70);
    g.fillText('idle · scala picchiaduro (160px)', 1040, 70);
    g.fillText('corsa · picchiaduro', 400, 380);
    g.fillText('corsa · picchiaduro', 1040, 380);
    g.fillText('corsa · scala platform (72px)', 400, 700);
    g.fillText('corsa · scala platform (72px)', 1040, 700);

    disegna3D('idle', t * 0.6, 400, 330, 160);
    disegna3D('corsa', t * 1.4, 400, 640, 160);
    disegna3D('corsa', t * 1.4, 400, 850, 72);
    disegnaPirata2D(g, 1040, 330, 160, posa('idle', t * 0.6));
    disegnaPirata2D(g, 1040, 640, 160, posa('corsa', t * 1.4));
    disegnaPirata2D(g, 1040, 850, 72, posa('corsa', t * 1.4));
    requestAnimationFrame(frame);
  }
  frame();
  console.log('LAB-PIRATI-PRONTO');
}

main().catch(e => console.log('LAB-PIRATI-ERRORE: ' + e.message));
