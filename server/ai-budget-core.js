'use strict';

// Guardia pura e testabile per Workers AI (#38). Cloudflare offre 10.000
// neuroni/giorno sul Free plan; Maremagnum ne riserva al massimo 500 (5%).
// Ogni generazione vale al massimo 100 neuroni e ogni tipo/periodo passa una
// sola volta. Il Durable Object si limita a serializzare e persistere lo stato.
const AI_DAILY_CAP = 500;
const AI_RESERVE_MAX = 100;

function vuoto(giorno) { return { giorno, riservati: 0, richieste: 0, chiavi: [] }; }

function prenota(corrente, chiave, richiesta = AI_RESERVE_MAX, giorno = Math.floor(Date.now() / 86400000)) {
  const stato = corrente && corrente.giorno === giorno
    ? { ...corrente, chiavi: [...(corrente.chiavi || [])] }
    : vuoto(giorno);
  const key = typeof chiave === 'string' ? chiave.slice(0, 80) : '';
  const riserva = Math.max(1, Math.min(AI_RESERVE_MAX, Number(richiesta) || AI_RESERVE_MAX));
  if (!key) return { ok: false, motivo: 'chiave?', stato };
  if (stato.chiavi.includes(key)) return { ok: false, motivo: 'gia-generato', stato };
  if (stato.riservati + riserva > AI_DAILY_CAP) return { ok: false, motivo: 'budget', stato };
  stato.riservati += riserva;
  stato.richieste += 1;
  stato.chiavi = [...stato.chiavi.slice(-19), key];
  return { ok: true, stato };
}

module.exports = { AI_DAILY_CAP, AI_RESERVE_MAX, vuoto, prenota };
