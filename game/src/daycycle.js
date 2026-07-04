// Il ciclo del giorno sul Mare dell'Internet. È agganciato all'orologio di
// muro, così tutti i giocatori vedono la stessa ora senza sincronia di rete.
// ?ora=0..1 (parametro di sviluppo) blocca il ciclo su un istante fisso:
// 0 alba · 0.25 giorno pieno · 0.5 tramonto · 0.62 crepuscolo · 0.8 notte fonda

export const CYCLE_S = 480; // 8 minuti per giro completo

// Ogni chiave: ambient moltiplica il mondo, sun colora i riflessi, glint ne
// regola l'intensità, night guida nebbia/lanterne, cloud le ombre delle nuvole.
const KEYS = [
  { t: 0.00, ambient: [0.97, 0.85, 0.78], sun: [1.00, 0.72, 0.50], glint: 0.45, night: 0.18, fog: 0.16, cloud: 0.6, warm: 0.40 },  // alba
  { t: 0.25, ambient: [1.00, 1.00, 1.00], sun: [1.00, 0.93, 0.72], glint: 0.55, night: 0.00, fog: 0.00, cloud: 1.0, warm: 0.00 },  // giorno
  { t: 0.50, ambient: [1.04, 0.80, 0.58], sun: [1.00, 0.52, 0.26], glint: 0.95, night: 0.08, fog: 0.05, cloud: 0.7, warm: 0.85 },  // tramonto
  { t: 0.62, ambient: [0.58, 0.57, 0.70], sun: [0.90, 0.62, 0.50], glint: 0.50, night: 0.55, fog: 0.42, cloud: 0.3, warm: 0.20 },  // crepuscolo
  { t: 0.80, ambient: [0.36, 0.42, 0.58], sun: [0.72, 0.80, 0.95], glint: 0.30, night: 1.00, fog: 0.80, cloud: 0.15, warm: 0.00 }, // notte fonda
  { t: 1.00, ambient: [0.97, 0.85, 0.78], sun: [1.00, 0.72, 0.50], glint: 0.45, night: 0.18, fog: 0.16, cloud: 0.6, warm: 0.40 },  // e di nuovo alba
];

const FORCED = (() => {
  try {
    const v = new URLSearchParams(location.search).get('ora');
    return v == null ? null : Math.min(0.999, Math.max(0, parseFloat(v)));
  } catch { return null; }
})();

const smooth = (k) => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

export function lightAt(t) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (t >= KEYS[i].t && t <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const k = smooth((t - a.t) / Math.max(1e-6, b.t - a.t));
  const ambient = lerp3(a.ambient, b.ambient, k);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const tintHex =
    (Math.round(clamp01(ambient[0]) * 255) << 16) |
    (Math.round(clamp01(ambient[1]) * 255) << 8) |
    Math.round(clamp01(ambient[2]) * 255);
  return {
    t,
    ambient,
    sun: lerp3(a.sun, b.sun, k),
    glint: lerp(a.glint, b.glint, k),
    night: lerp(a.night, b.night, k),
    fog: lerp(a.fog, b.fog, k),
    cloud: lerp(a.cloud, b.cloud, k),
    warm: lerp(a.warm, b.warm, k),
    tintHex,
  };
}

export function lightNow() {
  const t = FORCED != null ? FORCED : (Date.now() / 1000 % CYCLE_S) / CYCLE_S;
  return lightAt(t);
}
