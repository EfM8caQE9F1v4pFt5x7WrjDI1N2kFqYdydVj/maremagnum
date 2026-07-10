// Il registro del Mastro di Rotte: la campagna della settimana, persistente.
// Un solo oggetto; scrive solo il cron del worker (o l'Ammiragliato per i
// collaudi), legge il Mare al risveglio. Lo storico resta agli atti.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export class CampagneDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req) {
    const url = new URL(req.url);

    // #38: un dungeon per TIPO (giornaliero/settimanale), storicizzato per periodo
    if (url.pathname === '/pubblica' && req.method === 'POST') {
      const d = await req.json().catch(() => null);
      if (!d || typeof d.periodo !== 'number' || typeof d.tipo !== 'string' || !Array.isArray(d.tappe)) {
        return json({ errore: 'dungeon?' }, 400);
      }
      await this.state.storage.put('dungeon:' + d.tipo + ':corrente', d);
      await this.state.storage.put('dungeon:' + d.tipo + ':' + d.periodo, d);
      return json({ ok: true, dungeon: d });
    }

    if (url.pathname === '/corrente' && req.method === 'GET') {
      const giornaliero = (await this.state.storage.get('dungeon:giornaliero:corrente')) || null;
      const settimanale = (await this.state.storage.get('dungeon:settimanale:corrente')) || null;
      return json({ giornaliero, settimanale });
    }

    return json({ errore: 'rotta ignota' }, 404);
  }
}
