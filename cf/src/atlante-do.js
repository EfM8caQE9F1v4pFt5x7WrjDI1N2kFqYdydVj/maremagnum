// L'Atlante comunitario: contatori di approdi per dominio, persistenti.
// Un solo oggetto per tutto il Maremagnum; scritture solo dal Mare (mai
// pubbliche: nessuno gonfia la propria isola via curl). Piano gratuito:
// una riga per dominio, un incremento per approdo.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export class AtlanteDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/visita' && req.method === 'POST') {
      const { dominio } = await req.json().catch(() => ({}));
      if (!dominio || typeof dominio !== 'string' || dominio.length > 200) return json({ errore: 'dominio?' }, 400);
      const chiave = 'isola:' + dominio.toLowerCase();
      const n = ((await this.state.storage.get(chiave)) || 0) + 1;
      await this.state.storage.put(chiave, n);
      return json({ dominio, approdi: n });
    }

    if (url.pathname === '/tutte' && req.method === 'GET') {
      const righe = await this.state.storage.list({ prefix: 'isola:' });
      const tutte = [...righe].map(([k, v]) => [k.slice(6), v]);
      // soglia di anonimato: un dominio entra nell'Atlante pubblico solo
      // quando è meta condivisa (≥3 approdi), mai per il gesto di un singolo
      const sopra = tutte.filter(([, n]) => n >= 3);
      sopra.sort((x, y) => y[1] - x[1]);
      const isole = Object.fromEntries(sopra.slice(0, 500)); // tetto: niente dump illimitati
      return json({ v: Date.now(), isole });
    }

    return json({ errore: 'rotta ignota' }, 404);
  }
}
