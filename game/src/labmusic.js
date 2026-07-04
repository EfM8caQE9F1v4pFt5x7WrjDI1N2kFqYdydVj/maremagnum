// Laboratorio di sviluppo: la musica produce davvero suono? Misura l'energia
// RMS del master nei due temi e a musica spenta.

import { audioCtx } from './audio.js';
import { music } from './music.js';

const c = audioCtx();
const an = c.createAnalyser();
an.fftSize = 2048;
music.start();
music.master.disconnect();
music.master.connect(an);
an.connect(c.destination);

const rms = () => {
  const d = new Float32Array(an.fftSize);
  an.getFloatTimeDomainData(d);
  let s = 0;
  for (const x of d) s += x * x;
  return Math.sqrt(s / d.length);
};

setTimeout(() => console.log('LABM calma rms=' + rms().toFixed(4)), 4000);
setTimeout(() => music.setMood('battaglia'), 4500);
setTimeout(() => console.log('LABM battaglia rms=' + rms().toFixed(4)), 9500);
setTimeout(() => music.setEnabled(false), 10000);
setTimeout(() => console.log('LABM spenta rms=' + rms().toFixed(4)), 13500);
