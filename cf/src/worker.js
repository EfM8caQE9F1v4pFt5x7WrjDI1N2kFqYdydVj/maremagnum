// Il Maremagnum su Cloudflare: un solo Worker serve il client web (assets),
// smista i WebSocket verso il Mare (Durable Object) e le rotte d'Ancoraggio
// verso i Conti. Tutto entro i limiti del piano gratuito.

import { MareDO } from './mare-do.js';
import { ContiDO } from './conti-do.js';

export { MareDO, ContiDO };

const PUBBLICHE_CONTI = { '/ancora/nuovo': '/nuovo', '/ancora/conferma': '/conferma', '/ancora/entra': '/entra' };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    const upgrade = (req.headers.get('Upgrade') || '').toLowerCase();
    if (url.pathname === '/mare' && upgrade === 'websocket') {
      return env.MARE.get(env.MARE.idFromName('mare-1')).fetch(req);
    }

    if (url.pathname === '/salute') {
      const mare = await env.MARE.get(env.MARE.idFromName('mare-1')).fetch('https://mare/');
      return new Response(JSON.stringify({ ok: true, mare: await mare.json() }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    const rotta = PUBBLICHE_CONTI[url.pathname];
    if (rotta && req.method === 'POST') {
      const conti = env.CONTI.get(env.CONTI.idFromName('conti'));
      return conti.fetch('https://conti' + rotta, { method: 'POST', headers: req.headers, body: req.body });
    }

    return env.ASSETS.fetch(req);
  },
};
