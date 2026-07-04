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

class Missions {
  constructor(game) {
    this.game = game;
    this.assedio = null; // {phase, targetId, corridori:Set, bloccatori:Set, tPhase}
  }

  // --- missioni personali ---

  assign(ship) {
    let tpl;
    do { tpl = TEMPLATES[(Math.random() * TEMPLATES.length) | 0](); }
    while (ship.mission && tpl.key === ship.mission.key && TEMPLATES.length > 1);
    ship.mission = { ...tpl, progress: 0 };
    this.sendMission(ship);
  }

  sendMission(ship) {
    if (ship.npc || !ship.mission) return;
    const m = ship.mission;
    this.game.sendTo(ship, { t: 'mission', desc: m.desc, progress: m.progress, n: m.n, reward: m.reward });
  }

  progress(ship, amount = 1) {
    const m = ship.mission;
    if (!m) return;
    m.progress = Math.min(m.n, m.progress + amount);
    if (m.progress >= m.n) {
      ship.gold += m.reward;
      this.game.sendGold(ship, m.reward, `Missione compiuta: ${m.desc}`);
      this.game.broadcast({ t: 'feed', msg: `📜 ${ship.name} ha compiuto una missione (${m.reward} 🪙)` });
      this.assign(ship);
    } else {
      this.sendMission(ship);
    }
  }

  onDock(ship, island, firstVisit) {
    const m = ship.mission;
    if (m) {
      if (m.key === 'tld' && island.domain && island.domain.endsWith('.' + m.tld)) this.progress(ship);
      else if (m.key === 'discover' && firstVisit) this.progress(ship);
    }
    this.assedioOnDock(ship, island);
  }

  onKill(killer, victim) {
    const m = killer.mission;
    if (!m) return;
    if (m.key === 'merc' && victim.npc === 'merc') this.progress(killer);
    else if (m.key === 'ghost' && victim.npc === 'ghost') this.progress(killer);
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

module.exports = { Missions, ASSEDIO };
