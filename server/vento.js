// Il vento che governa il Maremagnum (issue #41, prima fetta).
//
// Il vento è del MARE, non del client: uno stato solo per tutti, derivato
// deterministicamente dall'orologio di muro — come il calendario del Mastro —
// così sopravvive al sonno del DO («il mare dorme quando è vuoto») e ogni
// macchina che fa lo stesso conto vede lo stesso vento.
//
// Ogni PERIODO di 5 minuti ha il suo bersaglio (direzione + forza) semato su
// 'vento-<n>'; tra un bersaglio e il successivo si interpola con smoothstep:
// il vento RUOTA in continuo, senza scatti, e nel giro di una sessione si
// provano andature diverse. La forza non scende mai sotto FORZA_MIN: il vento
// aiuta o frena, non paralizza (lezione di Windward e Black Flag — le lagne
// dei giocatori arrivano quando il vento è illeggibile o punitivo, mai
// quando è morbido).
//
// dir è il verso in cui il vento SOFFIA: prua allineata = vento in poppa.

const campagna = require('./campagna-core');

const PERIODO_S = 300; // ogni 5 minuti un nuovo bersaglio, raggiunto per gradi
// Il morso è ASIMMETRICO (ordine del capitano, 2026-07-11): la bolina
// punisce più di quanto la poppa premi — chi va contro vento lo deve
// SENTIRE. Deroga esplicita al vecchio tetto ±20% del #11, sua decisione.
const MORSO = { poppa: 0.15, bolina: 0.25 };
const FORZA_MIN = 0.5; // mai bonaccia totale

const smooth = (k) => k * k * (3 - 2 * k);

// il bersaglio del periodo n: stesso seme → stesso vento, ovunque e per sempre
function bersaglio(n) {
  const rng = campagna.mulberry32(campagna.hashStr('vento-' + n));
  return { dir: rng() * Math.PI * 2, forza: FORZA_MIN + rng() * (1 - FORZA_MIN) };
}

// il vento all'istante tMs (millisecondi epoch), interpolato tra i bersagli
// del periodo corrente e del prossimo — l'arco più corto, mai giri interi
function ventoAl(tMs) {
  const p = tMs / (PERIODO_S * 1000);
  const n = Math.floor(p);
  const a = bersaglio(n), b = bersaglio(n + 1);
  const k = smooth(p - n);
  let dd = b.dir - a.dir;
  while (dd > Math.PI) dd -= 2 * Math.PI;
  while (dd < -Math.PI) dd += 2 * Math.PI;
  const dir = a.dir + dd * k;
  return {
    dir: (dir % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI),
    forza: a.forza + (b.forza - a.forza) * k,
  };
}

// quanto il vento spinge (o frena) una prua: curva unica per tutti i tipi
// ma ASIMMETRICA — in poppa +15%·forza, di bolina fino a −25%·forza.
// Leggibile a colpo d'occhio: poppa spinge, bolina FRENA, traverso neutro.
function fattore(vento, rot) {
  const c = Math.cos(rot - vento.dir);
  return 1 + (c >= 0 ? MORSO.poppa : MORSO.bolina) * vento.forza * c;
}

// --- le burrasche vaganti (issue #41, fetta 5) ---
//
// Due tempeste che girano il mare, deterministiche dall'orologio come il
// vento: ogni PERIODO ogni burrasca ha un approdo semato ('burrasca-k-n') e
// ci deriva con lo smoothstep — stesso conto su ogni macchina, sonno del DO
// compreso. Dentro una burrasca il vento morde a forza PIENA e le palle
// volano corte: chi ci si infila sceglie il rischio.
// dentro una burrasca si naviga peggio SEMPRE (lentezza, ordine del
// capitano): oltre al vento a forza piena e alle palle corte
const BURRASCHE = { n: 2, raggio: 550, periodoS: 240, gittata: 0.7, lentezza: 0.85 };

function approdoBurrasca(k, n) {
  const rng = campagna.mulberry32(campagna.hashStr(`burrasca-${k}-${n}`));
  return { x: 600 + rng() * 4800, y: 600 + rng() * 4800 };
}

function burrascheAl(tMs) {
  const out = [];
  for (let k = 0; k < BURRASCHE.n; k++) {
    // fase sfalsata per burrasca: non si muovono all'unisono
    const p = tMs / (BURRASCHE.periodoS * 1000) + k * 0.37;
    const n = Math.floor(p);
    const a = approdoBurrasca(k, n), b = approdoBurrasca(k, n + 1);
    const s = smooth(p - n);
    out.push({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, r: BURRASCHE.raggio });
  }
  return out;
}

const inBurrasca = (burrasche, x, y) =>
  burrasche.some(b => Math.hypot(x - b.x, y - b.y) < b.r);

// VENTO_FISSO="dir,forza" e BURRASCA_FISSA="x,y,r" (solo sviluppo/test, via
// env del server Node — il Worker non ha process.env e naviga sempre col
// meteo vero): inchiodano il meteo per collaudi riproducibili.
const FISSO = (() => {
  try {
    const v = typeof process !== 'undefined' && process.env && process.env.VENTO_FISSO;
    if (!v) return null;
    const [dir, forza] = String(v).split(',').map(Number);
    return { dir: dir || 0, forza: Number.isFinite(forza) ? forza : 1 };
  } catch { return null; }
})();
const BURRASCA_FISSA = (() => {
  try {
    const v = typeof process !== 'undefined' && process.env && process.env.BURRASCA_FISSA;
    if (!v) return null;
    const [x, y, r] = String(v).split(',').map(Number);
    return [{ x: x || 3000, y: y || 3000, r: r || BURRASCHE.raggio }];
  } catch { return null; }
})();

module.exports = {
  PERIODO_S, MORSO, FORZA_MIN, FISSO, bersaglio, ventoAl, fattore,
  BURRASCHE, BURRASCA_FISSA, burrascheAl, inBurrasca,
};
