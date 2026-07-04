// L'acqua del Mare dell'Internet: un unico quad a schermo intero con shader
// GLSL. Ricetta ispirata a DREDGE: onde semplici (rumore stratificato), colore
// che fa l'atmosfera, pennellate posterizzate invece di gradienti fotorealisti.
// Le uniform di sole/ambiente sono pilotate dal ciclo giorno/notte.

import { Geometry, Mesh, Shader, UniformGroup } from 'pixi.js';

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
    vec2 world = uCam + vUV * uScreen;
    vec2 wp = world * 0.008;
    float t = uTime;

    // Percorso magro per renderer software: ~4 letture di rumore per pixel
    // invece di ~19, stessa palette e stesso ciclo giorno/notte.
    if (uCheap > 0.5) {
      float sea2 = fbm3(wp * 1.35 + vec2(t * 0.05, t * 0.02));
      float band2 = sea2 * 5.0;
      float q2 = (floor(band2) + smoothstep(0.3, 0.7, fract(band2))) / 5.0;
      vec3 c2 = mix(uDeep, uMid, q2);
      c2 = mix(c2, uLite, smoothstep(0.70, 0.95, q2));
      float g2 = smoothstep(0.80, 0.93, vnoise(wp * 9.0 + vec2(t * 0.3, -t * 0.2))) * smoothstep(0.5, 0.78, sea2);
      c2 += uSunCol * g2 * uGlint * 0.8;
      c2 = mix(c2, uSunCol * (0.25 + q2 * 0.55), uWarmth * smoothstep(0.45, 0.95, q2) * 0.65);
      c2 *= uAmbient;
      finalColor = vec4(c2, 1.0);
      return;
    }

    // due treni d'onda che scorrono in direzioni diverse
    float n1 = fbm(wp + vec2(t * 0.060, t * 0.022));
    float n2 = fbm(wp * 2.3 - vec2(t * 0.045, -t * 0.031) + 5.0);
    float sea = n1 * 0.65 + n2 * 0.35;

    // posterizzazione morbida: pennellate, non gradienti
    float band = sea * 5.0;
    float q = (floor(band) + smoothstep(0.3, 0.7, fract(band))) / 5.0;

    vec3 col = mix(uDeep, uMid, q);
    col = mix(col, uLite, smoothstep(0.70, 0.95, q));

    // correnti larghe: variazione tonale a bassa frequenza (profondità percepita)
    float depth = vnoise(world * 0.0011 + 31.0);
    col *= 0.90 + depth * 0.20;

    // riflessi del sole: scintille puntiformi sulle creste, non contorni
    vec2 wp2 = wp * 2.3 - vec2(t * 0.045, -t * 0.031) + 5.0;
    float e = 0.06;
    float ridge = abs(fbm(wp2 + vec2(e, 0.0)) - n2) + abs(fbm(wp2 + vec2(0.0, e)) - n2);
    float sparkleMask = smoothstep(0.74, 0.90, vnoise(wp * 15.0 + vec2(t * 0.35, -t * 0.22)));
    float glint = smoothstep(0.03, 0.085, ridge) * smoothstep(0.58, 0.82, n2) * sparkleMask;
    col += uSunCol * glint * uGlint;

    // spuma sparsa, appena accennata, sulle creste più alte
    float cap = smoothstep(0.90, 0.97, vnoise(wp * 6.0 + vec2(t * 0.12, -t * 0.07)));
    col = mix(col, vec3(0.78, 0.86, 0.90), cap * smoothstep(0.62, 0.85, sea) * 0.22);

    // riverbero del sole basso: i cavi d'onda restano freddi e scuri,
    // solo le creste prendono fuoco (il classico sentiero dorato)
    col = mix(col, uSunCol * (0.25 + q * 0.55), uWarmth * smoothstep(0.45, 0.95, q) * 0.65);

    col *= uAmbient;

    // grana sottile da pellicola: spezza le bande piatte
    col += (hash(world + vec2(fract(t) * 7.0)) - 0.5) * 0.022;

    finalColor = vec4(col, 1.0);
  }
`;

export class Water {
  constructor(cheap = false) {
    this.uniforms = new UniformGroup({
      uCheap: { value: cheap ? 1 : 0, type: 'f32' },
      uTime: { value: 0, type: 'f32' },
      uCam: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
      uScreen: { value: new Float32Array([1440, 900]), type: 'vec2<f32>' },
      uDeep: { value: new Float32Array([0.055, 0.145, 0.208]), type: 'vec3<f32>' },
      uMid: { value: new Float32Array([0.098, 0.235, 0.322]), type: 'vec3<f32>' },
      uLite: { value: new Float32Array([0.235, 0.427, 0.518]), type: 'vec3<f32>' },
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
