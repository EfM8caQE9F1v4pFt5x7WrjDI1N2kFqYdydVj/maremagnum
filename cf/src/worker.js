// Il Maremagnum su Cloudflare: un solo Worker serve il client web (assets),
// smista i WebSocket verso il Mare (Durable Object) e le rotte d'Ancoraggio
// verso i Conti. Tutto entro i limiti del piano gratuito.

import { MareDO } from './mare-do.js';
import { ContiDO } from './conti-do.js';
import { AtlanteDO } from './atlante-do.js';
import { GazzettaDO } from './gazzetta-do.js';

export { MareDO, ContiDO, AtlanteDO, GazzettaDO };

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

    // Il riscatto delle isole: i proprietari dei siti veri si mettono in rada
    // per l'Editor dell'Isola (in cantiere). Solo una lista d'attesa, per ora.
    if (url.pathname === '/riscatto' && req.method === 'POST') {
      const corpo = await req.text();
      if (corpo.length > 2048) return new Response('{"errore":"troppo lungo"}', { status: 413 });
      const atl = env.ATLANTE.get(env.ATLANTE.idFromName('atlante'));
      return atl.fetch('https://atlante/riscatto', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo,
      });
    }
    if (url.pathname === '/ammiragliato/riscatti' && req.method === 'GET') {
      if (!env.ADMIN_SECRET || req.headers.get('X-Ammiragliato') !== env.ADMIN_SECRET) {
        return new Response('Chi va là?', { status: 401 });
      }
      const atl = env.ATLANTE.get(env.ATLANTE.idFromName('atlante'));
      return atl.fetch('https://atlante/riscatti');
    }

    // L'Ammiragliato detta una notizia alla Gazzetta (annunci di release,
    // esiti dei riscatti). SOLO in gioco: arriverà ai naviganti al join
    // e sui WebSocket aperti, mai su canali fuori-gioco.
    if (url.pathname === '/ammiragliato/gazzetta' && req.method === 'POST') {
      if (!env.ADMIN_SECRET || req.headers.get('X-Ammiragliato') !== env.ADMIN_SECRET) {
        return new Response('Chi va là?', { status: 401 });
      }
      const corpo = await req.text();
      if (corpo.length > 2048) return new Response('{"errore":"troppo lungo"}', { status: 413 });
      const gaz = env.GAZZETTA.get(env.GAZZETTA.idFromName('gazzetta'));
      return gaz.fetch('https://gazzetta/pubblica', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo,
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
