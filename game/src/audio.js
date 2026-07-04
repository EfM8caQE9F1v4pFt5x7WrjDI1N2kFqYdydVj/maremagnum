// Effetti sonori procedurali via WebAudio: niente asset, solo fisica del rumore.
// sfx.enabled/volume sono governati dalle Impostazioni di bordo; il contesto
// audio è condiviso con la musica (music.js) tramite audioCtx().

let ctx = null;
export function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(c, seconds) {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function burst(freq, dur, gain, type = 'lowpass') {
  if (!sfx.enabled) return;
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur);
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain * sfx.volume, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

function tone(freq, dur, gain, type = 'sine', slideTo) {
  if (!sfx.enabled) return;
  const c = audioCtx();
  const o = c.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain * sfx.volume, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start(); o.stop(c.currentTime + dur);
}

// Il respiro del mare: rumore lento filtrato, con un'onda di volume che va e
// viene. Parte col primo gesto dell'utente e segue l'interruttore effetti.
let ambience = null;
function startAmbience() {
  if (ambience) return;
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 5);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 420;
  const g = c.createGain();
  g.gain.value = 0;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.11;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.012;
  lfo.connect(lfoGain).connect(g.gain);
  src.connect(f).connect(g).connect(c.destination);
  src.start(); lfo.start();
  ambience = { g };
  updateAmbience();
}
function updateAmbience() {
  if (!ambience) return;
  const target = sfx.enabled ? 0.028 * sfx.volume : 0;
  ambience.g.gain.setTargetAtTime(target, audioCtx().currentTime, 0.4);
}

export const sfx = {
  enabled: true,
  volume: 1,
  unlock() { audioCtx(); startAmbience(); },
  setEnabled(on) { sfx.enabled = on; updateAmbience(); },
  setVolume(v) { sfx.volume = v; updateAmbience(); },
  fire() { burst(420, 0.28, 0.5); tone(65, 0.22, 0.4, 'sine', 38); },
  hit() { burst(900, 0.18, 0.35, 'bandpass'); tone(110, 0.12, 0.25, 'square', 60); },
  splash() { burst(1500, 0.3, 0.2, 'highpass'); },
  thud() { tone(90, 0.15, 0.3, 'sine', 50); },
  coin() { tone(880, 0.09, 0.2, 'triangle'); setTimeout(() => tone(1320, 0.12, 0.2, 'triangle'), 70); },
  sink() { tone(60, 1.4, 0.5, 'sine', 28); burst(300, 1.1, 0.3); },
  towerdown() { burst(250, 0.7, 0.5); tone(70, 0.5, 0.4, 'sine', 35); },
  boom() { burst(180, 0.6, 0.55); tone(50, 0.5, 0.5, 'sine', 30); },
  beam() { tone(1800, 0.3, 0.06, 'sawtooth', 900); },
  dock() { tone(392, 0.15, 0.18, 'triangle'); setTimeout(() => tone(523, 0.2, 0.18, 'triangle'), 130); },
};
