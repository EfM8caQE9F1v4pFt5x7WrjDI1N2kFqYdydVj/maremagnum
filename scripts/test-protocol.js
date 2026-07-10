'use strict';
// Test end-to-end del protocollo v2. Avvia un server dedicato con WEAK_FORTS=1
// (difese di cartapesta che non sparano) e simula due giocatori reali.
//
// Uso: npm test

const { spawn } = require('child_process');
const path = require('path');

const PORT = 3299;
const URL = `ws://localhost:${PORT}`;
const PORTO = { x: 3000, y: 3000 };

let failures = 0;
function ok(cond, label) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + label);
  if (!cond) failures++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function norm(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

class Player {
  constructor(name, profile, spawn) {
    this.name = name;
    this.profile = profile || {};
    this.spawn = spawn;
    this.msgs = [];
    this.snap = null;
    this.id = null;
    this.welcome = null;
    this.ws = new WebSocket(URL);
    this.ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'snap') { this.snap = m; return; }
      m._rx = Date.now(); // per misurare le cadenze (es. ricarica con la Ciurma)
      this.msgs.push(m);
      if (m.t === 'welcome') { this.welcome = m; this.id = m.id; }
    });
    this.opened = new Promise(res => this.ws.addEventListener('open', res));
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  async join() { await this.opened; this.send({ t: 'join', name: this.name, profile: this.profile, spawn: this.spawn }); await this.wait(m => m.t === 'welcome'); }
  async wait(pred, timeout = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const i = this.msgs.findIndex(pred);
      if (i >= 0) return this.msgs.splice(i, 1)[0];
      await sleep(40);
    }
    return null;
  }
  me() { return this.snap && this.snap.ships.find(s => s.id === this.id); }
  find(id) { return this.snap && this.snap.ships.find(s => s.id === id); }
  fort(islandId) { return this.snap && this.snap.forts.find(f => f.i === islandId); }
  input(o) { this.send({ t: 'input', up: false, down: false, left: false, right: false, ...o }); }

  // Naviga fino a un punto e (opzionale) frena in prossimità. Ritorna quando vicino.
  async goto(tx, ty, near = 190, timeout = 60000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const me = this.me();
      if (me && !me.sunk) {
        const d = Math.hypot(tx - me.x, ty - me.y);
        if (d <= near) { this.input({ down: true }); if (me.vel < 40) { this.input({}); return true; } }
        else {
          const turn = norm(Math.atan2(ty - me.y, tx - me.x) - me.rot);
          this.input({ up: true, left: turn < -0.1, right: turn > 0.1 });
        }
      }
      await sleep(120);
    }
    return false;
  }
}

async function main() {
  console.log('— Avvio server di test (WEAK_FORTS) —');
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT, WEAK_FORTS: '1', DEV_UID_OK: '1', OG_FINTO: '1', SENZA_T0: '1' }, stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/health`); if (r.ok) break; } catch { /* riprova */ }
    await sleep(300);
  }

  try {
    // Timone 99 su Olonese (che sta fermo): testa il clamp senza scombussolare
    // l'autopilota di Barbanera, tarato sulla virata di base
    const A = new Player('Barbanera', { gold: 99999, crewLvl: 4 });
    const B = new Player('Olonese', { gold: 1000, holdLvl: 2, helmLvl: 99 });
    await A.join(); await B.join();

    console.log('— Benvenuto, arsenale, mondo —');
    ok(A.welcome.arsenal && A.welcome.arsenal.types.colubrina, 'il welcome porta il catalogo delle armi');
    ok(A.welcome.you.mounts.left.length === 1 && A.welcome.you.mounts.left[0].type === 'colubrina', 'nave base: 1 colubrina per lato');
    ok(A.welcome.you.gold === 99999, 'profilo (oro) accettato');
    ok(A.welcome.you.crewLvl === 4, 'punti nave dal profilo (Ciurma 4)');
    ok(B.welcome.you.helmLvl === 4 && B.welcome.you.holdLvl === 2 && B.welcome.you.gold === 1000,
      'Stiva di Olonese dal profilo, timone tosato al tetto (99 → 4)');
    const bDiA = await A.wait(m => m.t === 'bacheca' && Array.isArray(m.giornaliere) && m.giornaliere.length === 3, 4000);
    ok(!!bDiA, 'le tre del giorno arrivano al join, auto-attive (niente offerte da accettare)');

    console.log('— Le tre del giorno: uguali per tutti, accetta è un no-op —');
    const N = new Player('Novellino', {});
    await N.join();
    const b0 = await N.wait(m => m.t === 'bacheca', 4000);
    ok(b0 && b0.giornaliere.length === 3 && b0.giornaliere.every(m => !m.fatta && m.progress === 0),
      'anche il profilo vergine ha subito le sue tre, tutte da compiere');
    ok(b0.tris && !b0.tris.fatto && b0.strike && b0.settimana && b0.scadenza > Date.now(),
      'il conto del giorno viaggia con la bacheca: tris, strike, settimana, scadenza');
    ok(!!bDiA && JSON.stringify(bDiA.giornaliere.map(m => m.id + m.desc)) === JSON.stringify(b0.giornaliere.map(m => m.id + m.desc)),
      'le tre del giorno sono le STESSE per ogni capitano (seme = giorno)');
    N.send({ t: 'accetta', id: b0.giornaliere[0].id });
    ok(!!await N.wait(m => m.t === 'toast' && /si accettano da sole/.test(m.msg), 4000),
      'accetta è un no-op gentile: niente rifornimento infinito di missioni');

    console.log('— Le Alleanze temporanee (#37): invito, stato, bandiera aperta —');
    const M = new Player('Compare', {});
    await M.join();
    const ba0 = await M.wait(m => m.t === 'alleanzeAperte', 4000);
    ok(ba0 && Array.isArray(ba0.bandiere), 'al join arrivano le bandiere aperte (elenco, anche vuoto)');
    N.send({ t: 'alleanzaInvita', id: M.id });
    const inv = await M.wait(m => m.t === 'alleanzaInvito', 4000);
    ok(inv && inv.da && inv.da.nome === 'Novellino' && inv.ttl > 0, "l'invito d'alleanza arriva al destinatario, con la scadenza");
    M.send({ t: 'alleanzaAccetta', id: inv.da.id });
    ok(!!await M.wait(m => m.t === 'alleanza' && m.membri && m.membri.length === 2, 4000),
      'accettando, lo stato (2 vele) arriva a chi accetta');
    ok(!!await N.wait(m => m.t === 'alleanza' && m.membri && m.membri.length === 2, 4000),
      'e anche a chi ha invitato');
    M.send({ t: 'alleanzaLascia' });
    ok(!!await N.wait(m => m.t === 'alleanza' && m.membri === null, 4000),
      'chi resta solo senza bandiera è sciolto: membri null');
    M.send({ t: 'alleanzaApri' });
    const ba1 = await N.wait(m => m.t === 'alleanzeAperte' && m.bandiere.length === 1, 4000);
    ok(ba1 && ba1.bandiere[0].posti === 3 && ba1.bandiere[0].nomi.includes('Compare'),
      'la bandiera aperta di uno solo sventola in broadcast (recluta, 3 posti)');
    N.send({ t: 'alleanzaUnisciti', id: ba1.bandiere[0].id });
    ok(!!await N.wait(m => m.t === 'alleanza' && m.membri && m.membri.length === 2, 4000),
      'con la bandiera aperta ci si unisce senza invito');
    N.send({ t: 'alleanzaLascia' });
    ok(!!await M.wait(m => m.t === 'alleanza' && m.membri && m.membri.length === 1 && m.aperta, 4000),
      'la bandiera aperta sopravvive in uno: sta reclutando');
    M.send({ t: 'alleanzaChiudi' });
    ok(!!await M.wait(m => m.t === 'alleanza' && m.membri === null, 4000),
      'ammainata la bandiera da soli, l\'alleanza svanisce');
    M.ws.close();

    console.log('— Tipi di nave: grandfathering e frontiera di fiducia —');
    // profilo sporco: tipo inventato, Organo comprato ai vecchi tempi,
    // e un'esclusiva di un ALTRO tipo infilata di contrabbando
    const C = new Player('Mastro Organista', {
      gold: 13000, tipo: 'sgorbio',
      mounts: { left: [{ type: 'organo', lvl: 2 }], right: [{ type: 'lunga', lvl: 1 }] },
    });
    await C.join();
    ok(C.welcome.you.tipo === 'galeone', 'grandfathering: chi ha l\'Organo senza tipo è Galeone d\'ufficio');
    ok(C.welcome.you.mounts.left[0].type === 'organo' && C.welcome.you.mounts.left[0].lvl === 2, 'l\'Organo pagato resta a bordo');
    ok(C.welcome.you.mounts.right[0].type === 'colubrina', 'la Colubrina Lunga di contrabbando è rifiutata al join');
    await sleep(500);
    const cGaleone = C.me();
    ok(cGaleone && cGaleone.tp === 3 && cGaleone.maxHp === 240,
      `lo snapshot veste il tipo: Galeone corazzato (tp=3, ${cGaleone && cGaleone.maxHp}/240 HP)`);

    console.log('— Ciurma al completo: ricarica misurata —');
    // colubrina L1: 2.0s di base; con Ciurma 4 (−28%) attesi ~1440ms fra le bordate
    const spam = setInterval(() => A.send({ t: 'fire', group: 'left' }), 80);
    await sleep(3700);
    clearInterval(spam);
    const bordate = A.msgs.filter(m => m.t === 'shots' && m.from === A.id).map(m => m._rx);
    A.msgs = A.msgs.filter(m => !(m.t === 'shots' && m.from === A.id));
    const gaps = bordate.slice(1).map((t, i) => t - bordate[i]);
    ok(bordate.length >= 3, `bordate a raffica registrate: ${bordate.length}`);
    ok(gaps.length > 0 && gaps.every(g => g > 1200 && g < 1850),
      `la Ciurma accorcia la ricarica: ${gaps.join(', ')} ms (base 2000, attesi ~1440)`);

    console.log('— Il varo: Mastro Organista cambia rotta —');
    ok(await C.goto(PORTO.x, PORTO.y, 195, 40000), 'il Galeone raggiunge il Porto Franco');
    let cshop = null;
    for (let i = 0; i < 20 && !cshop; i++) {
      C.send({ t: 'dock' });
      cshop = await C.wait(m => m.t === 'shop', 1200);
    }
    ok(!!cshop, 'attracco: il cantiere apre');
    ok(cshop && cshop.varo && cshop.varo.tipo === 'galeone' && cshop.varo.cost === 90,
      'il cantiere espone il varo: tipo attuale e primo prezzo (90)');
    ok(cshop && cshop.ship.hullCost === 45, 'sconto di tipo: lo Scafo del Galeone è a metà prezzo (45)');
    C.send({ t: 'varo', tipo: 'galeone' });
    ok(!!await C.wait(m => m.t === 'toast' && /già la tua nave/.test(m.msg), 3000), 'varare lo stesso tipo è rifiutato senza spese');
    C.send({ t: 'varo', tipo: 'goletta' });
    ok(!!await C.wait(m => m.t === 'gold' && m.delta === 14550, 3000), 'l\'Organo L2 è riscattato al prezzo pieno pagato (14550 🪙)');
    cshop = await C.wait(m => m.t === 'shop', 3000);
    ok(cshop && cshop.varo.tipo === 'goletta' && cshop.varo.cost === 180, 'ora è Goletta; il prossimo varo costa il doppio (180)');
    ok(cshop && cshop.gold === 13000 - 90 + 14550, `i conti tornano: ${cshop && cshop.gold} 🪙 (13000 − 90 + 14550)`);
    ok(cshop && cshop.mounts.left[0].type === 'colubrina' && cshop.mounts.left[0].lvl === 1, 'lo slot dell\'Organo riparte con la colubrina');
    ok(cshop && cshop.ship.helmCost === 45, 'lo sconto segue il tipo: ora è il Timone a metà prezzo (45)');
    ok(cshop && cshop.groups.bow.max === 3 && cshop.groups.left.max === 4,
      'il cantiere espone la matrice del tipo: la goletta punge di prua (3) e accorcia le fiancate (4)');

    console.log('— Il Negozio delle Livree (issue #25) —');
    ok(cshop && cshop.negozio && cshop.negozio.catalogo.nera && cshop.negozio.possedute.length === 0,
      'il negozio è in vetrina col catalogo (guardaroba vuoto)');
    C.send({ t: 'compraLivrea', id: 'scarlatta' });
    let cneg = await C.wait(m => m.t === 'shop' && m.negozio && m.negozio.possedute.includes('scarlatta'), 3000);
    ok(!!cneg, 'livrea comprata: è nel guardaroba');
    ok(cneg && cneg.negozio.livrea === 'scarlatta', 'appena comprata, addosso');
    ok(cneg && cneg.gold === 27460 - 15000, `il conto torna: ${cneg && cneg.gold} 🪙 (27460 − 15000)`);
    C.send({ t: 'compraLivrea', id: 'ombre' });
    ok(!!await C.wait(m => m.t === 'toast' && /si guadagna/.test(m.msg), 3000),
      'l\'edizione-impresa non si compra: si guadagna');
    C.send({ t: 'bandiera', bandiera: { fondo: 1, taglio: 2, tinta2: 4, emblema: 0, tintaEmblema: 5 } });
    await sleep(600);
    const cVestita = C.me();
    ok(cVestita && cVestita.lv === 'scarlatta', 'la livrea viaggia nello snapshot (lv)');
    ok(cVestita && cVestita.sc === 0xc2453a, `la scia della livrea colora la spuma (sc=${cVestita && cVestita.sc})`);
    ok(cVestita && Array.isArray(cVestita.bf) && cVestita.bf.join('.') === '1.2.4.0.5',
      'il vessillo personale sventola in targhetta (bf)');
    C.send({ t: 'indossaLivrea', id: null, genere: 'livrea' });
    cneg = await C.wait(m => m.t === 'shop' && m.negozio
      && m.negozio.livrea === null && m.negozio.possedute.includes('scarlatta'), 3000);
    ok(!!cneg, 'riposta nel guardaroba: si torna al legno nudo');

    console.log('— Le vele separate dalle livree —');
    ok(cneg && cneg.negozio.catalogo.velenere && cneg.negozio.catalogo.velenere.genere === 'vele'
      && typeof cneg.negozio.catalogo.velenere.tinta === 'number',
      'il catalogo espone le vele col loro genere e la tinta della tela');
    C.send({ t: 'compraLivrea', id: 'velenere' });
    cneg = await C.wait(m => m.t === 'shop' && m.negozio && m.negozio.possedute.includes('velenere'), 3000);
    ok(cneg && cneg.negozio.vele === 'velenere' && cneg.negozio.livrea === null,
      'le vele comprate vestono il LORO slot: la livrea non si muove');
    // la trappola disinnescata: un id posseduto non si indossa nel genere sbagliato
    C.send({ t: 'indossaLivrea', id: 'scarlatta', genere: 'scia' });
    C.send({ t: 'indossaLivrea', id: 'velenere', genere: 'livrea' });
    await sleep(600);
    C.send({ t: 'indossaLivrea', id: null, genere: 'vele' });
    // il predicato include possedute: i messaggi shop di PRIMA dell'acquisto
    // hanno anche loro vele=null e ingannerebbero la wait (che scava nel buffer)
    cneg = await C.wait(m => m.t === 'shop' && m.negozio && m.negozio.vele === null
      && m.negozio.possedute.includes('velenere'), 3000);
    ok(cneg && cneg.negozio.scia === null && cneg.negozio.livrea === null,
      'i generi non si scambiano gli slot (la trappola livree/vele è chiusa)');
    C.send({ t: 'indossaLivrea', id: 'velenere', genere: 'vele' });
    await C.wait(m => m.t === 'shop' && m.negozio && m.negozio.vele === 'velenere', 3000);
    await sleep(600);
    const cTela = C.me();
    ok(cTela && cTela.ve === 'velenere', 'le vele viaggiano nello snapshot (ve)');
    ok(cTela && !cTela.lv, 'senza livrea lo snapshot non porta lv: la tela basta a sé');

    console.log('— Il Cartellone dell\'isola (issue #27) —');
    // lo spawn all'approdo mette la nave a r+100 dal centro: già accostata
    const O = new Player('Accostatore', { gold: 100 }, 'collaudo-og.example');
    await O.join();
    O.send({ t: 'cartellone', dominio: 'collaudo-og.example' });
    const cart = await O.wait(m => m.t === 'cartellone' && m.dominio === 'collaudo-og.example', 4000);
    ok(!!cart, 'accostandosi il cartellone arriva');
    ok(cart && cart.og.titolo === 'Il Sito Finto & Collaudato', `og:title servito e decodificato ("${cart && cart.og.titolo}")`);
    ok(cart && /collaudo/.test(cart.og.descrizione), 'og:description servita');
    ok(cart && cart.og.img === true, 'l\'immagine è annunciata (la serve il proxy /og-img)');
    // il porto non è un sito: il server tace
    O.send({ t: 'cartellone', dominio: 'porto' });
    ok(!await O.wait(m => m.t === 'cartellone' && m.dominio === 'porto', 1200), 'il Porto Franco non fa pubblicità (silenzio)');
    O.ws.close();
    await sleep(500);
    const cGoletta = C.me();
    ok(cGoletta && cGoletta.tp === 1 && cGoletta.maxHp === 170,
      `snapshot rivestito: Goletta (tp=1, ${cGoletta && cGoletta.maxHp}/170 HP)`);
    C.ws.close();

    console.log('— Abilità di tipo (tasto R) —');
    // Bordata Doppia: canne fresche all'istante e palle raddoppiate
    const G = new Player('Bombardiere', { tipo: 'galeone' });
    await G.join();
    G.send({ t: 'fire', group: 'left' });
    let volley = await G.wait(m => m.t === 'shots' && m.from === G.id, 3000);
    ok(volley && volley.shots.length === 1, 'colubrina a riposo: una palla per volta');
    G.send({ t: 'fire', group: 'left' });
    ok(!await G.wait(m => m.t === 'shots' && m.from === G.id, 700), 'canna calda: il secondo colpo non parte');
    G.send({ t: 'abilita' });
    ok(!!await G.wait(m => m.t === 'abilita' && m.nome === 'Bordata Doppia' && m.cd === 40, 3000), 'Bordata Doppia attivata (ack col cooldown)');
    G.send({ t: 'fire', group: 'left' });
    volley = await G.wait(m => m.t === 'shots' && m.from === G.id, 3000);
    ok(volley && volley.shots.length === 2, 'ricarica azzerata e palle RADDOPPIATE');
    G.send({ t: 'abilita' });
    ok(!!await G.wait(m => m.t === 'toast' && /⏳/.test(m.msg), 3000), 'abilità scarica: il mare dice di aspettare');
    G.ws.close();
    // il Fumogeno entra nello snapshot (i client lo disegnano, le IA lo temono)
    const F = new Player('Fumaiolo', { tipo: 'guerra' });
    await F.join();
    F.send({ t: 'abilita' });
    ok(!!await F.wait(m => m.t === 'abilita' && m.nome === 'Fumogeno', 3000), 'Fumogeno attivato');
    await sleep(500);
    const sm = F.snap && F.snap.sm;
    ok(!!sm && sm.length >= 1 && sm[0][2] === 150 && sm[0][3] > 7,
      `la nuvola è nello snapshot (r=${sm && sm[0][2]}, ${sm && sm[0][3]}s restanti)`);
    F.ws.close();
    // senza varo, niente abilità
    B.send({ t: 'abilita' });
    ok(!await B.wait(m => m.t === 'abilita', 800), 'senza tipo il server ignora il tasto R');
    // Speronamento: carica a vele spiegate e mazzata da contatto
    const D = new Player('Ariete', { tipo: 'goletta' });
    const E = new Player('Bersaglio');
    await D.join(); await E.join();
    await sleep(5300); // la tregua d'arrivo del bersaglio deve spegnersi
    const eShip = () => D.find(E.id);
    ok(!!eShip(), 'il bersaglio è in vista');
    // avvicinati, PUNTA la prua, poi carica; se la geometria rema contro
    // (isole sulla rotta), riprova una volta a cooldown scaduto
    let speronato = false, ackRam = false;
    for (let tentativo = 0; tentativo < 2 && !speronato; tentativo++) {
      if (tentativo) await sleep(31000); // lo Speronamento si ricarica (30s)
      if (!await D.goto(eShip().x, eShip().y, 120, 60000)) continue;
      for (let i = 0; i < 25; i++) {
        const me = D.me(), tgt = eShip();
        const turn = norm(Math.atan2(tgt.y - me.y, tgt.x - me.x) - me.rot);
        if (Math.abs(turn) < 0.15) break;
        D.input({ left: turn < 0, right: turn > 0 });
        await sleep(80);
      }
      D.send({ t: 'abilita' });
      ackRam = !!await D.wait(m => m.t === 'abilita' && m.nome === 'Speronamento', 3000) || ackRam;
      const tRam = Date.now();
      while (Date.now() - tRam < 4500 && !speronato) {
        const me = D.me(), tgt = eShip();
        // la speronata ha DUE firme (ramTick colpisce entrambi): bersaglio
        // −42 E pegno del legno — l'hp del bersaglio da solo inganna, un
        // Fantasma di passaggio può morderlo durante la carica
        if (tgt && tgt.hp <= 160 && me && me.hp <= 161) { speronato = true; break; }
        if (me && tgt) {
          const turn = norm(Math.atan2(tgt.y - me.y, tgt.x - me.x) - me.rot);
          D.input({ up: true, left: turn < -0.08, right: turn > 0.08 });
        }
        await sleep(80);
      }
      D.input({});
    }
    ok(ackRam, 'Speronamento attivato');
    ok(speronato, `speronato: il bersaglio incassa la prua (${eShip() && eShip().hp}/200)`);
    ok(speronato && D.me() && D.me().hp <= 161, `lo speronatore paga il pegno di legno (${D.me() && D.me().hp}/170)`);
    D.ws.close(); E.ws.close();

    console.log('— Isole effimere sotto soglia (issue #26bis) —');
    // chi naviga verso un sito nuovo lo vede (arriva nella risposta course),
    // ma resta affar suo: non affolla la mappa degli altri finché non è meta
    // condivisa (≥20 approdi). Anti-esplosione.
    const N1 = new Player('Esploratore', { gold: 100 });
    await N1.join();
    N1.send({ t: 'course', q: 'sito-mai-visto-xyz.example' });
    const rottaN = await N1.wait(m => m.t === 'course' && m.ok, 4000);
    ok(rottaN && rottaN.island.domain === 'sito-mai-visto-xyz.example',
      'chi traccia la rotta riceve l\'isola effimera nella risposta course');
    const N2 = new Player('Nuovo Arrivato', { gold: 100 });
    await N2.join();
    ok(!N2.welcome.islands.some(i => i.domain === 'sito-mai-visto-xyz.example'),
      'un sito sotto soglia NON affolla il welcome di un altro capitano');
    ok(N2.welcome.islands.every(i => i.kind !== 'site' || i.domain),
      'la mappa condivisa porta solo isole con un dominio valido');
    N1.ws.close(); N2.ws.close();

    console.log('— La flotta cresce (issue #11): Sciabecco e matrice del legno —');
    // il quarto tipo: vele latine, Falconetto di casa, Colpo di Vento
    const S = new Player('Levantino', {
      gold: 500, tipo: 'sciabecco',
      mounts: { left: [{ type: 'falconetto', lvl: 1 }], right: [{ type: 'colubrina', lvl: 1 }] },
    });
    await S.join();
    ok(S.welcome.you.tipo === 'sciabecco', 'il varo salvato torna dal profilo: Sciabecco');
    ok(S.welcome.you.mounts.left[0].type === 'falconetto', 'il Falconetto sullo sciabecco è di casa');
    await sleep(500);
    const sMe = S.me();
    ok(sMe && sMe.tp === 4 && sMe.maxHp === 180, `snapshot vestito: tp=4, scafo agile (${sMe && sMe.maxHp}/180 HP)`);
    ok(sMe && sMe.gw && sMe.gw[0] === 'f1', `il falconetto viaggia in chiaro (gw "${sMe && sMe.gw && sMe.gw[0]}")`);
    S.send({ t: 'abilita' });
    ok(!!await S.wait(m => m.t === 'abilita' && m.nome === 'Colpo di Vento' && m.cd === 30, 3000),
      'Colpo di Vento attivato (ack col cooldown)');
    // la raffica spinge a vele ferme: senza input la nave starebbe FERMA,
    // quindi qualunque velocità franca prova la spinta (le isole possono
    // frenare la corsa: la soglia non pretende il massimo teorico)
    let sVel = 0;
    for (let i = 0; i < 16; i++) { await sleep(150); const me = S.me(); if (me) sVel = Math.max(sVel, me.vel); }
    ok(sVel > 90, `la raffica spinge senza vele (picco ${sVel} px/s, da fermo)`);
    S.ws.close();
    // la matrice cambia, il Cantiere paga (issue #11): un galeone d'annata
    // con armi assiali comprate quando si poteva le vede riscattate al join
    const V = new Player('Vecchio Galeone', {
      gold: 1000, tipo: 'galeone',
      mounts: {
        left: [{ type: 'colubrina', lvl: 1 }], right: [{ type: 'colubrina', lvl: 1 }],
        bow: [{ type: 'cannone', lvl: 1 }], stern: [{ type: 'colubrina', lvl: 1 }, { type: 'colubrina', lvl: 1 }],
      },
    });
    await V.join();
    // cannone 360 + 2 colubrine 240 + slot di prua 400 + slot di poppa 400+1200 = 2600
    const risc = await V.wait(m => m.t === 'gold' && m.delta === 2600, 3000);
    ok(!!risc, 'riscatto al join: 2600 🪙 per armi E slot assiali del galeone');
    ok(!!risc && /riscattato/.test(risc.reason || ''), `…col conto in chiaro ("${risc && risc.reason}")`);
    ok(V.welcome.you.mounts.bow.length === 0 && V.welcome.you.mounts.stern.length === 0, 'gli assiali del galeone sono sbarcati');
    ok(V.welcome.you.gold === 3600, `l'oro è già nel welcome (${V.welcome.you.gold} = 1000 + 2600)`);
    // la carronata (vietata dalla matrice sulla goletta) si riscatta anch'essa
    const Q = new Player('Golettiere', {
      gold: 0, tipo: 'goletta',
      mounts: { left: [{ type: 'carronata', lvl: 1 }], right: [{ type: 'colubrina', lvl: 1 }] },
    });
    await Q.join();
    ok(!!await Q.wait(m => m.t === 'gold' && m.delta === 1080, 3000), 'carronata vietata sulla goletta: riscattata (1080 🪙)');
    ok(Q.welcome.you.mounts.left[0].type === 'colubrina', 'al suo posto una colubrina di cortesia');
    Q.ws.close(); V.ws.close();

    console.log('— Rotte e fortezza oisd —');
    A.send({ t: 'course', q: 'wikipedia.org' });
    let c = await A.wait(m => m.t === 'course');
    ok(c && c.ok && c.island.id === 'wikipedia.org', 'rotta per wikipedia.org');
    // un sito, un'isola (issue #26): il sottodominio non fa doppioni,
    // ma la rotta resta profonda
    A.send({ t: 'course', q: 'https://it.wikipedia.org/wiki/Isola' });
    c = await A.wait(m => m.t === 'course');
    ok(c && c.ok && c.island.id === 'wikipedia.org' && c.url === 'https://it.wikipedia.org/wiki/Isola',
      "it.wikipedia.org è la STESSA isola, e all'attracco si aprirà la pagina digitata");
    A.send({ t: 'course', q: 'pornhub.com' });
    c = await A.wait(m => m.t === 'course');
    ok(c && c.ok && c.island.fortress === true, 'dominio nella blocklist oisd → fortezza');
    const fortIsland = c.island;
    await sleep(400);
    const fort = A.fort('pornhub.com');
    ok(fort && fort.d.length === 11, `arsenale completo: ${fort ? fort.d.length : 0}/11 difese (8 torri, 2 bombarde, 1 specchio)`);
    ok(fort && fort.d.some(d => d[0] === 's'), 'lo Specchio Ustorio è sul mastio');

    console.log('— Approdi preferiti (issue #13) —');
    // spawn scelto al join: l'isola nasce al volo e si salpa dal suo anello
    const P = new Player('Pellegrino', { gold: 500 });
    await P.opened;
    P.send({ t: 'join', name: 'Pellegrino', profile: { gold: 500 }, spawn: 'archive.org' });
    await P.wait(m => m.t === 'welcome');
    const meta = P.welcome.islands.find(i => i.domain === 'archive.org');
    ok(!!meta, "l'approdo scelto nasce al volo (archive.org)");
    await sleep(600);
    const pMe = P.me();
    const dMeta = pMe && meta ? Math.hypot(pMe.x - meta.x, pMe.y - meta.y) : 9e9;
    ok(dMeta < (meta ? meta.r : 0) + 160, `si salpa dall'anello dell'approdo scelto (${dMeta | 0}px)`);
    // fortezza non conquistata: lo spawn ripiega sul Porto
    const FZ = new Player('Temerario', { gold: 100 });
    await FZ.opened;
    FZ.send({ t: 'join', name: 'Temerario', profile: { gold: 100 }, spawn: 'pornhub.com' });
    await FZ.wait(m => m.t === 'welcome');
    await sleep(600);
    const fMe = FZ.me();
    const dPorto = fMe ? Math.hypot(fMe.x - PORTO.x, fMe.y - PORTO.y) : 9e9;
    ok(dPorto < 400, `spawn su fortezza negato: si parte dal Porto (${dPorto | 0}px)`);
    // la stella si segna solo da attraccati, e si può ripensare
    ok(await P.goto(meta.x, meta.y, meta.r + 40, 60000), "Pellegrino sotto costa all'approdo scelto");
    P.send({ t: 'dock' });
    ok(!!await P.wait(m => m.t === 'docked', 5000), "attraccato all'approdo scelto");
    P.send({ t: 'preferisci', dominio: 'archive.org', on: true });
    const stella = await P.wait(m => m.t === 'toast' && /approdi preferiti/.test(m.msg), 3000);
    ok(!!stella, `la stella segna l'approdo ("${stella && stella.msg}")`);
    P.send({ t: 'preferisci', dominio: 'archive.org', on: false });
    ok(!!await P.wait(m => m.t === 'toast' && /tolta/.test(m.msg), 3000), 'la stella si può togliere');
    P.send({ t: 'undock' });

    console.log('— Le Fratellanze (issue #5) —');
    const GL = new Player('Gildano', { gold: 30000 });
    await GL.opened;
    GL.send({ t: 'join', name: 'Gildano', profile: { gold: 30000 }, uid: 'gildano' });
    await GL.wait(m => m.t === 'welcome');
    ok(await GL.goto(PORTO.x, PORTO.y, 200), 'Gildano raggiunge il Porto');
    let gdock = null;
    for (let i = 0; i < 20 && !gdock; i++) { GL.send({ t: 'dock' }); gdock = await GL.wait(m => m.t === 'shop', 1200); }
    ok(!!gdock, 'la fondazione è burocrazia di banchina: si attracca');
    GL.send({
      t: 'gildaFonda', nome: 'Vele Nere', tag: 'VELE', motto: 'Mai domi', categoria: 'corsari',
      bandiera: { fondo: 0, taglio: 2, tinta2: 1, emblema: 0, tintaEmblema: 4 }, aperta: true,
    });
    ok(!!await GL.wait(m => m.t === 'gold' && m.delta === -25000, 4000), 'la fondazione costa 25.000 🪙');
    const miaG = await GL.wait(m => m.t === 'gilda' && m.mia && m.mia.tag === 'VELE', 4000);
    ok(miaG && miaG.mia.mioRuolo === 'capitano', 'la scheda arriva: Gildano è capitano di [VELE]');
    ok(!!await GL.wait(m => m.t === 'notifica' && m.voce.tipo === 'gilda', 4000), 'la fondazione va in Gazzetta');
    GL.send({ t: 'undock' });
    await sleep(800);
    const gMe = GL.me();
    ok(gMe && gMe.gt === 'VELE', 'la bandierina [VELE] naviga nello snapshot');
    // il rito è obbligatorio: senza blocco, niente richiesta
    P.send({ t: 'gildaRichiesta', id: miaG.mia.id });
    ok(!!await P.wait(m => m.t === 'toast' && /rito/i.test(m.msg), 3000), 'senza rito la richiesta è respinta');
    // col diritto nel profilo (il blocco lo scrive lì), porte aperte = dentro
    const H = new Player('Novizio', {});
    await H.opened;
    H.send({
      t: 'join', name: 'Novizio', uid: 'novizio',
      profile: { gold: 100, sfide: { [miaG.mia.id]: Date.now() + 86400e3 } },
    });
    await H.wait(m => m.t === 'welcome');
    H.send({ t: 'gildaRichiesta', id: miaG.mia.id });
    ok(!!await H.wait(m => m.t === 'gilda' && m.mia && m.mia.tag === 'VELE', 4000),
      'col diritto conquistato le porte aperte ammettono subito');
    ok(!!await H.wait(m => m.t === 'notifica' && m.voce.tipo === 'gilda' && /Novizio/.test(m.voce.testo), 4000),
      "anche l'ammissione va in Gazzetta");
    A.send({ t: 'course', q: 'chi era barbanera' });
    c = await A.wait(m => m.t === 'course');
    ok(c && c.ok && c.island.id === 'oracolo', 'ricerca → Oracolo');

    console.log('— Assedio: bacheca e lobby —');
    A.send({ t: 'assedio', role: 'corridori' });
    let as = await A.wait(m => m.t === 'assedio' && m.phase === 'lobby', 5000);
    ok(!!as, 'assedio bandito (lobby)');
    B.send({ t: 'assedio', role: 'bloccatori' });
    as = await B.wait(m => m.t === 'assedio' && m.phase === 'countdown', 5000);
    ok(as && as.timeLeft <= 30 && as.corridori.includes('Barbanera') && as.bloccatori.includes('Olonese'),
      `lobby piena → conto alla rovescia (${as && as.timeLeft}s, ${as && as.corridori.length}v${as && as.bloccatori.length})`);

    console.log('— Cantiere: slot, potenziamenti, tier —');
    ok(await A.goto(PORTO.x, PORTO.y, 195, 40000), 'Barbanera raggiunge il Porto Franco');
    A.send({ t: 'dock' });
    let shop = null;
    for (let i = 0; i < 20 && !shop; i++) {
      A.send({ t: 'dock' });
      shop = await A.wait(m => m.t === 'shop', 1200);
    }
    ok(!!shop, 'attracco al porto: il cantiere apre');
    console.log('— Cantiere: punti nave —');
    ok(shop.ship.crewCost === null, 'Ciurma già al tetto: nessun gradino in vendita');
    ok(shop.ship.helmCost === 90 && shop.ship.holdCost === 90, 'Timone e Stiva partono da 90 🪙');
    A.send({ t: 'buyShip', stat: 'helm' });
    shop = await A.wait(m => m.t === 'shop');
    ok(shop && shop.ship.helmLvl === 1 && shop.ship.helmCost === 180, 'Timone 1 comprato, il gradino dopo costa il doppio (180)');
    A.send({ t: 'buyShip', stat: 'hold' });
    shop = await A.wait(m => m.t === 'shop');
    ok(shop && shop.ship.holdLvl === 1 && shop.ship.holdCost === 180, 'Stiva 1 comprata: prezzi esponenziali su ogni linea');
    A.send({ t: 'buySlot', group: 'left' });
    shop = await A.wait(m => m.t === 'shop');
    ok(shop && shop.groups.left.slots.length === 2, 'slot sinistro aggiunto (2/5), colubrina inclusa');
    A.send({ t: 'upgradeWeapon', group: 'left', slot: 0 });
    shop = await A.wait(m => m.t === 'shop');
    A.send({ t: 'upgradeWeapon', group: 'left', slot: 0 });
    shop = await A.wait(m => m.t === 'shop');
    ok(shop && shop.groups.left.slots[0].lvl === 3 && shop.groups.left.slots[0].upCost === null, 'colubrina sinistra al massimo (L3)');
    ok(shop.groups.left.slots[0].replace && shop.groups.left.slots[0].replace.type === 'cannone', 'al massimo si sblocca il tier successivo');
    A.send({ t: 'replaceWeapon', group: 'left', slot: 0 });
    shop = await A.wait(m => m.t === 'shop');
    ok(shop && shop.groups.left.slots[0].type === 'cannone' && shop.groups.left.slots[0].lvl === 1, 'colubrina sostituita dal Cannone da 24');
    // prua: scala fino al mortaio (per espugnare la fortezza)
    A.send({ t: 'buySlot', group: 'bow' });
    shop = await A.wait(m => m.t === 'shop');
    ok(shop && shop.groups.bow.slots.length === 1, 'slot di prua acquistato');
    const chain = ['cannone', 'carronata', 'mortaio'];
    for (const want of chain) {
      A.send({ t: 'upgradeWeapon', group: 'bow', slot: 0 });
      await A.wait(m => m.t === 'shop');
      A.send({ t: 'upgradeWeapon', group: 'bow', slot: 0 });
      await A.wait(m => m.t === 'shop');
      A.send({ t: 'replaceWeapon', group: 'bow', slot: 0 });
      shop = await A.wait(m => m.t === 'shop');
    }
    ok(shop && shop.groups.bow.slots[0].type === 'mortaio', 'scala dei tier fino al Mortaio in prua');
    A.send({ t: 'upgradeWeapon', group: 'bow', slot: 0 });
    await A.wait(m => m.t === 'shop');
    A.send({ t: 'upgradeWeapon', group: 'bow', slot: 0 });
    shop = await A.wait(m => m.t === 'shop');
    ok(shop && shop.groups.bow.slots[0].lvl === 3, 'mortaio potenziato al massimo (gittata 590)');

    console.log('— Il varo di Barbanera: Goletta da caccia —');
    A.send({ t: 'varo', tipo: 'goletta' });
    shop = await A.wait(m => m.t === 'shop');
    ok(shop && shop.varo.tipo === 'goletta' && shop.varo.cost === 180, 'Barbanera vara la Goletta (90); ripensarci costerebbe 180');
    ok(shop && shop.ship.helmCost === 90, 'sconto di tipo: Timone 2 a metà prezzo (90 invece di 180)');
    ok(shop && shop.groups.bow.slots[0].replace && shop.groups.bow.slots[0].replace.type === 'lunga',
      'sopra il mortaio ora c\'è la Colubrina Lunga, non l\'Organo');
    A.send({ t: 'undock' });
    await A.wait(m => m.t === 'undocked');
    await sleep(500);
    const aGoletta = A.me();
    ok(aGoletta && aGoletta.tp === 1 && aGoletta.maxHp === 170,
      `Barbanera in mare da Goletta (tp=1, ${aGoletta && aGoletta.maxHp}/170 HP)`);

    console.log('— Battaglia: fiancate indipendenti —');
    let killed = false;
    const hunt = setInterval(() => {
      const me = A.me(), target = A.find(B.id);
      if (!me || !target || me.sunk || target.sunk) return;
      const d = Math.hypot(target.x - me.x, target.y - me.y);
      const bearing = Math.atan2(target.y - me.y, target.x - me.x);
      if (d > 200) {
        const turn = norm(bearing - me.rot);
        A.input({ up: true, left: turn < -0.1, right: turn > 0.1 });
      } else {
        const turn = norm(bearing + Math.PI / 2 - me.rot); // bersaglio al traverso sinistro
        A.input({ up: d > 130, left: turn < -0.1, right: turn > 0.1 });
        if (Math.abs(turn) < 0.5) A.send({ t: 'fire', group: 'left' });
      }
    }, 140);
    const kill = await A.wait(m => m.t === 'kill' && m.victim === 'Olonese' && m.killer === 'Barbanera', 90000);
    clearInterval(hunt);
    A.input({});
    ok(!!kill, 'Olonese BLOCCATO con la fiancata sinistra (il kill si conta al blocco)');
    // economia del blocco (issue #15) + Stiva 2: doppiofondo (20%) SEMPRE
    // protetto; al blocco parte il 25% del forziere in gioco
    const bloccato = await B.wait(m => m.t === 'gold' && m.delta < 0, 3000);
    const pre = bloccato ? bloccato.gold - bloccato.delta : 0;
    const inGioco = pre - Math.round(pre * 0.2);
    ok(bloccato && -bloccato.delta === Math.round(inGioco * 0.25),
      `al blocco parte il 25% dell'in-gioco (${bloccato && -bloccato.delta} su ${inGioco} 🪙)`);
    if (kill) ok(kill.bounty === -bloccato.delta, 'la taglia del diario coincide col prelievo');
    await sleep(400);
    const bBlocked = B.me();
    ok(bBlocked && !bBlocked.sunk && bBlocked.bk > 0 && bBlocked.bb === A.id,
      `la vittima è in acqua, bloccata e abbordabile solo dal vincitore (bk=${bBlocked && bBlocked.bk}s)`);
    // il tocco: Barbanera si accosta e l'arrembaggio v1 prende il resto
    const tocco = setInterval(() => {
      const me = A.me(), t = A.find(B.id);
      if (!me || !t) return;
      const turn = norm(Math.atan2(t.y - me.y, t.x - me.x) - me.rot);
      A.input({ up: true, left: turn < -0.1, right: turn > 0.1 });
    }, 140);
    const abbordo = await B.wait(m => m.t === 'gold' && m.delta < 0, 15000);
    clearInterval(tocco);
    A.input({});
    ok(abbordo && abbordo.gold === Math.round(pre * 0.2),
      `arrembaggio col tocco: alla vittima resta il doppiofondo (${abbordo && abbordo.gold}/${pre} 🪙)`);
    // si aspetta la morte DELL'ARREMBAGGIO: un Fantasma può aver affondato
    // Olonese nelle lunghe sezioni precedenti, e quel 'dead' stantio in coda
    // non è il conto che stiamo verificando
    const morte = await B.wait(m => m.t === 'dead' && m.da === 'Barbanera', 6000);
    ok(!!morte, 'la vittima abbordata affonda');
    // la morte racconta (issue #23): chi, il totale perso, il doppiofondo
    ok(morte && morte.perso === inGioco && morte.salvo === Math.round(pre * 0.2),
      `…e il conto è servito: da ${morte && morte.da}, −${morte && morte.perso} 🪙, salvati ${morte && morte.salvo}`);
    ok(!!await B.wait(m => m.t === 'respawned', 12000), 'la vittima rispunta al porto');

    console.log('— La Fortezza Proibita: blocco reale, poi espugnazione —');
    ok(await A.goto(fortIsland.x, fortIsland.y, fortIsland.r + 80, 90000), 'Barbanera raggiunge le acque della Fortezza');
    A.send({ t: 'dock' });
    const blocked = await A.wait(m => m.t === 'toast' && /Fortezza/.test(m.msg), 4000);
    ok(!!blocked, `l'approdo è sbarrato ("${blocked && blocked.msg}")`);

    // bombardamento col mortaio di prua: ogni difesa, una per una
    const MRANGE = 500 + 45 * 2; // mortaio L3
    let fell = null;
    const conqueredPromise = A.wait(m => m.t === 'conquered', 240000);
    const bombard = setInterval(() => {
      const me = A.me();
      const f = A.fort(fortIsland.id);
      if (!me || me.sunk || !f) return;
      const alive = f.d.filter(d => !d[5]);
      if (!alive.length) return;
      const [, dx, dy] = alive[0];
      const d = Math.hypot(dx - me.x, dy - me.y);
      const bearing = Math.atan2(dy - me.y, dx - me.x);
      if (d < MRANGE - 70) {
        // troppo sotto le mura: vira e allontanati
        const turn = norm(bearing + Math.PI - me.rot);
        A.input({ up: true, left: turn < -0.08, right: turn > 0.08 });
      } else if (d > MRANGE + 70) {
        const turn = norm(bearing - me.rot);
        A.input({ up: true, left: turn < -0.08, right: turn > 0.08 });
      } else {
        const turn = norm(bearing - me.rot);
        A.input({ down: true, left: turn < -0.08, right: turn > 0.08 });
        if (Math.abs(turn) < 0.12) A.send({ t: 'fire', group: 'bow' });
      }
    }, 150);
    const conquered = await conqueredPromise;
    clearInterval(bombard);
    A.input({});
    ok(!!conquered, 'FORTEZZA ESPUGNATA: tutte le difese abbattute');
    ok(conquered && conquered.list.includes(fortIsland.id), 'il blocco è disattivato nel profilo del conquistatore');
    const bounty = await A.wait(m => m.t === 'gold' && m.delta === 1500, 3000);
    ok(!!bounty, 'taglia di conquista: 1500 🪙');

    console.log('— La Gazzetta del Corsaro (issue #4) —');
    const notizia = await A.wait(m => m.t === 'notifica' && m.voce && m.voce.tipo === 'espugnazione', 3000);
    ok(!!notizia, `l'espugnazione va in Gazzetta sul filo dei presenti ("${notizia && notizia.voce.testo}")`);
    // chi arriva DOPO trova lo storico al join: espugnazione E arrembaggio
    const L = new Player('Lettore', { gold: 100 });
    await L.join();
    const albo = await L.wait(m => m.t === 'gazzetta', 4000);
    ok(albo && Array.isArray(albo.voci) && albo.voci.some(v => v.tipo === 'espugnazione'),
      `lo storico arriva al join (${albo ? albo.voci.length : 0} voci, c'è l'espugnazione)`);
    ok(albo && albo.voci.some(v => v.tipo === 'arrembaggio'),
      'anche l\'arrembaggio della battaglia è agli atti');
    L.send({ t: 'gazzettaLetta', fino: Date.now() }); // il cursore non fa male a nessuno
    // il Mastro di Rotte (issue #3): la campagna della settimana arriva al join
    const camp = await L.wait(m => m.t === 'campagna', 3000);
    ok(camp && camp.stato && camp.stato.nome && camp.stato.tappe.length === 3 && camp.stato.tappa === 0,
      `la campagna del Mastro arriva al join ("${camp && camp.stato.nome}", 3 tappe, da capo)`);
    ok(await A.goto(fortIsland.x, fortIsland.y, fortIsland.r + 80, 60000), 'ritorno sotto le mura');
    A.send({ t: 'dock' });
    let dockedFort = null;
    for (let i = 0; i < 15 && !dockedFort; i++) {
      A.send({ t: 'dock' });
      dockedFort = await A.wait(m => m.t === 'docked' && m.island.id === fortIsland.id, 1200);
    }
    ok(!!dockedFort, 'ora si attracca: il sito bloccato è raggiungibile');

    A.ws.close(); B.ws.close();
  } finally {
    server.kill();
  }
  console.log(failures === 0 ? '\nTUTTO VERDE ⚓' : `\n${failures} FALLIMENTI ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
