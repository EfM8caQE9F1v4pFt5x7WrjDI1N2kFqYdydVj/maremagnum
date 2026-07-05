// La Gazzetta del Corsaro: l'albo persistente delle notizie del Maremagnum.
// Un solo oggetto per tutto il mare; scritture MAI pubbliche — solo il Mare
// (via binding) e l'Ammiragliato. Le notizie vivono SOLO in gioco: nessun
// canale fuori-gioco, mai. Piano gratuito: una lettura al risveglio del
// mare, una scrittura per evento raro, cap alle ultime 100 voci.

const CAP = 100;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export class GazzettaDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/pubblica' && req.method === 'POST') {
      const { tipo, testo, t } = await req.json().catch(() => ({}));
      if (!testo || typeof testo !== 'string') return json({ errore: 'testo?' }, 400);
      const voce = {
        t: typeof t === 'number' && t > 0 ? t : Date.now(),
        tipo: String(tipo || 'notizia').slice(0, 24),
        testo: testo.slice(0, 300),
      };
      // chiave ordinabile per tempo, con un soffio di sale anti-collisione
      const chiave = 'voce:' + String(voce.t).padStart(15, '0') + ':' + Math.random().toString(36).slice(2, 6);
      await this.state.storage.put(chiave, voce);
      // potatura: l'albo tiene solo le ultime CAP voci
      const tutte = await this.state.storage.list({ prefix: 'voce:' });
      if (tutte.size > CAP) {
        const daPotare = [...tutte.keys()].slice(0, tutte.size - CAP); // le più vecchie
        await this.state.storage.delete(daPotare);
      }
      return json({ ok: true, voce });
    }

    if (url.pathname === '/ultime' && req.method === 'GET') {
      const n = Math.min(CAP, Math.max(1, parseInt(url.searchParams.get('n') || '50', 10)));
      const righe = await this.state.storage.list({ prefix: 'voce:', reverse: true, limit: n });
      return json({ voci: [...righe.values()] });
    }

    return json({ errore: 'rotta ignota' }, 404);
  }
}
