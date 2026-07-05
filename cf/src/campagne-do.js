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

    if (url.pathname === '/pubblica' && req.method === 'POST') {
      const campagna = await req.json().catch(() => null);
      if (!campagna || typeof campagna.settimana !== 'number' || !Array.isArray(campagna.tappe)) {
        return json({ errore: 'campagna?' }, 400);
      }
      await this.state.storage.put('campagna:corrente', campagna);
      await this.state.storage.put('campagna:sett:' + campagna.settimana, campagna);
      return json({ ok: true, campagna });
    }

    if (url.pathname === '/corrente' && req.method === 'GET') {
      const campagna = (await this.state.storage.get('campagna:corrente')) || null;
      return json({ campagna });
    }

    return json({ errore: 'rotta ignota' }, 404);
  }
}
