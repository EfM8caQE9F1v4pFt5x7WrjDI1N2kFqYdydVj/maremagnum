// I Conti del Maremagnum: l'Ancoraggio del profilo.
// Nome a scelta (anche una mail: NON la verifichiamo) + TOTP. Niente password,
// niente conferme. Un conto che non entra da 30 giorni viene inghiottito dal mare.

import { generaSegreto, verificaTotp, otpauthUri } from './totp.js';
import { firmaToken } from './sessione.js';

const BOZZA_TTL_MS = 10 * 60 * 1000;          // 10 min per confermare il QR
const CONTO_TTL_MS = 30 * 24 * 3600 * 1000;   // 30 giorni di assenza = addio
const SESSIONE_TTL_MS = 90 * 24 * 3600 * 1000;
const SWEEP_MS = 24 * 3600 * 1000;

function normalizzaHandle(h) {
  const s = String(h || '').trim().toLowerCase();
  if (!/^[a-z0-9@._+-]{3,40}$/.test(s)) return null;
  return s;
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export class ContiDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // la scopa passa una volta al giorno
    this.state.storage.getAlarm().then((a) => {
      if (a == null) this.state.storage.setAlarm(Date.now() + SWEEP_MS);
    });
  }

  async alarm() {
    const conti = await this.state.storage.list({ prefix: 'conto:' });
    const soglia = Date.now() - CONTO_TTL_MS;
    for (const [key, conto] of conti) {
      if ((conto.ultimoIngresso || 0) < soglia) await this.state.storage.delete(key);
    }
    await this.state.storage.setAlarm(Date.now() + SWEEP_MS);
  }

  async fetch(req) {
    const url = new URL(req.url);
    const body = req.method === 'POST' || req.method === 'PUT' ? await req.json().catch(() => ({})) : {};

    // --- rotte pubbliche (inoltrate dal worker) ---

    if (url.pathname === '/nuovo' && req.method === 'POST') {
      const uid = normalizzaHandle(body.handle);
      if (!uid) return json({ errore: 'Nome d\'ancoraggio non valido (3-40 caratteri, lettere/numeri/@._+-).' }, 400);
      if (await this.state.storage.get('conto:' + uid)) return json({ errore: 'Questo ancoraggio è già di un altro capitano.' }, 409);
      const segreto = generaSegreto();
      await this.state.storage.put('bozza:' + uid, { segreto, exp: Date.now() + BOZZA_TTL_MS });
      return json({ uid, segreto, otpauth: otpauthUri(uid, segreto) });
    }

    if (url.pathname === '/conferma' && req.method === 'POST') {
      const uid = normalizzaHandle(body.handle);
      const bozza = uid && await this.state.storage.get('bozza:' + uid);
      if (!bozza || bozza.exp < Date.now()) return json({ errore: 'Bozza scaduta: ricomincia l\'ancoraggio.' }, 410);
      if (!(await verificaTotp(bozza.segreto, body.codice))) return json({ errore: 'Codice errato: controlla l\'app.' }, 401);
      if (await this.state.storage.get('conto:' + uid)) return json({ errore: 'Ancoraggio già preso.' }, 409);
      await this.state.storage.put('conto:' + uid, {
        uid, segreto: bozza.segreto, creato: Date.now(), ultimoIngresso: Date.now(), profilo: body.profilo || null,
      });
      await this.state.storage.delete('bozza:' + uid);
      const token = await firmaToken({ uid, exp: Date.now() + SESSIONE_TTL_MS }, this.env.SESSION_SECRET);
      return json({ token, uid });
    }

    if (url.pathname === '/entra' && req.method === 'POST') {
      const uid = normalizzaHandle(body.handle);
      const conto = uid && await this.state.storage.get('conto:' + uid);
      if (!conto) return json({ errore: 'Nessun ancoraggio con questo nome (o è stato inghiottito dal mare dopo 30 giorni).' }, 404);
      if (!(await verificaTotp(conto.segreto, body.codice))) return json({ errore: 'Codice errato: controlla l\'app.' }, 401);
      conto.ultimoIngresso = Date.now();
      await this.state.storage.put('conto:' + uid, conto);
      const token = await firmaToken({ uid, exp: Date.now() + SESSIONE_TTL_MS }, this.env.SESSION_SECRET);
      return json({ token, uid, profilo: conto.profilo });
    }

    // --- rotte interne (solo dal MareDO) ---

    if (url.pathname.startsWith('/profilo/')) {
      const uid = normalizzaHandle(url.pathname.slice('/profilo/'.length));
      const conto = uid && await this.state.storage.get('conto:' + uid);
      if (!conto) return json({ errore: 'sconosciuto' }, 404);
      if (req.method === 'GET') {
        conto.ultimoIngresso = Date.now();
        await this.state.storage.put('conto:' + uid, conto);
        return json({ uid, profilo: conto.profilo });
      }
      if (req.method === 'PUT') {
        conto.profilo = body.profilo || conto.profilo;
        conto.ultimoIngresso = Date.now();
        await this.state.storage.put('conto:' + uid, conto);
        return json({ ok: true });
      }
    }

    return json({ errore: 'rotta ignota' }, 404);
  }
}
