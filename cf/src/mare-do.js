// Il Mare come Durable Object: lo STESSO Game del server Node, con la
// disciplina del piano gratuito — il mare dorme quando è vuoto, i profili
// ancorati vivono nei Conti, il tetto di ciurma tiene i costi a zero.

import { Game } from '../../server/game.js';
import blocklist from '../../server/blocklist-core.js';
import atlante from '../../server/atlante-core.js';
import gazzetta from '../../server/gazzetta-core.js';
import campagna from '../../server/campagna-core.js';
import gilde from '../../server/gilde-core.js';
import { verificaToken } from './sessione.js';

const LIST_URL = 'https://nsfw.oisd.nl/abp';
const LIST_KEY = 'oisd-nsfw-abp.txt';
const LIST_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const MAX_CIURMA = 24;       // tetto giocatori per mare (piano gratuito)
const SALVA_OGNI_MS = 60000; // autosalvataggio dei profili ancorati

export class MareDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.game = null;
    this.prontoPromise = null;
    this.equipaggio = new Map(); // ws -> { ship, uid }
    this.saveTimer = null;
    this.atlanteOk = false;   // il primo caricamento è andato a buon fine?
    this.riseminando = false; // una guarigione alla volta
  }

  // La blocklist arriva da R2 (cache) o dall'origine; il core è lo stesso di Node.
  async caricaBlocklist() {
    try {
      const obj = await this.env.DEPOSITO.get(LIST_KEY);
      const fresca = obj && (Date.now() - new Date(obj.uploaded).getTime()) < LIST_MAX_AGE_MS;
      if (obj && fresca) {
        blocklist.setFromText(await obj.text(), 'R2');
        return;
      }
      const res = await fetch(LIST_URL, { headers: { 'user-agent': 'maremagnum-game/0.6' } });
      if (res.ok) {
        const text = await res.text();
        if (blocklist.setFromText(text, 'origine')) {
          await this.env.DEPOSITO.put(LIST_KEY, text);
          return;
        }
      }
      if (obj) blocklist.setFromText(await obj.text(), 'R2 scaduta'); // meglio vecchia che niente
    } catch (e) {
      console.warn('blocklist non caricata (' + e.message + '): fortezze sul fallback');
    }
  }

  // Fusione al rialzo (non rimpiazzo): il modulo atlante sopravvive alla
  // ricreazione del DO nello stesso isolate, e gli approdi registrati nel
  // frattempo non vanno persi.
  async caricaAtlante() {
    try {
      const atl = this.env.ATLANTE.get(this.env.ATLANTE.idFromName('atlante'));
      const res = await atl.fetch('https://atlante/tutte');
      if (res.ok) {
        atlante.mergeConteggi((await res.json()).isole);
        this.atlanteOk = true;
      }
    } catch { /* si ritenta al prossimo risveglio (vedi risemina) */ }
  }

  // Se al varo l'Atlante non rispose, il mare guarisce quando arriva qualcuno:
  // ricarica i conteggi e semina le isole mancanti, annunciandole ai presenti.
  async risemina() {
    if (this.atlanteOk || this.riseminando) return;
    this.riseminando = true;
    try {
      await this.caricaAtlante();
      if (this.atlanteOk && this.game) this.game.semina();
    } finally {
      this.riseminando = false;
    }
  }

  // Le notizie persistite tornano a bordo al risveglio: la Gazzetta è SOLO
  // in gioco, quindi il suo unico magazzino è il GazzettaDO.
  async caricaGazzetta() {
    try {
      const gaz = this.env.GAZZETTA.get(this.env.GAZZETTA.idFromName('gazzetta'));
      const res = await gaz.fetch('https://gazzetta/ultime?n=100');
      if (res.ok) gazzetta.setVoci((await res.json()).voci);
    } catch { /* le notizie arriveranno al prossimo risveglio */ }
  }

  // I dungeon del Mastro (#38: PvE giornaliero/settimanale e PvP mensile) tornano a bordo al
  // risveglio del mare — e se mancano o sono stantii (deploy fresco, oppure il
  // cron non li ha ancora rinfrescati su questo mare caldo) li si semina al volo
  // col vestito procedurale e li si ripubblica: niente attesa del cron. I
  // bersagli sono isole reali sopra soglia dell'Atlante (già caricato in `pronto`).
  // Se il Game è già in piedi, stende subito le difese sui bersagli del periodo.
  async caricaDungeoni() {
    try {
      const reg = this.env.CAMPAGNE.get(this.env.CAMPAGNE.idFromName('campagne'));
      const res = await reg.fetch('https://campagne/corrente');
      const correnti = res.ok ? await res.json() : {};
      for (const tipo of campagna.TIPI) {
        const { dungeon, daPubblicare } = campagna.assicura(
          correnti[tipo], tipo, campagna.periodoDi(tipo), campagna.bersagli(atlante.sopraSoglia()));
        campagna.setDungeon(tipo, dungeon);
        if (daPubblicare) {
          await reg.fetch('https://campagne/pubblica', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(dungeon),
          });
        }
      }
      if (this.game) this.game.applicaDungeoni();
    } catch { /* il Mastro tornerà al prossimo risveglio */ }
  }

  // le Fratellanze tornano a bordo al risveglio: la logica vive nel core,
  // il GildeDO è solo lo scaffale (write-through a ogni mutazione)
  async caricaGilde() {
    try {
      const reg = this.env.GILDE.get(this.env.GILDE.idFromName('gilde'));
      const res = await reg.fetch('https://gilde/tutte');
      if (res.ok) gilde.setGilde((await res.json()).gilde);
    } catch { /* il registro tornerà al prossimo risveglio */ }
  }

  async pronto() {
    if (!this.prontoPromise) {
      this.prontoPromise = (async () => {
        await this.caricaBlocklist();
        await this.caricaAtlante();
        await this.caricaGazzetta();
        await this.caricaDungeoni();
        await this.caricaGilde();
        this.game = new Game((obj) => {
          const s = JSON.stringify(obj);
          for (const ws of this.equipaggio.keys()) {
            try { ws.send(s); } catch { /* socket morente */ }
          }
        });
        this.game.pausa(); // nasce addormentato: si sveglia col primo capitano
        this.game.applicaDungeoni(); // le difese del Mastro (#38) sui bersagli del periodo
        // le mutazioni delle Fratellanze si persistono in write-through
        this.game.onGilde = (op, g) => {
          const reg = this.env.GILDE.get(this.env.GILDE.idFromName('gilde'));
          reg.fetch('https://gilde/' + (op === 'cancella' ? 'cancella' : 'salva'), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(op === 'cancella' ? { id: g.id } : g),
          }).catch(() => { /* la gilda resta almeno in memoria */ });
        };
        // le notizie del Game finiscono nell'albo persistente
        this.game.onGazzetta = (voce) => {
          const gaz = this.env.GAZZETTA.get(this.env.GAZZETTA.idFromName('gazzetta'));
          gaz.fetch('https://gazzetta/pubblica', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(voce),
          }).catch(() => { /* la notizia resta almeno in memoria */ });
        };
        // il Cartellone (issue #27): l'immagine approvata si annota su R2 —
        // il proxy /og-img serve SOLO domini con questo lasciapassare
        this.game.onCartellone = (dominio, urlImmagine) =>
          this.env.DEPOSITO.put('og-ok/' + dominio, urlImmagine);
        // ogni approdo fa crescere l'isola per tutto il Maremagnum
        this.game.onApprodo = (dominio) => {
          atlante.registraApprodo(dominio); // effetto immediato su questo mare
          const atl = this.env.ATLANTE.get(this.env.ATLANTE.idFromName('atlante'));
          atl.fetch('https://atlante/visita', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ dominio }),
          }).catch(() => { /* si conta al prossimo approdo */ });
        };
      })();
    }
    return this.prontoPromise;
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response(JSON.stringify({ mare: 'aperto', ciurma: this.equipaggio.size }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    await this.pronto();
    if (this.equipaggio.size >= MAX_CIURMA) {
      return new Response('Mare pieno: torna con la prossima marea.', { status: 503 });
    }
    const coppia = new WebSocketPair();
    const [client, server] = Object.values(coppia);
    server.accept();
    this.arruola(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  arruola(ws) {
    const voce = { ship: null, uid: null };
    this.equipaggio.set(ws, voce);
    this.game.riprendi();
    this.risemina(); // no-op se l'Atlante è già arrivato
    if (!this.saveTimer) this.saveTimer = setInterval(() => this.salvaTutti(), SALVA_OGNI_MS);

    // adattatore: Game si aspetta .send e .readyState come il pacchetto ws
    const conn = {
      send: (s) => { try { ws.send(s); } catch { /* morente */ } },
      close: (code, reason) => { try { ws.close(code, reason); } catch { /* già chiuso */ } },
      get readyState() { try { return ws.readyState ?? 1 } catch { return 3; } },
    };

    ws.addEventListener('message', async (e) => {
      if (typeof e.data !== 'string' || e.data.length > 2048) return; // niente bombe
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (!msg || typeof msg.t !== 'string' || !this.game) return;
      if (!voce.ship) {
        if (msg.t !== 'join') return;
        // il Mastro a caldo: se è girata la settimana da quando il mare s'è
        // svegliato, rileggi/risemina la campagna prima che il Game la mandi
        if (campagna.TIPI.some(tipo =>
          campagna.getDungeon(tipo)?.periodo !== campagna.periodoDi(tipo))) {
          await this.caricaDungeoni();
        }
        // ancoraggio: col token valido il profilo autorevole arriva dai Conti
        if (msg.token && this.env.SESSION_SECRET) {
          const payload = await verificaToken(msg.token, this.env.SESSION_SECRET);
          if (payload) {
            const conti = this.env.CONTI.get(this.env.CONTI.idFromName('conti'));
            const res = await conti.fetch('https://conti/profilo/' + encodeURIComponent(payload.uid));
            if (res.ok) {
              const dati = await res.json();
              voce.uid = payload.uid;
              if (dati.profilo) {
                msg.profile = dati.profilo;
                if (dati.profilo.name) msg.name = dati.profilo.name;
              }
            }
          }
        }
        voce.ship = this.game.join(conn, msg);
        // l'identità di gilda esce SOLO dal token verificato, mai dal client
        voce.ship.uid = voce.uid;
        this.game.aggiornaGilda(voce.ship);
        return;
      }
      this.game.handle(voce.ship, msg);
    });

    const congeda = async () => {
      const v = this.equipaggio.get(ws);
      if (!v) return;
      this.equipaggio.delete(ws);
      if (v.ship && this.game) {
        // PRIMA il congedo, POI il salvataggio (audit 5-bis): leave() applica
        // le pene di chi stacca la spina (abbordaggio del bloccato, tassa del
        // codardo sull'ingaggiato) — salvare prima le avrebbe cancellate
        this.game.leave(v.ship);
        if (v.uid) await this.salvaProfilo(v.uid, v.ship);
      }
      if (this.equipaggio.size === 0 && this.game) {
        this.game.pausa(); // il mare si riaddormenta: il piano gratuito ringrazia
        clearInterval(this.saveTimer);
        this.saveTimer = null;
      }
    };
    ws.addEventListener('close', congeda);
    ws.addEventListener('error', congeda);
  }

  profiloDaShip(ship) {
    return {
      name: ship.name,
      gold: ship.gold,
      hullLvl: ship.hullLvl,
      sailsLvl: ship.sailsLvl,
      helmLvl: ship.helmLvl,
      crewLvl: ship.crewLvl,
      holdLvl: ship.holdLvl,
      tipo: ship.tipo,
      vari: ship.vari,
      mounts: ship.mounts,
      esclusive: { ...(ship.esclusive || {}) }, // l'arsenale (audit Cantiere 2)
      // la Ciurma (#16): arruolati, prescelto e tipi varati in carriera
      ciurma: [...(ship.ciurma || [])],
      pirata: ship.pirata || null,
      varati: [...(ship.varati || [])],
      conquered: [...(ship.conquered || [])],
      preferiti: [...(ship.preferiti || [])],
      livree: [...(ship.livree || [])],
      livrea: ship.livrea || null,
      vele: ship.vele || null,
      scia: ship.scia || null,
      bandiera: ship.bandiera || null,
      gazzettaLetta: ship.gazzettaLetta || 0,
      campagna: ship.campagna || null,
      dungeonGiorno: ship.dungeonGiorno || 0,
      dungeonMese: ship.dungeonMese || 0,
      ricordiMastro: ship.ricordiMastro || [],
      giornaliere: {
        giorno: ship.missioniGiorno | 0,
        progressi: (ship.giornaliere || []).map(m => m.progress | 0),
        fatte: (ship.giornaliere || []).map(m => !!m.fatta),
      },
      strike: ship.strike || { giorno: 0, n: 0 },
      settimana: ship.settimana || { periodo: 0, pieni: 0 },
      sfide: ship.sfide || {},
      kills: ship.kills,
      deaths: ship.deaths,
    };
  }

  async salvaProfilo(uid, ship) {
    try {
      const conti = this.env.CONTI.get(this.env.CONTI.idFromName('conti'));
      await conti.fetch('https://conti/profilo/' + encodeURIComponent(uid), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profilo: this.profiloDaShip(ship) }),
      });
    } catch { /* si risalva al giro dopo */ }
  }

  async salvaTutti() {
    for (const v of this.equipaggio.values()) {
      if (v.uid && v.ship) await this.salvaProfilo(v.uid, v.ship);
    }
  }
}
