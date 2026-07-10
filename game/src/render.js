// Rendering del Mare dell'Internet con PixiJS v8. Tutto è disegnato in modo
// procedurale (niente asset): la forma di ogni isola nasce dal suo seed, che il
// server distribuisce a tutti — così il mondo è identico per ogni giocatore.

import { Application, Container, Graphics, Text, Sprite, Texture, TilingSprite, Assets, Rectangle } from 'pixi.js';
import { mulberry32, clamp } from './util.js';
import { Water } from './water.js';
import { CanvasWater } from './water-canvas.js';
import { lightNow } from './daycycle.js';
import { drawGun as drawGunNuovo } from './guns.js';
import { disegnaBandiera } from './bandiera.js';
import { COL } from './palette.js';

// Miscela lineare fra due colori esadecimali (k: 0=a, 1=b).
function mixHex(a, b, k) {
  const r = Math.round((a >> 16 & 255) + ((b >> 16 & 255) - (a >> 16 & 255)) * k);
  const g = Math.round((a >> 8 & 255) + ((b >> 8 & 255) - (a >> 8 & 255)) * k);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * k);
  return (r << 16) | (g << 8) | bl;
}

// COL (la palette semantica del mondo) vive ora in palette.js, sorgente da
// game/tokens.json: la STESSA fonte di verità della UI (issue #32).

export class Renderer {
  async init(mount) {
    this.app = new Application();
    await this.app.init({ resizeTo: window, background: COL.sea, antialias: false, autoDensity: true });
    mount.appendChild(this.app.canvas);
    // il mondo dipinto è descritto dal testo dentro #stage: il canvas in sé
    // non ha nulla da dire a uno screen reader
    this.app.canvas.setAttribute('aria-hidden', 'true');

    // Qualità adattiva: su renderer software (SwiftShader/llvmpipe) lo shader
    // a schermo pieno mangia la CPU → mezza risoluzione, shader magro, 30 fps.
    const gl = this.app.renderer.gl;
    const dbgInfo = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const glName = gl
      ? String(gl.getParameter(dbgInfo ? dbgInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
      : 'canvas';
    console.log('Renderer GL:', glName);
    const forced = new URLSearchParams(location.search).get('qualita');
    this.lowSpec = forced ? forced === 'bassa'
      : (!gl || /swiftshader|llvmpipe|softpipe|software/i.test(glName));
    if (this.lowSpec) {
      // Il metodo Monkey Island: niente calcolo per-pixel a runtime.
      // L'acqua viene "cotta" in una tile pittorica e solo piastrellata.
      this.app.ticker.maxFPS = 30;
      console.log(`Vele da CPU (${glName}): acqua cotta in tile, 30 fps`);
    }

    this.water = this.lowSpec ? new CanvasWater() : new Water(false);
    this.noWater = new URLSearchParams(location.search).get('acqua') === 'off';
    if (!this.noWater) this.app.stage.addChild(this.water.mesh);
    this.light = null; // impostato dal ciclo giorno/notte

    this.world = new Container();
    this.app.stage.addChild(this.world);

    this.shallowLayer = new Container();
    this.routeGfx = new Graphics();
    this.wakeGfx = new Graphics();
    this.islandLayer = new Container();
    this.foamGfx = [];
    this.fortLayer = new Container();
    this.shotGfx = new Graphics();
    this.shipLayer = new Container();
    this.fxGfx = new Graphics();
    this.beamGfx = new Graphics();
    this.labelLayer = new Container();
    this.smokeGfx = new Graphics(); // i fumogeni: sopra TUTTO il mondo, nomi compresi
    this.smokes = new Map();
    this.world.addChild(this.shallowLayer, this.routeGfx, this.wakeGfx, this.islandLayer,
      this.fortLayer, this.shotGfx, this.shipLayer, this.fxGfx, this.beamGfx, this.labelLayer,
      this.smokeGfx);

    // strato meteo e luce, sopra il mondo: ombre di nuvole, nebbia notturna
    // centrata sul giocatore (alla DREDGE), lanterna di bordo, vignetta.
    this.cloudShadows = new TilingSprite({ texture: this.makeCloudTexture(), width: innerWidth, height: innerHeight });
    this.cloudShadows.blendMode = 'multiply';
    this.cloudShadows.tileScale.set(1.7);
    this.cloudShadows.alpha = 0.22;
    this.cloudShadows.visible = !this.lowSpec; // un multiply a schermo pieno costa troppo su CPU
    this.app.stage.addChild(this.cloudShadows);

    this.fog = new Sprite(this.makeFogTexture());
    this.fog.anchor.set(0.5);
    this.fog.alpha = 0;
    this.app.stage.addChild(this.fog);

    this.glowTex = this.makeGlowTexture();
    this.shallowTex = this.makeShallowTexture();
    this.lantern = new Sprite(this.glowTex);
    this.lantern.anchor.set(0.5);
    this.lantern.blendMode = 'add';
    this.lantern.tint = 0xffc878;
    this.lantern.alpha = 0;
    this.app.stage.addChild(this.lantern);

    // Sul CanvasRenderer il tint dei container è inaffidabile (silhouette):
    // il grading giorno/notte passa da un overlay in moltiplicazione.
    if (this.lowSpec) {
      this.tintCanvas = document.createElement('canvas');
      this.tintCanvas.width = this.tintCanvas.height = 8;
      this.tintTexture = Texture.from(this.tintCanvas);
      this.tintOverlay = new Sprite(this.tintTexture);
      this.tintOverlay.blendMode = 'multiply';
      this._tintHex = -1;
      this.app.stage.addChild(this.tintOverlay);
    }

    this.vignette = new Sprite(this.makeVignette());
    this.app.stage.addChild(this.vignette);

    // la bussola della rotta (issue #22): quando la meta è fuori schermo,
    // una freccia al bordo con la distanza in leghe — sopra la vignetta,
    // fuori dalla tinta del mondo (è interfaccia, non mare)
    this.bussola = new Container();
    this.bussolaFreccia = new Graphics();
    this.bussolaFreccia.poly([16, 0, -10, -9, -5, 0, -10, 9]).fill(0xe8c268)
      .poly([16, 0, -10, -9, -5, 0, -10, 9]).stroke({ width: 1.5, color: 0x2a1a0c });
    this.bussolaTesto = new Text({
      text: '', style: {
        fontFamily: 'Atkinson Hyperlegible Next, sans-serif', fontSize: 13, fill: 0xf0e2b8,
        stroke: { color: 0x1a1208, width: 3 },
      },
    });
    this.bussolaTesto.anchor.set(0.5);
    this.bussola.addChild(this.bussolaFreccia, this.bussolaTesto);
    this.bussola.visible = false;
    this.app.stage.addChild(this.bussola);
    this.lightNow = lightNow();

    this.navi = null; // atlas delle navi cotte; finché manca si resta sul vettoriale
    this.cartellone = null; // l'insegna OG dell'isola accostata (issue #27)
    this.livree = {}; // atlanti delle livree (issue #25), caricati solo se qualcuno le indossa
    this.tela = undefined; // l'atlante UNICO delle vele (tela bianca): undefined = mai chiesto, null = in volo
    this.veleTinte = {}; // id vela → tinta 0x, dal catalogo del welcome (main.js)
    this._bandTex = {}; // texture dei vessilli personali, per chiave bf
    this.loadNavi();
    // le bocche da fuoco cotte (issue #17); ?armicotte=off forza il
    // fallback vettoriale (utile per i confronti e per collaudarlo)
    if (new URLSearchParams(location.search).get('armicotte') !== 'off') this.loadArmi();

    this.ships = new Map();
    this.forts = new Map();     // islandId -> Graphics
    this.islands = new Map();
    this.labels = new Map();    // islandId -> Text
    this.shots = [];
    this.particles = [];
    this.rings = [];
    this.beams = [];
    this.debris = [];
    this.wakes = [];
    this.lightBeams = [];
    this.dest = null;
    this.shake = 0;
    this.t = 0;
    this.zoom = 1;
    this.zoomTarget = 1;
  }

  // tre livelli di cannocchiale: mare aperto, manovra, abbordaggio
  setZoom(z) {
    this.zoomTarget = clamp(z, 1, 2);
  }

  async loadNavi() {
    try {
      const meta = await (await fetch('assets/navi.json')).json();
      const tex = await Assets.load('assets/navi.webp');
      const frames = {};
      for (const [name, vi] of Object.entries(meta.variants)) {
        const arr = [];
        for (let k = 0; k < meta.steps; k++) {
          const col = k % meta.cols, row = ((k / meta.cols) | 0) + vi * meta.rows;
          arr.push(new Texture({
            source: tex.source,
            frame: new Rectangle(col * meta.frame, row * meta.frame, meta.frame, meta.frame),
          }));
        }
        frames[name] = arr;
      }
      this.navi = { meta, frames };
      for (const c of this.ships.values()) c.buildKey = ''; // ricostruisci con gli sprite
    } catch (e) {
      console.warn('Navi cotte non disponibili, resto sul vettoriale:', e.message);
    }
  }

  // le livree (issue #25): stesso schema delle navi, un atlante per id,
  // scaricato SOLO quando qualcuno in mare la indossa (lazy, una volta)
  async loadLivrea(id) {
    if (!/^[a-z0-9]{1,24}$/.test(id) || this.livree[id] !== undefined) return;
    this.livree[id] = null; // in caricamento: non richiedere due volte
    try {
      const meta = await (await fetch('assets/livree/' + id + '.json')).json();
      const tex = await Assets.load('assets/livree/' + id + '.webp');
      const frames = {};
      for (const [name, vi] of Object.entries(meta.variants)) {
        const arr = [];
        for (let k = 0; k < meta.steps; k++) {
          const col = k % meta.cols, row = ((k / meta.cols) | 0) + vi * meta.rows;
          arr.push(new Texture({
            source: tex.source,
            frame: new Rectangle(col * meta.frame, row * meta.frame, meta.frame, meta.frame),
          }));
        }
        frames[name] = arr;
      }
      this.livree[id] = { meta, frames };
      for (const c of this.ships.values()) c.buildKey = ''; // rivesti chi la indossa
    } catch { /* la nave resta di legno: pazienza */ }
  }

  // le vele tinte: UN atlante di tela bianca per tutti i colori (la tinta
  // arriva dal catalogo, vedi veleTinte) — scaricato al primo che le indossa
  async loadTela() {
    if (this.tela !== undefined) return;
    this.tela = null; // in caricamento: non richiedere due volte
    try {
      const meta = await (await fetch('assets/vele/tela.json')).json();
      const tex = await Assets.load('assets/vele/tela.webp');
      const frames = {};
      for (const [name, vi] of Object.entries(meta.variants)) {
        const arr = [];
        for (let k = 0; k < meta.steps; k++) {
          const col = k % meta.cols, row = ((k / meta.cols) | 0) + vi * meta.rows;
          arr.push(new Texture({
            source: tex.source,
            frame: new Rectangle(col * meta.frame, row * meta.frame, meta.frame, meta.frame),
          }));
        }
        frames[name] = arr;
      }
      this.tela = { meta, frames };
      for (const c of this.ships.values()) c.buildKey = ''; // rivesti chi le indossa
    } catch { /* la tela resta del suo colore: pazienza */ }
  }

  // Anteprima FEDELE della nave con livrea e vele (issue #34): estrae in un
  // canvas lo STESSO sprite bakeato che si vede in mare — così il cambio si vede
  // subito nel Cantiere, dove la nave è invisibile perché sei attraccato. `s` è
  // lo stato della propria nave (tp/sl/maxHp/k) per la classe esatta. Ritorna un
  // canvas (o null se l'atlante non è pronto). Async: aspetta i caricamenti.
  async previewLivrea(livreaId, veleId, s) {
    if (!s) return null;
    // aspetta che l'atlante serva pronto (in gioco è già caricato: attesa nulla)
    const attendi = (test) => new Promise((res) => {
      let i = 0;
      const giro = () => (test() && i++ < 120) ? setTimeout(giro, 50) : res();
      giro();
    });
    // i caricamenti non devono MAI appendere l'anteprima: race col tempo
    if (livreaId && this.livree[livreaId] === undefined) {
      await Promise.race([this.loadLivrea(livreaId), new Promise(r => setTimeout(r, 6000))]);
    }
    if (veleId && this.tela === undefined) {
      await Promise.race([this.loadTela(), new Promise(r => setTimeout(r, 6000))]);
    }
    await attendi(() => livreaId && this.livree[livreaId] === null); // atlante livrea in volo
    await attendi(() => veleId && this.tela === null);               // atlante tela in volo
    const classe = this.shipClass(s);
    const liv = livreaId && this.livree[livreaId] && this.livree[livreaId].frames[classe];
    if (!liv) await attendi(() => !this.navi); // senza livrea (o classe assente) serve l'atlante navi
    const atlante = liv ? this.livree[livreaId] : this.navi;
    if (!atlante) return null;
    const frames = atlante.frames[classe] || atlante.frames.pirata
      || atlante.frames[Object.keys(atlante.frames)[0]];
    if (!frames || !frames.length) return null;
    const ang = Math.round(frames.length * 0.625) % frames.length; // vista di 3/4
    const spr = new Sprite(frames[ang]);
    spr.anchor.set(0.5);
    // le vele tinte sopra, stessa posa (se la tela è pronta e ha la classe)
    let target = spr;
    const telaFrames = veleId && this.tela && this.tela.frames[classe];
    if (telaFrames && telaFrames.length === frames.length) {
      const cont = new Container();
      cont.addChild(spr);
      const vs = new Sprite(telaFrames[ang]);
      vs.anchor.set(0.5);
      vs.tint = this.veleTinte[veleId] ?? 0xffffff;
      cont.addChild(vs);
      target = cont;
    }
    let canvas = null;
    try { canvas = this.app.renderer.extract.canvas({ target }); }
    catch { /* estrazione non riuscita: niente anteprima */ }
    target.destroy({ children: true });
    return canvas;
  }

  // --- il Cartellone dell'isola (issue #27) ---
  // L'anteprima OG su un'insegna di pergamena al centro dell'isola: appare
  // in dissolvenza quando la nave si accosta, sparisce allontanandosi.
  // Chiamata ogni frame: (island, og) per mostrare, (null) per spegnere.
  setCartellone(island, og) {
    if (!island) {
      if (this.cartellone) {
        this.cartellone.alpha += (0 - this.cartellone.alpha) * 0.12;
        if (this.cartellone.alpha < 0.02) { this.cartellone.destroy({ children: true }); this.cartellone = null; }
      }
      return;
    }
    if (!this.cartellone || this.cartellone.perIsola !== island.id) {
      if (this.cartellone) this.cartellone.destroy({ children: true });
      this.cartellone = this.buildCartellone(island, og);
      this.world.addChild(this.cartellone);
    }
    this.cartellone.alpha += (1 - this.cartellone.alpha) * 0.12;
    this.cartellone.scale.set(1 / this.zoom); // leggibile a ogni cannocchiale
  }

  buildCartellone(island, og) {
    const c = new Container();
    c.perIsola = island.id;
    c.alpha = 0;
    c.position.set(island.x, island.y);
    const LARGO = 240;
    // i testi crescono verso il BASSO da y=0; l'immagine (quando attracca
    // dal proxy di bordo, stessa origine: niente CORS) vive sopra, in y<0
    const fondo = new Graphics();
    c.addChild(fondo);
    let y = 0;
    const aggiungi = (testo, style) => {
      const t = new Text({ text: testo, style });
      t.anchor.set(0.5, 0);
      t.position.set(0, y);
      c.addChild(t);
      y += t.height + 5;
    };
    if (og.titolo) {
      aggiungi(og.titolo, {
        fontFamily: 'Atkinson Hyperlegible Next, sans-serif', fontSize: 14.5, fontWeight: 'bold', fill: 0x2b1c08,
        wordWrap: true, wordWrapWidth: LARGO - 26, align: 'center',
      });
    }
    if (og.descrizione) {
      aggiungi(og.descrizione, {
        fontFamily: 'Atkinson Hyperlegible Next, sans-serif', fontSize: 11.5, fill: 0x4a3620, lineHeight: 15,
        wordWrap: true, wordWrapWidth: LARGO - 26, align: 'center',
      });
    }
    aggiungi('⚓ ' + island.domain, { fontFamily: 'Atkinson Hyperlegible Next, sans-serif', fontSize: 10.5, fontStyle: 'italic', fill: 0x7a4a12 });
    let imgH = 0; // spazio occupato dall'immagine sopra i testi
    const disegnaFondo = () => {
      const cima = -imgH - 12, basso = y + 6;
      fondo.clear()
        .roundRect(-LARGO / 2 - 3, cima - 3, LARGO + 6, basso - cima + 6, 8).fill(0x6d4c22)
        .roundRect(-LARGO / 2, cima, LARGO, basso - cima, 6).fill(0xefe3c2);
      fondo.rect(-LARGO / 2 + 18, basso, 7, 26).fill(0x54401f);
      fondo.rect(LARGO / 2 - 25, basso, 7, 26).fill(0x54401f);
      c.pivot.set(0, basso + 26); // i piedi dell'insegna al centro dell'isola
    };
    disegnaFondo();
    if (og.img) {
      const img = new Image();
      img.src = '/og-img/' + island.domain;
      img.onload = () => {
        if (this.cartellone !== c) return; // nel frattempo si è voltato pagina
        const tex = Texture.from(img);
        const sc = Math.min((LARGO - 24) / tex.width, 110 / tex.height);
        const spr = new Sprite(tex);
        spr.scale.set(sc);
        spr.anchor.set(0.5, 0);
        imgH = tex.height * sc + 10;
        spr.position.set(0, -imgH + 4);
        disegnaFondo();
        c.addChild(spr);
      };
    }
    return c;
  }

  // il vessillo personale (issue #25): canvas → texture, memoizzato
  bandieraTex(bf) {
    const k = bf.join('.');
    if (!this._bandTex[k]) {
      const cv = document.createElement('canvas');
      cv.width = 30; cv.height = 20;
      disegnaBandiera(cv, { fondo: bf[0], taglio: bf[1], tinta2: bf[2], emblema: bf[3], tintaEmblema: bf[4] });
      this._bandTex[k] = Texture.from(cv);
    }
    return this._bandTex[k];
  }

  // prototipo issue #17: atlas delle bocche da fuoco, stesso schema delle navi
  async loadArmi() {
    try {
      const meta = await (await fetch('assets/armi.json')).json();
      const tex = await Assets.load('assets/armi.webp');
      const frames = {};
      for (const [name, vi] of Object.entries(meta.variants)) {
        const arr = [];
        for (let k = 0; k < meta.steps; k++) {
          const col = k % meta.cols, row = ((k / meta.cols) | 0) + vi * meta.rows;
          arr.push(new Texture({
            source: tex.source,
            frame: new Rectangle(col * meta.frame, row * meta.frame, meta.frame, meta.frame),
          }));
        }
        frames[name] = arr;
      }
      this.armi = { meta, frames };
      for (const c of this.ships.values()) c.buildKey = '';
    } catch (e) {
      console.warn('Armi cotte non disponibili, resto sul vettoriale:', e.message);
    }
  }

  makeVignette() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(256, 256, 150, 256, 256, 360);
    grad.addColorStop(0, 'rgba(6,20,32,0)');
    grad.addColorStop(1, 'rgba(6,20,32,0.42)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
    return Texture.from(c);
  }

  // La notte di DREDGE: un cerchio di visione attorno alla nave, il resto
  // annega nel buio. Trasparente al centro, blu-carbone spesso ai bordi.
  makeFogTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1024;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(512, 512, 130, 512, 512, 512);
    grad.addColorStop(0, 'rgba(9,14,26,0)');
    grad.addColorStop(0.45, 'rgba(9,14,26,0.55)');
    grad.addColorStop(1, 'rgba(9,14,26,0.96)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 1024);
    return Texture.from(c);
  }

  // Alone caldo per lanterne e luci: bianco al centro, svanisce ai bordi.
  makeGlowTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 4, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.30)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return Texture.from(c);
  }

  // Acqua bassa: alone turchese che svanisce dolcemente verso il largo.
  makeShallowTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 30, 128, 128, 128);
    grad.addColorStop(0, 'rgba(88,160,183,0.60)');
    grad.addColorStop(0.62, 'rgba(74,146,170,0.34)');
    grad.addColorStop(1, 'rgba(62,140,165,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return Texture.from(c);
  }

  // L'isola dipinta: gradiente di luce da nord-ovest, pennellate procedurali,
  // alone di sabbia sfumato. Niente contorni neri: il volume nasce dal tono.
  makeIslandTexture(island, pts) {
    const R = island.r * 1.45 + 12;
    const S = Math.ceil(R * 2);
    const cnv = document.createElement('canvas');
    cnv.width = cnv.height = S;
    const g = cnv.getContext('2d');
    const path = (scale) => {
      g.beginPath();
      for (let i = 0; i < pts.length; i += 2) {
        const x = pts[i] * scale + R, y = pts[i + 1] * scale + R;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
    };

    // battigia: sabbia che sfuma nell'acqua
    g.filter = 'blur(7px)';
    path(1.24);
    g.fillStyle = 'rgba(186,164,118,0.55)';
    g.fill();
    g.filter = 'none';

    const sandGrad = g.createRadialGradient(R, R, island.r * 0.3, R, R, island.r * 1.25);
    sandGrad.addColorStop(0, '#cfb98c');
    sandGrad.addColorStop(1, '#b39c6c');
    path(1.17);
    g.fillStyle = sandGrad;
    g.fill();

    // terra: luce da nord-ovest (in alto a sinistra), ombra a sud-est
    const fort = !!island.fortress;
    const lg = g.createLinearGradient(R - island.r * 0.7, R - island.r * 0.7, R + island.r * 0.8, R + island.r * 0.8);
    lg.addColorStop(0, fort ? '#8b8b7d' : '#7d9a66');
    lg.addColorStop(1, fort ? '#565649' : '#4e6540');
    path(1);
    g.fillStyle = lg;
    g.fill();

    // colline: il volume sale verso il cuore dell'isola
    g.filter = 'blur(4px)';
    const hg = g.createLinearGradient(R - island.r * 0.4, R - island.r * 0.4, R + island.r * 0.45, R + island.r * 0.45);
    hg.addColorStop(0, fort ? '#98988a' : '#8aa871');
    hg.addColorStop(1, fort ? '#505044' : '#48603b');
    path(0.52);
    g.fillStyle = hg;
    g.fill();
    path(0.26);
    g.fillStyle = fort ? 'rgba(178,178,164,0.55)' : 'rgba(160,190,124,0.55)';
    g.fill();
    g.filter = 'none';

    // pennellate: tratti corti chiari e scuri, solo dentro la terra
    g.save();
    path(1);
    g.clip();
    const rng = mulberry32(island.seed ^ 0x9e3779b9);
    for (let i = 0; i < 170; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * island.r * 1.05;
      const x = R + Math.cos(a) * d, y = R + Math.sin(a) * d;
      const dark = rng() > 0.45;
      g.fillStyle = fort
        ? (dark ? 'rgba(58,58,50,0.10)' : 'rgba(178,178,160,0.09)')
        : (dark ? 'rgba(42,60,34,0.11)' : 'rgba(196,214,156,0.10)');
      g.beginPath();
      const rr = 2.5 + rng() * 6, rot = rng() * Math.PI;
      g.ellipse(x, y, rr * (1.6 + rng()), rr * 0.55, rot, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    return Texture.from(cnv);
  }

  // Nuvole alla DREDGE: "normalmente sono soffici… le nostre sono angolari e
  // dure". Poligoni irregolari grigio-freddi su bianco, in moltiplicazione.
  makeCloudTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 1024, 1024);
    const rng = mulberry32(23);
    for (let i = 0; i < 9; i++) {
      const cx = rng() * 1024, cy = rng() * 1024;
      const r = 90 + rng() * 170;
      const n = 5 + (rng() * 4 | 0);
      const tone = 205 + (rng() * 22 | 0);
      g.fillStyle = `rgb(${tone - 6},${tone},${tone + 6})`;
      g.beginPath();
      for (let v = 0; v < n; v++) {
        const a = (v / n) * Math.PI * 2 + rng() * 0.5;
        const rr = r * (0.55 + rng() * 0.6);
        const px = cx + Math.cos(a) * rr * 1.5, py = cy + Math.sin(a) * rr * 0.8;
        if (v === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
    }
    return Texture.from(c);
  }

  addShake(amount) { if (!this.calmo) this.shake = Math.min(14, this.shake + amount); }

  // Mare calmo (movimento ridotto, WCAG 2.3.3): niente scosse dello schermo
  // né ombre di nuvole alla deriva; il gioco resta identico.
  setCalma(v) {
    this.calmo = !!v;
    if (this.calmo) this.shake = 0;
    if (this.cloudShadows) this.cloudShadows.visible = !this.lowSpec && !this.calmo;
  }

  setWorld(world) {
    this.W = world.W; this.H = world.H;
    const border = new Graphics();
    border.rect(30, 30, world.W - 60, world.H - 60).stroke({ width: 3, color: COL.route, alpha: 0.22 });
    border.rect(44, 44, world.W - 88, world.H - 88).stroke({ width: 1, color: COL.route, alpha: 0.18 });
    this.shallowLayer.addChild(border);
    const style = { fontFamily: 'Pirata One, Georgia, serif', fontSize: 46, fill: 0xdfc98d };
    for (const [x, y, rot] of [[world.W / 2, 90, 0], [world.W / 2, world.H - 90, 0], [90, world.H / 2, -Math.PI / 2], [world.W - 90, world.H / 2, Math.PI / 2]]) {
      const t = new Text({ text: 'HIC · SVNT · DRACONES', style });
      t.anchor.set(0.5); t.position.set(x, y); t.rotation = rot; t.alpha = 0.30;
      this.shallowLayer.addChild(t);
    }
  }

  addIsland(island) {
    if (this.islands.has(island.id)) return;
    this.islands.set(island.id, island);
    const rng = mulberry32(island.seed);
    const c = new Container();
    c.position.set(island.x, island.y);

    // acqua bassa: gradiente radiale morbido, non un disco piatto
    const shallow = new Sprite(this.shallowTex);
    shallow.anchor.set(0.5);
    shallow.position.set(island.x, island.y);
    shallow.width = shallow.height = island.r * 3.6;
    shallow.alpha = 0.34;
    this.shallowLayer.addChild(shallow);

    const pts = [];
    const N = 16;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = island.r * (0.74 + rng() * 0.42);
      pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    // schiuma animata sulla battigia
    const foam = new Graphics();
    foam.poly(pts.map(v => v * 1.26)).stroke({ width: 4, color: 0xd8ecf4, alpha: 1 });
    foam.position.set(island.x, island.y);
    foam.phase = rng() * Math.PI * 2;
    this.shallowLayer.addChild(foam);
    this.foamGfx.push(foam);

    // terra e sabbia dipinte: luce da nord-ovest, pennellate, bordi sfumati
    const landSprite = new Sprite(this.makeIslandTexture(island, pts));
    landSprite.anchor.set(0.5);
    c.addChild(landSprite);

    if (island.kind === 'porto') this.drawPorto(c, island, rng);
    else if (island.kind === 'oracolo') this.drawFaro(c, island, rng);
    else if (island.fortress) this.drawKeep(c, island, rng);
    else this.drawPalms(c, island, rng);

    this.islandLayer.addChild(c);

    const label = new Text({
      text: island.name,
      style: {
        fontFamily: 'Pirata One, Georgia, serif', fontSize: 18,
        fill: island.fortress ? 0xd98873 : 0xe9dcbc,
        stroke: { color: 0x140d05, width: 3 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(island.x, island.y + island.r * 1.25 + 20);
    this.labelLayer.addChild(label);
    this.labels.set(island.id, label);
  }

  markConquered(islandId) {
    const label = this.labels.get(islandId);
    if (label) {
      label.style.fill = 0x9fe089;
      label.text = label.text.replace(' ⚑', '') + ' ⚑';
    }
  }

  drawPalms(c, island, rng) {
    const n = 2 + (rng() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, d = rng() * island.r * 0.45;
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      const p = new Graphics();
      p.ellipse(x + 6, y + 3, 12, 5).fill({ color: 0x000000, alpha: 0.14 });
      p.moveTo(x, y).quadraticCurveTo(x + 4, y - 14, x + 8, y - 22).stroke({ width: 3, color: COL.trunk });
      for (let f = 0; f < 5; f++) {
        const fa = -Math.PI / 2 + (f - 2) * 0.55;
        p.moveTo(x + 8, y - 22)
          .quadraticCurveTo(x + 8 + Math.cos(fa) * 10, y - 22 + Math.sin(fa) * 7, x + 8 + Math.cos(fa) * 17, y - 22 + Math.sin(fa) * 12 + 4)
          .stroke({ width: 2.5, color: COL.palm });
      }
      c.addChild(p);
    }
  }

  drawPorto(c, island, rng) {
    const g = new Graphics();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const x1 = Math.cos(a) * island.r * 0.9, y1 = Math.sin(a) * island.r * 0.9;
      const x2 = Math.cos(a) * (island.r * 1.45), y2 = Math.sin(a) * (island.r * 1.45);
      g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 7, color: 0x8a6a45 });
    }
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2, d = rng() * island.r * 0.5;
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      g.rect(x - 7, y - 6, 14, 12).fill(0xbd9c6d).stroke({ width: 1.5, color: 0x6d4c22, alpha: 0.6 });
      g.poly([x - 9, y - 6, x, y - 15, x + 9, y - 6]).fill(0x8a4a34);
    }
    g.moveTo(0, 6).lineTo(0, -34).stroke({ width: 3, color: 0x4a3520 });
    g.poly([0, -34, 22, -28, 0, -22]).fill(COL.gold);
    c.addChild(g);
  }

  drawFaro(c, island, rng) {
    const g = new Graphics();
    g.poly([-11, 14, 11, 14, 7, -30, -7, -30]).fill(0xe9e2d0).stroke({ width: 2, color: 0x8d8478, alpha: 0.7 });
    g.rect(-9, -4, 18, 7).fill(0xa04a3a);
    g.rect(-10, -18, 20, 7).fill(0xa04a3a);
    g.rect(-8, -38, 16, 9).fill(0x3d3428);
    g.circle(0, -33, 4).fill(0xffe9a0);
    c.addChild(g);
    const beam = new Graphics();
    beam.poly([0, 0, 190, -26, 190, 26]).fill({ color: 0xffe9a0, alpha: 1 });
    beam.position.set(0, -33);
    beam.alpha = 0.13; // di notte il faro si accende davvero (vedi frame)
    c.addChild(beam);
    this.lightBeams.push(beam);
    const halo = new Sprite(this.glowTex);
    halo.anchor.set(0.5); halo.blendMode = 'add'; halo.tint = 0xffe9a0;
    halo.position.set(0, -33); halo.scale.set(0.5); halo.alpha = 0.25;
    c.addChild(halo);
    this.lightBeams.push(Object.assign(halo, { isHalo: true }));
  }

  drawKeep(c, island, rng) {
    const g = new Graphics();
    g.circle(0, 0, island.r * 0.42).fill(COL.stone).stroke({ width: 3, color: COL.stoneDark });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.rect(Math.cos(a) * island.r * 0.42 - 3, Math.sin(a) * island.r * 0.42 - 3, 6, 6).fill(COL.stoneDark);
    }
    c.addChild(g);
  }

  // --- navi ---

  // Se il varo ha dato un tipo, la classe è quella (tp nello snapshot);
  // altrimenti si legge dallo scafo come un tempo: fino a scafo lvl1 sei una
  // sloop, lvl2-3 un brigantino, lvl4 un galeone; con anche le vele al
  // massimo il galeone si veste d'oro.
  shipClass(s) {
    if (s.k === 'g') return 'fantasma';
    if (s.k === 'm') return 'mercantile';
    // la scala visiva DENTRO ogni tipo (issue #11): con scafo e vele al
    // massimo si diventa VETERANI — castello in più e pomi d'oro in testa
    // d'albero. Le soglie sono i maxHp a scafo 4 col moltiplicatore di tipo.
    // soglie raddoppiate col +100% vita: maxHp a scafo 4 = (200+320)×hpMul
    const vet = (s.sl | 0) >= 4;
    if (s.tp === 1) return vet && s.maxHp >= 442 ? 'golettavet' : 'goletta';
    if (s.tp === 2) return vet && s.maxHp >= 520 ? 'guerravet' : 'guerra';
    // tipo galeone: hp ×1.2, quindi il dorato scatta a 624 (520 × 1.2);
    // sotto il dorato veste il blu regale, distinto dal galeone di leva
    if (s.tp === 3) return vet && s.maxHp >= 624 ? 'oro' : 'galeonetipo';
    if (s.tp === 4) return 'sciabecco';
    if (s.maxHp >= 520) return vet ? 'oro' : 'galeone';
    return s.maxHp >= 360 ? 'brigantino' : 'sloop';
  }

  // Un cannone vero, non un pallino: il disegno vive in guns.js (issue #17)
  // ed è il fallback quando l'atlas delle armi cotte non c'è.
  drawGun(g, cx, cy, dir, type, lvl) {
    drawGunNuovo(g, cx, cy, dir, type, lvl);
  }

  buildShipBody(c, s, selfId) {
    const mode = this.navi ? 'S' : 'V';
    const classe = this.shipClass(s);
    // la livrea (issue #25): se indossata e l'atlante è pronto, veste lei;
    // finché scarica (o se manca) si resta sul legno — mai un buco
    if (s.lv && this.livree[s.lv] === undefined) this.loadLivrea(s.lv);
    const liv = s.lv && this.livree[s.lv] && this.livree[s.lv].frames[classe] ? this.livree[s.lv] : null;
    // le vele tinte: overlay di tela sopra lo sprite (atlante unico + tint)
    if (s.ve && this.tela === undefined) this.loadTela();
    const tela = s.ve && this.tela && this.tela.frames[classe] ? this.tela : null;
    const key = mode + '|' + s.k + '|' + classe + '|' + (liv ? s.lv : '') + '|' + (tela ? s.ve : '') + '|' + (s.gp || []).join(',') + '|' + (s.gw || []).join(',') + (s.id === selfId ? '|S' : '');
    if (c.buildKey === key) return;
    c.buildKey = key;
    if (c.body) c.body.destroy({ children: true });
    if (c.shadow) { c.shadow.destroy(); c.shadow = null; }
    const body = new Container();
    c.addChildAt(body, (c.glow ? 1 : 0) + (c.ring ? 1 : 0));
    c.body = body;

    const ghost = s.k === 'g', merc = s.k === 'm';

    if (this.navi) {
      // nave cotta: sprite pre-renderizzato + portelli che ruotano continui
      const atlante = liv || this.navi;
      const variant = atlante.frames[classe] ? classe
        : atlante.frames.pirata ? 'pirata' : Object.keys(atlante.frames)[0];
      // lo scafo si allunga con la classe (solo in lunghezza: il baglio è fisso)
      const fL = variant === 'sloop' ? 0.82 : variant === 'goletta' ? 0.88
        : variant === 'golettavet' ? 0.92 : variant === 'sciabecco' ? 0.94
          : variant === 'guerravet' ? 1.06
            : (variant === 'galeone' || variant === 'galeonetipo' || variant === 'oro') ? 1.16 : 1;
      const shadow = new Graphics();
      shadow.ellipse(2, 7, 27 * fL, 11).fill({ color: 0x061018, alpha: 0.17 });
      c.addChildAt(shadow, (c.glow ? 1 : 0));
      c.shadow = shadow;
      const spr = new Sprite(atlante.frames[variant][0]);
      spr.anchor.set(0.5, 0.53);
      spr.scale.set((atlante.meta.scala || 98.4) / atlante.meta.frame); // la stazza la detta il bake (79 × D/13)
      if (ghost) spr.alpha = 0.88;
      body.addChild(spr);
      body.atlante = atlante;
      // la tela tinta si appoggia sopra, stessa posa: dove l'alberatura passa
      // davanti alle vele l'atlante è bucato e sotto riappare il legno
      body.veleSprite = null;
      if (tela && tela.frames[variant]) {
        const vs = new Sprite(tela.frames[variant][0]);
        vs.anchor.set(0.5, 0.53);
        vs.scale.set((tela.meta.scala || 98.4) / tela.meta.frame);
        vs.tint = this.veleTinte[s.ve] ?? 0xffffff;
        body.addChild(vs);
        body.veleSprite = vs;
        body.veleAtlante = tela;
      }
      const ports = new Graphics();
      const gp = s.gp || [1, 1, 0, 0];
      // slot d'arma: se il server manda gw usiamo la sagoma vera, altrimenti
      // cannoni generici dai soli conteggi (client nuovo, server vecchio)
      const slot = (gi, i) => {
        const w = s.gw && s.gw[gi];
        return w && w.length >= (i + 1) * 2 ? [w[i * 2], +w[i * 2 + 1] || 1] : ['n', 1];
      };
      // issue #17: se l'atlas delle armi è carico e ha la sagoma, sprite
      // cotto (posa scelta a ogni frame); altrimenti fallback vettoriale.
      // Il pezzo cotto è un affusto intero: lo si arretra di qualche passo
      // verso l'interno (INBOARD, contro il verso di fuoco) e gli si dà
      // un'ombra di contatto, così siede sul ponte invece di fluttuare.
      const INBOARD = 2.2;
      const gunLayer = new Container();
      body.gunSprites = [];
      const mkGun = (x, y, dir, t, l) => {
        const key = t + l;
        if (this.armi && this.armi.frames[key]) {
          const ombra = new Graphics();
          ombra.ellipse(0, 0, 5.6, 2.3).fill({ color: 0x061018, alpha: 0.18 });
          gunLayer.addChild(ombra);
          const spr = new Sprite(this.armi.frames[key][0]);
          spr.anchor.set(0.5);
          spr.scale.set(this.armi.meta.scala / this.armi.meta.frame);
          body.gunSprites.push({
            spr, ombra, key,
            lx: x - Math.cos(dir) * INBOARD,
            ly: y - Math.sin(dir) * INBOARD,
            dir,
          });
          gunLayer.addChild(spr);
          return;
        }
        this.drawGun(ports, x, y, dir, t, l);
      };
      for (let i = 0; i < gp[0]; i++) {
        const x = gp[0] === 1 ? -3 : -14 + (i / (gp[0] - 1)) * 22;
        const [t, l] = slot(0, i);
        mkGun(x, -9.5, -Math.PI / 2, t, l);
      }
      for (let i = 0; i < gp[1]; i++) {
        const x = gp[1] === 1 ? -3 : -14 + (i / (gp[1] - 1)) * 22;
        const [t, l] = slot(1, i);
        mkGun(x, 9.5, Math.PI / 2, t, l);
      }
      for (let i = 0; i < gp[2]; i++) {
        const [t, l] = slot(2, i);
        mkGun(20, (i - (gp[2] - 1) / 2) * 7, 0, t, l);
      }
      for (let i = 0; i < gp[3]; i++) {
        const [t, l] = slot(3, i);
        mkGun(-18, (i - (gp[3] - 1) / 2) * 7, Math.PI, t, l);
      }
      ports.scale.x = fL;
      body.addChild(ports);
      body.addChild(gunLayer);
      body.shipSprite = spr;
      body.ports = ports;
      body.variant = variant;
      body.frameIdx = -1;
      body.sails = [];
      // il galeone dorato si riconosce da lontano: nome d'oro e bagliore anche di giorno
      if (c.label) c.label.style.fill = variant === 'oro' ? 0xffd98a : c.label.baseFill;
      return;
    }
    if (c.label) c.label.style.fill = c.label.baseFill;
    const hullCol = ghost ? 0x3d4750 : COL.hull;
    const g = new Graphics();
    // ombra sull'acqua: due strati morbidi, spostati col sole (sud-est)
    g.poly([-18, -4, 9, -4, 26, 5, 9, 14, -18, 14]).fill({ color: 0x061018, alpha: 0.10 });
    g.poly([-19, -6, 8, -6, 24, 3, 8, 12, -19, 12]).fill({ color: 0x061018, alpha: 0.16 });
    // scafo: chiglia scura, fasciame, ponte — niente contorno nero
    g.poly([-19, -9, 7, -9, 22, 0, 7, 9, -19, 9]).fill(hullCol).stroke({ width: 1.6, color: COL.hullLine, alpha: 0.65 });
    g.poly([-16, -5.5, 6, -5.5, 16, 0, 6, 5.5, -16, 5.5]).fill({ color: ghost ? 0x55636d : COL.deck });
    g.moveTo(-16, -2).lineTo(14, -2).stroke({ width: 1, color: COL.plank, alpha: 0.8 });
    g.moveTo(-16, 2).lineTo(14, 2).stroke({ width: 1, color: COL.plank, alpha: 0.8 });
    // bompresso
    g.moveTo(20, 0).lineTo(30, 0).stroke({ width: 2.5, color: ghost ? 0x2c353c : COL.hullDark });
    // portelli dei cannoni: la potenza di fuoco si VEDE
    const gp = s.gp || [1, 1, 0, 0];
    for (let i = 0; i < gp[0]; i++) {
      const x = gp[0] === 1 ? -3 : -14 + (i / (gp[0] - 1)) * 22;
      g.rect(x - 2, -10.5, 4.5, 3.5).fill(0x14100a);
    }
    for (let i = 0; i < gp[1]; i++) {
      const x = gp[1] === 1 ? -3 : -14 + (i / (gp[1] - 1)) * 22;
      g.rect(x - 2, 7, 4.5, 3.5).fill(0x14100a);
    }
    for (let i = 0; i < gp[2]; i++) g.circle(23, (i - 0.5) * 7 + 3.5 * (gp[2] === 1 ? 0 : 1) - 3.5, 2.2).fill(0x14100a);
    for (let i = 0; i < gp[3]; i++) g.circle(-19.5, (i - 0.5) * 7 + 3.5 * (gp[3] === 1 ? 0 : 1) - 3.5, 2.2).fill(0x14100a);
    body.addChild(g);

    if (merc) {
      const crates = new Graphics();
      crates.rect(-6, -3, 7, 6).fill(0x9a7443).stroke({ width: 1, color: 0x5c4526 });
      crates.rect(2, -2, 6, 5).fill(0x84623a).stroke({ width: 1, color: 0x5c4526 });
      body.addChild(crates);
    }

    // vele (animate nel frame)
    const sailCol = ghost ? COL.sailGhost : merc ? COL.sailMerc : COL.sail;
    body.sails = [];
    const mkSail = (px, sc) => {
      const sail = new Graphics();
      sail.poly([-3, -13, 3, -13, 6, 0, 3, 13, -3, 13, -6, 0]).fill(sailCol).stroke({ width: 1.2, color: ghost ? 0x6d838f : 0xb09a6e, alpha: 0.65 });
      sail.position.set(px, 0);
      sail.scale.set(sc);
      sail.phase = Math.random() * Math.PI * 2;
      if (ghost) sail.alpha = 0.85;
      body.addChild(sail);
      body.sails.push(sail);
      return sail;
    };
    mkSail(-7, 1);
    if (!merc) mkSail(8, 0.8);

    if (!merc) {
      const flag = new Graphics();
      if (ghost) flag.poly([-19, -2, -24, -5, -22, -7, -27, -9, -19, -10]).fill(0x27313a);
      else { flag.poly([-19, -2, -27, -6, -19, -10]).fill(0x181818); flag.circle(-23, -6, 1.6).fill(0xffffff); }
      body.addChild(flag);
      body.flag = flag;
    }
    if (ghost) body.alpha = 0.88;
  }

  ensureShip(s, selfId) {
    let c = this.ships.get(s.id);
    if (!c) {
      c = new Container();
      const glow = new Sprite(this.glowTex);
      glow.anchor.set(0.5); glow.blendMode = 'add'; glow.tint = 0xffc27a;
      glow.scale.set(0.55); glow.alpha = 0;
      c.addChild(glow);
      c.glow = glow;
      if (s.id === selfId) {
        const ring = new Graphics();
        ring.circle(0, 0, 30).stroke({ width: 2, color: COL.gold, alpha: 0.5 });
        c.addChild(ring);
        c.ring = ring;
      }
      // la targhetta del nome (issue #20): fondino scuro + orlo, leggibile
      // anche sopra le vele bianche; il Fantasma si annuncia in tinta ostile
      const label = new Text({
        text: s.name,
        style: {
          fontFamily: 'Atkinson Hyperlegible Next, sans-serif', fontSize: 13,
          fill: s.id === selfId ? 0xbfe8a8 : (s.k === 'g' ? 0xf0937b : s.k === 'm' ? 0xcfd6d9 : 0xffc9b0),
          stroke: { color: 0x1a1208, width: 3 },
        },
      });
      label.anchor.set(0.5);
      label.baseFill = label.style.fill;
      const tag = new Container();
      const fondino = new Graphics();
      fondino.roundRect(-label.width / 2 - 6, -10, label.width + 12, 20, 9)
        .fill({ color: 0x0c141c, alpha: 0.42 });
      tag.addChild(fondino, label);
      tag.position.set(0, -44);
      tag.baseY = -44;
      const hpBar = new Graphics();
      c.addChild(tag, hpBar);
      c.tag = tag;
      c.fondino = fondino;
      c.label = label;
      c.hpBar = hpBar;
      this.shipLayer.addChild(c);
      this.ships.set(s.id, c);
    }
    this.buildShipBody(c, s, selfId);
    return c;
  }

  removeShip(id) {
    const c = this.ships.get(id);
    if (c) { c.destroy({ children: true }); this.ships.delete(id); }
  }

  updateShips(list, selfId, dt) {
    const seen = new Set();
    for (const s of list) {
      seen.add(s.id);
      const c = this.ensureShip(s, selfId);
      c.position.set(s.x, s.y);
      if (c.body.shipSprite && this.navi) {
        const atl = c.body.atlante || this.navi;
        const steps = atl.meta.steps;
        const step = (2 * Math.PI) / steps;
        let f = Math.round(-s.rot / step) % steps;
        if (f < 0) f += steps;
        if (c.body.frameIdx !== f) {
          c.body.frameIdx = f;
          c.body.shipSprite.texture = atl.frames[c.body.variant][f];
          if (c.body.veleSprite) c.body.veleSprite.texture = c.body.veleAtlante.frames[c.body.variant][f];
        }
        c.body.rotation = 0;
        c.body.ports.rotation = s.rot;
        // armi cotte: la posa segue l'angolo assoluto della bocca, la
        // posizione ruota col continuo (come i portelli vettoriali).
        // ALZO: il ponte sta sopra la linea d'acqua, e con la camera a 58°
        // un rialzo si proietta verso l'alto dello schermo — senza questo
        // scarto i pezzi sembrano galleggiare di fianco allo scafo.
        if (this.armi && c.body.gunSprites && c.body.gunSprites.length) {
          const ALZO = 2.6;
          const stepsA = this.armi.meta.steps, stepA = (2 * Math.PI) / stepsA;
          const cosR = Math.cos(s.rot), sinR = Math.sin(s.rot);
          const fL = c.body.ports.scale.x;
          for (const gs of c.body.gunSprites) {
            let fa = Math.round(-(s.rot + gs.dir) / stepA) % stepsA;
            if (fa < 0) fa += stepsA;
            gs.spr.texture = this.armi.frames[gs.key][fa];
            const px = gs.lx * fL * cosR - gs.ly * sinR;
            const py = gs.lx * fL * sinR + gs.ly * cosR;
            gs.spr.position.set(px, py - ALZO);
            gs.ombra.position.set(px, py + 0.6);
          }
        }
        // beccheggio: lo scafo danza, l'ombra resta al pelo dell'acqua
        c.body.y = Math.sin(this.t * 1.7 + (s.x + s.y) * 0.011) * 1.7;
        c.body.shipSprite.rotation = Math.sin(this.t * 1.3 + s.x * 0.013) * 0.028;
        if (c.body.veleSprite) c.body.veleSprite.rotation = c.body.shipSprite.rotation;
      } else {
        c.body.rotation = s.rot;
        c.body.y = 0;
      }
      c.visible = !s.docked;
      // il nome resta leggibile, non ingigantisce col cannocchiale
      if (c.tag) c.tag.scale.set(1 / this.zoom);
      // la bandierina di gilda (issue #5): [TAG] davanti al nome; il vessillo
      // personale (issue #25) sventola accanto se NON c'è gilda; il fondino
      // si ridisegna quando il testo cambia larghezza
      if (c.tag && c.fondino) {
        // il 🤝 degli alleati (issue #37): si riconoscono in mezzo alla battaglia
        const alleato = this.alleati && this.alleati.has(s.id) && s.id !== selfId;
        const testo = (alleato ? '🤝 ' : '') + (s.gt ? '[' + s.gt + '] ' : '') + s.name;
        const bfKey = (!s.gt && Array.isArray(s.bf)) ? s.bf.join('.') : '';
        if (c.label.text !== testo || c.tagBf !== bfKey) {
          c.label.text = testo;
          c.tagBf = bfKey;
          if (c.bandSpr) { c.bandSpr.destroy(); c.bandSpr = null; }
          const sinistra = bfKey ? 26 : 0; // lo spazio del vessillo
          c.fondino.clear().roundRect(-c.label.width / 2 - 6 - sinistra, -10, c.label.width + 12 + sinistra, 20, 9)
            .fill({ color: 0x0c141c, alpha: 0.42 });
          if (bfKey) {
            c.bandSpr = new Sprite(this.bandieraTex(s.bf));
            c.bandSpr.anchor.set(0.5);
            c.bandSpr.scale.set(0.62);
            c.bandSpr.position.set(-c.label.width / 2 - 6 - 12, 0);
            c.tag.addChild(c.bandSpr);
          }
        }
      }
      const targetAlpha = s.sunk ? 0 : 1;
      c.alpha += (targetAlpha - c.alpha) * Math.min(1, dt * 4);
      // lanterna di bordo: si accende con la notte; il galeone dorato
      // luccica sempre, e il suo riverbero respira piano
      const oro = c.body.variant === 'oro';
      const night = this.lightNow ? this.lightNow.night : 0;
      c.glow.tint = oro ? 0xffd98a : 0xffc27a;
      c.glow.alpha = s.sunk ? 0 : Math.max(
        oro ? 0.13 + 0.05 * Math.sin(this.t * 2.1) : 0,
        night * (s.id === selfId ? 0.34 : 0.27));
      const scale = s.sunk ? Math.max(0.5, c.body.scale.x - dt * 0.5) : 1;
      c.body.scale.set(scale);
      // vele che respirano col vento e con l'andatura
      const puff = 1 + 0.05 * Math.sin(this.t * 3 + (c.body.sails[0]?.phase || 0)) + Math.min(0.12, s.vel / 1400);
      for (const sail of c.body.sails || []) sail.scale.x = sail.scale.y * puff;
      if (c.body.flag) c.body.flag.rotation = 0.08 * Math.sin(this.t * 5 + s.x * 0.01);
      c.hpBar.clear();
      if (!s.sunk && s.hp < s.maxHp) {
        const w = 44, frac = clamp(s.hp / s.maxHp, 0, 1);
        c.hpBar.rect(-w / 2, -28, w, 5).fill({ color: COL.hpBg, alpha: 0.7 });
        // tre soglie come nell'HUD: il giallo avvisa PRIMA che sia tardi (#19)
        c.hpBar.rect(-w / 2, -28, w * frac, 5)
          .fill(frac > 0.6 ? COL.hpOk : frac > 0.35 ? COL.hpMid : COL.hpBad);
      }
      // il blocco (issue #15): nave spenta con l'anello del tempo che si
      // consuma; chi si è appena svincolato porta un anello dorato d'immunità
      const bloccata = (s.bk || 0) > 0;
      if (c.body.shipSprite) c.body.shipSprite.tint = bloccata ? 0x7c848d : 0xffffff;
      // la tela tinta si spegne col blocco come il resto della nave
      if (c.body.veleSprite) c.body.veleSprite.tint = bloccata ? 0x7c848d : (this.veleTinte[s.ve] ?? 0xffffff);
      if (bloccata) {
        c.hpBar.circle(0, 4, 40).stroke({ width: 2, color: 0x1a1208, alpha: 0.5 });
        c.hpBar.arc(0, 4, 40, -Math.PI / 2, -Math.PI / 2 + Math.min(1, s.bk / 18) * Math.PI * 2)
          .stroke({ width: 3, color: 0xd8552e, alpha: 0.9 });
      } else if (s.im) {
        c.hpBar.circle(0, 4, 38).stroke({ width: 2, color: COL.gold, alpha: 0.45 });
      }
      if (!s.sunk && !s.docked && s.vel > 30 && Math.random() < 0.6) {
        this.wakes.push({
          x: s.x - Math.cos(s.rot) * 22, y: s.y - Math.sin(s.rot) * 22,
          life: 1.2, max: 1.2, size: 2 + Math.random() * 3,
          color: s.sc || null, // la scia comprata (issue #25) colora la spuma
        });
      }
    }
    for (const id of this.ships.keys()) if (!seen.has(id)) this.removeShip(id);

    // anti-collisione delle targhette (issue #20): navi vicine = nomi che si
    // pestano; il più alto sale di un gradino finché non respirano (le
    // distanze si misurano in px di schermo: le targhette non zoomano)
    const targhe = [...this.ships.values()].filter(c => c.visible && c.tag);
    for (const c of targhe) c.tag.y = c.tag.baseY;
    targhe.sort((a, b) => (a.position.y + a.tag.y) - (b.position.y + b.tag.y));
    for (let i = 1; i < targhe.length; i++) {
      for (let j = 0; j < i; j++) {
        const A = targhe[j], B = targhe[i]; // A è (partiva) più in alto
        const mezzo = (A.label.width + B.label.width) / 2 + 10;
        if (Math.abs(A.position.x - B.position.x) * this.zoom > mezzo) continue;
        const dy = ((B.position.y + B.tag.y) - (A.position.y + A.tag.y)) * this.zoom;
        if (Math.abs(dy) < 22) A.tag.y -= (22 - dy) / this.zoom;
      }
    }
  }

  // --- difese delle fortezze ---

  // I fumogeni dallo snapshot: [x, y, raggio, secondi restanti]. La chiave
  // posizionale preserva l'età della nuvola fra uno snapshot e l'altro.
  updateSmokes(list) {
    const now = performance.now();
    const next = new Map();
    for (const [x, y, r, ttl] of list || []) {
      const key = x + ',' + y;
      const prev = this.smokes.get(key);
      next.set(key, { x, y, r, fine: now + ttl * 1000, nato: prev ? prev.nato : now });
    }
    this.smokes = next;
  }

  // quando un dungeon del Mastro (#38) scade, le sue difese vanno tolte dal
  // canvas: l'isola torna un approdo normale
  clearFort(islandId) {
    const g = this.forts.get(islandId);
    if (!g) return;
    g.clear();
    this.fortLayer.removeChild(g);
    g.destroy();
    this.forts.delete(islandId);
  }

  updateFort(islandId, defs) {
    let g = this.forts.get(islandId);
    if (!g) { g = new Graphics(); this.fortLayer.addChild(g); this.forts.set(islandId, g); }
    g.clear();
    for (const [kind, x, y, hp, max, dead] of defs) {
      if (dead) {
        g.poly([x - 14, y + 8, x - 5, y - 2, x + 4, y + 3, x + 13, y - 4, x + 15, y + 8]).fill({ color: COL.stoneDark, alpha: 0.75 });
        continue;
      }
      if (kind === 't') {
        g.ellipse(x + 3, y + 5, 15, 8).fill({ color: 0x000000, alpha: 0.18 });
        g.circle(x, y, 14).fill(COL.stone).stroke({ width: 2.5, color: COL.stoneDark });
        g.circle(x, y, 5.5).fill(COL.stoneDark);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          g.rect(x + Math.cos(a) * 14 - 2, y + Math.sin(a) * 14 - 2, 4, 4).fill(COL.stoneDark);
        }
        g.moveTo(x, y).lineTo(x, y - 24).stroke({ width: 2, color: 0x2a2a24 });
        g.poly([x, y - 24, x + 12, y - 20, x, y - 16]).fill(COL.banner);
      } else if (kind === 'b') {
        g.ellipse(x + 3, y + 6, 18, 9).fill({ color: 0x000000, alpha: 0.18 });
        g.circle(x, y, 16).fill(0x5a5147).stroke({ width: 3, color: 0x32291f });
        g.circle(x - 3, y - 3, 8).fill(0x241d15).stroke({ width: 2, color: 0x0f0b07 });
        g.rect(x - 14, y + 8, 28, 5).fill(0x6d4c22);
      } else {
        g.ellipse(x + 3, y + 6, 18, 9).fill({ color: 0x000000, alpha: 0.2 });
        g.circle(x, y, 17).fill(COL.mirror).stroke({ width: 3, color: 0x9c7a1e });
        g.circle(x, y, 10).fill(0xfff6d8);
        g.moveTo(x - 8, y - 8).quadraticCurveTo(x, y - 13, x + 8, y - 8).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
      }
      if (hp < max) {
        g.rect(x - 15, y - 32, 30, 4).fill({ color: COL.hpBg, alpha: 0.7 });
        g.rect(x - 15, y - 32, 30 * clamp(hp / max, 0, 1), 4).fill(COL.banner);
      }
    }
  }

  // --- proiettili & effetti ---

  spawnShots(shots) {
    for (const s of shots) {
      this.shots.push({ ...s, ttl0: s.ttl });
      // lampo di bocca + sbuffo di fumo
      this.particles.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0.12, max: 0.12, size: 6, color: 0xffe9a0, drag: 0 });
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          x: s.x, y: s.y,
          vx: s.vx * 0.06 + (Math.random() - 0.5) * 26, vy: s.vy * 0.06 + (Math.random() - 0.5) * 26,
          life: 0.9 + Math.random() * 0.5, max: 1.4, size: 3 + Math.random() * 3, color: 0xcfcfcf, drag: 1.6,
        });
      }
    }
  }

  fx(kind, x, y, extra = {}) {
    const P = this.particles;
    const burst = (n, opts) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = opts.v * (0.4 + Math.random());
        P.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: opts.life * (0.6 + Math.random() * 0.7), max: opts.life,
          size: opts.size * (0.6 + Math.random() * 0.8), color: opts.color, drag: opts.drag ?? 2,
        });
      }
    };
    if (kind === 'splash') burst(8, { v: 55, life: 0.6, size: 2.6, color: 0xbfe2f2 });
    else if (kind === 'hit') { burst(10, { v: 90, life: 0.5, size: 3, color: 0xffb347 }); burst(8, { v: 40, life: 1.1, size: 4, color: 0x4a4a4a }); }
    else if (kind === 'thud') burst(7, { v: 45, life: 0.6, size: 3, color: 0xcbb684 });
    else if (kind === 'boom') {
      burst(18, { v: 120, life: 0.7, size: 4, color: 0xffb347 });
      burst(12, { v: 60, life: 1.3, size: 5, color: 0x53585c });
      this.rings.push({ x, y, r: 8, maxR: (extra.r || 70) + 16, life: 0.5, max: 0.5 });
    } else if (kind === 'sink') {
      burst(22, { v: 70, life: 1.6, size: 5, color: 0x53585c });
      burst(14, { v: 45, life: 1.2, size: 3.5, color: 0xbfe2f2 });
      this.rings.push({ x, y, r: 10, maxR: 60, life: 0.8, max: 0.8 });
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 60;
        this.debris.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 4,
          w: 6 + Math.random() * 8, h: 2.5, life: 2.4 + Math.random(), max: 3,
        });
      }
    } else if (kind === 'towerdown') {
      burst(20, { v: 95, life: 1.2, size: 4.5, color: 0x8d8d7a });
      this.rings.push({ x, y, r: 6, maxR: 46, life: 0.5, max: 0.5 });
    } else if (kind === 'beam') {
      this.beams.push({ x1: x, y1: y, x2: extra.x2, y2: extra.y2, life: 0.3, max: 0.3 });
      burst(4, { v: 50, life: 0.4, size: 3, color: 0xffe9a0 });
    } else if (kind === 'ram') {
      // il telegrafo dello Speronamento: schiuma e anello alla partenza
      burst(12, { v: 75, life: 0.5, size: 3, color: 0xd9edf7 });
      this.rings.push({ x, y, r: 6, maxR: 42, life: 0.4, max: 0.4 });
    }
  }

  setDest(island) { this.dest = island; }

  // gli alleati della sessione (issue #37): il nome si veste del 🤝
  setAlleati(ids) { this.alleati = ids || null; }

  // --- frame ---

  frame(dt, cam, me) {
    this.t += dt;
    const w = this.app.renderer.width, h = this.app.renderer.height;

    this.shake = Math.max(0, this.shake - dt * 26);
    const shx = (Math.random() - 0.5) * this.shake, shy = (Math.random() - 0.5) * this.shake;

    // zoom del cannocchiale: il mondo scala, l'interfaccia no
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 6);
    const z = this.zoom;
    this.world.scale.set(z);
    const hw = w / (2 * z), hh = h / (2 * z);
    const cx = clamp(cam.x, hw, Math.max(hw, (this.W || w) - hw));
    const cy = clamp(cam.y, hh, Math.max(hh, (this.H || h) - hh));
    this.world.position.set(w / 2 - cx * z + shx, h / 2 - cy * z + shy);

    // le etichette del mondo non si perdono sotto l'HUD (issue #20, F17):
    // dove il pannello di bordo o la minimappa coprono, la scritta si
    // dissolve invece di sparire tagliata
    this._hudFadeT = (this._hudFadeT || 0) - dt;
    if (this._hudFadeT <= 0) {
      this._hudFadeT = 0.12;
      const wx = this.world.position.x, wy = this.world.position.y;
      for (const label of this.labels.values()) {
        const sx = label.x * z + wx, sy = label.y * z + wy;
        const sotto = (sx < 300 && sy > h - 175) || (sx > w - 275 && sy > h - 275) || sy < 60;
        label.alpha += ((sotto ? 0.15 : 1) - label.alpha) * 0.45;
      }
    }

    // luce del ciclo giorno/notte: acqua, tinta del mondo, meteo
    const light = this.lightNow = lightNow();
    this.water.zoom = z;
    if (!this.noWater) this.water.update(dt, cx - hw - shx / z, cy - hh - shy / z, w, h, light);
    if (this.tintOverlay) {
      this.tintOverlay.width = w; this.tintOverlay.height = h;
      if (this._tintHex !== light.tintHex) {
        this._tintHex = light.tintHex;
        const g = this.tintCanvas.getContext('2d');
        g.fillStyle = '#' + light.tintHex.toString(16).padStart(6, '0');
        g.fillRect(0, 0, 8, 8);
        this.tintTexture.source.update();
      }
    } else {
      this.world.tint = light.tintHex;
    }

    if (this.cloudShadows.visible) {
      this.cloudShadows.width = w; this.cloudShadows.height = h;
      this.cloudShadows.tilePosition.set((-cx * 0.92 + this.t * 10) * z, (-cy * 0.92 + this.t * 4.5) * z);
      this.cloudShadows.alpha = 0.22 * light.cloud;
    }

    // nebbia e lanterna seguono la nave (in coordinate schermo)
    const meX = me ? w / 2 + (me.x - cx) * z + shx : w / 2;
    const meY = me ? h / 2 + (me.y - cy) * z + shy : h / 2;
    const cover = Math.max(w, h) * 1.8;
    this.fog.visible = light.fog > 0.01;
    if (this.fog.visible) {
      this.fog.position.set(meX, meY);
      this.fog.width = cover; this.fog.height = cover;
      this.fog.alpha = light.fog;
    }
    this.lantern.visible = light.night > 0.02;
    if (this.lantern.visible) {
      this.lantern.position.set(meX, meY);
      this.lantern.scale.set(1.5 + 0.05 * Math.sin(this.t * 7.3));
      this.lantern.alpha = light.night * (0.38 + 0.05 * Math.sin(this.t * 11));
    }

    this.vignette.width = w; this.vignette.height = h;

    for (const b of this.lightBeams) {
      if (b.isHalo) { b.alpha = 0.18 + light.night * 0.5; continue; }
      b.rotation = this.t * 0.6;
      b.alpha = 0.13 + light.night * 0.45;
    }
    for (const f of this.foamGfx) f.alpha = 0.16 + 0.12 * Math.sin(this.t * 1.6 + f.phase);

    // proiettili (i colpi ad arco "volano": ombra a terra, palla che sale)
    // Di notte le palle di ferro sparirebbero nel buio: sbiancano col calare
    // della luce, così restano leggibili (per chi spara e per chi schiva).
    const ballCol = mixHex(0x1d1d1d, 0xeef3f6, light.night);
    const ballArcCol = mixHex(0x26211a, 0xeef3f6, light.night);
    this.shotGfx.clear();
    this.shots = this.shots.filter(s => {
      s.x += s.vx * dt; s.y += s.vy * dt; s.ttl -= dt;
      if (s.ttl <= 0) return false;
      if (s.arc) {
        const prog = 1 - s.ttl / s.ttl0;
        const alt = Math.sin(Math.PI * prog) * 26;
        this.shotGfx.ellipse(s.x, s.y + 6, 5 * (1 - alt / 60), 2.5).fill({ color: 0x000000, alpha: 0.3 });
        this.shotGfx.circle(s.x, s.y - alt, 4.5).fill(ballArcCol);
        this.shotGfx.circle(s.x - 1.5, s.y - alt - 1.5, 1.5).fill({ color: 0xffffff, alpha: 0.5 + light.night * 0.4 });
      } else {
        this.shotGfx.circle(s.x + 2, s.y + 3, 3).fill({ color: 0x000000, alpha: 0.25 });
        this.shotGfx.circle(s.x, s.y, 3).fill(ballCol);
        this.shotGfx.circle(s.x - 1, s.y - 1, 1).fill({ color: 0xffffff, alpha: 0.5 + light.night * 0.4 });
      }
      return true;
    });

    // scie
    this.wakeGfx.clear();
    this.wakes = this.wakes.filter(p => {
      p.life -= dt;
      if (p.life <= 0) return false;
      this.wakeGfx.circle(p.x, p.y, p.size * (1 + (1 - p.life / p.max)))
        .fill({ color: p.color || 0xd9edf7, alpha: (p.color ? 0.42 : 0.3) * (p.life / p.max) });
      return true;
    });

    // particelle, anelli d'urto, relitti
    this.fxGfx.clear();
    this.particles = this.particles.filter(p => {
      p.life -= dt;
      if (p.life <= 0) return false;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx -= p.vx * p.drag * dt; p.vy -= p.vy * p.drag * dt;
      this.fxGfx.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: 0.85 * (p.life / p.max) });
      return true;
    });
    this.rings = this.rings.filter(r => {
      r.life -= dt;
      if (r.life <= 0) return false;
      const prog = 1 - r.life / r.max;
      this.fxGfx.circle(r.x, r.y, r.r + (r.maxR - r.r) * prog).stroke({ width: 3, color: 0xeaf6fc, alpha: 0.5 * (r.life / r.max) });
      return true;
    });
    this.debris = this.debris.filter(d => {
      d.life -= dt;
      if (d.life <= 0) return false;
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.vx *= (1 - dt); d.vy *= (1 - dt);
      d.rot += d.vr * dt;
      const cos = Math.cos(d.rot), sin = Math.sin(d.rot);
      const hw = d.w / 2, hh = d.h / 2;
      this.fxGfx.poly([
        d.x - hw * cos + hh * sin, d.y - hw * sin - hh * cos,
        d.x + hw * cos + hh * sin, d.y + hw * sin - hh * cos,
        d.x + hw * cos - hh * sin, d.y + hw * sin + hh * cos,
        d.x - hw * cos - hh * sin, d.y - hw * sin + hh * cos,
      ]).fill({ color: 0x6b4a2f, alpha: 0.9 * Math.min(1, d.life) });
      return true;
    });

    // il raggio dello Specchio Ustorio
    this.beamGfx.clear();
    this.beams = this.beams.filter(b => {
      b.life -= dt;
      if (b.life <= 0) return false;
      const a = b.life / b.max;
      this.beamGfx.moveTo(b.x1, b.y1).lineTo(b.x2, b.y2).stroke({ width: 9, color: 0xffe9a0, alpha: 0.25 * a });
      this.beamGfx.moveTo(b.x1, b.y1).lineTo(b.x2, b.y2).stroke({ width: 3.5, color: 0xfff6d8, alpha: 0.85 * a });
      this.beamGfx.circle(b.x2, b.y2, 7).fill({ color: 0xffe9a0, alpha: 0.5 * a });
      return true;
    });

    // i fumogeni: ciuffi che respirano, deterministici (niente sfarfallio)
    this.smokeGfx.clear();
    if (this.smokes.size) {
      const nowMs = performance.now();
      for (const [key, s] of this.smokes) {
        const left = (s.fine - nowMs) / 1000;
        if (left <= 0) { this.smokes.delete(key); continue; }
        const alpha = Math.min(1, (nowMs - s.nato) / 450) * Math.min(1, left / 1.5);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + s.x;
          const wob = Math.sin(this.t * 0.7 + i * 1.7 + s.y) * 6;
          const d = i === 0 ? 0 : s.r * 0.52 + wob;
          const rr = (i === 0 ? s.r * 0.62 : s.r * 0.46) + wob;
          this.smokeGfx.circle(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, rr)
            .fill({ color: i % 2 ? 0x8e99a3 : 0x76818b, alpha: alpha * 0.5 });
        }
      }
    }

    // la bussola della rotta (issue #22): meta fuori schermo → freccia al
    // bordo dello schermo, orientata verso la meta, con le leghe che scalano
    this.bussola.visible = false;
    if (this.dest && me && !me.docked) {
      const sx = this.dest.x * z + this.world.position.x;
      const sy = this.dest.y * z + this.world.position.y;
      if (sx < 0 || sy < 0 || sx > w || sy > h) {
        const vx = sx - w / 2, vy = sy - h / 2;
        const k = Math.min((w / 2 - 46) / Math.abs(vx || 1e-9), (h / 2 - 46) / Math.abs(vy || 1e-9));
        // margini asimmetrici: la topbar in alto e la legenda in basso coprono
        this.bussola.position.set(
          clamp(w / 2 + vx * k, 46, w - 46),
          clamp(h / 2 + vy * k, 78, h - 66));
        const ang = Math.atan2(vy, vx);
        this.bussolaFreccia.rotation = ang;
        const leghe = Math.max(1, Math.round(Math.hypot(this.dest.x - me.x, this.dest.y - me.y) / 100));
        const testo = `${leghe} leghe`;
        if (this.bussolaTesto.text !== testo) this.bussolaTesto.text = testo;
        this.bussolaTesto.position.set(-Math.cos(ang) * 36, -Math.sin(ang) * 36);
        this.bussola.visible = true;
      }
    }

    // rotta verso la destinazione
    this.routeGfx.clear();
    if (this.dest && me) {
      const d = this.dest;
      const dx = d.x - me.x, dy = d.y - me.y;
      const dist = Math.hypot(dx, dy);
      if (dist > d.r + 60) {
        const ux = dx / dist, uy = dy / dist;
        for (let s = 40; s < dist - d.r; s += 30) {
          this.routeGfx.moveTo(me.x + ux * s, me.y + uy * s)
            .lineTo(me.x + ux * Math.min(s + 15, dist - d.r), me.y + uy * Math.min(s + 15, dist - d.r))
            .stroke({ width: 3, color: COL.route, alpha: 0.55 });
        }
      }
      const pulse = 10 + Math.sin(this.t * 4) * 3;
      this.routeGfx.moveTo(d.x - pulse, d.y - pulse).lineTo(d.x + pulse, d.y + pulse)
        .moveTo(d.x + pulse, d.y - pulse).lineTo(d.x - pulse, d.y + pulse)
        .stroke({ width: 5, color: 0xd8552e, alpha: 0.8 });
    }
  }
}
