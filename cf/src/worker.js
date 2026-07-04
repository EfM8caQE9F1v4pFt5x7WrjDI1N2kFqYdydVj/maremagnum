// Il Maremagnum su Cloudflare: un solo Worker serve il client web (assets),
// smista i WebSocket verso il Mare (Durable Object) e le rotte d'Ancoraggio
// verso i Conti. Tutto entro i limiti del piano gratuito.

import { MareDO } from './mare-do.js';
import { ContiDO } from './conti-do.js';
import { AtlanteDO } from './atlante-do.js';

export { MareDO, ContiDO, AtlanteDO };

const PUBBLICHE_CONTI = { '/ancora/nuovo': '/nuovo', '/ancora/conferma': '/conferma', '/ancora/entra': '/entra' };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    const upgrade = (req.headers.get('Upgrade') || '').toLowerCase();
    if (url.pathname === '/mare' && upgrade === 'websocket') {
      return env.MARE.get(env.MARE.idFromName('mare-1')).fetch(req);
    }

    if (url.pathname === '/atlante' && req.method === 'GET') {
      const atl = env.ATLANTE.get(env.ATLANTE.idFromName('atlante'));
      const r = await atl.fetch('https://atlante/tutte');
      return new Response(await r.text(), {
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
      });
    }

    // Ammiragliato: rotte d'amministrazione protette da segreto (mai nel git)
    if (url.pathname.startsWith('/ammiragliato/profilo/')) {
      if (!env.ADMIN_SECRET || req.headers.get('X-Ammiragliato') !== env.ADMIN_SECRET) {
        return new Response('Chi va là?', { status: 401 });
      }
      const uid = url.pathname.slice('/ammiragliato/profilo/'.length);
      const conti = env.CONTI.get(env.CONTI.idFromName('conti'));
      return conti.fetch('https://conti/profilo/' + encodeURIComponent(uid), {
        method: req.method, headers: { 'content-type': 'application/json' }, body: req.body,
      });
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
