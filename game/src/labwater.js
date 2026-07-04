// Laboratorio di sviluppo: renderizza SOLO la mesh dell'acqua con Pixi e
// stampa ogni diagnostica utile (versione WebGL, errori GL, sorgenti
// preprocessati, compile/link raw).

import { Application } from 'pixi.js';
import { Water } from './water.js';

async function main() {
  const app = new Application();
  await app.init({ width: 640, height: 400, background: 0x101010, preference: 'webgl' });
  document.body.appendChild(app.canvas);
  console.log('LAB renderer: ' + app.renderer.name + ' / ' + app.renderer.constructor.name + ' / gl=' + typeof app.renderer.gl);

  const w = new Water();
  app.stage.addChild(w.mesh);
  w.update(0.016, 0, 0, 640, 400, null);

  // un render esplicito, poi leggo l'errore GL
  app.render();
  const glp = app.renderer.gl;
  console.log('LAB glGetError dopo il render: ' + glp.getError());

  // compile/link raw degli stessi sorgenti preprocessati da Pixi
  const prog = w.mesh.shader.glProgram;
  const cnv = document.createElement('canvas');
  const gl = cnv.getContext('webgl2') || cnv.getContext('webgl');
  console.log('LAB contesto raw: ' + (gl.getParameter(gl.VERSION)));
  const comp = (type, src, label) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    const ok = gl.getShaderParameter(s, gl.COMPILE_STATUS);
    console.log(`LAB ${label}: ${ok ? 'OK' : 'FALLITO'} ${gl.getShaderInfoLog(s) || ''}`);
    if (!ok) console.log('LAB sorgente:\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
    return s;
  };
  const vs = comp(gl.VERTEX_SHADER, prog.vertex, 'vertex');
  const fs = comp(gl.FRAGMENT_SHADER, prog.fragment, 'fragment');
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  console.log(`LAB link: ${gl.getProgramParameter(p, gl.LINK_STATUS) ? 'OK' : 'FALLITO'} ${gl.getProgramInfoLog(p) || ''}`);

  app.ticker.add((t) => w.update(t.deltaMS / 1000, 0, 0, 640, 400, null));
  console.log('LAB pixi avviato');
}

main().catch(e => console.log('LAB ERRORE: ' + e.message + '\n' + e.stack));
