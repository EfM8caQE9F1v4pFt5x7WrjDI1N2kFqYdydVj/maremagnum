// Il registro delle Fratellanze: persistenza write-through per gilde-core.
// Un solo oggetto; scrive solo il Mare via binding (la logica vive nel core
// condiviso, qui solo lo scaffale). Le bandiere sono DATI (indici su set
// fissi), mai immagini: niente moderazione, niente R2.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export class GildeDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/salva' && req.method === 'POST') {
      const g = await req.json().catch(() => null);
      if (!g || !g.id || !g.nome) return json({ errore: 'gilda?' }, 400);
      await this.state.storage.put('gilda:' + g.id, g);
      return json({ ok: true });
    }

    if (url.pathname === '/cancella' && req.method === 'POST') {
      const { id } = await req.json().catch(() => ({}));
      if (!id) return json({ errore: 'id?' }, 400);
      await this.state.storage.delete('gilda:' + id);
      return json({ ok: true });
    }

    if (url.pathname === '/tutte' && req.method === 'GET') {
      const righe = await this.state.storage.list({ prefix: 'gilda:' });
      return json({ gilde: [...righe.values()] });
    }

    return json({ errore: 'rotta ignota' }, 404);
  }
}
