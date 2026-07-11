'use strict';

const { WORLD, PORT, FORT, parseCourse, Archipelago, publicIsland } = require('./world');
const { dominioBase } = require('./dominio');
const W = require('./weapons');
const { Missions } = require('./missions');
const atlante = require('./atlante-core');
const gazzetta = require('./gazzetta-core');
const campagna = require('./campagna-core');
const gilde = require('./gilde-core');
const livree = require('./livree');
const og = require('./og-core');
const { Alleanze, quotaAlleanza } = require('./alleanze');
const vento = require('./vento');

const TICK = 1 / 30;          // simulazione a 30Hz
const SNAP_EVERY = 2;         // snapshot ai client a 15Hz
const START_GOLD = 200;
const RESPAWN_S = 6;
const DISCOVERY_GOLD = 25;
const MAX_SHIP_LVL = 4;       // ogni linea del Cantiere: scafo, vele, timone, ciurma, stiva
const PVE_BOUNTY = { merc: 25, ghost: 60 }; // taglie magre e fisse per tipologia
// La resa dei mercantili (issue #41, fetta 3, alla Sid Meier's Pirates!):
// sotto la soglia ammainano — chi li TOCCA li saccheggia (bottino FISSO dal
// listino, una volta per resa), chi preferisce la missione li affonda lo
// stesso. Il cooldown è la diga anti-farming; il mare non è un bancomat.
const RESA = { soglia: 0.3, durata: 25, bottino: 150, cooldown: 180, hpRitorno: 0.5 };
// Le carovane scortate (issue #41, fette 3 e 4): un capo panciuto coi
// fantasmi di scorta, in rotta annunciata tra due isole vere. Attacchi uno,
// rispondono tutti — l'ecologia delle prede di Pirates!. Il convoglio è il
// pane; il GALEONE DEL TESORO è la festa: raro, corazzato, guardia serrata —
// e il suo oro si prende col TOCCO: chi lo affonda lo manda negli abissi.
const CAROVANE = {
  convoglio: {
    nome: 'Mercantile di Convoglio', scortaNome: 'Scorta del Convoglio',
    scorte: 2, stazza: 2, bottino: 400, ogni: 300, lvlScorta: 2,
    annuncio: (da, a) => `🚢 Un convoglio scortato è salpato: da ${da} verso ${a}, stive piene!`,
    arrivo: (a) => `⚓ Il convoglio è giunto sano e salvo a ${a}.`,
    perduto: '🌊 Il mercantile di convoglio è perduto: la scorta, orfana, dà la caccia ai colpevoli.',
  },
  tesoro: {
    nome: 'Galeone del Tesoro', scortaNome: 'Guardia del Tesoro',
    scorte: 3, stazza: 3, bottino: 1000, ogni: 1800, lvlScorta: 3,
    annuncio: (da, a) => `👑 IL GALEONE DEL TESORO è salpato: da ${da} verso ${a} — scorta serrata, stive d'oro!`,
    arrivo: (a) => `👑 Il Galeone del Tesoro è giunto al sicuro a ${a}: l'oro è sbarcato.`,
    perduto: '🌊 Il Galeone del Tesoro è negli abissi col suo oro: la Guardia, orfana, cerca vendetta.',
  },
};
const MINACCIA_TTL = 30; // il mutuo soccorso ricorda l'aggressore per 30s
// CONVOGLIO_SUBITO=1 (env, solo Node dev/test): le carovane salpano al primo
// tick invece che a calendario — per collaudi riproducibili
const CONVOGLIO_SUBITO = !!(typeof process !== 'undefined' && process.env && process.env.CONVOGLIO_SUBITO);
// I cacciatori di taglie (issue #41, fetta 4, alla Pirates!): l'infamia
// chiama — ogni 3 prede (blocchi o affondamenti) un Cacciatore fiuta il
// colpevole e lo braccia per 4 minuti. Ucciderlo paga FISSO e azzera il
// conto. Mai più di 2 cacciatori in mare: è un mare, non un tribunale.
const CACCIA = { ogniKill: 3, bounty: 120, ttl: 240, max: 2, stazza: 1.5 };
// L'economia del blocco (issue #15, arrembaggio v1): vita a zero per mano di
// un capitano = nave BLOCCATA, non affondata. Il doppiofondo della Stiva è
// SEMPRE protetto; il resto è "il forziere in gioco": 25% subito al vincitore,
// il tocco prende il resto, il timeout libera col 75% e l'immunità.
const BLOCCO = { durata: 18, immunita: 30, quotaSubito: 0.25, hpRitorno: 0.5, tocco: 46 };
// Approdi preferiti (issue #13): i segnalibri del corsaro
const PREFERITI_MAX = 8;
const DOMINIO_OK = /^[a-z0-9][a-z0-9.-]{2,99}$/i;
const WEAK_FORTS = !!(typeof process !== 'undefined' ? process.env.WEAK_FORTS : undefined); // knob per i test: difese di cartapesta
// Il Cartellone dell'isola (issue #27): quanto vicino per vederlo, quanto
// vive la cache (una lettura del sito a settimana), quanti in memoria.
const CARTELLONE = { raggio: 220, ttl: 7 * 24 * 3600 * 1000, maxCache: 300 };
const OG_FINTO = !!(typeof process !== 'undefined' ? process.env.OG_FINTO : undefined); // knob per i test: niente rete

// Legge la home del sito per l'anteprima: timeout stretto, solo HTML,
// solo l'inizio (i meta stanno in <head>).
const UA_MARE = 'Maremagnum/1.0 (+https://maremagnum.maremagnum.workers.dev)';

async function leggiSito(dominio) {
  if (OG_FINTO) {
    return `<html><head><title>Finto</title>
      <meta property="og:title" content="Il Sito Finto &amp; Collaudato"/>
      <meta property="og:description" content="Una descrizione da collaudo, scritta apposta."/>
      <meta property="og:image" content="https://finto.example/anteprima.png"/>
      </head></html>`;
  }
  // molti siti servono i meta solo su www: se la nuda fallisce, si riprova
  for (const host of [dominio, 'www.' + dominio]) {
    try {
      const r = await fetch('https://' + host + '/', {
        redirect: 'follow',
        signal: AbortSignal.timeout(6500),
        headers: { 'user-agent': UA_MARE, accept: 'text/html' },
      });
      if (r.ok && /text\/html/.test(r.headers.get('content-type') || '')) {
        return (await r.text()).slice(0, 200000);
      }
    } catch { /* prova la variante, poi si arrende */ }
    if (dominio.startsWith('www.')) break; // già www: niente doppioni
  }
  throw new Error('niente html');
}

// Segue i redirect per trovare l'identità canonica di un dominio: dove
// atterra la home (eTLD+1 finale). wikipedia.com → wikipedia.org. Se non
// redirige altrove (o la rete tace), resta il dominio di partenza.
async function risolviRedirect(dominio) {
  const r = await fetch('https://' + dominio + '/', {
    redirect: 'follow',
    signal: AbortSignal.timeout(4000),
    headers: { 'user-agent': UA_MARE, accept: 'text/html' },
  });
  const finale = dominioBase(new URL(r.url).hostname);
  return finale || dominio;
}

const GROUP_DIR = { left: -Math.PI / 2, right: Math.PI / 2, bow: 0, stern: Math.PI };

// La rastrellata (issue #41, fetta 2): il colpo diretto che entra dal settore
// di poppa (±30°) morde di più — la manovra paga, e il sopravvento serve.
const RASTRELLATA = { settore: Math.PI / 6, mult: 1.5 };

// Le isole di partenza (issue #26bis): esistono dal T0, sempre visibili,
// anche a zero approdi — la mappa non nasce vuota. Elenco curato (il
// capitano lo rifinisce). I domini vanno in forma registrabile (eTLD+1).
// SENZA_T0=1 lascia il mare spoglio: i test end-to-end usano un autopilota
// ingenuo che si impiglia tra troppe isole.
const ISOLE_T0 = (typeof process !== 'undefined' && process.env.SENZA_T0) ? [] : [
  'booost.network', 'cumino.com', 'sending.dev', 'toranoai.com', 'hyperuranios.com',
];

// Le linee di punti nave in vendita al Cantiere: stat pubblica → campo della nave.
const SHIP_LINES = { hull: 'hullLvl', sails: 'sailsLvl', helm: 'helmLvl', crew: 'crewLvl', hold: 'holdLvl' };

// I tipi di nave: identità di build scelta col "varo" al Cantiere.
// Moltiplicatori piccoli (mai oltre ±20%: nessuno scontro va perso in
// partenza), uno sconto di linea, un'arma esclusiva a coronare la scala.
// Il tipo "equilibrato" non ha bonus alle stat: la lezione dei brigantini
// che dominano è già stata scritta da altri mari.
const TIPI = {
  goletta: {
    nome: 'Goletta', hpMul: 0.85, speedMul: 1.12, turnMul: 1,
    sconto: 'helmLvl', motto: 'Veloce e fragile: pungi da lontano, vivi per raccontarlo',
  },
  guerra: {
    nome: 'Brigantino da Guerra', hpMul: 1, speedMul: 1, turnMul: 1,
    sconto: 'crewLvl', motto: 'Equilibrato: bordate fitte e nervi saldi',
  },
  galeone: {
    nome: 'Galeone', hpMul: 1.2, speedMul: 1, turnMul: 0.88,
    sconto: 'hullLvl', motto: 'Lento e corazzato: un castello che naviga',
  },
  sciabecco: {
    nome: 'Sciabecco', hpMul: 0.9, speedMul: 1, turnMul: 1.15,
    sconto: 'holdLvl', motto: 'Agile e rapace: vira dove gli altri arrancano, e la stiva non pesa',
  },
};
const TIPO_SNAP = { goletta: 1, guerra: 2, galeone: 3, sciabecco: 4 };

// Le abilità attive: una per tipo, tasto R, cooldown lungo rispetto al
// ritmo del duello (TTK ~10-30s). Il fumogeno acceca solo le IA (fantasmi
// e fortezze): i capitani veri possono sempre sparare alla cieca nel fumo.
const ABILITA = {
  goletta: { nome: 'Speronamento', cd: 30, durata: 2.2, dmg: 42, autodanno: 10, spinta: 1.9 },
  guerra: { nome: 'Fumogeno', cd: 40, durata: 10, raggio: 150 },
  galeone: { nome: 'Bordata Doppia', cd: 40, durata: 4 },
  // il Colpo di Vento è pura mobilità: niente danno, niente prua indurita —
  // si entra (o si esce) da un duello, non lo si vince col tasto R
  sciabecco: { nome: 'Colpo di Vento', cd: 30, durata: 2.5, spinta: 1.75 },
};
// l'abilità spiegata in una riga (audit Cantiere): i numeri vengono da
// ABILITA, il testo è code-owned — una sola fonte di verità, mai a braccio
const ABILITA_EFFETTO = {
  goletta: (a) => `carichi per ${a.durata}s e speroni: ${a.dmg} danni al bersaglio, ${a.autodanno} al tuo legno`,
  guerra: (a) => `una cortina di fumo (${a.durata}s): dentro, fantasmi e torri non ti prendono di mira`,
  galeone: (a) => `per ${a.durata}s ogni bocca spara il doppio, con le canne subito fresche`,
  sciabecco: (a) => `scatto a vele piene per ${a.durata}s: agganci un duello, o te ne sganci`,
};

// catalogo pubblico del varo (statico): quello che il Cantiere espone —
// con la SCHEDA dell'abilità R e i numeri dell'esclusiva (audit Cantiere):
// il Cantiere spiega, non si limita a nominare
const TIPI_PUB = Object.fromEntries(Object.entries(TIPI).map(([k, t]) => {
  const a = ABILITA[k];
  const es = W.weaponStats({ type: W.EXCLUSIVES[k], lvl: 1 });
  return [k, {
    nome: t.nome, motto: t.motto, sconto: t.sconto,
    hpMul: t.hpMul, speedMul: t.speedMul, turnMul: t.turnMul,
    esclusiva: W.TYPES[W.EXCLUSIVES[k]].name,
    abilita: a.nome,
    abilitaInfo: { nome: a.nome, cd: a.cd, durata: a.durata, effetto: ABILITA_EFFETTO[k](a) },
    esclusivaInfo: { dmg: es.dmg, range: es.range, reload: es.reload },
  }];
}));

const NPCS = { merc: 3, ghost: 2 };

// L'oro a bordo si perde, i punti nave no: il Cantiere è la banca del corsaro.
function shipStats(ship) {
  const t = TIPI[ship.tipo];
  return {
    // scafi più duri (+100%): le battaglie duravano troppo poco e una sola
    // bordata poteva uccidere — ora 200 base + 80 a punto (hull 4 = 520 base)
    maxHp: Math.round((200 + ship.hullLvl * 80) * (t ? t.hpMul : 1)),
    speed: (135 + ship.sailsLvl * 20) * (t ? t.speedMul : 1),
    turnRate: 2.3 * (1 + 0.08 * ship.helmLvl) * (t ? t.turnMul : 1), // timone: virate più strette
    reloadMul: 1 - 0.07 * ship.crewLvl,         // ciurma: ricarica −7% a punto (−28% al tetto)
  };
}

function shipLvlCost(lvl) { return lvl >= MAX_SHIP_LVL ? null : 90 * 2 ** lvl; }

// Prezzo di un gradino per QUESTA nave: il tipo dimezza la sua linea di sconto.
function lineCost(ship, field) {
  const c = shipLvlCost(ship[field]);
  const t = TIPI[ship.tipo];
  return c !== null && t && t.sconto === field ? Math.round(c / 2) : c;
}

function varoCost(ship) { return 90 * 2 ** ship.vari; } // ogni cambio di rotta costa il doppio

class Game {
  constructor(broadcast) {
    this.broadcast = broadcast;
    this.archipelago = new Archipelago();
    this.semina();
    this.missions = new Missions(this);
    this.alleanze = new Alleanze(this); // le alleanze temporanee (#37)
    this.ships = new Map();
    this.shots = new Map();
    this.smokes = [];
    this.cartelloni = new Map(); // dominio → { og, at }: la cache dei Cartelloni (issue #27)
    this.cartelloniInCorso = new Map(); // dominio → Promise: un fetch solo per dominio
    this.canonico = new Map(); // dominio digitato → dominio canonico (redirect, issue #26bis)
    this.canonicoInCorso = new Map(); // una risoluzione sola per dominio
    this.nextId = 1;
    this.nextShotId = 1;
    this.now = Date.now() / 1000;
    this.vento = vento.FISSO || vento.ventoAl(this.now * 1000); // il vento del mare (issue #41)
    // le carovane scortate (issue #41, fette 3-4): una per tipo, a calendario
    this.carovane = { convoglio: null, tesoro: null };
    this.prossimaCarovana = {
      convoglio: this.now + (CONVOGLIO_SUBITO ? 0 : CAROVANE.convoglio.ogni),
      tesoro: this.now + (CONVOGLIO_SUBITO ? 0 : CAROVANE.tesoro.ogni),
    };
    this.cacciatori = 0; // quanti Cacciatori di Taglie battono il mare
    this.tickCount = 0;
    this.fxQueue = [];
    for (let i = 0; i < NPCS.merc; i++) this.spawnNpc('merc');
    for (let i = 0; i < NPCS.ghost; i++) this.spawnNpc('ghost');
    this.timer = null;
    this.boardTimer = null;
    this.riprendi();
  }

  stop() { clearInterval(this.timer); clearInterval(this.boardTimer); }

  // Al risveglio il mare si ricorda delle sue isole: le isole di partenza
  // (T0) e le mete condivise dell'Atlante (≥ soglia) rinascono senza
  // aspettare una nuova rotta, con un tetto per non affollare la mappa.
  semina(cap = 150) {
    const domini = [...new Set([...ISOLE_T0, ...atlante.sopraSoglia()])].slice(0, cap);
    for (const dominio of domini) {
      const { island, isNew } = this.archipelago.ensure(dominio);
      if (isNew) this.broadcastIsland(island);
    }
  }

  // Un'isola è STABILE (visibile a tutti, riseminata) se è fissa (Porto,
  // Faro), di partenza (T0), o ha raccolto abbastanza approdi (issue #26bis).
  // Le altre sono effimere: le vede solo chi ci naviga, spariscono al sonno.
  stabile(island) {
    if (!island) return false;
    if (island.kind !== 'site') return true;
    if (island.dungeon) return true; // un dungeon del Mastro (#38) è un bersaglio visibile a tutti
    if (ISOLE_T0.includes(island.domain)) return true;
    return atlante.approdiDi(island.domain) >= atlante.SOGLIA_ISOLA;
  }

  // --- navi ---

  spawnPoint() {
    const a = Math.random() * Math.PI * 2;
    const d = this.archipelago.get('porto').r + 90 + Math.random() * 90;
    return { x: PORT.x + Math.cos(a) * d, y: PORT.y + Math.sin(a) * d };
  }

  makeShip(id, name, npc) {
    const p = this.spawnPoint();
    return {
      id, name, npc: npc || false, conn: null,
      x: p.x, y: p.y, rot: Math.random() * Math.PI * 2, vel: 0,
      input: { up: false, down: false, left: false, right: false },
      gold: START_GOLD, hullLvl: 0, sailsLvl: 0, helmLvl: 0, crewLvl: 0, holdLvl: 0,
      tipo: null, vari: 0,
      mounts: W.defaultMounts(), ready: { left: [0], right: [0], bow: [], stern: [] },
      hp: 100, kills: 0, deaths: 0,
      docked: null, sunkUntil: 0, lastHitBy: null, lastDamageAt: 0,
      blockedUntil: 0, blockedBy: null, bloccoSalvo: 0, immuneUntil: 0,
      abilityAt: 0, ramUntil: 0, doubleUntil: 0, ventoUntil: 0,
      // le munizioni (issue #41, fetta 2): scelta di sessione, mai persistita;
      // i debuff sono temporanei e si rinfrescano, non si sommano
      munizione: 'palle', veleTagliateUntil: 0, falcidiaUntil: 0,
      // la resa dei mercantili e le carovane (issue #41, fette 3-4)
      resaUntil: 0, resaCooldownUntil: 0, saccheggiato: false, convoglio: null,
      // i cacciatori di taglie (fetta 4): il conto dell'infamia e il mandato
      tagliaCacciata: 0, caccia: null,
      visited: new Set(), conquered: new Set(), preferiti: new Set(),
      livree: new Set(), livrea: null, vele: null, scia: null, bandiera: null,
      mission: null, wp: null, fleeUntil: 0,
      alleanzaId: null, // l'alleanza temporanea (#37): effimera, mai nel profilo
    };
  }

  // Il mare dorme quando non c'è nessuno: nei Durable Objects il tempo attivo
  // si paga, e un'onda che nessuno guarda non ha bisogno di esistere.
  pausa() {
    clearInterval(this.timer);
    clearInterval(this.boardTimer);
    this.timer = null;
    this.boardTimer = null;
  }

  riprendi() {
    if (this.timer) return;
    this.now = Date.now() / 1000; // niente salti di simulazione al risveglio
    this.timer = setInterval(() => this.tick(), TICK * 1000);
    this.boardTimer = setInterval(() => this.sendBoard(), 3000);
  }

  spawnNpc(kind) {
    const id = 'n' + this.nextId++;
    const ship = this.makeShip(id, kind === 'merc' ? 'Mercantile' : 'Corsaro Fantasma', kind);
    ship.x = 400 + Math.random() * (WORLD.W - 800);
    ship.y = 400 + Math.random() * (WORLD.H - 800);
    if (kind === 'merc') {
      ship.hp = 70; ship.mounts = { left: [], right: [], bow: [], stern: [] };
      ship.ready = { left: [], right: [], bow: [], stern: [] };
    } else {
      ship.hp = 160; ship.sailsLvl = 0;
      ship.mounts = {
        left: [{ type: 'cannone', lvl: 2 }, { type: 'cannone', lvl: 2 }],
        right: [{ type: 'cannone', lvl: 2 }, { type: 'cannone', lvl: 2 }],
        bow: [], stern: [],
      };
      this.syncReady(ship);
    }
    this.ships.set(id, ship);
    return ship;
  }

  // +100% come le navi vere; il capo del convoglio è panciuto (stazza, fetta 3)
  npcMaxHp(ship) { return (ship.npc === 'merc' ? 140 : 320) * (ship.stazza || 1); }

  syncReady(ship) {
    for (const g of Object.keys(W.GROUPS)) {
      const n = ship.mounts[g].length;
      const cur = ship.ready[g] || [];
      ship.ready[g] = Array.from({ length: n }, (_, i) => cur[i] || 0);
    }
  }

  join(conn, msg) {
    const id = 'p' + this.nextId++;
    const name = String(msg.name || '').trim().slice(0, 18) || 'Corsaro Anonimo';
    const ship = this.makeShip(id, name, false);
    ship.conn = conn;
    ship.graceUntil = this.now + 5; // tregua d'arrivo: i Fantasmi non toccano i nuovi
    const p = msg.profile || {};
    ship.gold = Math.min(1e7, Math.max(0, (p.gold | 0) || START_GOLD));
    for (const f of Object.values(SHIP_LINES)) ship[f] = Math.min(MAX_SHIP_LVL, Math.max(0, p[f] | 0));
    ship.tipo = TIPI[p.tipo] ? p.tipo : null;
    ship.vari = Math.min(30, Math.max(0, p.vari | 0));
    // grandfathering: chi comprò l'Organo quando era di tutti è Galeone
    // d'ufficio, gratis — nessuno perde un'arma che ha pagato
    if (!ship.tipo && hasOrgano(p.mounts)) ship.tipo = 'galeone';
    // la matrice del legno può essere cambiata da un aggiornamento: le armi
    // che il tipo non regge più tornano ORO PIENO al capitano (issue #11)
    const sanificati = W.sanitizeConRiscatto(p.mounts, ship.tipo);
    ship.mounts = sanificati.mounts;
    ship.gold = Math.min(1e7, ship.gold + sanificati.riscatto);
    ship.riscattoAlJoin = sanificati;
    ship.kills = Math.min(1e6, Math.max(0, p.kills | 0));
    // l'infamia dei Cacciatori (fetta 4) conta le prede di SESSIONE: il
    // veterano che torna non si trova un mandato vecchio sulla testa
    ship.tagliaCacciata = ship.kills;
    ship.deaths = Math.min(1e6, Math.max(0, p.deaths | 0));
    if (Array.isArray(p.conquered)) {
      for (const d of p.conquered.slice(0, 500)) if (typeof d === 'string') ship.conquered.add(d.slice(0, 100));
    }
    // approdi preferiti (issue #13): lista sanificata, con tetto
    ship.preferiti = new Set();
    if (Array.isArray(p.preferiti)) {
      for (const d of p.preferiti.slice(0, PREFERITI_MAX)) {
        if (typeof d === 'string' && DOMINIO_OK.test(d)) ship.preferiti.add(d.toLowerCase().slice(0, 100));
      }
    }
    // il guardaroba (issue #25): livree possedute/indossate e bandiera personale
    Object.assign(ship, livree.sanificaGuardaroba(p));
    this.syncReady(ship);
    ship.hp = shipStats(ship).maxHp;
    // la scelta del punto di partenza (issue #13, campo ADDITIVO nel join):
    // isola esistente o seminata al volo, mai una fortezza non conquistata
    let isolaSpawn = null;
    if (typeof msg.spawn === 'string' && DOMINIO_OK.test(msg.spawn)) {
      const dominio = msg.spawn.toLowerCase();
      const { island } = this.archipelago.ensure(dominio);
      if (!island.fortress || ship.conquered.has(island.domain)) {
        const a = Math.random() * Math.PI * 2;
        ship.x = island.x + Math.cos(a) * (island.r + 100);
        ship.y = island.y + Math.sin(a) * (island.r + 100);
        ship.rot = a;
        isolaSpawn = island; // la si mostra a chi ci parte, anche se sotto soglia
      }
    }
    this.ships.set(id, ship);
    // la mappa condivisa: solo le isole STABILI (issue #26bis); i siti di
    // passaggio sotto soglia restano affar di chi ci naviga — ma l'isola su
    // cui si spawna la si vede comunque, sennò si parte nel vuoto
    const mappa = this.archipelago.list().filter(i => this.stabile(i) || i === isolaSpawn);
    this.sendTo(ship, {
      t: 'welcome', id, world: WORLD, port: PORT,
      islands: mappa.map(publicIsland),
      you: this.youFor(ship),
      arsenal: W.publicConfig(),
      livree: livree.publicCatalogo(),
    });
    if (ship.riscattoAlJoin && ship.riscattoAlJoin.riscatto) {
      const { riscatto, tolte } = ship.riscattoAlJoin;
      this.sendGold(ship, riscatto, `Il Cantiere ha riscattato: ${[...new Set(tolte)].join(', ')}`);
    }
    delete ship.riscattoAlJoin;
    // le Fratellanze (issue #5): l'identità è l'uid dell'Ancoraggio.
    // In sviluppo (Node, MAI nel Worker) il client può dichiararlo:
    // il MareDO lo sovrascrive comunque con quello verificato dal token.
    if (typeof process !== 'undefined' && process.env && process.env.DEV_UID_OK && typeof msg.uid === 'string') {
      ship.uid = msg.uid.slice(0, 40);
    }
    this.aggiornaGilda(ship);
    // il diritto di sfida conquistato col blocco (profilo additivo, ancorati)
    ship.sfide = {};
    if (p.sfide && typeof p.sfide === 'object') {
      for (const [gid, fino] of Object.entries(p.sfide).slice(0, 10)) {
        if (typeof gid === 'string' && +fino > Date.now()) ship.sfide[gid.slice(0, 24)] = +fino;
      }
    }
    // la Gazzetta (issue #4): lo storico al join + il cursore dei non-letti
    ship.gazzettaLetta = Math.max(0, +p.gazzettaLetta || 0);
    this.sendTo(ship, { t: 'gazzetta', voci: gazzetta.ultime(50) });
    // il Mastro di Rotte (issue #3): il progresso personale torna dal profilo
    if (p.campagna && typeof p.campagna === 'object') {
      ship.campagna = {
        settimana: p.campagna.settimana | 0,
        tappa: Math.max(0, p.campagna.tappa | 0),
        fatto: Math.max(0, p.campagna.fatto | 0),
        completata: !!p.campagna.completata,
      };
    }
    // il dungeon del giorno (#38): l'ultimo periodo già incassato, per non
    // ripagare il premio a chi lo rivince nello stesso giorno
    ship.dungeonGiorno = p.dungeonGiorno | 0;
    const statoCampagna = this.campagnaPer(ship);
    if (statoCampagna) this.sendTo(ship, { t: 'campagna', stato: statoCampagna });
    const statoDungeon = this.dungeonGiornoPer(ship);
    if (statoDungeon) this.sendTo(ship, { t: 'dungeon', stato: statoDungeon });
    // le tre del giorno: le missioni sono quelle del seme del giorno, dal
    // profilo tornano solo progressi, strike e conto della settimana
    this.missions.ripristina(ship, p);
    this.missions.broadcastState();
    // le alleanze temporanee (#37): il nuovo arrivato vede le bandiere aperte
    this.sendTo(ship, { t: 'alleanzeAperte', bandiere: this.alleanze.bandiereAperte() });
    this.broadcast({ t: 'feed', msg: `⚓ ${name} è salpato nel Mare dell'Internet` });
    return ship;
  }

  youFor(ship) {
    return {
      gold: ship.gold, hullLvl: ship.hullLvl, sailsLvl: ship.sailsLvl,
      helmLvl: ship.helmLvl, crewLvl: ship.crewLvl, holdLvl: ship.holdLvl,
      tipo: ship.tipo, vari: ship.vari,
      mounts: ship.mounts, conquered: [...ship.conquered],
      preferiti: [...ship.preferiti],
      livree: [...ship.livree], livrea: ship.livrea, vele: ship.vele, scia: ship.scia, bandiera: ship.bandiera,
      gazzettaLetta: ship.gazzettaLetta || 0,
      campagna: ship.campagna || null,
      dungeonGiorno: ship.dungeonGiorno || 0,
      giornaliere: {
        giorno: ship.missioniGiorno | 0,
        progressi: (ship.giornaliere || []).map(m => m.progress | 0),
        fatte: (ship.giornaliere || []).map(m => !!m.fatta),
      },
      strike: ship.strike || { giorno: 0, n: 0 },
      settimana: ship.settimana || { periodo: 0, pieni: 0 },
      sfide: ship.sfide || {},
      kills: ship.kills, deaths: ship.deaths,
    };
  }

  leave(ship) {
    // scappare staccando la spina non paga: chi resta vince (issue #15)
    if (ship.blockedUntil > this.now) this.abborda(ship);
    this.alleanze.leave(ship); // chi sbarca esce dall'alleanza (#37)
    this.missions.leave(ship);
    this.ships.delete(ship.id);
    this.broadcast({ t: 'feed', msg: `${ship.name} è tornato sulla terraferma` });
  }

  sendTo(ship, obj) {
    if (ship.conn && ship.conn.readyState === 1) {
      try { ship.conn.send(JSON.stringify(obj)); } catch { /* connessione morente */ }
    }
  }

  broadcastIsland(island) {
    this.broadcast({ t: 'island', island: publicIsland(island) });
  }

  // La Gazzetta del Corsaro (issue #4): le notizie degne di storia vanno
  // nell'albo persistente E sul filo dei presenti. SOLO in gioco: la
  // consegna è il WebSocket, la persistenza il GazzettaDO (via hook).
  annuncia(tipo, testo) {
    const voce = gazzetta.pubblica(tipo, testo);
    this.broadcast({ t: 'feed', msg: voce.testo }); // il diario, per chi c'è
    this.broadcast({ t: 'notifica', voce });        // l'albo, per chi verrà
    if (this.onGazzetta) this.onGazzetta(voce);
  }

  // Il Mastro di Rotte (issue #3): la campagna della settimana avanza sugli
  // eventi che il Game emette già; i numeri sono del codice, mai dell'LLM.
  campagnaPer(ship) {
    const c = campagna.getCampagna();
    if (!c) return null;
    const st = ship.campagna && ship.campagna.settimana === c.settimana
      ? ship.campagna : { tappa: 0, fatto: 0, completata: false };
    return {
      settimana: c.settimana, nome: c.nome, lore: c.lore, premio: c.premio,
      tappe: c.tappe.map(t => ({ desc: t.desc, lore: t.lore, n: t.n })),
      tappa: st.tappa, fatto: st.fatto, completata: !!st.completata,
    };
  }

  // Il dungeon del giorno (#38) per l'HUD: obiettivo singolo (l'assalto), con il
  // bersaglio reale, la fascia e se il capitano l'ha già incassato oggi.
  dungeonGiornoPer(ship) {
    const dg = campagna.getDungeon('giornaliero');
    if (!dg) return null;
    return {
      periodo: dg.periodo, nome: dg.nome, lore: dg.lore, bersaglio: dg.bersaglio || null,
      premio: dg.premio, difficolta: dg.difficolta, scadenza: dg.scadenza,
      fatto: ship.dungeonGiorno === dg.periodo,
    };
  }

  // Stende i dungeon del Mastro (#38) sulle isole bersaglio: le difese temporanee
  // compaiono su isole normali per la durata del periodo. Il settimanale ha la
  // precedenza sul giornaliero se puntano la stessa isola. Idempotente (non
  // azzera le difese se il dungeon è già steso per quel periodo).
  applicaDungeoni() {
    for (const tipo of ['settimanale', 'giornaliero']) {
      const dg = campagna.getDungeon(tipo);
      if (!dg) continue;
      const isl = this.archipelago.applyDungeon(dg);
      if (isl) this.broadcast({ t: 'island', island: publicIsland(isl) });
    }
  }

  // --- le Fratellanze (issue #5) ---

  // la scheda che il client vede: con uid di richieste/membri SOLO per chi
  // ha i galloni (servono a approvare/promuovere; l'uid è l'handle pubblico)
  schedaPer(ship, g) {
    const s = gilde.scheda(g);
    s.mioRuolo = ship.uid ? gilde.ruoloDi(g, ship.uid) : null;
    if (s.mioRuolo === 'capitano' || s.mioRuolo === 'ufficiale') {
      s.richieste = g.richieste.map(r => ({ uid: r.uid, nome: r.nome }));
      s.membriUid = g.membri.map(m => ({ uid: m.uid, nome: m.nome, ruolo: m.ruolo }));
    }
    return s;
  }

  aggiornaGilda(ship) {
    const g = ship.uid ? gilde.diUid(ship.uid) : null;
    ship.gilda = g ? { id: g.id, tag: g.tag, nome: g.nome } : null;
    this.sendTo(ship, { t: 'gilda', mia: g ? this.schedaPer(ship, g) : null });
  }

  salvaGilda(g, cancella = false) {
    if (this.onGilde) this.onGilde(cancella ? 'cancella' : 'salva', g);
  }

  // ogni nave online della gilda si vede aggiornare tag e scheda
  rinfrescaGilda(id) {
    for (const s of this.ships.values()) {
      if (!s.npc && s.uid && (s.gilda ? s.gilda.id === id : gilde.diUid(s.uid))) this.aggiornaGilda(s);
    }
  }

  gildaMsg(ship, msg) {
    const rispondi = (r) => {
      if (r.errore) { this.sendTo(ship, { t: 'toast', msg: '🏴 ' + r.errore }); return null; }
      return r;
    };
    switch (msg.t) {
      case 'gildaElenco': {
        const elenco = gilde.tutte()
          .sort((a, b) => b.membri.length - a.membri.length)
          .slice(0, 30)
          .map(g => ({ ...gilde.scheda(g), sfidabile: !!(ship.sfide && ship.sfide[g.id] > Date.now()) }));
        this.sendTo(ship, { t: 'gildaElenco', gilde: elenco, fondazione: gilde.FONDAZIONE });
        break;
      }
      case 'gildaFonda': {
        if (ship.docked !== 'porto') { rispondi({ errore: 'Le Fratellanze si fondano al Porto Franco.' }); break; }
        if (ship.gold < gilde.FONDAZIONE) { rispondi({ errore: `Servono ${gilde.FONDAZIONE} 🪙 per fondare.` }); break; }
        const r = rispondi(gilde.fonda({
          nome: msg.nome, tag: msg.tag, motto: msg.motto, categoria: msg.categoria,
          bandiera: msg.bandiera, aperta: msg.aperta, uid: ship.uid, nomeNave: ship.name,
        }));
        if (!r) break;
        ship.gold -= gilde.FONDAZIONE;
        this.sendGold(ship, -gilde.FONDAZIONE, `La Fratellanza «${r.gilda.nome}» è fondata`);
        this.salvaGilda(r.gilda);
        this.aggiornaGilda(ship);
        this.annuncia('gilda', `🏴 ${ship.name} ha fondato la Fratellanza «${r.gilda.nome}» [${r.gilda.tag}] (${r.gilda.categoria})`);
        break;
      }
      case 'gildaRichiesta': {
        const g = gilde.get(String(msg.id || ''));
        if (!g) { rispondi({ errore: 'Fratellanza sconosciuta.' }); break; }
        if (!ship.sfide || !(ship.sfide[g.id] > Date.now())) {
          rispondi({ errore: 'Prima il rito: blocca una loro nave per conquistare il diritto.' });
          break;
        }
        const r = rispondi(gilde.richiedi(g.id, ship.uid, ship.name));
        if (!r) break;
        this.salvaGilda(r.gilda);
        if (r.ammesso) {
          delete ship.sfide[g.id];
          this.aggiornaGilda(ship);
          this.annuncia('gilda', `⛵ ${ship.name} è entrato nella Fratellanza «${g.nome}» [${g.tag}]`);
        } else {
          this.sendTo(ship, { t: 'toast', msg: `✉ Richiesta in rada: capitano e ufficiali di «${g.nome}» decideranno` });
          this.rinfrescaGilda(g.id); // gli ufficiali online vedono la richiesta
        }
        break;
      }
      case 'gildaApprova': case 'gildaRifiuta': {
        const mia = ship.uid && gilde.diUid(ship.uid);
        if (!mia) { rispondi({ errore: 'Non sei in una Fratellanza.' }); break; }
        const uidR = String(msg.uid || '').slice(0, 40);
        const r = rispondi(msg.t === 'gildaApprova'
          ? gilde.approva(mia.id, uidR, ship.uid)
          : gilde.rifiuta(mia.id, uidR, ship.uid));
        if (!r) break;
        this.salvaGilda(r.gilda);
        if (r.ammesso) {
          this.annuncia('gilda', `⛵ ${r.ammesso.nome} è stato ammesso nella Fratellanza «${mia.nome}» [${mia.tag}]`);
          for (const s of this.ships.values()) if (s.uid === uidR && s.sfide) delete s.sfide[mia.id];
        }
        this.rinfrescaGilda(mia.id);
        break;
      }
      case 'gildaLascia': case 'gildaSciogli': {
        const mia = ship.uid && gilde.diUid(ship.uid);
        if (!mia) { rispondi({ errore: 'Non sei in una Fratellanza.' }); break; }
        const r = rispondi(msg.t === 'gildaLascia' ? gilde.lascia(mia.id, ship.uid) : gilde.sciogli(mia.id, ship.uid));
        if (!r) break;
        if (r.sciolta) {
          this.salvaGilda(mia, true);
          this.annuncia('gilda', `🌊 La Fratellanza «${mia.nome}» [${mia.tag}] è stata sciolta`);
        } else {
          this.salvaGilda(r.gilda);
        }
        this.rinfrescaGilda(mia.id);
        this.aggiornaGilda(ship);
        break;
      }
      case 'gildaPromuovi': case 'gildaEspelli': {
        const mia = ship.uid && gilde.diUid(ship.uid);
        if (!mia) { rispondi({ errore: 'Non sei in una Fratellanza.' }); break; }
        const uidM = String(msg.uid || '').slice(0, 40);
        const r = rispondi(msg.t === 'gildaPromuovi'
          ? gilde.promuovi(mia.id, uidM, ship.uid)
          : gilde.espelli(mia.id, uidM, ship.uid));
        if (!r) break;
        this.salvaGilda(r.gilda);
        this.rinfrescaGilda(mia.id);
        break;
      }
    }
  }

  avanzaCampagna(ship, evento) {
    const c = campagna.getCampagna();
    if (!c || ship.npc) return;
    if (!ship.campagna || ship.campagna.settimana !== c.settimana) {
      ship.campagna = { settimana: c.settimana, tappa: 0, fatto: 0, completata: false };
    }
    const st = ship.campagna;
    if (st.completata || st.tappa >= c.tappe.length) return;
    if (c.tappe[st.tappa].tipo !== evento) return;
    st.fatto++;
    if (st.fatto >= c.tappe[st.tappa].n) {
      st.tappa++;
      st.fatto = 0;
      if (st.tappa >= c.tappe.length) {
        st.completata = true;
        ship.gold += c.premio;
        this.sendGold(ship, c.premio, `Campagna "${c.nome}" compiuta!`);
        this.annuncia('campagna', `⚔ ${ship.name} ha compiuto la campagna "${c.nome}"! (+${c.premio} 🪙)`);
        // l'edizione-impresa (issue #25): la livrea che non si compra
        if (!ship.livree.has('ombre')) {
          ship.livree.add('ombre');
          this.sendTo(ship, { t: 'toast', msg: '🎨 Guadagnata la livrea "Mare delle Ombre"! Indossala al Cantiere.' });
        }
      } else {
        this.sendTo(ship, { t: 'toast', msg: `⚔ Tappa compiuta! Ora: ${c.tappe[st.tappa].desc}` });
      }
    }
    this.sendTo(ship, { t: 'campagna', stato: this.campagnaPer(ship) });
  }

  // --- messaggi dai client ---

  handle(ship, msg) {
    switch (msg.t) {
      case 'input':
        for (const k of ['up', 'down', 'left', 'right']) ship.input[k] = !!msg[k];
        break;
      case 'fire': this.fire(ship, msg.group); break;
      // le munizioni (issue #41, fetta 2): switch libero, l'ack fa fede
      case 'munizione':
        if (W.MUNIZIONI[msg.tipo] && !ship.npc) {
          ship.munizione = msg.tipo;
          this.sendTo(ship, { t: 'munizione', tipo: msg.tipo });
        }
        break;
      case 'course': this.setCourse(ship, msg.q).catch(() => { /* la rotta si può ritracciare */ }); break;
      case 'dock': this.dock(ship); break;
      case 'preferisci': this.preferisci(ship, msg); break;
      case 'gazzettaLetta': ship.gazzettaLetta = Math.max(ship.gazzettaLetta || 0, +msg.fino || 0); break;
      case 'gildaElenco': case 'gildaFonda': case 'gildaRichiesta': case 'gildaApprova':
      case 'gildaRifiuta': case 'gildaLascia': case 'gildaSciogli': case 'gildaPromuovi':
      case 'gildaEspelli': this.gildaMsg(ship, msg); break;
      case 'undock': this.undock(ship); break;
      case 'shop': if (ship.docked === 'porto') this.sendShop(ship); break;
      case 'buyShip': this.buyShip(ship, msg.stat); break;
      case 'varo': this.varo(ship, msg.tipo); break;
      case 'abilita': this.abilita(ship); break;
      case 'buySlot': this.buySlot(ship, msg.group); break;
      case 'compraLivrea': this.compraLivrea(ship, msg.id); break;
      case 'indossaLivrea': this.indossaLivrea(ship, msg.id, msg.genere); break;
      case 'bandiera': this.bandieraPersonale(ship, msg.bandiera); break;
      case 'cartellone': this.cartellone(ship, msg.dominio); break;
      case 'upgradeWeapon': this.upgradeWeapon(ship, msg.group, msg.slot); break;
      case 'replaceWeapon': this.replaceWeapon(ship, msg.group, msg.slot); break;
      case 'assedio': this.missions.assedioJoin(ship, msg.role); break;
      // le alleanze temporanee (#37): invito diretto o bandiera aperta
      case 'alleanzaInvita': case 'alleanzaAccetta': case 'alleanzaRifiuta':
      case 'alleanzaLascia': case 'alleanzaApri': case 'alleanzaChiudi':
      case 'alleanzaUnisciti': this.alleanze.handle(ship, msg); break;
      // compat coi client vecchi (#39): le tre del giorno si accettano da sole
      case 'accetta': this.missions.accetta(ship); break;
      case 'rifiuta': this.missions.rifiuta(ship); break;
      case 'abbandona': this.missions.abbandona(ship); break;
    }
  }

  async setCourse(ship, q) {
    const parsed = parseCourse(q);
    if (!parsed) { this.sendTo(ship, { t: 'course', ok: false, error: 'Rotta illeggibile, corsaro.' }); return; }
    let island, isNew = false;
    if (parsed.search) {
      island = this.archipelago.get('oracolo');
    } else {
      // il dominio VERO è dove punta il redirect (issue #26bis): wikipedia.com
      // che rimanda a wikipedia.org è la stessa isola; apple.com e apple.org,
      // che NON si rimandano, restano distinti. Un'isola sola per entità.
      const dominio = await this.canonicalizza(parsed.domain);
      const r = this.archipelago.ensure(dominio);
      island = r.island; isNew = r.isNew;
      // solo le mete condivise finiscono sulla mappa di tutti; le altre le
      // vede solo chi ci naviga (arrivano nella risposta 'course' qui sotto)
      if (isNew && this.stabile(island)) this.broadcastIsland(island);
    }
    this.sendTo(ship, { t: 'course', ok: true, island: publicIsland(island), url: parsed.url, isNew });
  }

  // Segue il redirect del dominio per trovare la sua identità canonica
  // (eTLD+1 finale). Cache per non rifare la corsa; una risoluzione sola
  // per dominio. In caso di rete muta o test (OG_FINTO) si tiene il digitato.
  async canonicalizza(dominio) {
    if (this.canonico.has(dominio)) return this.canonico.get(dominio);
    if (OG_FINTO) return dominio;
    let corsa = this.canonicoInCorso.get(dominio);
    if (!corsa) {
      corsa = risolviRedirect(dominio).catch(() => dominio);
      this.canonicoInCorso.set(dominio, corsa);
      corsa.finally(() => this.canonicoInCorso.delete(dominio));
    }
    const canon = (await corsa) || dominio;
    this.canonico.set(dominio, canon);
    if (canon !== dominio && this.onCanonico) { try { this.onCanonico(dominio, canon); } catch { /* si ripersiste poi */ } }
    return canon;
  }

  // --- fuoco ---

  fire(ship, group) {
    if (!GROUP_DIR.hasOwnProperty(group)) return;
    if (ship.docked || this.isSunk(ship) || ship.npc === 'merc') return;
    if (ship.blockedUntil > this.now) return; // bloccata: cannoni muti
    if (!ship.npc) ship.graceUntil = 0; // chi apre il fuoco rinuncia alla tregua
    const mounts = ship.mounts[group];
    if (!mounts.length) return;
    const reloadMul = shipStats(ship).reloadMul;
    const raddoppio = ship.doubleUntil > this.now ? 2 : 1; // Bordata Doppia
    // ciurma falcidiata dalla mitraglia (issue #41, fetta 2): si ricarica piano
    const falcidia = ship.falcidiaUntil > this.now ? W.MUNIZIONI.mitraglia.falcidia.malus : 1;
    const out = [];
    for (let i = 0; i < mounts.length; i++) {
      if (this.now < ship.ready[group][i]) continue;
      const w = mounts[i];
      const st = W.weaponStats(w);
      // la munizione scelta veste il colpo; il mortaio (arc) spara sempre
      // palle: una bombarda non si incatena. Gli NPC restano a palle.
      const mun = (st.arc || ship.npc) ? 'palle' : (W.MUNIZIONI[ship.munizione] ? ship.munizione : 'palle');
      ship.ready[group][i] = this.now + st.reload * reloadMul * falcidia;
      const dir = ship.rot + GROUP_DIR[group];
      // posizione della bocca da fuoco lungo lo scafo
      let along = 0, side = 0;
      if (group === 'left' || group === 'right') {
        along = mounts.length === 1 ? 0 : (i / (mounts.length - 1) - 0.5) * 34;
        side = 14;
      } else if (group === 'bow') { along = 24; side = (i - 0.5) * 8; }
      else { along = -22; side = (i - 0.5) * 8; }
      const px = ship.x + Math.cos(ship.rot) * along + Math.cos(dir) * side;
      const py = ship.y + Math.sin(ship.rot) * along + Math.sin(dir) * side;
      const balle = st.burst * raddoppio;
      for (let b = 0; b < balle; b++) {
        const jitter = (Math.random() - 0.5) * (balle > 1 ? 0.16 : 0.09);
        out.push(this.spawnShot(ship.id, px, py, dir + jitter, st, mun));
      }
    }
    if (out.length) this.broadcast({ t: 'shots', from: ship.id, shots: out });
  }

  spawnShot(owner, x, y, dir, st, mun = 'palle') {
    const id = this.nextShotId++;
    // la munizione scala le stat dell'arma (issue #41, fetta 2): le catene
    // volano corte e lente, la mitraglia cortissima — il danno è nel debuff
    const m = W.MUNIZIONI[mun] || W.MUNIZIONI.palle;
    const speed = st.speed * m.speed;
    const shot = {
      id, owner, x, y,
      vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed,
      ttl: (st.range * m.range) / speed, damage: st.dmg * m.dmg,
      aoe: st.aoe || 0, arc: !!st.arc, mun,
    };
    this.shots.set(id, shot);
    return {
      id, x: r1(x), y: r1(y), vx: r1(shot.vx), vy: r1(shot.vy), ttl: r2(shot.ttl), arc: shot.arc ? 1 : 0, aoe: shot.aoe,
      // campo additivo: il tipo di proiettile, solo se non è una palla
      ...(mun !== 'palle' ? { mn: mun } : {}),
    };
  }

  // --- attracco / porto ---

  fortressBlocks(ship, island) {
    // sbarra l'approdo sia le Fortezze Proibite sia i dungeon temporanei del
    // Mastro (#38): entrambi hanno difese da abbattere prima di poter attraccare
    if (!island.defs || (!island.fortress && !island.dungeon)) return false;
    if (ship.conquered.has(island.id)) return false;
    if (island.fallenUntil > this.now) return false;
    return island.defs.some(d => !d.dead);
  }

  dock(ship) {
    if (ship.docked || this.isSunk(ship) || ship.npc) return;
    if (ship.blockedUntil > this.now) return; // bloccata: niente fughe in banchina
    if (ship.vel > 45) { this.sendTo(ship, { t: 'toast', msg: 'Troppo veloce per attraccare: ammaina le vele!' }); return; }
    let best = null, bestD = Infinity;
    for (const i of this.archipelago.list()) {
      const d = Math.hypot(i.x - ship.x, i.y - ship.y);
      if (d < i.r + 90 && d < bestD) { best = i; bestD = d; }
    }
    if (!best) { this.sendTo(ship, { t: 'toast', msg: 'Nessun approdo in vista.' }); return; }
    if (this.fortressBlocks(ship, best)) {
      this.sendTo(ship, { t: 'toast', msg: '🏰 La Fortezza sbarra l\'approdo: abbatti TUTTE le sue difese!' });
      return;
    }
    ship.docked = best.id; ship.vel = 0;
    const firstVisit = best.id !== 'porto' && !ship.visited.has(best.id);
    if (best.id === 'porto') {
      ship.hp = shipStats(ship).maxHp; // riparazione completa al porto
      this.sendTo(ship, { t: 'docked', island: publicIsland(best) });
      this.sendShop(ship);
    } else {
      if (firstVisit) {
        ship.visited.add(best.id);
        ship.gold += DISCOVERY_GOLD;
        this.sendGold(ship, DISCOVERY_GOLD, 'Terra scoperta!');
        this.avanzaCampagna(ship, 'scoperte');
      }
      this.sendTo(ship, { t: 'docked', island: publicIsland(best) });
      // Atlante comunitario: l'approdo fa crescere l'isola per tutti
      if (best.kind === 'site' && this.onApprodo) this.onApprodo(best.domain);
    }
    this.missions.onDock(ship, best, firstVisit);
  }

  // La stella dell'approdo (issue #13): si segna solo l'isola dove si è
  // attraccati ORA — il segnalibro è un gesto di presenza, non di curl.
  preferisci(ship, msg) {
    if (ship.npc || !ship.docked || ship.docked === 'porto') return;
    const island = this.archipelago.get(ship.docked);
    if (!island || !island.domain || island.domain !== msg.dominio) return;
    if (msg.on) {
      if (ship.preferiti.size >= PREFERITI_MAX && !ship.preferiti.has(island.domain)) {
        this.sendTo(ship, { t: 'toast', msg: `⭐ Hai già ${PREFERITI_MAX} approdi preferiti: togline uno prima` });
        return;
      }
      ship.preferiti.add(island.domain);
      this.sendTo(ship, { t: 'toast', msg: `⭐ ${island.name} è tra i tuoi approdi preferiti` });
    } else {
      ship.preferiti.delete(island.domain);
      this.sendTo(ship, { t: 'toast', msg: `☆ ${island.name} tolta dagli approdi preferiti` });
    }
  }

  undock(ship) {
    if (!ship.docked) return;
    const island = this.archipelago.get(ship.docked);
    ship.docked = null;
    if (island) {
      const a = Math.atan2(ship.y - island.y, ship.x - island.x) || Math.random() * Math.PI * 2;
      ship.x = island.x + Math.cos(a) * (island.r + 100);
      ship.y = island.y + Math.sin(a) * (island.r + 100);
      ship.rot = a;
    }
    ship.vel = 0;
    this.sendTo(ship, { t: 'undocked' });
  }

  // --- cantiere ---

  sendShop(ship) {
    const groups = {};
    const perTipo = W.groupsPer(ship.tipo);
    for (const g of Object.keys(W.GROUPS)) {
      groups[g] = {
        // gli slot grandfathered oltre il tetto nuovo restano visibili
        max: Math.max(perTipo[g].max, ship.mounts[g].length),
        nextSlotCost: W.slotCost(g, ship.mounts[g].length, ship.tipo),
        slots: ship.mounts[g].map((w, i) => {
          const nt = w.lvl >= W.MAX_WEAPON_LVL ? W.nextTier(w.type, ship.tipo) : null;
          const st = W.weaponStats(w);
          return {
            slot: i, type: w.type, lvl: w.lvl, name: W.TYPES[w.type].name, tier: W.TYPES[w.type].tier,
            // i numeri dell'arma AL LIVELLO ATTUALE (audit Cantiere): per
            // decidere un potenziamento non serve la memoria, serve la scheda
            stats: { dmg: st.dmg, range: st.range, reload: st.reload },
            upCost: W.upgradeCost(w),
            replace: nt ? (({ dmg, range, reload }) => ({
              type: nt, name: W.TYPES[nt].name, cost: W.TYPES[nt].cost,
              stats: { dmg, range, reload },
            }))(W.weaponStats({ type: nt, lvl: 1 })) : null,
          };
        }),
      };
    }
    this.sendTo(ship, {
      t: 'shop', gold: ship.gold,
      ship: {
        hullLvl: ship.hullLvl, sailsLvl: ship.sailsLvl,
        helmLvl: ship.helmLvl, crewLvl: ship.crewLvl, holdLvl: ship.holdLvl,
        hullCost: lineCost(ship, 'hullLvl'), sailsCost: lineCost(ship, 'sailsLvl'),
        helmCost: lineCost(ship, 'helmLvl'), crewCost: lineCost(ship, 'crewLvl'),
        holdCost: lineCost(ship, 'holdLvl'),
      },
      mounts: ship.mounts,
      groups,
      varo: { tipo: ship.tipo, vari: ship.vari, cost: varoCost(ship), tipi: TIPI_PUB },
      negozio: {
        catalogo: livree.publicCatalogo(), possedute: [...ship.livree],
        livrea: ship.livrea, vele: ship.vele, scia: ship.scia, bandiera: ship.bandiera,
      },
    });
  }

  // --- il Negozio delle Livree (issue #25): pay to show, mai pay to win ---

  compraLivrea(ship, id) {
    const l = livree.CATALOGO[typeof id === 'string' ? id : ''];
    if (ship.docked !== 'porto' || !l) return;
    if (ship.livree.has(id)) { this.sendTo(ship, { t: 'toast', msg: 'Ce l\'hai già nel guardaroba, capitano.' }); return; }
    if (l.prezzo === null) { this.sendTo(ship, { t: 'toast', msg: 'Questa non si compra: si guadagna.' }); return; }
    if (!this.charge(ship, l.prezzo)) return;
    ship.livree.add(id);
    // appena comprata, addosso: nessun secondo click per pavoneggiarsi.
    // Lo slot lo detta il GENERE del catalogo, mai un fallback (era la
    // trappola livree/vele: client e server collassavano in slot opposti)
    ship[l.genere] = id;
    this.annuncia('livrea', `🎨 ${ship.name} sfoggia una livrea nuova: "${l.nome}"!`);
    this.sendShop(ship);
  }

  indossaLivrea(ship, id, genere) {
    if (ship.docked !== 'porto') return;
    if (!livree.GENERI.includes(genere)) return; // genere ignoto: niente slot a caso
    if (id === null || id === undefined) {
      ship[genere] = null; // si torna al legno nudo (o alla tela, o alla scia del mare)
    } else {
      const l = livree.CATALOGO[typeof id === 'string' ? id : ''];
      if (!l || !ship.livree.has(id) || l.genere !== genere) return;
      ship[genere] = id;
    }
    this.sendShop(ship);
  }

  bandieraPersonale(ship, b) {
    // identità, non merce: si issa (o si ammaina con null) anche in mare
    ship.bandiera = livree.sanificaBandiera(b);
    if (ship.docked === 'porto') this.sendShop(ship);
  }

  // --- il Cartellone dell'isola (issue #27) ---
  // L'anteprima OG del sito quando la nave si ACCOSTA davvero (la distanza
  // la verifica il server: il protocollo non è un raschietto). Le fortezze
  // non fanno pubblicità: sono la blocklist, né visitarle né decantarle.

  async cartellone(ship, dominio) {
    if (ship.npc || typeof dominio !== 'string') return;
    const island = this.archipelago.get(dominio);
    if (!island || island.kind !== 'site' || island.fortress) return;
    if (Math.hypot(ship.x - island.x, ship.y - island.y) > island.r + CARTELLONE.raggio) return;
    const ora = Date.now();
    const pronto = this.cartelloni.get(dominio);
    if (pronto && ora - pronto.at < CARTELLONE.ttl) {
      this.sendTo(ship, { t: 'cartellone', dominio, og: pronto.og });
      return;
    }
    if (ship.cartelloneAt && this.now - ship.cartelloneAt < 1) return; // freno per nave
    ship.cartelloneAt = this.now;
    let corsa = this.cartelloniInCorso.get(dominio);
    if (!corsa) {
      corsa = this.scaricaCartellone(dominio, ora);
      this.cartelloniInCorso.set(dominio, corsa);
      corsa.finally(() => this.cartelloniInCorso.delete(dominio));
    }
    const dati = await corsa;
    // anche il cartellone bianco si consegna: il client smette di chiedere
    this.sendTo(ship, { t: 'cartellone', dominio, og: dati });
  }

  async scaricaCartellone(dominio, ora) {
    let dati = { titolo: '', descrizione: '', img: false };
    let riuscito = false;
    try {
      const html = await leggiSito(dominio);
      const e = og.estraiOG(html, 'https://' + dominio + '/');
      dati = { titolo: e.titolo, descrizione: e.descrizione, img: !!e.immagine };
      riuscito = true;
      // il traghetto verso il proxy delle immagini: chi ha lo storage
      // (MareDO/R2 o il server di sviluppo) annota l'URL approvato
      if (e.immagine && this.onCartellone) {
        try { await this.onCartellone(dominio, e.immagine); } catch { dati.img = false; }
      }
    } catch { /* sito muto o lento: il cartellone resta bianco */ }
    // si cachea SOLO ciò che si è letto davvero: un fallimento (sito lento o
    // bloccato al momento) non deve condannare il cartellone al bianco per una
    // settimana — al prossimo passaggio si riprova (issue #27, robustezza)
    if (riuscito) {
      this.cartelloni.set(dominio, { og: dati, at: ora });
      if (this.cartelloni.size > CARTELLONE.maxCache) {
        this.cartelloni.delete(this.cartelloni.keys().next().value);
      }
    }
    return dati;
  }

  // Il varo: si sceglie (o si cambia) il tipo di nave. Le esclusive
  // dell'altro tipo vengono riscattate al prezzo PIENO pagato: cambiare
  // rotta costa il varo, mai le armi già comprate.
  varo(ship, tipo) {
    if (ship.docked !== 'porto' || !TIPI[tipo]) return;
    if (ship.tipo === tipo) { this.sendTo(ship, { t: 'toast', msg: 'Questa è già la tua nave, capitano.' }); return; }
    if (!this.charge(ship, varoCost(ship))) return;
    ship.vari++;
    ship.tipo = tipo;
    // la matrice del legno decide cosa il nuovo scafo regge: esclusive
    // altrui, vietate e gruppi a tetto zero tornano oro pieno (fonte
    // fidata: questi mount vivevano già sul server)
    const { mounts, riscatto, tolte } = W.sanitizeConRiscatto(ship.mounts, tipo, true);
    ship.mounts = mounts;
    this.syncReady(ship);
    if (riscatto) {
      ship.gold += riscatto;
      this.sendGold(ship, riscatto, `Il Cantiere ha riscattato: ${[...new Set(tolte)].join(', ')}`);
    }
    ship.hp = shipStats(ship).maxHp; // il varo esce dal bacino a scafo asciutto
    this.broadcast({ t: 'feed', msg: `⚓ ${ship.name} ha varato: ora naviga su un ${TIPI[tipo].nome}!` });
    this.sendShop(ship);
  }

  charge(ship, cost) {
    if (cost === null || cost === undefined) { this.sendTo(ship, { t: 'toast', msg: 'Già al massimo, capitano.' }); return false; }
    if (ship.gold < cost) { this.sendTo(ship, { t: 'toast', msg: 'Crediti insufficienti.' }); return false; }
    ship.gold -= cost;
    return true;
  }

  buyShip(ship, stat) {
    const field = SHIP_LINES[stat];
    if (ship.docked !== 'porto' || !field) return;
    if (!this.charge(ship, lineCost(ship, field))) return;
    ship[field]++;
    if (stat === 'hull') ship.hp = shipStats(ship).maxHp;
    this.sendShop(ship);
  }

  buySlot(ship, group) {
    if (ship.docked !== 'porto' || !W.GROUPS[group]) return;
    if (!this.charge(ship, W.slotCost(group, ship.mounts[group].length, ship.tipo))) return;
    ship.mounts[group].push({ type: 'colubrina', lvl: 1 }); // lo slot arriva armato
    this.syncReady(ship);
    this.sendShop(ship);
  }

  upgradeWeapon(ship, group, slot) {
    const w = W.GROUPS[group] && ship.mounts[group][slot | 0];
    if (ship.docked !== 'porto' || !w) return;
    if (!this.charge(ship, W.upgradeCost(w))) return;
    w.lvl++;
    this.sendShop(ship);
  }

  replaceWeapon(ship, group, slot) {
    const w = W.GROUPS[group] && ship.mounts[group][slot | 0];
    if (ship.docked !== 'porto' || !w) return;
    if (w.lvl < W.MAX_WEAPON_LVL) { this.sendTo(ship, { t: 'toast', msg: 'Prima porta quest\'arma al livello massimo.' }); return; }
    const nt = W.nextTier(w.type, ship.tipo);
    if (!nt) { this.sendTo(ship, { t: 'toast', msg: 'Non esiste arma più potente di questa.' }); return; }
    if (!this.charge(ship, W.TYPES[nt].cost)) return;
    ship.mounts[group][slot | 0] = { type: nt, lvl: 1 };
    this.sendShop(ship);
  }

  // --- abilità di tipo (tasto R) ---

  abilita(ship) {
    const a = !ship.npc && ABILITA[ship.tipo];
    if (!a || ship.docked || this.isSunk(ship) || ship.blockedUntil > this.now) return;
    if (this.now < ship.abilityAt) {
      this.sendTo(ship, { t: 'toast', msg: `⏳ ${a.nome}: ancora ${Math.ceil(ship.abilityAt - this.now)}s` });
      return;
    }
    ship.abilityAt = this.now + a.cd;
    if (ship.tipo === 'goletta') {
      ship.ramUntil = this.now + a.durata;
      ship.graceUntil = 0; // chi sperona rinuncia alla tregua
      this.fxQueue.push({ k: 'ram', x: r1(ship.x), y: r1(ship.y) }); // telegrafo: la carica si vede partire
    } else if (ship.tipo === 'guerra') {
      this.smokes.push({ x: ship.x, y: ship.y, r: a.raggio, until: this.now + a.durata });
    } else if (ship.tipo === 'galeone') {
      ship.doubleUntil = this.now + a.durata;
      for (const g of Object.keys(W.GROUPS)) ship.ready[g] = ship.ready[g].map(() => 0); // canne fresche
    } else if (ship.tipo === 'sciabecco') {
      ship.ventoUntil = this.now + a.durata;
      // la raffica ha il SUO telegrafo (#41 fetta 2-bis), non l'anello dello
      // sperone: chi guarda deve capire cosa sta partendo
      this.fxQueue.push({ k: 'vento', x: r1(ship.x), y: r1(ship.y) });
    }
    // la durata viaggia nell'ack: il client mostra quanto resta dell'effetto
    this.sendTo(ship, { t: 'abilita', nome: a.nome, cd: a.cd, durata: a.durata });
  }

  inSmoke(ship) {
    return this.smokes.some(s => s.until > this.now && Math.hypot(ship.x - s.x, ship.y - s.y) < s.r);
  }

  // lo Speronamento: prua indurita e vento in poppa; chi viene toccato
  // incassa la mazzata, lo speronatore paga un piccolo pegno di legno
  ramTick(ship) {
    const a = ABILITA.goletta;
    for (const other of this.ships.values()) {
      if (other === ship || other.docked || this.isSunk(other)) continue;
      if (Math.hypot(other.x - ship.x, other.y - ship.y) > 30) continue;
      ship.ramUntil = 0;
      this.fxQueue.push({ k: 'boom', x: r1((ship.x + other.x) / 2), y: r1((ship.y + other.y) / 2), r: 42 });
      this.damageShip(other, a.dmg, ship.id);
      this.damageShip(ship, a.autodanno, other.id);
      break;
    }
  }

  sendGold(ship, delta, reason) {
    if (!ship.npc) this.sendTo(ship, { t: 'gold', gold: ship.gold, delta, reason });
  }

  isSunk(ship) { return ship.sunkUntil > this.now; }

  // --- simulazione ---

  tick() {
    this.now = Date.now() / 1000;
    // il vento ruota piano, semato sull'orologio (VENTO_FISSO nei collaudi)
    this.vento = vento.FISSO || vento.ventoAl(this.now * 1000);
    const dt = TICK;
    if (this.smokes.length) this.smokes = this.smokes.filter(s => s.until > this.now);
    for (const ship of this.ships.values()) {
      if (ship.sunkUntil && this.now >= ship.sunkUntil) this.respawn(ship);
      if (this.isSunk(ship) || ship.docked) continue;
      // il blocco (issue #15): la nave è inerme; si risolve col tocco o col tempo
      if (ship.blockedUntil) {
        if (this.now >= ship.blockedUntil) { this.libera(ship); continue; }
        const p = this.ships.get(ship.blockedBy);
        if (p && !this.isSunk(p) && !p.docked &&
            Math.hypot(p.x - ship.x, p.y - ship.y) < BLOCCO.tocco) this.abborda(ship);
        continue;
      }
      // la resa (issue #41, fetta 3): bandiera ammainata, timone e vele ferme
      if (ship.resaUntil > this.now) {
        ship.input.up = ship.input.left = ship.input.right = false;
      } else if (ship.npc === 'merc') (ship.convoglio ? this.steerCapo(ship) : this.steerMerc(ship));
      else if (ship.npc === 'ghost') {
        if (ship.convoglio) this.steerScorta(ship);
        else if (ship.caccia) this.steerCacciatore(ship);
        else this.steerGhost(ship);
      }
      this.move(ship, dt);
      if (ship.ramUntil > this.now) this.ramTick(ship);
      this.regen(ship, dt);
    }
    this.moveShots(dt);
    this.tickForts(dt);
    this.tickResa();
    this.tickCarovane();
    this.missions.tick(this.now);
    this.tickCount++;
    if (this.fxQueue.length) { this.broadcast({ t: 'fx', list: this.fxQueue }); this.fxQueue = []; }
    if (this.tickCount % SNAP_EVERY === 0) this.sendSnapshot();
  }

  move(ship, dt) {
    const st = shipStats(ship);
    // il vento (issue #41) spinge o frena OGNI scafo, NPC compresi (le loro
    // velocità fisse bypassano shipStats): una regola sola, anche per le
    // cariche di Speronamento e Colpo di Vento che moltiplicano questa speed.
    // Le vele tagliate dalle catene (fetta 2) frenano allo stesso modo.
    const fv = vento.fattore(this.vento, ship.rot);
    const taglio = ship.veleTagliateUntil > this.now ? W.MUNIZIONI.catene.taglia.malus : 1;
    const speed = (ship.npc === 'merc' ? 75 : (ship.npc === 'ghost' ? 105 : st.speed)) * fv * taglio;
    const turn = (ship.input.left ? -1 : 0) + (ship.input.right ? 1 : 0);
    ship.rot += turn * st.turnRate * dt;
    // durante lo speronamento (o il Colpo di Vento) la nave carica, vele o non vele
    const desired = ship.ramUntil > this.now ? speed * ABILITA.goletta.spinta
      : ship.ventoUntil > this.now ? speed * ABILITA.sciabecco.spinta
        : ship.input.up ? speed : 0;
    ship.vel += (desired - ship.vel) * Math.min(1, dt * 1.1);
    if (ship.input.down) ship.vel *= Math.max(0, 1 - 2.5 * dt);
    ship.x += Math.cos(ship.rot) * ship.vel * dt;
    ship.y += Math.sin(ship.rot) * ship.vel * dt;
    if (ship.x < 60) { ship.x = 60; ship.vel *= 0.5; }
    if (ship.y < 60) { ship.y = 60; ship.vel *= 0.5; }
    if (ship.x > WORLD.W - 60) { ship.x = WORLD.W - 60; ship.vel *= 0.5; }
    if (ship.y > WORLD.H - 60) { ship.y = WORLD.H - 60; ship.vel *= 0.5; }
    for (const i of this.archipelago.list()) {
      const d = Math.hypot(ship.x - i.x, ship.y - i.y);
      const min = i.r + 18;
      if (d < min && d > 0.001) {
        ship.x = i.x + ((ship.x - i.x) / d) * min;
        ship.y = i.y + ((ship.y - i.y) / d) * min;
        ship.vel *= 0.4;
        if (ship.npc) ship.wp = null;
      }
    }
  }

  steerToward(ship, tx, ty, throttle = true) {
    const want = Math.atan2(ty - ship.y, tx - ship.x);
    let d = want - ship.rot;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    ship.input.left = d < -0.08; ship.input.right = d > 0.08; ship.input.up = throttle;
    return d;
  }

  steerMerc(ship) {
    if (!ship.wp || Math.hypot(ship.wp.x - ship.x, ship.wp.y - ship.y) < 90) {
      ship.wp = { x: 500 + Math.random() * (WORLD.W - 1000), y: 500 + Math.random() * (WORLD.H - 1000) };
    }
    this.steerToward(ship, ship.wp.x, ship.wp.y);
  }

  // --- le carovane scortate, la resa e i cacciatori (issue #41, fette 3-4) ---

  // il capo della carovana tira dritto verso il porto di destinazione:
  // niente giri turistici, la rotta è quella annunciata
  steerCapo(ship) {
    const c = ship.convoglio && this.carovane[ship.convoglio.tipo];
    if (!c) { this.steerMerc(ship); return; }
    this.steerToward(ship, c.meta.x, c.meta.y);
  }

  // caccia col fianco: insegui la preda, mettila al traverso e fai fuoco —
  // il mestiere condiviso da scorte e Cacciatori di Taglie
  attacca(ship, preda) {
    const d = Math.hypot(preda.x - ship.x, preda.y - ship.y);
    if (d > 240) { this.steerToward(ship, preda.x, preda.y); return; }
    const want = Math.atan2(preda.y - ship.y, preda.x - ship.x);
    const scelte = [want - Math.PI / 2, want + Math.PI / 2]
      .map((rot) => ({ rot, d: Math.abs(this.normAngle(rot - ship.rot)) }))
      .sort((a, b) => a.d - b.d);
    const lato = scelte[0].rot === want - Math.PI / 2 ? 'right' : 'left';
    const diff = this.normAngle(scelte[0].rot - ship.rot);
    ship.input.left = diff < -0.08; ship.input.right = diff > 0.08; ship.input.up = d > 150;
    if (Math.abs(diff) < 0.35) this.fire(ship, lato);
  }

  // la scorta tiene la stazione ai lati del capo; se qualcuno tocca la
  // carovana, molla la formazione e gli dà la caccia (mutuo soccorso)
  steerScorta(ship) {
    const c = ship.convoglio && this.carovane[ship.convoglio.tipo];
    const capo = c && this.ships.get(c.capo);
    if (!c || !capo || this.isSunk(capo)) { this.steerGhost(ship); return; }
    const preda = c.minaccia && c.minaccia.fino > this.now ? this.ships.get(c.minaccia.id) : null;
    if (preda && !this.isSunk(preda) && !preda.docked && !this.inSmoke(preda) &&
        Math.hypot(preda.x - ship.x, preda.y - ship.y) < 900) {
      this.attacca(ship, preda);
      return;
    }
    // stazione: i posti si aprono a ventaglio dietro le spalle del capo
    const posto = (ship.convoglio.posto - (c.scorte.length - 1) / 2) * 1.6 + Math.PI;
    const tx = capo.x + Math.cos(capo.rot + posto) * 95;
    const ty = capo.y + Math.sin(capo.rot + posto) * 95;
    this.steerToward(ship, tx, ty, Math.hypot(tx - ship.x, ty - ship.y) > 55);
  }

  normAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

  // una carovana salpa: capo panciuto + scorte, rotta vera annunciata in
  // Gazzetta. I capolinea EVITANO fortezze e isole con difese attive (i
  // dungeon del Mastro sparano anche ai mercantili: visto in collaudo un
  // Galeone del Tesoro crivellato in rada prima ancora di salpare)
  spawnCarovana(tipo) {
    const cfg = CAROVANE[tipo];
    const isole = this.archipelago.list()
      .filter(i => !i.fortress && !(i.defs && i.defs.some(d => !d.dead)));
    if (!cfg || isole.length < 2) return;
    let da = null, a = null;
    for (let tenta = 0; tenta < 12 && !a; tenta++) {
      da = isole[Math.floor(Math.random() * isole.length)];
      const lontane = isole.filter(i => i !== da && Math.hypot(i.x - da.x, i.y - da.y) > 2200);
      if (lontane.length) a = lontane[Math.floor(Math.random() * lontane.length)];
    }
    if (!a) return;
    const capo = this.spawnNpc('merc');
    capo.name = cfg.nome;
    capo.stazza = cfg.stazza;
    capo.hp = this.npcMaxHp(capo);
    const ang = Math.atan2(a.y - da.y, a.x - da.x);
    capo.x = da.x + Math.cos(ang) * (da.r + 140);
    capo.y = da.y + Math.sin(ang) * (da.r + 140);
    capo.rot = ang;
    capo.convoglio = { tipo, ruolo: 'capo' };
    const scorte = [];
    for (let i = 0; i < cfg.scorte; i++) {
      const s = this.spawnNpc('ghost');
      s.name = cfg.scortaNome;
      // la Guardia del Tesoro spara più pesante della scorta ordinaria
      for (const g of ['left', 'right']) s.mounts[g].forEach(w => { w.lvl = cfg.lvlScorta; });
      const posto = (i - (cfg.scorte - 1) / 2) * 1.6 + Math.PI;
      s.x = capo.x + Math.cos(capo.rot + posto) * 95;
      s.y = capo.y + Math.sin(capo.rot + posto) * 95;
      s.rot = ang;
      s.convoglio = { tipo, ruolo: 'scorta', posto: i };
      scorte.push(s.id);
    }
    this.carovane[tipo] = { capo: capo.id, scorte, meta: { x: a.x, y: a.y, r: a.r, nome: a.name }, minaccia: null };
    this.annuncia('convoglio', cfg.annuncio(da.name, a.name));
  }

  // fine corsa: all'ARRIVO tutti a terra (spariscono in porto); se il capo
  // AFFONDA le scorte non svaniscono a mezz'aria — restano a caccia come
  // orfane e il mare se le riprende quando affondano (niente respawn)
  sciogliCarovana(tipo, motivo, arrivo) {
    const c = this.carovane[tipo];
    if (!c) return;
    for (const id of [c.capo, ...c.scorte]) {
      const s = this.ships.get(id);
      if (!s) continue;
      if (arrivo && !this.isSunk(s)) this.ships.delete(id);
      // i relitti e le orfane conservano ship.convoglio: al "respawn" si tolgono
    }
    this.carovane[tipo] = null;
    this.prossimaCarovana[tipo] = this.now + CAROVANE[tipo].ogni;
    if (motivo) this.broadcast({ t: 'feed', msg: motivo });
  }

  tickCarovane() {
    for (const tipo of Object.keys(CAROVANE)) {
      const c = this.carovane[tipo];
      if (!c) {
        if (this.now >= this.prossimaCarovana[tipo]) this.spawnCarovana(tipo);
        continue;
      }
      const capo = this.ships.get(c.capo);
      if (!capo) { this.sciogliCarovana(tipo, null); continue; }
      if (this.isSunk(capo)) {
        this.sciogliCarovana(tipo, CAROVANE[tipo].perduto, false);
        continue;
      }
      if (Math.hypot(capo.x - c.meta.x, capo.y - c.meta.y) < c.meta.r + 170) {
        this.sciogliCarovana(tipo, CAROVANE[tipo].arrivo(c.meta.nome), true);
      }
    }
  }

  // --- i Cacciatori di Taglie (issue #41, fetta 4) ---

  // l'infamia chiama: ogni CACCIA.ogniKill prede, un Cacciatore fiuta il
  // colpevole — se non ne ha già uno addosso e c'è posto sul mare
  valutaTaglia(pirata) {
    if (!pirata || pirata.npc) return;
    if (pirata.kills - pirata.tagliaCacciata < CACCIA.ogniKill) return;
    if (this.cacciatori >= CACCIA.max) return;
    for (const s of this.ships.values()) {
      if (s.caccia && s.caccia.bersaglio === pirata.id) return; // già braccato
    }
    pirata.tagliaCacciata = pirata.kills;
    const h = this.spawnNpc('ghost');
    h.name = 'Cacciatore di Taglie';
    h.stazza = CACCIA.stazza;
    h.hp = this.npcMaxHp(h);
    for (const g of ['left', 'right']) h.mounts[g].forEach(w => { w.lvl = 3; });
    const ang = Math.random() * Math.PI * 2;
    h.x = Math.max(200, Math.min(WORLD.W - 200, pirata.x + Math.cos(ang) * 900));
    h.y = Math.max(200, Math.min(WORLD.H - 200, pirata.y + Math.sin(ang) * 900));
    h.caccia = { bersaglio: pirata.id, fino: this.now + CACCIA.ttl };
    this.cacciatori++;
    this.broadcast({ t: 'feed', msg: `⚔ Una taglia pende su ${pirata.name}: un Cacciatore gli dà la caccia!` });
  }

  // il mandato scade, il bersaglio sparisce o attracca: il Cacciatore molla.
  // Finché dura, insegue SOLO il suo uomo — le altre prede non lo riguardano
  steerCacciatore(ship) {
    const preda = this.ships.get(ship.caccia.bersaglio);
    const finita = !preda || this.now > ship.caccia.fino ||
      preda.docked || this.isSunk(preda) || this.inSmoke(preda);
    if (finita) {
      // il fumo o l'attracco lo seminano solo a mandato scaduto; prima aspetta
      if (preda && this.now <= ship.caccia.fino && !this.isSunk(preda)) {
        if (preda.docked || this.inSmoke(preda)) { ship.input.up = false; return; }
      }
      this.congedaCacciatore(ship, preda ? `⚔ Il Cacciatore rinuncia: ${preda.name} l'ha fatta franca.` : null);
      return;
    }
    this.attacca(ship, preda);
  }

  congedaCacciatore(ship, motivo) {
    if (!ship.caccia) return;
    const preda = this.ships.get(ship.caccia.bersaglio);
    if (preda) preda.tagliaCacciata = preda.kills; // il conto riparte da qui
    ship.caccia = null;
    this.cacciatori = Math.max(0, this.cacciatori - 1);
    this.ships.delete(ship.id);
    if (motivo) this.broadcast({ t: 'feed', msg: motivo });
  }

  // il saccheggio col tocco: primo capitano accosto al mercantile arreso
  tickResa() {
    for (const ship of this.ships.values()) {
      if (ship.npc !== 'merc' || ship.resaUntil <= this.now || ship.saccheggiato) continue;
      for (const p of this.ships.values()) {
        if (p.npc || p.docked || this.isSunk(p)) continue;
        if (Math.hypot(p.x - ship.x, p.y - ship.y) >= BLOCCO.tocco) continue;
        const bottino = ship.convoglio ? CAROVANE[ship.convoglio.tipo].bottino : RESA.bottino;
        ship.saccheggiato = true;
        ship.resaUntil = this.now + 3; // issa la bandiera e riprende il largo
        ship.resaCooldownUntil = this.now + RESA.cooldown;
        ship.hp = Math.max(ship.hp, this.npcMaxHp(ship) * RESA.hpRitorno);
        p.gold += bottino;
        this.sendGold(p, bottino, `Hai saccheggiato ${ship.name} senza colpo ferire!`);
        this.broadcast({ t: 'feed', msg: `⚓ ${p.name} ha saccheggiato ${ship.name} (+${bottino} 🪙)` });
        if (ship.convoglio) this.annuncia('convoglio', `💰 ${p.name} ha svuotato le stive: ${ship.name} alleggerito!`);
        break;
      }
    }
  }

  inSafeWaters(ship) {
    for (const i of this.archipelago.list()) {
      if (Math.hypot(ship.x - i.x, ship.y - i.y) < i.r + 170) return true;
    }
    return false;
  }

  steerGhost(ship) {
    let target = null, bestD = 520; // caccia più miope di un tempo
    for (const s of this.ships.values()) {
      if (s.npc || s.docked || this.isSunk(s)) continue;
      if (s.graceUntil > this.now) continue;          // tregua
      if (this.inSafeWaters(s)) continue;             // acque franche sotto costa
      if (this.inSmoke(s)) continue;                  // il fumogeno acceca i fantasmi
      const d = Math.hypot(s.x - ship.x, s.y - ship.y);
      if (d < bestD) { target = s; bestD = d; }
    }
    if (ship.fleeUntil > this.now) {
      if (target) this.steerToward(ship, ship.x * 2 - target.x, ship.y * 2 - target.y);
      else this.steerMerc(ship);
      return;
    }
    if (!target) { this.steerMerc(ship); return; }
    if (ship.hp < 50) { ship.fleeUntil = this.now + 8; return; }
    const bearing = Math.atan2(target.y - ship.y, target.x - ship.x);
    if (bestD > 240) {
      this.steerToward(ship, target.x, target.y);
    } else {
      // al traverso: scegli la fiancata più comoda e tienila puntata
      const optionL = bearing - GROUP_DIR.left, optionR = bearing - GROUP_DIR.right;
      const diffL = Math.abs(norm(optionL - ship.rot)), diffR = Math.abs(norm(optionR - ship.rot));
      const heading = diffL < diffR ? optionL : optionR;
      const side = diffL < diffR ? 'left' : 'right';
      let d = norm(heading - ship.rot);
      ship.input.left = d < -0.08; ship.input.right = d > 0.08; ship.input.up = bestD > 150;
      if (Math.abs(d) < 0.45 && bestD < 300 && Math.random() < 0.5) this.fire(ship, side);
    }
  }

  regen(ship, dt) {
    const max = ship.npc ? this.npcMaxHp(ship) : shipStats(ship).maxHp;
    if (ship.hp < max && this.now - ship.lastDamageAt > 10) {
      ship.hp = Math.min(max, ship.hp + 1.2 * dt);
    }
  }

  moveShots(dt) {
    const islands = this.archipelago.list();
    for (const shot of this.shots.values()) {
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.ttl -= dt;
      let gone = false;
      if (!shot.arc) {
        for (const ship of this.ships.values()) {
          if (ship.id === shot.owner || ship.docked || this.isSunk(ship)) continue;
          if (Math.hypot(ship.x - shot.x, ship.y - shot.y) < 24) {
            // la rastrellata: solo colpi diretti fra navi (le torri non
            // manovrano, il mortaio vola sopra e non c'entra: è AoE)
            let dmg = shot.damage;
            if (!String(shot.owner).startsWith('fort:')) {
              let d = Math.atan2(shot.y - ship.y, shot.x - ship.x) - (ship.rot + Math.PI);
              while (d > Math.PI) d -= 2 * Math.PI;
              while (d < -Math.PI) d += 2 * Math.PI;
              if (Math.abs(d) < RASTRELLATA.settore) {
                dmg *= RASTRELLATA.mult;
                this.fxQueue.push({ k: 'rast', x: r1(shot.x), y: r1(shot.y) });
              }
            }
            this.damageShip(ship, dmg, shot.owner, shot);
            this.fxQueue.push({ k: 'hit', x: r1(shot.x), y: r1(shot.y) });
            gone = true; break;
          }
        }
        if (!gone) {
          for (const i of islands) {
            if (i.defs && !String(shot.owner).startsWith('fort:')) {
              for (const def of i.defs) {
                const rr = def.kind === 't' ? 30 : def.kind === 'b' ? 34 : 40;
                if (!def.dead && Math.hypot(def.x - shot.x, def.y - shot.y) < rr) {
                  this.damageDefense(i, def, shot.damage, shot.owner);
                  this.fxQueue.push({ k: 'hit', x: r1(shot.x), y: r1(shot.y) });
                  gone = true; break;
                }
              }
            }
            if (gone) break;
            if (Math.hypot(i.x - shot.x, i.y - shot.y) < i.r - 6) {
              this.fxQueue.push({ k: 'thud', x: r1(shot.x), y: r1(shot.y) });
              gone = true; break;
            }
          }
        }
      }
      if (!gone && shot.ttl <= 0) {
        if (shot.aoe) this.explode(shot, islands);
        else this.fxQueue.push({ k: 'splash', x: r1(shot.x), y: r1(shot.y) });
        gone = true;
      }
      if (gone) this.shots.delete(shot.id);
    }
  }

  explode(shot, islands) {
    this.fxQueue.push({ k: 'boom', x: r1(shot.x), y: r1(shot.y), r: shot.aoe });
    for (const ship of this.ships.values()) {
      if (ship.id === shot.owner || ship.docked || this.isSunk(ship)) continue;
      if (Math.hypot(ship.x - shot.x, ship.y - shot.y) < shot.aoe + 14) {
        this.damageShip(ship, shot.damage, shot.owner);
      }
    }
    if (!String(shot.owner).startsWith('fort:')) {
      for (const i of islands) {
        if (!i.defs) continue;
        for (const def of i.defs) {
          if (!def.dead && Math.hypot(def.x - shot.x, def.y - shot.y) < shot.aoe + 20) {
            this.damageDefense(i, def, shot.damage, shot.owner);
          }
        }
      }
    }
  }

  damageDefense(island, def, dmg, byId) {
    // il registro dell'assalto (#37): chi batte le difese è in squadra quando
    // cadono — il tempo dell'ultimo colpo decide chi era davvero in battaglia
    (island.assalitori = island.assalitori || new Map()).set(byId, this.now);
    def.hp -= dmg;
    def.lastHit = this.now;
    if (def.hp <= 0 && !def.dead) {
      def.dead = true; def.deadAt = this.now;
      this.fxQueue.push({ k: 'towerdown', x: r1(def.x), y: r1(def.y) });
      if (island.defs.every(d => d.dead)) this.fortressFalls(island, byId);
    }
  }

  fortressFalls(island, byId) {
    island.fallenUntil = this.now + FORT.fallDuration;
    const hero = this.ships.get(byId);
    if (island.dungeon) {
      this.dungeonFalls(island, hero); // il dungeon del Mastro (#38) ha regole sue
    } else if (hero && !hero.npc) {
      hero.gold += FORT.conquestBounty;
      hero.conquered.add(island.id);
      hero.kills++;
      this.sendGold(hero, FORT.conquestBounty, `Hai espugnato ${island.name}!`);
      this.sendTo(hero, { t: 'conquered', island: island.id, list: [...hero.conquered] });
      this.annuncia('espugnazione', `🏰⚔️ ${hero.name} ha ESPUGNATO ${island.name}! Il blocco è caduto.`);
      this.avanzaCampagna(hero, 'espugnazione');
    } else {
      this.broadcast({ t: 'feed', msg: `🏰 Le difese di ${island.name} sono cadute!` });
    }
    this.broadcast({ t: 'fortFall', island: island.id });
    island.assalitori = null; // l'assalto è chiuso: il registro si azzera (#37)
  }

  // Un dungeon (#38) su un'isola normale è caduto: premio SPENDIBILE bounded (dal
  // listino, blindato in campagna-core), MAI conquista permanente — l'isola non
  // è bloccata, le difese sono un evento a tempo. Il settimanale lascia che sia
  // la campagna a pagare (c.premio, evita il doppio premio); il giornaliero paga
  // una volta al giorno. Il resto del bottino (lore/trofei) è dell'AI, altrove.
  // In alleanza (#37) la SQUADRA — l'eroe più gli alleati che hanno battuto le
  // difese — si spartisce l'esito: quota code-owned a testa, ognuno gated dal
  // SUO dungeonGiorno; nel settimanale ognuno avanza la SUA campagna.
  dungeonFalls(island, hero) {
    const dg = island.dungeon;
    if (!hero || hero.npc) {
      this.broadcast({ t: 'feed', msg: `⚔ Le difese di ${island.name} sono cadute!` });
      return;
    }
    const squadra = this.alleanze.squadra(hero, island);
    if (dg.tipo === 'settimanale') {
      for (const s of squadra) this.avanzaCampagna(s, 'espugnazione'); // la campagna paga al completamento
      return;
    }
    const quota = quotaAlleanza(dg.premio, squadra.length);
    let pagati = 0;
    for (const s of squadra) {
      if (s.dungeonGiorno === dg.periodo) {
        this.sendTo(s, { t: 'toast', msg: '⚔ Difese abbattute! Il premio del giorno l\'hai già incassato.' });
        continue;
      }
      s.dungeonGiorno = dg.periodo;
      s.gold += quota;
      s.kills++;
      this.sendGold(s, quota, `Dungeon del giorno espugnato: "${dg.nome}"!`);
      this.sendTo(s, { t: 'dungeon', stato: this.dungeonGiornoPer(s) }); // HUD → incassato
      pagati++;
    }
    if (!pagati) return;
    if (squadra.length > 1) {
      const nomi = squadra.map(s => s.name).join(' + ');
      this.annuncia('campagna', `⚔ L'alleanza di ${nomi} ha espugnato il dungeon del giorno "${dg.nome}" su ${island.name}! (+${quota} 🪙 a testa)`);
    } else {
      this.annuncia('campagna', `⚔ ${hero.name} ha espugnato il dungeon del giorno "${dg.nome}" su ${island.name}! (+${dg.premio} 🪙)`);
    }
  }

  tickForts(dt) {
    for (const island of this.archipelago.list()) {
      if (!island.defs) continue;
      // il dungeon del Mastro (#38) scade a fine periodo (orologio VERO, non il
      // tempo di gioco): le difese temporanee svaniscono, l'isola torna approdo
      if (island.dungeon && Date.now() >= island.dungeon.scadenza) {
        const nome = island.name;
        this.archipelago.clearDungeon(island.domain);
        this.broadcast({ t: 'island', island: publicIsland(island) });
        this.broadcast({ t: 'feed', msg: `⚓ La marea si ritira da ${nome}: le difese del Mastro svaniscono.` });
        continue;
      }
      if (island.fallenUntil > this.now) continue;
      if (island.fallenUntil && island.fallenUntil <= this.now) {
        island.fallenUntil = 0;
        for (const def of island.defs) { def.dead = false; def.hp = def.max; }
        island.assalitori = null; // assedio nuovo, registro nuovo (#37)
        this.broadcast({ t: 'feed', msg: `🏰 ${island.name} è stata ricostruita. Il blocco è di nuovo attivo.` });
      }
      const volley = [];
      for (const def of island.defs) {
        if (def.dead) {
          if (!WEAK_FORTS && this.now - def.deadAt > FORT.rebuildAfter) { def.dead = false; def.hp = def.max * FORT.rebuildFrac; }
          continue;
        }
        if (!WEAK_FORTS && this.now - def.lastHit > FORT.regenAfter && def.hp < def.max) {
          def.hp = Math.min(def.max, def.hp + FORT.regen * dt);
        }
        if (WEAK_FORTS) continue; // nei test le difese non sparano
        if (this.now < def.fireAt) continue;
        const spec = def.kind === 't' ? FORT.torre : def.kind === 'b' ? FORT.bombarda : FORT.specchio;
        let target = null, bestD = spec.range;
        for (const ship of this.ships.values()) {
          if (ship.docked || this.isSunk(ship) || ship.conquered.has(island.id)) continue;
          if (this.inSmoke(ship)) continue; // le vedette non sparano nel fumo
          const d = Math.hypot(ship.x - def.x, ship.y - def.y);
          if (d < bestD) { target = ship; bestD = d; }
        }
        if (!target) continue;
        if (def.kind === 's') {
          // lo Specchio Ustorio: raggio istantaneo, brucia a cadenza fissa
          def.fireAt = this.now + spec.tick;
          this.damageShip(target, spec.dmg, 'fort:' + island.id);
          this.fxQueue.push({ k: 'beam', x: r1(def.x), y: r1(def.y), x2: r1(target.x), y2: r1(target.y) });
          continue;
        }
        def.fireAt = this.now + spec.reload;
        const speed = def.kind === 'b' ? spec.speed : 430;
        const t = bestD / speed;
        const ax = target.x + Math.cos(target.rot) * target.vel * t;
        const ay = target.y + Math.sin(target.rot) * target.vel * t;
        const dir = Math.atan2(ay - def.y, ax - def.x);
        const st = def.kind === 'b'
          ? { dmg: spec.dmg, range: Math.min(spec.range, Math.hypot(ax - def.x, ay - def.y) + 30), speed, aoe: spec.aoe, arc: true, burst: 1 }
          : { dmg: spec.dmg, range: spec.range + 40, speed, aoe: 0, arc: false, burst: 1 };
        volley.push(this.spawnShot('fort:' + island.id, def.x, def.y, dir, st));
      }
      if (volley.length) this.broadcast({ t: 'shots', from: 'fort', shots: volley });
    }
  }

  damageShip(ship, dmg, byId, shot) {
    if (ship.graceUntil > this.now) return; // tregua: il colpo scivola in mare
    if (ship.immuneUntil > this.now) return; // appena svincolato: intoccabile
    if (ship.blockedUntil > this.now) return; // già vinta: si abborda, non si bombarda
    ship.hp -= dmg;
    ship.lastHitBy = byId;
    ship.lastDamageAt = this.now;
    // i debuff delle munizioni (issue #41, fetta 2): temporanei e si
    // RINFRESCANO senza sommarsi — mai oltre il malus dichiarato nel catalogo
    if (shot && shot.mun === 'catene') ship.veleTagliateUntil = this.now + W.MUNIZIONI.catene.taglia.durata;
    if (shot && shot.mun === 'mitraglia') ship.falcidiaUntil = this.now + W.MUNIZIONI.mitraglia.falcidia.durata;
    // la carovana fa quadrato (issue #41, fette 3-4): tocchi uno, rispondono le scorte
    const carovana = ship.convoglio && this.carovane[ship.convoglio.tipo];
    if (carovana && typeof byId === 'string' && !byId.startsWith('fort:')) {
      const attaccante = this.ships.get(byId);
      if (attaccante && !attaccante.npc) carovana.minaccia = { id: byId, fino: this.now + MINACCIA_TTL };
    }
    // la resa dei mercantili (issue #41, fetta 3): sotto la soglia ammainano.
    // Si può ancora affondarli (la missione è missione): la resa è un'OFFERTA
    if (ship.npc === 'merc' && ship.hp > 0 && ship.resaUntil <= this.now &&
        this.now >= ship.resaCooldownUntil && ship.hp <= this.npcMaxHp(ship) * RESA.soglia) {
      ship.resaUntil = this.now + RESA.durata;
      ship.saccheggiato = false;
      this.broadcast({ t: 'feed', msg: `🏳 ${ship.name} ammaina bandiera: chi lo tocca lo saccheggia!` });
    }
    if (ship.hp <= 0) {
      // fra capitani il colpo di grazia BLOCCA (issue #15); NPC e fortezze
      // affondano come sempre
      const killer = this.ships.get(byId);
      if (!ship.npc && killer && !killer.npc) this.blocca(ship, killer);
      else this.sink(ship, byId);
    }
  }

  // Il blocco: lo scontro navale è vinto QUI — kill, missioni e diario si
  // registrano subito; l'arrembaggio è solo il bottino che manca.
  blocca(vittima, predatore) {
    vittima.hp = 0;
    vittima.vel = 0;
    vittima.input = { up: false, down: false, left: false, right: false };
    vittima.blockedUntil = this.now + BLOCCO.durata;
    vittima.blockedBy = predatore.id;
    vittima.deaths++;
    vittima.bloccoSalvo = Math.round(vittima.gold * 0.10 * vittima.holdLvl);
    const inGioco = vittima.gold - vittima.bloccoSalvo;
    const subito = Math.round(inGioco * BLOCCO.quotaSubito);
    vittima.bloccoPerso = subito; // il conto della morte lo racconterà (#23)
    vittima.gold -= subito;
    predatore.gold += subito;
    predatore.kills++;
    this.fxQueue.push({ k: 'boom', x: r1(vittima.x), y: r1(vittima.y), r: 30 });
    this.sendGold(vittima, -subito, 'Bloccato! Un quarto del forziere in gioco è del vincitore');
    this.sendGold(predatore, subito, `Hai bloccato ${vittima.name}: toccala per l'arrembaggio!`);
    this.missions.onKill(predatore, vittima);
    this.valutaTaglia(predatore); // l'infamia si conta anche ai blocchi (fetta 4)
    this.broadcast({ t: 'kill', killer: predatore.name, victim: vittima.name, bounty: subito });
    // il rito d'ingresso (issue #5): bloccare una nave di gilda conquista il
    // diritto di chiedere l'ingresso; il fuoco fra compagni finisce nel log
    if (vittima.gilda) {
      const g = gilde.get(vittima.gilda.id);
      if (predatore.gilda && predatore.gilda.id === vittima.gilda.id) {
        if (g) {
          gilde.annota(g, `⚡ ${predatore.name} ha bloccato il compagno ${vittima.name}: la legge del mare non guarda in faccia`);
          this.salvaGilda(g);
        }
      } else if (predatore.uid) {
        predatore.sfide = predatore.sfide || {};
        predatore.sfide[vittima.gilda.id] = Date.now() + gilde.SFIDA_GIORNI * 86400e3;
        this.sendTo(predatore, {
          t: 'toast',
          msg: `🏴 Rito compiuto: puoi chiedere l'ingresso a «${vittima.gilda.nome}» per ${gilde.SFIDA_GIORNI} giorni`,
        });
        if (g) { gilde.annota(g, `⚔ ${predatore.name} ha bloccato ${vittima.name}: ha conquistato il diritto di chiedere l'ingresso`); this.salvaGilda(g); }
      }
    }
  }

  // Il tocco entro il tempo: il predatore prende tutto il forziere in gioco;
  // alla vittima resta il doppiofondo, e la nave affonda (conto già saldato).
  abborda(vittima) {
    const predatore = this.ships.get(vittima.blockedBy);
    const resto = Math.max(0, vittima.gold - vittima.bloccoSalvo);
    if (resto > 0) {
      vittima.gold = vittima.bloccoSalvo;
      if (predatore) {
        predatore.gold += resto;
        this.sendGold(predatore, resto, `Arrembaggio! Il forziere di ${vittima.name} è tuo`);
      }
      this.sendGold(vittima, -resto, vittima.bloccoSalvo > 0
        ? 'Abbordato! Il doppiofondo ha salvato qualcosa' : 'Abbordato! Il forziere è del vincitore');
    }
    this.annuncia('arrembaggio', `⚔ ${predatore ? predatore.name : 'Il mare'} ha ABBORDATO ${vittima.name}!${resto ? ` (+${resto} 🪙)` : ''}`);
    vittima.blockedUntil = 0;
    vittima.blockedBy = null;
    vittima.sunkUntil = this.now + RESPAWN_S;
    this.fxQueue.push({ k: 'sink', x: r1(vittima.x), y: r1(vittima.y) });
    // la morte racconta (issue #23, campi ADDITIVI): chi, quanto, quanto salvo
    this.sendTo(vittima, {
      t: 'dead', respawn: RESPAWN_S,
      da: predatore ? predatore.name : 'Il mare',
      perso: (vittima.bloccoPerso || 0) + resto,
      salvo: vittima.bloccoSalvo || 0,
    });
  }

  // Il timeout: nessuno ha osato — la vittima si svincola col 75% del forziere
  // in gioco (mai toccato dopo il blocco), mezza vita e l'immunità per rientrare.
  libera(vittima) {
    vittima.blockedUntil = 0;
    vittima.blockedBy = null;
    vittima.hp = Math.round(shipStats(vittima).maxHp * BLOCCO.hpRitorno);
    vittima.immuneUntil = this.now + BLOCCO.immunita;
    this.sendTo(vittima, { t: 'toast', msg: `⛵ Nessuno ha osato abbordarti: sei libero, con ${BLOCCO.immunita}s di immunità` });
    this.broadcast({ t: 'feed', msg: `⛵ ${vittima.name} si è svincolato dal blocco` });
  }

  sink(ship, byId) {
    ship.deaths++;
    ship.hp = 0;
    ship.vel = 0;
    ship.sunkUntil = this.now + RESPAWN_S;
    this.fxQueue.push({ k: 'sink', x: r1(ship.x), y: r1(ship.y) });
    const killer = this.ships.get(byId);
    let killerName = 'Il Mare';
    if (typeof byId === 'string' && byId.startsWith('fort:')) {
      const island = this.archipelago.get(byId.slice(5));
      killerName = island ? island.name : 'La Fortezza';
    }
    let bounty = 0;
    if (killer && !killer.npc) {
      killerName = killer.name;
      if (ship.npc) {
        // le prede PvE pagano poco e FISSO: l'oro vero naviga sotto bandiera
        // altrui — ma la testa di un Cacciatore di Taglie vale il suo prezzo
        bounty = ship.caccia ? CACCIA.bounty : (PVE_BOUNTY[ship.npc] || 0);
      } else {
        // legge del mare: chi affonda un capitano si prende il forziere —
        // meno quel che la Stiva nasconde nel doppiofondo (10% a punto)
        const salvo = Math.round(ship.gold * 0.10 * ship.holdLvl);
        bounty = ship.gold - salvo;
        ship.gold = salvo;
        this.sendGold(ship, -bounty, salvo > 0 ? 'Il doppiofondo della stiva ha salvato qualcosa' : 'Il forziere è del vincitore');
      }
      killer.gold += bounty;
      killer.kills++;
      this.sendGold(killer, bounty, `Hai affondato ${ship.name}!`);
      this.missions.onKill(killer, ship);
      if (ship.npc) this.avanzaCampagna(killer, ship.npc === 'ghost' ? 'fantasmi' : 'mercantili');
      this.valutaTaglia(killer); // l'infamia cresce a ogni preda (fetta 4)
    } else if (killer && killer.npc === 'ghost') {
      killerName = killer.name;
    }
    // il Cacciatore affondato chiude il mandato: il conto del braccato
    // riparte da zero — s'è comprato la pace a cannonate (fetta 4)
    if (ship.caccia) {
      const preda = this.ships.get(ship.caccia.bersaglio);
      if (preda) preda.tagliaCacciata = preda.kills;
      this.cacciatori = Math.max(0, this.cacciatori - 1);
    }
    this.broadcast({ t: 'kill', killer: killerName, victim: ship.name, bounty });
    // per mano di NPC o fortezze il forziere resta a bordo: si racconta anche
    // questo — il sollievo è metà del racconto (issue #23)
    if (!ship.npc) {
      this.sendTo(ship, {
        t: 'dead', respawn: RESPAWN_S, da: killerName,
        perso: bounty && !ship.npc && killer && !killer.npc ? bounty : 0,
        salvo: ship.gold,
      });
    }
  }

  respawn(ship) {
    // membri delle carovane e Cacciatori non rinascono (issue #41, fette
    // 3-4): il relitto ha fatto la sua scena, il mare se lo riprende
    if (ship.npc && (ship.convoglio || ship.caccia)) { this.ships.delete(ship.id); return; }
    ship.sunkUntil = 0;
    ship.lastHitBy = null;
    ship.blockedUntil = 0; ship.blockedBy = null; ship.bloccoSalvo = 0; ship.bloccoPerso = 0; ship.immuneUntil = 0;
    if (ship.npc) {
      ship.x = 400 + Math.random() * (WORLD.W - 800);
      ship.y = 400 + Math.random() * (WORLD.H - 800);
      ship.hp = this.npcMaxHp(ship);
      ship.wp = null; ship.fleeUntil = 0;
    } else {
      const p = this.spawnPoint();
      ship.x = p.x; ship.y = p.y;
      ship.hp = shipStats(ship).maxHp;
      ship.graceUntil = this.now + 8; // niente agguati sul respawn
      this.sendTo(ship, { t: 'respawned' });
    }
  }

  // --- uscita verso i client ---

  sendSnapshot() {
    const ships = [];
    for (const s of this.ships.values()) {
      const scia = livree.sciaDi(s);
      // l'abilità in corso (#41 fetta 2-bis): la minaccia si legge — il tipo
      // (tp) dice QUALE abilità, ab dice per quanti secondi ancora
      const abUntil = Math.max(s.ramUntil || 0, s.doubleUntil || 0, s.ventoUntil || 0);
      ships.push({
        id: s.id, name: s.name, x: r1(s.x), y: r1(s.y), rot: r2(s.rot),
        vel: r1(s.vel), hp: Math.ceil(s.hp),
        maxHp: s.npc ? this.npcMaxHp(s) : shipStats(s).maxHp,
        docked: s.docked, sunk: this.isSunk(s),
        k: s.npc === 'merc' ? 'm' : s.npc === 'ghost' ? 'g' : 'p',
        sl: s.npc ? 0 : s.sailsLvl,
        tp: TIPO_SNAP[s.tipo] || 0, // il tipo vestito dal varo (0 = nessuno)
        gp: [s.mounts.left.length, s.mounts.right.length, s.mounts.bow.length, s.mounts.stern.length],
        // armi in chiaro (iniziale+livello per slot): il client disegna i
        // cannoni VERI, non pallini — "n" = cannone, "r" = carronata
        gw: [encW(s.mounts.left), encW(s.mounts.right), encW(s.mounts.bow), encW(s.mounts.stern)],
        // il blocco (issue #15), campi ADDITIVI: bk = secondi al timeout,
        // bb = chi ha diritto d'abbordaggio, im = 1 se immune post-svincolo
        ...(s.blockedUntil > this.now
          ? { bk: Math.ceil(s.blockedUntil - this.now), bb: s.blockedBy } : {}),
        ...(s.immuneUntil > this.now ? { im: 1 } : {}),
        // i debuff delle munizioni (#41, fetta 2): secondi restanti, additivi
        ...(s.veleTagliateUntil > this.now ? { vt: r2(s.veleTagliateUntil - this.now) } : {}),
        ...(s.falcidiaUntil > this.now ? { cf: r2(s.falcidiaUntil - this.now) } : {}),
        ...(abUntil > this.now ? { ab: r2(abUntil - this.now) } : {}),
        // la resa (#41 fetta 3): bandiera bianca coi secondi restanti
        ...(s.resaUntil > this.now ? { rs: r2(s.resaUntil - this.now) } : {}),
        ...(s.gilda ? { gt: s.gilda.tag } : {}), // la bandierina della gilda
        // il guardaroba in mare (issue #25), campi ADDITIVI: lv = livrea,
        // ve = vele tinte, sc = colore scia, bf = bandiera personale (la gilda vince)
        ...(s.livrea ? { lv: s.livrea } : {}),
        ...(s.vele ? { ve: s.vele } : {}),
        ...(scia !== null ? { sc: scia } : {}),
        ...(s.bandiera && !s.gilda
          ? { bf: [s.bandiera.fondo, s.bandiera.taglio, s.bandiera.tinta2, s.bandiera.emblema, s.bandiera.tintaEmblema] } : {}),
      });
    }
    const forts = [];
    for (const i of this.archipelago.list()) {
      if (i.defs) {
        forts.push({
          i: i.id,
          fallen: i.fallenUntil > this.now ? Math.round(i.fallenUntil - this.now) : 0,
          d: i.defs.map(d => [d.kind, r1(d.x), r1(d.y), Math.ceil(d.hp), d.max, d.dead ? 1 : 0]),
        });
      }
    }
    const snap = { t: 'snap', ts: Date.now(), ships, forts };
    // campo additivo: il vento del mare (issue #41) — [verso in cui soffia, forza]
    snap.vn = [r2(this.vento.dir), r2(this.vento.forza)];
    // campo additivo: i fumogeni attivi (x, y, raggio, secondi restanti)
    if (this.smokes.length) snap.sm = this.smokes.map(s => [r1(s.x), r1(s.y), s.r, r2(s.until - this.now)]);
    this.broadcast(snap);
  }

  sendBoard() {
    const rows = [...this.ships.values()]
      .filter(s => !s.npc)
      .sort((a, b) => b.kills - a.kills || b.gold - a.gold)
      .slice(0, 10)
      .map(s => ({ name: s.name, kills: s.kills, deaths: s.deaths, gold: s.gold }));
    if (rows.length) this.broadcast({ t: 'board', rows });
  }
}

function norm(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// C'è un Organo di Da Vinci in un profilo GREZZO (non ancora sanificato)?
function hasOrgano(m) {
  return !!m && typeof m === 'object' &&
    Object.values(m).some(list => Array.isArray(list) && list.some(w => w && w.type === 'organo'));
}

function r1(n) { return Math.round(n * 10) / 10; }
function r2(n) { return Math.round(n * 100) / 100; }

function encW(mounts) {
  let out = '';
  for (const m of mounts) out += (m.type === 'cannone' ? 'n' : m.type === 'carronata' ? 'r' : m.type[0]) + m.lvl;
  return out;
}

module.exports = { Game, shipStats, shipLvlCost };
