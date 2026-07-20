// L'acqua del Mare dell'Internet: un unico quad a schermo intero con shader
// GLSL. Ricetta ispirata a DREDGE: onde semplici (rumore stratificato), colore
// che fa l'atmosfera, pennellate posterizzate invece di gradienti fotorealisti.
// Le uniform di sole/ambiente sono pilotate dal ciclo giorno/notte.

import { Geometry, Mesh, Shader, UniformGroup } from 'pixi.js';
import { COL } from './palette.js';

const rgb01 = (n) => new Float32Array([(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]);

const VERT = /* glsl */`
  in vec2 aPosition;
  in vec2 aUV;

  out vec2 vUV;

  uniform mat3 uProjectionMatrix;
  uniform mat3 uWorldTransformMatrix;
  uniform mat3 uTransformMatrix;

  void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vUV = aUV;
  }
`;

// GLSL ES 1.00 "universale": Pixi lo adatta via #define sia a WebGL1 che a
// WebGL2 (niente #version, niente dFdx/dFdy: i riflessi usano differenze
// finite). Il fallback software di alcuni ambienti offre solo WebGL1.
const FRAG = /* glsl */`
  precision highp float;

  in vec2 vUV;
  out vec4 finalColor;

  uniform float uTime;
  uniform float uZoom;    // cannocchiale: 1 = mare aperto, 2 = abbordaggio
  uniform vec2 uCam;      // angolo in alto a sinistra della camera, in coordinate mondo
  uniform vec2 uScreen;   // dimensioni dello schermo in px
  uniform vec3 uDeep;     // colore d'abisso
  uniform vec3 uMid;      // colore medio
  uniform vec3 uLite;     // creste illuminate
  uniform vec3 uSunCol;   // colore della luce solare/lunare
  uniform vec3 uAmbient;  // moltiplicatore ambiente (giorno/notte)
  uniform float uGlint;   // intensità dei riflessi
  uniform float uWarmth;  // riverbero del sole basso (alba/tramonto)
  uniform float uCheap;   // 1 = percorso magro per renderer software

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.31, 11.7); a *= 0.5; }
    return v;
  }

  float fbm3(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.31, 11.7); a *= 0.5; }
    return v;
  }

  void main() {
    vec2 world = uCam + vUV * uScreen / uZoom;
    float t = uTime;

    // Diorama: triangoli larghi e PIATTI. La varietà vive nelle facce, non in
    // rumore per-pixel; il mare sembra intagliato nello stesso materiale delle
    // isole e resta stabile mentre la camera si muove.
    const float facetSize = 42.0;
    // Reticolo obliquo: il taglio triangolare non ricompone mai una griglia
    // di quadrati allineata allo schermo.
    vec2 lattice = vec2(world.x / facetSize - world.y / (facetSize * 1.72),
      world.y / (facetSize * 0.86));
    lattice += vec2(vnoise(world * 0.006 + 4.0), vnoise(world * 0.006 - 9.0) - 0.5) * 0.16;
    vec2 cell = floor(lattice);
    vec2 local = fract(lattice);
    float halfFace = step(1.0, local.x + local.y);
    float facet = hash(cell + vec2(halfFace * 19.7, halfFace * 7.3));
    float q = floor(facet * 4.0) / 3.0;
    vec3 col = mix(uDeep, uMid, 0.22 + q * 0.42);
    col = mix(col, uLite, max(0.0, q - 0.78) * 0.32);

    // Una seconda scala larga suggerisce profondità, ma resta tanto lieve da
    // non disegnare quadrati sopra la tassellazione triangolare.
    float depth = vnoise(world * 0.0014 + 31.0);
    col *= 0.94 + depth * 0.08;

    // Bande direzionali corte: una cresta disegnata, poi vuoto. Il cheap path
    // ne usa meno, ma non cambia linguaggio.
    float phase = dot(world, vec2(0.030, 0.012)) - t * 0.65;
    float ridge = 1.0 - smoothstep(0.0, 0.13, abs(sin(phase)));
    float broken = smoothstep(uCheap > 0.5 ? 0.84 : 0.72, 0.96,
      vnoise(floor(world / 24.0) * vec2(0.7, 1.3) + 9.0));
    float crest = ridge * broken;
    col = mix(col, uLite + uSunCol * 0.16, crest * (0.12 + uGlint * 0.22));

    // Il sole basso tocca soprattutto le facce chiare; nessuna grana casuale.
    col = mix(col, uSunCol * (0.26 + q * 0.52), uWarmth * q * 0.42);
    col *= uAmbient;

    finalColor = vec4(col, 1.0);
  }
`;

export class Water {
  constructor(cheap = false) {
    this.uniforms = new UniformGroup({
      uCheap: { value: cheap ? 1 : 0, type: 'f32' },
      uTime: { value: 0, type: 'f32' },
      uZoom: { value: 1, type: 'f32' },
      uCam: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
      uScreen: { value: new Float32Array([1440, 900]), type: 'vec2<f32>' },
      uDeep: { value: rgb01(COL.sea), type: 'vec3<f32>' },
      uMid: { value: rgb01(COL.seaMid), type: 'vec3<f32>' },
      uLite: { value: rgb01(COL.seaLight), type: 'vec3<f32>' },
      uSunCol: { value: new Float32Array([1.0, 0.87, 0.62]), type: 'vec3<f32>' },
      uAmbient: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
      uGlint: { value: 0.5, type: 'f32' },
      uWarmth: { value: 0, type: 'f32' },
    });

    const geometry = new Geometry({
      attributes: {
        aPosition: [0, 0, 1, 0, 1, 1, 0, 1],
        aUV: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      indexBuffer: [0, 1, 2, 0, 2, 3],
    });

    const shader = Shader.from({
      gl: { vertex: VERT, fragment: FRAG },
      resources: { waterUniforms: this.uniforms },
    });

    this.mesh = new Mesh({ geometry, shader });
  }

  // camX/camY: angolo in alto a sinistra della vista in coordinate mondo.
  // pixelW/pixelH: dimensione in px del bersaglio di disegno (se diversa da
  // w/h l'acqua viene disegnata più piccola e poi riscalata dal chiamante).
  update(dt, camX, camY, w, h, light, pixelW = w, pixelH = h) {
    const u = this.uniforms.uniforms;
    u.uTime += dt;
    u.uZoom = this.zoom || 1;
    u.uCam[0] = camX; u.uCam[1] = camY;
    u.uScreen[0] = w; u.uScreen[1] = h;
    this.mesh.scale.set(pixelW, pixelH);
    if (light) {
      u.uAmbient[0] = light.ambient[0]; u.uAmbient[1] = light.ambient[1]; u.uAmbient[2] = light.ambient[2];
      u.uSunCol[0] = light.sun[0]; u.uSunCol[1] = light.sun[1]; u.uSunCol[2] = light.sun[2];
      u.uGlint = light.glint;
      u.uWarmth = light.warm || 0;
    }
  }
}
