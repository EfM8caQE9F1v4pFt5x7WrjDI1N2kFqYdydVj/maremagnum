// La musica del Mare: brani veri con licenza aperta, in crossfade fra due
// stati d'animo. Niente più sintesi: arte di chi la sa fare, attribuita.
//
//   · calma:     "Netherworld Shanty", "Bushwick Tarantella" (in rotazione)
//   · battaglia: "Stoneworld Battle"
//
// Tutti di Kevin MacLeod (incompetech.com) — Licensed under Creative Commons:
// By Attribution 3.0 — http://creativecommons.org/licenses/by/3.0/
// L'attribuzione è mostrata nelle Impostazioni di bordo e nel README.

import { audioCtx } from './audio.js';

const TRACCE = {
  calma: ['assets/musica/calma1.oga', 'assets/musica/calma2.oga'],
  battaglia: ['assets/musica/battaglia.ogg'],
};
const MASTER = 0.3;

class Music {
  constructor() {
    this.started = false;
    this.enabled = true;
    this.mood = 'calma';
    this.volume = 1;
    this.buffers = { calma: [], battaglia: [] };
    this.correnti = { calma: null, battaglia: null }; // sorgenti in esecuzione
    this.girata = { calma: 0, battaglia: 0 };         // indice di rotazione
  }

  async _setup() {
    const c = audioCtx();
    this.master = c.createGain();
    this.master.gain.value = (this.enabled ? MASTER : 0) * this.volume;
    this.master.connect(c.destination);
    this.calmGain = c.createGain();
    this.battleGain = c.createGain();
    this.calmGain.gain.value = this.mood === 'calma' ? 1 : 0;
    this.battleGain.gain.value = this.mood === 'battaglia' ? 1 : 0;
    this.calmGain.connect(this.master);
    this.battleGain.connect(this.master);

    // scarica e decodifica i brani (in ordine di urgenza: prima la calma)
    for (const mood of ['calma', 'battaglia']) {
      for (const url of TRACCE[mood]) {
        try {
          const dati = await (await fetch(url)).arrayBuffer();
          this.buffers[mood].push(await c.decodeAudioData(dati));
        } catch (e) {
          console.warn('brano non caricato:', url, e.message);
        }
      }
      if (this.buffers[mood].length) this._suona(mood);
    }
  }

  _suona(mood) {
    const c = audioCtx();
    const lista = this.buffers[mood];
    if (!lista.length) return;
    const buf = lista[this.girata[mood] % lista.length];
    this.girata[mood]++;
    const src = c.createBufferSource();
    src.buffer = buf;
    if (lista.length === 1) {
      src.loop = true; // un solo brano: gira in tondo
    } else {
      src.onended = () => { if (this.correnti[mood] === src) this._suona(mood); };
    }
    src.connect(mood === 'calma' ? this.calmGain : this.battleGain);
    src.start();
    this.correnti[mood] = src;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this._setup();
  }

  setMood(mood) {
    if (!this.started || mood === this.mood) { this.mood = mood; return; }
    this.mood = mood;
    const c = audioCtx();
    const battle = mood === 'battaglia';
    // crossfade ~2.5s: l'uno sfuma mentre l'altro monta
    this.calmGain.gain.setTargetAtTime(battle ? 0 : 1, c.currentTime, 0.8);
    this.battleGain.gain.setTargetAtTime(battle ? 1 : 0, c.currentTime, 0.8);
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.started) return;
    this.master.gain.setTargetAtTime(on ? MASTER * this.volume : 0, audioCtx().currentTime, 0.25);
  }

  setVolume(v) {
    this.volume = v;
    if (this.started && this.enabled) {
      this.master.gain.setTargetAtTime(MASTER * v, audioCtx().currentTime, 0.1);
    }
  }
}

export const music = new Music();
