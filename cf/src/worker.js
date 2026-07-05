// Il Maremagnum su Cloudflare: un solo Worker serve il client web (assets),
// smista i WebSocket verso il Mare (Durable Object) e le rotte d'Ancoraggio
// verso i Conti. Tutto entro i limiti del piano gratuito.

import { MareDO } from './mare-do.js';
import { ContiDO } from './conti-do.js';
import { AtlanteDO } from './atlante-do.js';
import { GazzettaDO } from './gazzetta-do.js';
import { CampagneDO } from './campagne-do.js';
import { GildeDO } from './gilde-do.js';
import campagna from '../../server/campagna-core.js';

export { MareDO, ContiDO, AtlanteDO, GazzettaDO, CampagneDO, GildeDO };

// Il Mastro di Rotte al lavoro (issue #3): campagna procedurale e
// DETERMINISTICA dal numero della settimana; Workers AI (quota permettendo)
// riveste SOLO nome e lore — mai i numeri. Se l'LLM manca o sfora, il
// vestito procedurale del core basta: la campagna esce comunque.
async function generaCampagna(env) {
  const settimana = campagna.settimanaDi();
  const c = campagna.genera(settimana);
  let esitoAI = 'saltata (binding assente)';
  try {
    if (env.AI) {
      esitoAI = 'vestito procedurale (risposta non usabile)';
      // una sola chiamata a settimana: conta la qualità dell'italiano, non
      // il risparmio di neuron (modello verificato sull'account: 2026-07)
      const risposta = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [{
          role: 'user',
          content: 'Sei il Mastro di Rotte di un gioco piratesco italiano. Rispondi SOLO con JSON ' +
            `{"nome": "...", "lore": "...", "tappe": ["...", "...", "..."]}: un nome evocativo (max 5 parole) ` +
            `per la campagna della settimana, una riga di lore (max 20 parole), e una riga di lore piratesca ` +
            `(max 15 parole) per ciascuna di queste ${c.tappe.length} tappe: ` +
            c.tappe.map((t, i) => `${i + 1}) ${t.desc}`).join('; ') + '. Niente numeri, niente premi: solo atmosfera.',
        }],
        max_tokens: 300,
      });
      // i modelli cambiano vestito più dei corsari: stringa, oggetto o
      // formato OpenAI-compat — si normalizza tutto a testo
      let testo = risposta && (risposta.response ?? risposta.result ??
        (risposta.choices && risposta.choices[0] && risposta.choices[0].message
          && risposta.choices[0].message.content));
      if (testo && typeof testo !== 'string') testo = JSON.stringify(testo);
      testo = testo || '';
      const match = testo.match(/\{[\s\S]*\}/);
      const vestito = match ? JSON.parse(match[0]) : null;
      if (vestito && typeof vestito.nome === 'string' && vestito.nome.trim()) {
        c.nome = vestito.nome.trim().slice(0, 60);
        if (typeof vestito.lore === 'string') c.lore = vestito.lore.trim().slice(0, 200);
        if (Array.isArray(vestito.tappe)) {
          vestito.tappe.forEach((l, i) => {
            if (c.tappe[i] && typeof l === 'string' && l.trim()) c.tappe[i].lore = l.trim().slice(0, 120);
          });
        }
        esitoAI = 'lore AI';
      }
    }
  } catch (e) {
    // niente neuron? pazienza: si salpa col vestito procedurale
    esitoAI = 'vestito procedurale (' + (e && e.message ? String(e.message).slice(0, 120) : 'errore') + ')';
    console.warn('Mastro di Rotte, lore AI non disponibile: ' + esitoAI);
  }

  const reg = env.CAMPAGNE.get(env.CAMPAGNE.idFromName('campagne'));
  const { __esitoAI, ...daPersistere } = c;
  await reg.fetch('https://campagne/pubblica', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(daPersistere),
  });
  // una campagna non annunciata non esiste: la Gazzetta la proclama
  const gaz = env.GAZZETTA.get(env.GAZZETTA.idFromName('gazzetta'));
  await gaz.fetch('https://gazzetta/pubblica', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tipo: 'campagna',
      testo: `⚔ Il Mastro di Rotte proclama la campagna della settimana: "${c.nome}" — ${c.tappe.length} tappe, ${c.premio} 🪙 a chi la compie.`,
    }),
  });
  c.__esitoAI = esitoAI; // solo per la risposta dell'Ammiragliato, non persiste
  return c;
}

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

    // Il proxy delle immagini del Cartellone (issue #27): serve SOLO i
    // domini col lasciapassare 'og-ok/' scritto dal Mare per prossimità
    // reale (mai un proxy aperto), con cache su R2 per una settimana.
    const ogImg = url.pathname.match(/^\/og-img\/([a-z0-9.-]{3,100})$/i);
    if (ogImg && req.method === 'GET') {
      const dominio = ogImg[1].toLowerCase();
      const inCache = await env.DEPOSITO.get('og-img/' + dominio);
      if (inCache) {
        const eta = Date.now() - new Date(inCache.uploaded).getTime();
        if (eta < 7 * 24 * 3600 * 1000) {
          return new Response(inCache.body, {
            headers: {
              'content-type': inCache.httpMetadata?.contentType || 'image/jpeg',
              'cache-control': 'public, max-age=604800',
            },
          });
        }
      }
      const lascia = await env.DEPOSITO.get('og-ok/' + dominio);
      if (!lascia) return new Response('', { status: 404 });
      try {
        // lo User-Agent è d'obbligo: Wikimedia e altri rifiutano i client anonimi
        const r = await fetch(await lascia.text(), {
          redirect: 'follow',
          signal: AbortSignal.timeout(8000),
          headers: { 'user-agent': 'Maremagnum/1.0 (+https://maremagnum.maremagnum.workers.dev)', accept: 'image/*' },
        });
        const tipo = r.headers.get('content-type') || '';
        if (!r.ok || !tipo.startsWith('image/')) throw new Error('niente immagine');
        const dati = await r.arrayBuffer();
        if (dati.byteLength > 3 * 1024 * 1024) throw new Error('troppo pesante');
        await env.DEPOSITO.put('og-img/' + dominio, dati, { httpMetadata: { contentType: tipo } });
        return new Response(dati, {
          headers: { 'content-type': tipo, 'cache-control': 'public, max-age=604800' },
        });
      } catch {
        return new Response('', { status: 404 });
      }
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

    // L'Ammiragliato può battere il cron sul tempo (collaudi e prime uscite)
    if (url.pathname === '/ammiragliato/mastro' && req.method === 'POST') {
      if (!env.ADMIN_SECRET || req.headers.get('X-Ammiragliato') !== env.ADMIN_SECRET) {
        return new Response('Chi va là?', { status: 401 });
      }
      const c = await generaCampagna(env);
      return new Response(JSON.stringify({ ok: true, campagna: c }), {
        headers: { 'content-type': 'application/json' },
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

  // il cron del Mastro di Rotte: ogni lunedì alle 06:00 UTC una campagna nuova
  async scheduled(event, env, ctx) {
    ctx.waitUntil(generaCampagna(env));
  },
};
