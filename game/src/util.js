// Utilità condivise: lo stesso PRNG del server, così le isole hanno la stessa
// forma per tutti a partire dal seed che il server distribuisce.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function anglerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

export function angdiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

const NOMI = ['Barbanera', 'Corsaro Rosso', 'Olonese', 'Drake', 'Morgan', 'Grace O\'Malley', 'Calico Jack', 'Anne Bonny', 'Vento Nero', 'Squalo Bianco'];
const EPITETI = ['il Terribile', 'la Furia', 'del Tramonto', 'Mangiafuoco', 'l\'Inafferrabile', 'Tre Dita', 'il Silenzioso', 'delle Tempeste'];

export function pirateName() {
  const rng = Math.random;
  return `${NOMI[(rng() * NOMI.length) | 0]} ${EPITETI[(rng() * EPITETI.length) | 0]}`.slice(0, 18);
}
