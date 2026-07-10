'use strict';

// Le TRE DEL GIORNO (missioni giornaliere) e l'Assedio: il "dungeon" PvP in cui
// i Corridori devono attraccare a un'isola bersaglio e i Bloccatori impedirlo.
//
// Niente più bacheca da accettare (il rifornimento infinito era oro infinito):
// le giornaliere sono AUTO-ATTIVE, uguali per tutti (seme = giorno, stesso
// calendario dei dungeon del Mastro #38), fattibili UNA volta, e si rinnovano
// a mezzanotte UTC. Chi le compie tutte e tre incassa il tris; i tris in giorni
// consecutivi allungano lo strike; il tris per tutti i 7 giorni della settimana
// paga il premio settimanale. È il motivo per loggarsi ogni giorno.

const campagna = require('./campagna-core');

const ASSEDIO = {
  lobbyMin: { corridori: 1, bloccatori: 1 },
  countdown: 30,
  duration: 240,
  rewardWin: 400,
  rewardLose: 100,
  targets: ['wikipedia.org', 'archive.org', 'openstreetmap.org', 'gutenberg.org', 'wiktionary.org'],
};

// Economia FISSA e code-owned (paletto #38: mai cifre da fuori, mai premi
// ripetibili all'infinito). Il tris di un giorno vale al massimo
// missione×3 + tris + strike pieno = 300 + 150 + 175: sotto il dungeon "medio".
const PREMI = {
  missione: 100,   // ogni giornaliera compiuta
  tris: 150,       // tutte e tre nello stesso giorno
  strike: 25,      // × giorni di tris consecutivi…
  strikeCap: 7,    // …fino al 7°: +175
  settimana: 1000, // tris tutti i 7 giorni della settimana
};
const GIORNALIERE_N = 3;

// I mestieri possibili: il rng arriva dal seme del giorno, così le tre di oggi
// sono le stesse per ogni capitano (e il reconnect non le rimescola).
const TEMPLATES = [
  (rng) => {
    const tld = ['org', 'edu', 'gov', 'net', 'it'][(rng() * 5) | 0];
    return { key: 'tld', tld, desc: `Attracca a un'isola .${tld}`, n: 1 };
  },
  (rng) => {
    const n = 2 + ((rng() * 2) | 0);
    return { key: 'discover', desc: `Scopri ${n} isole mai visitate`, n };
  },
  () => ({ key: 'merc', desc: 'Affonda 2 mercantili', n: 2 }),
  () => ({ key: 'ghost', desc: 'Affonda un Corsaro Fantasma', n: 1 }),
];

class Missions {
  constructor(game) {
    this.game = game;
    this.assedio = null; // {phase, targetId, corridori:Set, bloccatori:Set, tPhase}
    this._giorno = this.oggi(); // sentinella del giro di mezzanotte (tick)
  }

  // il giorno corrente del calendario (#38, UTC) — stubbabile nei test
  oggi() { return campagna.giornoDi(); }

  // --- le tre del giorno ---

  // genera le giornaliere di un giorno: 3 mestieri DISTINTI pescati col seme
  genera(giorno) {
    const rng = campagna.mulberry32(campagna.hashStr('giornaliere-' + giorno));
    const idx = TEMPLATES.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, GIORNALIERE_N).map((t, i) => ({
      id: `g${giorno}-${i}`, ...TEMPLATES[t](rng),
      reward: PREMI.missione, progress: 0, fatta: false,
    }));
  }

  // la nave ha le giornaliere del giorno CORRENTE? Se no, gliele rinnova.
  assicura(ship) {
    const oggi = this.oggi();
    if (ship.giornaliere && ship.missioniGiorno === oggi) return false;
    ship.missioniGiorno = oggi;
    ship.giornaliere = this.genera(oggi);
    return true;
  }

  // ripristina lo stato dal profilo (mai fidarsi: le missioni sono quelle del
  // seme, dal profilo tornano solo progressi e contatori, sagomati e clampati)
  ripristina(ship, p) {
    const oggi = this.oggi();
    ship.missioniGiorno = -1;
    this.assicura(ship);
    const g = p && p.giornaliere;
    if (g && (g.giorno | 0) === oggi) {
      ship.giornaliere.forEach((m, i) => {
        m.progress = Math.max(0, Math.min(m.n, (Array.isArray(g.progressi) ? g.progressi[i] : 0) | 0));
        m.fatta = Array.isArray(g.fatte) && !!g.fatte[i];
        if (m.fatta) m.progress = m.n;
      });
    }
    const s = (p && p.strike) || {};
    ship.strike = { giorno: Math.min(oggi, s.giorno | 0), n: Math.max(0, Math.min(9999, s.n | 0)) };
    if (ship.strike.giorno < oggi - 1) ship.strike.n = 0; // catena spezzata: ieri niente tris
    // la settimana piena: mai più giorni pieni di quanti ne sono passati
    const sett = Math.floor(oggi / 7);
    const w = (p && p.settimana) || {};
    const maxPieni = (oggi % 7) + (ship.strike.giorno === oggi ? 1 : 0);
    ship.settimana = (w.periodo | 0) === sett
      ? { periodo: sett, pieni: Math.max(0, Math.min(maxPieni, w.pieni | 0)) }
      : { periodo: sett, pieni: 0 };
    this.sendBacheca(ship);
  }

  // lo stato per il Diario: le tre di oggi, tris, strike, settimana, scadenza
  statoPer(ship) {
    const strike = ship.strike || { giorno: 0, n: 0 };
    const settimana = ship.settimana || { periodo: 0, pieni: 0 };
    return {
      giornaliere: (ship.giornaliere || []).map(m => ({
        id: m.id, desc: m.desc, n: m.n, reward: m.reward,
        progress: m.progress || 0, fatta: !!m.fatta,
      })),
      tris: { fatto: !!(ship.giornaliere || []).length && ship.giornaliere.every(m => m.fatta), premio: PREMI.tris },
      strike: { n: strike.n, bonus: PREMI.strike, cap: PREMI.strikeCap },
      settimana: { pieni: settimana.pieni, premio: PREMI.settimana },
      scadenza: campagna.scadenzaDi('giornaliero', ship.missioniGiorno | 0),
    };
  }

  sendBacheca(ship) {
    if (ship.npc) return;
    this.game.sendTo(ship, { t: 'bacheca', ...this.statoPer(ship) });
  }

  // compat coi client vecchi (#39): le rotte del giorno si accettano da sole
  accetta(ship) { this._nonSiAccetta(ship); }
  rifiuta(ship) { this._nonSiAccetta(ship); }
  abbandona(ship) { this._nonSiAccetta(ship); }
  _nonSiAccetta(ship) {
    if (ship.npc) return;
    this.game.sendTo(ship, { t: 'toast', msg: 'Le rotte del giorno si accettano da sole: si rinnovano a mezzanotte.' });
    this.sendBacheca(ship);
  }

  // avanza le giornaliere che combaciano con l'evento (predicato): ognuna paga
  // UNA volta; col tris scattano bonus, strike e conto della settimana
  avanza(ship, predicato) {
    if (ship.npc) return;
    this.assicura(ship); // se la mezzanotte è passata sotto i piedi, si riparte
    let mutata = false;
    for (const m of ship.giornaliere) {
      if (m.fatta || !predicato(m)) continue;
      m.progress = Math.min(m.n, (m.progress || 0) + 1);
      mutata = true;
      if (m.progress >= m.n) {
        m.fatta = true;
        ship.gold += m.reward;
        this.game.sendGold(ship, m.reward, `Missione del giorno compiuta: ${m.desc}`);
        this.game.broadcast({ t: 'feed', msg: `📜 ${ship.name} ha compiuto una missione del giorno (+${m.reward} 🪙)` });
      }
    }
    if (mutata && ship.giornaliere.every(m => m.fatta)) this.pagaTris(ship);
    if (mutata) this.sendBacheca(ship);
  }

  // il tris del giorno: bonus + strike; se la settimana si riempie, paga anche lei
  pagaTris(ship) {
    const oggi = this.oggi();
    const st = ship.strike || { giorno: 0, n: 0 };
    if (st.giorno === oggi) return; // già pagato oggi: mai due volte
    st.n = st.giorno === oggi - 1 ? st.n + 1 : 1;
    st.giorno = oggi;
    ship.strike = st;
    const bonus = PREMI.tris + PREMI.strike * Math.min(st.n, PREMI.strikeCap);
    ship.gold += bonus;
    this.game.sendGold(ship, bonus, `Tris del giorno! (strike di ${st.n} ${st.n === 1 ? 'giorno' : 'giorni'})`);
    this.game.broadcast({ t: 'feed', msg: `🌟 ${ship.name} ha compiuto il tris del giorno (strike ×${st.n})` });
    const sett = Math.floor(oggi / 7);
    if (!ship.settimana || ship.settimana.periodo !== sett) ship.settimana = { periodo: sett, pieni: 0 };
    ship.settimana.pieni = Math.min(7, ship.settimana.pieni + 1);
    if (ship.settimana.pieni === 7) {
      ship.gold += PREMI.settimana;
      this.game.sendGold(ship, PREMI.settimana, 'Settimana piena: il tris tutti i giorni!');
      this.game.broadcast({ t: 'feed', msg: `👑 ${ship.name} ha compiuto la settimana piena (+${PREMI.settimana} 🪙)` });
    }
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
    // il giro di mezzanotte (UTC): a chi è in mare si rinnovano le tre del giorno
    const oggi = this.oggi();
    if (oggi !== this._giorno) {
      this._giorno = oggi;
      for (const s of this.game.ships.values()) {
        if (!s.npc && this.assicura(s)) this.sendBacheca(s);
      }
    }
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

module.exports = { Missions, ASSEDIO, PREMI, GIORNALIERE_N };
