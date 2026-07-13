// Il registro del Mastro di Rotte: dungeon e budget AI, persistenti.

import aiBudget from '../../server/ai-budget-core.js';
// Un solo oggetto; scrive solo il cron del worker (o l'Ammiragliato per i
// collaudi), legge il Mare al risveglio. Lo storico resta agli atti.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

// Guardia applicativa: appena il Worker prova a superare 500 neuroni riservati
// nello stesso giorno, l'AI viene saltata e scatta il fallback procedurale. È il
// 5% dell'allocazione gratuita Cloudflare (10.000/giorno, luglio 2026).

export class CampagneDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req) {
    const url = new URL(req.url);

    // #38: un dungeon per TIPO, storicizzato per periodo
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
      const mensile = (await this.state.storage.get('dungeon:mensile:corrente')) || null;
      return json({ giornaliero, settimanale, mensile });
    }

    // Prenotazione atomica prima della chiamata Workers AI: una sola chiamata
    // per tipo/periodo, nessun retry occulto, tetto molto sotto il piano free.
    if (url.pathname === '/ai/prenota' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const chiave = typeof b.chiave === 'string' ? b.chiave.slice(0, 80) : '';
      if (!chiave) return json({ ok: false, motivo: 'chiave?' }, 400);
      const giorno = Math.floor(Date.now() / 86400000);
      const storageKey = 'ai:budget:' + giorno;
      const corrente = await this.state.storage.get(storageKey);
      const r = aiBudget.prenota(corrente, chiave, b.riserva, giorno);
      if (r.ok) {
        await this.state.storage.put(storageKey, r.stato);
        await this.state.storage.delete('ai:budget:' + (giorno - 8)); // telemetria mobile, storage bounded
      }
      return json({ ok: r.ok, ...(r.motivo ? { motivo: r.motivo } : {}), ...r.stato, cap: aiBudget.AI_DAILY_CAP });
    }

    if (url.pathname === '/ai/budget' && req.method === 'GET') {
      const giorno = Math.floor(Date.now() / 86400000);
      const stato = (await this.state.storage.get('ai:budget:' + giorno)) ||
        aiBudget.vuoto(giorno);
      return json({ ...stato, cap: aiBudget.AI_DAILY_CAP, allocazioneCloudflare: 10000 });
    }

    return json({ errore: 'rotta ignota' }, 404);
  }
}
