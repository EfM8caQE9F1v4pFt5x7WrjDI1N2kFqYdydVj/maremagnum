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
  constructor(name, profile) {
    this.name = name;
    this.profile = profile || {};
    this.msgs = [];
    this.snap = null;
    this.id = null;
    this.welcome = null;
    this.ws = new WebSocket(URL);
    this.ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'snap') { this.snap = m; return; }
      this.msgs.push(m);
      if (m.t === 'welcome') { this.welcome = m; this.id = m.id; }
    });
    this.opened = new Promise(res => this.ws.addEventListener('open', res));
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  async join() { await this.opened; this.send({ t: 'join', name: this.name, profile: this.profile }); await this.wait(m => m.t === 'welcome'); }
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
    env: { ...process.env, PORT, WEAK_FORTS: '1' }, stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/health`); if (r.ok) break; } catch { /* riprova */ }
    await sleep(300);
  }

  try {
    const A = new Player('Barbanera', { gold: 99999 });
    const B = new Player('Olonese');
    await A.join(); await B.join();

    console.log('— Benvenuto, arsenale, mondo —');
    ok(A.welcome.arsenal && A.welcome.arsenal.types.colubrina, 'il welcome porta il catalogo delle armi');
    ok(A.welcome.you.mounts.left.length === 1 && A.welcome.you.mounts.left[0].type === 'colubrina', 'nave base: 1 colubrina per lato');
    ok(A.welcome.you.gold === 99999, 'profilo (oro) accettato');
    ok(!!await A.wait(m => m.t === 'mission', 4000), 'missione personale assegnata al join');

    console.log('— Rotte e fortezza oisd —');
    A.send({ t: 'course', q: 'wikipedia.org' });
    let c = await A.wait(m => m.t === 'course');
    ok(c && c.ok && c.island.id === 'wikipedia.org', 'rotta per wikipedia.org');
    A.send({ t: 'course', q: 'pornhub.com' });
    c = await A.wait(m => m.t === 'course');
    ok(c && c.ok && c.island.fortress === true, 'dominio nella blocklist oisd → fortezza');
    const fortIsland = c.island;
    await sleep(400);
    const fort = A.fort('pornhub.com');
    ok(fort && fort.d.length === 11, `arsenale completo: ${fort ? fort.d.length : 0}/11 difese (8 torri, 2 bombarde, 1 specchio)`);
    ok(fort && fort.d.some(d => d[0] === 's'), 'lo Specchio Ustorio è sul mastio');
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
    A.send({ t: 'undock' });
    await A.wait(m => m.t === 'undocked');

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
    ok(!!kill, 'Olonese affondato con la fiancata sinistra');
    if (kill) ok(kill.bounty >= 60, `taglia incassata (${kill.bounty} 🪙)`);
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
