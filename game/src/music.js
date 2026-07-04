// La musica del Mare: generativa, via WebAudio, niente asset.
// Due temi che si danno il cambio con un crossfade morbido:
//  - "calma"     → shanty lento in re dorico, 6/8, pizzicati e fisarmonica
//  - "battaglia" → 4/4 incalzante in la frigio, tamburi e riff staccato
// Il tema attivo si sceglie con setMood(); il resto è uno scheduler con
// lookahead che compone battuta per battuta, con variazioni deterministiche.

import { audioCtx } from './audio.js';

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// piccolo rng deterministico per le variazioni (seed = numero di battuta)
function srand(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const CALM_EIGHTH = 0.225;   // 6/8 disteso
const BATTLE_SIXT = 0.106;   // ~141 bpm

// re dorico: giro Dm — F — C — Dm (bassi e accordi per battuta)
const CALM_BARS = [
  { root: 38, chord: [50, 53, 57], pool: [62, 64, 65, 69, 72, 74] },
  { root: 41, chord: [53, 57, 60], pool: [65, 69, 72, 74, 76] },
  { root: 36, chord: [48, 52, 55], pool: [64, 67, 72, 74, 76] },
  { root: 38, chord: [50, 53, 57], pool: [62, 65, 69, 74] },
];

// la frigio: riff sull'ottavo, stab su ♭II per la tensione
const BATTLE_RIFFS = [
  [45, 45, 48, 45, 43, 45, 50, 48],
  [45, 45, 48, 50, 52, 50, 48, 46],
];
const BATTLE_STABS = [[57, 60, 64], [58, 62, 65]]; // Am, B♭

class Music {
  constructor() {
    this.started = false;
    this.enabled = true;
    this.mood = 'calma';
    this.volume = 1;
    this._timer = null;
  }

  _setup() {
    const c = audioCtx();
    this.master = c.createGain();
    this.master.gain.value = (this.enabled ? 0.16 : 0) * this.volume;
    this.master.connect(c.destination);
    this.calmGain = c.createGain();
    this.battleGain = c.createGain();
    this.calmGain.gain.value = 1;
    this.battleGain.gain.value = 0;
    this.calmGain.connect(this.master);
    this.battleGain.connect(this.master);
    const t = c.currentTime + 0.1;
    this.nextCalm = t; this.calmStep = 0;
    this.nextBattle = t; this.battleStep = 0;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this._setup();
    this._timer = setInterval(() => this._tick(), 70);
  }

  setMood(mood) {
    if (!this.started || mood === this.mood) { this.mood = mood; return; }
    this.mood = mood;
    const c = audioCtx();
    const battle = mood === 'battaglia';
    // crossfade ~2.5s (costante 0.8): l'uno sfuma mentre l'altro sale
    this.calmGain.gain.setTargetAtTime(battle ? 0 : 1, c.currentTime, 0.8);
    this.battleGain.gain.setTargetAtTime(battle ? 1 : 0, c.currentTime, 0.8);
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.started) return;
    const c = audioCtx();
    this.master.gain.setTargetAtTime(on ? 0.16 * this.volume : 0, c.currentTime, 0.25);
  }

  setVolume(v) {
    this.volume = v;
    if (this.started && this.enabled) {
      this.master.gain.setTargetAtTime(0.16 * v, audioCtx().currentTime, 0.1);
    }
  }

  _tick() {
    const c = audioCtx();
    if (c.state === 'suspended') c.resume();
    const ahead = c.currentTime + 0.20;
    // se una coda è rimasta indietro (tab in pausa), riallineala
    if (this.nextCalm < c.currentTime - 1) this.nextCalm = c.currentTime + 0.05;
    if (this.nextBattle < c.currentTime - 1) this.nextBattle = c.currentTime + 0.05;
    while (this.nextCalm < ahead) {
      if (this.enabled && this.calmGain.gain.value > 0.004) this._calmStep(this.calmStep, this.nextCalm);
      this.nextCalm += CALM_EIGHTH; this.calmStep++;
    }
    while (this.nextBattle < ahead) {
      if (this.enabled && this.battleGain.gain.value > 0.004) this._battleStep(this.battleStep, this.nextBattle);
      this.nextBattle += BATTLE_SIXT; this.battleStep++;
    }
  }

  // --- strumenti ---

  _pluck(track, hz, when, dur, gain, type = 'triangle', lp = 2400) {
    const c = audioCtx();
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lp;
    const g = c.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(f).connect(g).connect(track);
    o.start(when); o.stop(when + dur + 0.05);
  }

  _pad(track, hzs, when, dur, gain) {
    const c = audioCtx();
    for (const hz of hzs) {
      for (const det of [-4, 4]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz;
        o.detune.value = det;
        const f = c.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 900;
        const g = c.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(gain, when + dur * 0.35);
        g.gain.setTargetAtTime(0, when + dur * 0.7, dur * 0.18);
        o.connect(f).connect(g).connect(track);
        o.start(when); o.stop(when + dur + 0.3);
      }
    }
  }

  _drum(track, when, kind) {
    const c = audioCtx();
    if (kind === 'kick') {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(110, when);
      o.frequency.exponentialRampToValueAtTime(38, when + 0.12);
      const g = c.createGain();
      g.gain.setValueAtTime(0.5, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
      o.connect(g).connect(track);
      o.start(when); o.stop(when + 0.25);
      return;
    }
    // rullante/tick: rumore filtrato
    const src = c.createBufferSource();
    const buf = c.createBuffer(1, c.sampleRate * 0.12, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = kind === 'snare' ? 'bandpass' : 'highpass';
    f.frequency.value = kind === 'snare' ? 1700 : 6000;
    const g = c.createGain();
    g.gain.setValueAtTime(kind === 'snare' ? 0.22 : 0.05, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + (kind === 'snare' ? 0.13 : 0.05));
    src.connect(f).connect(g).connect(track);
    src.start(when);
  }

  // --- composizione ---

  _calmStep(step, when) {
    const eighth = step % 6;          // posizione nella battuta 6/8
    const bar = (step / 6) | 0;
    const spec = CALM_BARS[bar % CALM_BARS.length];
    const rng = srand(bar * 7 + eighth);

    if (eighth === 0) {
      // basso pizzicato sul battere + fisarmonica ogni due battute
      this._pluck(this.calmGain, midiHz(spec.root), when, 0.9, 0.30, 'sine', 500);
      if (bar % 2 === 0) this._pad(this.calmGain, spec.chord.map(midiHz), when, CALM_EIGHTH * 12, 0.028);
    }
    if (eighth === 3) this._pluck(this.calmGain, midiHz(spec.root + 7), when, 0.5, 0.16, 'sine', 500);

    // melodia: flauto di gabbia di corda, frasi rade con respiri
    const density = eighth === 0 ? 0.75 : 0.42;
    if (rng() < density) {
      const pool = spec.pool;
      const note = pool[(rng() * pool.length) | 0];
      const len = (eighth >= 4 || rng() < 0.25) ? CALM_EIGHTH * 2.6 : CALM_EIGHTH * 1.2;
      this._pluck(this.calmGain, midiHz(note), when, len, 0.09, 'triangle', 2300);
    }
    // tamburello leggero
    if (eighth === 0 || eighth === 3) this._drum(this.calmGain, when, 'tick');
  }

  _battleStep(step, when) {
    const sixt = step % 16;           // posizione nella battuta 4/4
    const bar = (step / 16) | 0;
    const rng = srand(bar * 13 + sixt);
    const riff = BATTLE_RIFFS[bar % 2];

    // tamburi di guerra
    if (sixt === 0 || sixt === 6 || sixt === 8) this._drum(this.battleGain, when, 'kick');
    if (sixt === 4 || sixt === 12) this._drum(this.battleGain, when, 'snare');
    if (sixt % 2 === 0) this._drum(this.battleGain, when, 'tick');

    // riff basso staccato sugli ottavi
    if (sixt % 2 === 0) {
      const note = riff[(sixt / 2) | 0];
      this._pluck(this.battleGain, midiHz(note), when, BATTLE_SIXT * 1.7, 0.15, 'sawtooth', 750);
    }

    // stab d'accordo a inizio battuta (Am / B♭: la tensione frigia)
    if (sixt === 0 && bar % 2 === 0) {
      this._pad(this.battleGain, BATTLE_STABS[(bar / 2) % 2].map(midiHz), when, BATTLE_SIXT * 6, 0.05);
    }
    // controcanto teso ogni 4 battute
    if (sixt === 8 && bar % 4 === 2 && rng() < 0.9) {
      this._pluck(this.battleGain, midiHz(69 + (bar % 8 >= 4 ? 1 : 0)), when, BATTLE_SIXT * 8, 0.05, 'sawtooth', 1600);
    }
  }
}

export const music = new Music();
