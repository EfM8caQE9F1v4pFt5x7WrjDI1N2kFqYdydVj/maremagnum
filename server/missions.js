'use strict';

// Missioni personali (esplorazione/caccia) e l'Assedio: il "dungeon" PvP in cui
// i Corridori devono attraccare a un'isola bersaglio e i Bloccatori impedirlo.

const ASSEDIO = {
  lobbyMin: { corridori: 1, bloccatori: 1 },
  countdown: 30,
  duration: 240,
  rewardWin: 400,
  rewardLose: 100,
  targets: ['wikipedia.org', 'archive.org', 'openstreetmap.org', 'gutenberg.org', 'wiktionary.org'],
};

const TEMPLATES = [
  () => {
    const tld = ['org', 'edu', 'gov', 'net', 'it'][(Math.random() * 5) | 0];
    return { key: 'tld', tld, desc: `Attracca a un'isola .${tld}`, n: 1, reward: 120 };
  },
  () => {
    const n = 2 + ((Math.random() * 2) | 0);
    return { key: 'discover', desc: `Scopri ${n} isole mai visitate`, n, reward: n * 75 };
  },
  () => ({ key: 'merc', desc: 'Affonda 2 mercantili', n: 2, reward: 140 }),
  () => ({ key: 'ghost', desc: 'Affonda un Corsaro Fantasma', n: 1, reward: 250 }),
];

const MAX_ATTIVE = 3;   // rotte in corso insieme
const BACHECA_N = 3;    // offerte sempre pronte sulla bacheca del Diario

class Missions {
  constructor(game) {
    this.game = game;
    this.assedio = null; // {phase, targetId, corridori:Set, bloccatori:Set, tPhase}
    this._id = 0;        // contatore per gli id stabili delle missioni
  }

  // --- la Bacheca del Diario (issue #39): offerte da accettare, attive in corso ---

  // una nuova offerta con id stabile; evita di ripetere le key già in mano
  nuovaOfferta(escludiKeys = []) {
    let tpl, tent = 0;
    do { tpl = TEMPLATES[(Math.random() * TEMPLATES.length) | 0](); tent++; }
    while (escludiKeys.includes(tpl.key) && tent < 8);
    return { id: 'm' + (++this._id), ...tpl, progress: 0 };
  }

  // rifornisce la bacheca fino a BACHECA_N, senza doppioni di tipo con le attive
  rifornisci(ship) {
    ship.bacheca = ship.bacheca || [];
    ship.missioni = ship.missioni || [];
    let guardia = 0;
    while (ship.bacheca.length < BACHECA_N && guardia++ < 20) {
      const usate = [...ship.bacheca, ...ship.missioni].map(m => m.key);
      ship.bacheca.push(this.nuovaOfferta(usate));
    }
  }

  // ripristina le missioni ATTIVE dal profilo (id nuovi, valori sanificati) e
  // riempie la bacheca fresca; poi manda tutto al Diario
  ripristina(ship, salvate) {
    ship.missioni = [];
    if (Array.isArray(salvate)) {
      for (const m of salvate.slice(0, MAX_ATTIVE)) {
        if (!m || typeof m.key !== 'string' || typeof m.desc !== 'string') continue;
        const n = Math.max(1, m.n | 0);
        ship.missioni.push({
          id: 'm' + (++this._id), key: m.key, tld: m.tld,
          desc: String(m.desc).slice(0, 80), n, reward: Math.max(0, m.reward | 0),
          progress: Math.max(0, Math.min(n, m.progress | 0)),
        });
      }
    }
    ship.bacheca = [];
    this.rifornisci(ship);
    this.sendBacheca(ship);
  }

  sendBacheca(ship) {
    if (ship.npc) return;
    const pubblica = (m) => ({ id: m.id, desc: m.desc, n: m.n, reward: m.reward, progress: m.progress || 0 });
    this.game.sendTo(ship, {
      t: 'bacheca',
      disponibili: (ship.bacheca || []).map(pubblica),
      attive: (ship.missioni || []).map(pubblica),
    });
  }

  accetta(ship, id) {
    if (ship.npc) return;
    ship.missioni = ship.missioni || [];
    ship.bacheca = ship.bacheca || [];
    if (ship.missioni.length >= MAX_ATTIVE) {
      this.game.sendTo(ship, { t: 'toast', msg: 'Hai già tre rotte in corso: compine o abbandonane una prima.' });
      return;
    }
    const i = ship.bacheca.findIndex(m => m.id === id);
    if (i < 0) return;
    const [m] = ship.bacheca.splice(i, 1);
    m.progress = 0;
    ship.missioni.push(m);
    this.rifornisci(ship);
    this.sendBacheca(ship);
  }

  rifiuta(ship, id) {
    if (ship.npc) return;
    ship.bacheca = ship.bacheca || [];
    const i = ship.bacheca.findIndex(m => m.id === id);
    if (i < 0) return;
    ship.bacheca.splice(i, 1);
    this.rifornisci(ship);
    this.sendBacheca(ship);
  }

  abbandona(ship, id) {
    if (ship.npc || !ship.missioni) return;
    const i = ship.missioni.findIndex(m => m.id === id);
    if (i < 0) return;
    ship.missioni.splice(i, 1);
    this.sendBacheca(ship);
  }

  // avanza TUTTE le missioni attive che combaciano con l'evento (predicato); paga
  // e toglie quelle compiute, poi rinfresca la bacheca del Diario
  avanza(ship, predicato) {
    if (ship.npc || !ship.missioni || !ship.missioni.length) return;
    let mutata = false;
    const compiute = [];
    for (const m of ship.missioni) {
      if (m.progress >= m.n || !predicato(m)) continue;
      m.progress = Math.min(m.n, (m.progress || 0) + 1);
      mutata = true;
      if (m.progress >= m.n) compiute.push(m);
    }
    for (const m of compiute) {
      ship.gold += m.reward;
      this.game.sendGold(ship, m.reward, `Missione compiuta: ${m.desc}`);
      this.game.broadcast({ t: 'feed', msg: `📜 ${ship.name} ha compiuto una missione (${m.reward} 🪙)` });
      ship.missioni.splice(ship.missioni.indexOf(m), 1);
    }
    if (mutata) this.sendBacheca(ship);
  }

  onDock(ship, island, firstVisit) {
    this.avanza(ship, (m) =>
      (m.key === 'tld' && island.domain && island.domain.endsWith('.' + m.tld)) ||
      (m.key === 'discover' && firstVisit));
    this.assedioOnDock(ship, island);
  }

  onKill(killer, victim) {
    this.avanza(killer, (m) =>
      (m.key === 'merc' && victim.npc === 'merc') ||
      (m.key === 'ghost' && victim.npc === 'ghost'));
  }

  // --- assedio ---

  assedioJoin(ship, role) {
    if (ship.npc) return;
    if (role !== 'corridori' && role !== 'bloccatori') return;
    if (!this.assedio) {
      const targetId = this.pickTarget();
      if (!targetId) { this.game.sendTo(ship, { t: 'toast', msg: 'Nessun bersaglio disponibile per un assedio.' }); return; }
      this.assedio = {
        phase: 'lobby', targetId,
        corridori: new Set(), bloccatori: new Set(),
        tPhase: 0,
      };
      this.game.broadcast({ t: 'feed', msg: `⚔️ ${ship.name} ha bandito un Assedio! Presentarsi alla Bacheca del Porto.` });
    }
    const a = this.assedio;
    if (a.phase === 'running') { this.game.sendTo(ship, { t: 'toast', msg: "L'assedio è già in corso." }); return; }
    a.corridori.delete(ship.id);
    a.bloccatori.delete(ship.id);
    a[role].add(ship.id);
    this.broadcastState();
  }

  pickTarget() {
    // un'isola-sito esistente non fortificata, o una dal registro delle rotte famose
    const sites = this.game.archipelago.list().filter(i => i.kind === 'site' && !i.fortress);
    if (sites.length && Math.random() < 0.5) return sites[(Math.random() * sites.length) | 0].id;
    const domain = ASSEDIO.targets[(Math.random() * ASSEDIO.targets.length) | 0];
    const { island, isNew } = this.game.archipelago.ensure(domain);
    if (isNew) this.game.broadcastIsland(island);
    return island.id;
  }

  leave(ship) {
    const a = this.assedio;
    if (!a) return;
    a.corridori.delete(ship.id);
    a.bloccatori.delete(ship.id);
    if (a.phase !== 'lobby' && a.corridori.size === 0) this.finish('bloccatori', 'i Corridori hanno abbandonato');
    else if (a.phase !== 'lobby' && a.bloccatori.size === 0) this.finish('corridori', 'i Bloccatori hanno abbandonato');
    else this.broadcastState();
  }

  assedioOnDock(ship, island) {
    const a = this.assedio;
    if (a && a.phase === 'running' && island.id === a.targetId && a.corridori.has(ship.id)) {
      this.finish('corridori', `${ship.name} ha attraccato al bersaglio`);
    }
  }

  tick(now) {
    const a = this.assedio;
    if (!a) return;
    if (a.phase === 'lobby') {
      if (a.corridori.size >= ASSEDIO.lobbyMin.corridori && a.bloccatori.size >= ASSEDIO.lobbyMin.bloccatori) {
        a.phase = 'countdown';
        a.tPhase = now + ASSEDIO.countdown;
        const target = this.game.archipelago.get(a.targetId);
        this.game.broadcast({ t: 'feed', msg: `⚔️ Assedio a ${target.name}: si salpa tra ${ASSEDIO.countdown}s!` });
        this.broadcastState();
      }
    } else if (a.phase === 'countdown' && now >= a.tPhase) {
      a.phase = 'running';
      a.tPhase = now + ASSEDIO.duration;
      this.game.broadcast({ t: 'feed', msg: '⚔️ L\'Assedio è cominciato!' });
      this.broadcastState();
    } else if (a.phase === 'running' && now >= a.tPhase) {
      this.finish('bloccatori', 'il tempo è scaduto');
    }
  }

  finish(winnerRole, reason) {
    const a = this.assedio;
    if (!a) return;
    const target = this.game.archipelago.get(a.targetId);
    const winners = [...a[winnerRole]];
    const losers = [...a[winnerRole === 'corridori' ? 'bloccatori' : 'corridori']];
    for (const id of winners) {
      const s = this.game.ships.get(id);
      if (s) { s.gold += ASSEDIO.rewardWin; this.game.sendGold(s, ASSEDIO.rewardWin, 'Assedio vinto!'); }
    }
    for (const id of losers) {
      const s = this.game.ships.get(id);
      if (s) { s.gold += ASSEDIO.rewardLose; this.game.sendGold(s, ASSEDIO.rewardLose, 'Assedio perso, ma con onore'); }
    }
    const label = winnerRole === 'corridori' ? 'i Corridori' : 'i Bloccatori';
    this.game.broadcast({ t: 'feed', msg: `⚔️ Assedio a ${target ? target.name : '?'}: vincono ${label} (${reason})` });
    this.assedio = null;
    this.broadcastState();
  }

  broadcastState() {
    const a = this.assedio;
    if (!a) { this.game.broadcast({ t: 'assedio', phase: null }); return; }
    const target = this.game.archipelago.get(a.targetId);
    const names = (set) => [...set].map(id => { const s = this.game.ships.get(id); return s ? s.name : '?'; });
    this.game.broadcast({
      t: 'assedio', phase: a.phase,
      target: target ? { id: target.id, name: target.name } : null,
      corridori: names(a.corridori), bloccatori: names(a.bloccatori),
      timeLeft: a.tPhase ? Math.max(0, Math.round(a.tPhase - this.game.now)) : null,
    });
  }
}

module.exports = { Missions, ASSEDIO, MAX_ATTIVE, BACHECA_N };
