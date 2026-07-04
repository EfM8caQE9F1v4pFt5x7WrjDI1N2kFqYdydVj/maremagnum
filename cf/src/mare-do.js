// Il Mare come Durable Object: lo STESSO Game del server Node, con la
// disciplina del piano gratuito — il mare dorme quando è vuoto, i profili
// ancorati vivono nei Conti, il tetto di ciurma tiene i costi a zero.

import { Game } from '../../server/game.js';
import blocklist from '../../server/blocklist-core.js';
import atlante from '../../server/atlante-core.js';
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

  async caricaAtlante() {
    try {
      const atl = this.env.ATLANTE.get(this.env.ATLANTE.idFromName('atlante'));
      const res = await atl.fetch('https://atlante/tutte');
      if (res.ok) atlante.setConteggi((await res.json()).isole);
    } catch { /* l'Atlante arriverà al prossimo risveglio */ }
  }

  async pronto() {
    if (!this.prontoPromise) {
      this.prontoPromise = (async () => {
        await this.caricaBlocklist();
        await this.caricaAtlante();
        this.game = new Game((obj) => {
          const s = JSON.stringify(obj);
          for (const ws of this.equipaggio.keys()) {
            try { ws.send(s); } catch { /* socket morente */ }
          }
        });
        this.game.pausa(); // nasce addormentato: si sveglia col primo capitano
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
    if (!this.saveTimer) this.saveTimer = setInterval(() => this.salvaTutti(), SALVA_OGNI_MS);

    // adattatore: Game si aspetta .send e .readyState come il pacchetto ws
    const conn = {
      send: (s) => { try { ws.send(s); } catch { /* morente */ } },
      get readyState() { try { return ws.readyState ?? 1 } catch { return 3; } },
    };

    ws.addEventListener('message', async (e) => {
      if (typeof e.data !== 'string' || e.data.length > 2048) return; // niente bombe
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (!msg || typeof msg.t !== 'string' || !this.game) return;
      if (!voce.ship) {
        if (msg.t !== 'join') return;
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
        return;
      }
      this.game.handle(voce.ship, msg);
    });

    const congeda = async () => {
      const v = this.equipaggio.get(ws);
      if (!v) return;
      this.equipaggio.delete(ws);
      if (v.ship && this.game) {
        if (v.uid) await this.salvaProfilo(v.uid, v.ship);
        this.game.leave(v.ship);
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
      conquered: [...(ship.conquered || [])],
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
