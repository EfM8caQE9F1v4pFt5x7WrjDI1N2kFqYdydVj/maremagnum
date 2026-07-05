'use strict';

// Le Fratellanze del Maremagnum (issue #5), cuore puro: tutta la logica di
// gilda vive qui, in memoria, testabile senza rete; il GildeDO persiste in
// write-through e il Mare ricarica al risveglio (pattern atlante/gazzetta).
// L'identità è l'uid dell'Ancoraggio: senza ancora niente gilda — il tag in
// mare esce solo da una verifica server, mai dal profilo del client.

const FONDAZIONE = 25000; // ben sopra l'Organo (9700): il primo pozzo sociale
const MEMBRI_MAX = 24;    // come il tetto del mare
const GILDE_MAX = 200;
const SFIDA_GIORNI = 7;   // il diritto conquistato col blocco scade

const CATEGORIE = ['corsari', 'mercanti', 'esploratori', 'accademici', 'guardiani'];

// la bandiera è DATO, non immagine: indici su set fissi — niente moderazione
const BANDIERA = { fondi: 8, tagli: 4, emblemi: 8, tinte: 8 };

let gilde = new Map(); // id -> gilda

const pulisci = (s, max) => String(s || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

function sanificaBandiera(b) {
  b = b && typeof b === 'object' ? b : {};
  const idx = (v, n) => Math.min(n - 1, Math.max(0, v | 0));
  return {
    fondo: idx(b.fondo, BANDIERA.tinte),
    taglio: idx(b.taglio, BANDIERA.tagli),
    tinta2: idx(b.tinta2, BANDIERA.tinte),
    emblema: idx(b.emblema, BANDIERA.emblemi),
    tintaEmblema: idx(b.tintaEmblema, BANDIERA.tinte),
  };
}

function setGilde(list) {
  gilde = new Map();
  for (const g of Array.isArray(list) ? list : []) {
    if (g && g.id && g.nome && Array.isArray(g.membri)) gilde.set(g.id, g);
  }
}

function tutte() { return [...gilde.values()]; }
function get(id) { return gilde.get(id) || null; }

function diUid(uid) {
  if (!uid) return null;
  for (const g of gilde.values()) {
    if (g.membri.some(m => m.uid === uid)) return g;
  }
  return null;
}

function ruoloDi(g, uid) {
  const m = g.membri.find(x => x.uid === uid);
  return m ? m.ruolo : null;
}

function annota(g, testo, t = Date.now()) {
  g.log.unshift({ t, testo: pulisci(testo, 160) });
  if (g.log.length > 20) g.log.length = 20;
}

// La fondazione: nome e tag unici, bandiera sanificata, il fondatore è capitano.
function fonda({ nome, tag, motto, categoria, bandiera, aperta, uid, nomeNave }, t = Date.now()) {
  if (!uid) return { errore: "Serve l'Ancoraggio per fondare una Fratellanza." };
  if (diUid(uid)) return { errore: 'Sei già in una Fratellanza.' };
  if (gilde.size >= GILDE_MAX) return { errore: 'Il registro delle Fratellanze è pieno.' };
  nome = pulisci(nome, 24);
  tag = pulisci(tag, 5).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (nome.length < 3) return { errore: 'Il nome vuole almeno 3 caratteri.' };
  if (tag.length < 2) return { errore: 'Il tag vuole 2-5 lettere.' };
  for (const g of gilde.values()) {
    if (g.nome.toLowerCase() === nome.toLowerCase()) return { errore: 'Quel nome batte già bandiera.' };
    if (g.tag === tag) return { errore: 'Quel tag batte già bandiera.' };
  }
  if (!CATEGORIE.includes(categoria)) return { errore: 'Categoria sconosciuta.' };
  const id = 'g' + t.toString(36) + Math.random().toString(36).slice(2, 5);
  const gilda = {
    id, nome, tag,
    motto: pulisci(motto, 60),
    categoria,
    bandiera: sanificaBandiera(bandiera),
    aperta: !!aperta,
    membri: [{ uid, nome: pulisci(nomeNave, 18), ruolo: 'capitano' }],
    richieste: [], // [{uid, nome, t}]
    log: [],
    fondata: t,
  };
  annota(gilda, `⚓ ${gilda.membri[0].nome} ha fondato la Fratellanza`, t);
  gilde.set(id, gilda);
  return { gilda };
}

// Il rito: la richiesta vale solo col diritto di sfida (verificato dal Game).
function richiedi(id, uid, nomeNave, t = Date.now()) {
  const g = gilde.get(id);
  if (!g) return { errore: 'Fratellanza sconosciuta.' };
  if (!uid) return { errore: "Serve l'Ancoraggio per entrare in una Fratellanza." };
  if (diUid(uid)) return { errore: 'Sei già in una Fratellanza.' };
  if (g.membri.length >= MEMBRI_MAX) return { errore: 'La ciurma è al completo.' };
  const nome = pulisci(nomeNave, 18);
  if (g.aperta) {
    g.membri.push({ uid, nome, ruolo: 'marinaio' });
    annota(g, `⛵ ${nome} è entrato nella Fratellanza (porte aperte)`, t);
    return { gilda: g, ammesso: true };
  }
  if (g.richieste.some(r => r.uid === uid)) return { errore: 'La tua richiesta è già in rada.' };
  if (g.richieste.length >= 20) return { errore: 'Troppe richieste in rada.' };
  g.richieste.push({ uid, nome, t });
  annota(g, `✉ ${nome} ha chiesto l'ingresso`, t);
  return { gilda: g, ammesso: false };
}

function approva(id, uidRichiesta, daUid, t = Date.now()) {
  const g = gilde.get(id);
  if (!g) return { errore: 'Fratellanza sconosciuta.' };
  const ruolo = ruoloDi(g, daUid);
  if (ruolo !== 'capitano' && ruolo !== 'ufficiale') return { errore: 'Solo capitano e ufficiali approvano.' };
  const i = g.richieste.findIndex(r => r.uid === uidRichiesta);
  if (i < 0) return { errore: 'Richiesta non trovata.' };
  if (g.membri.length >= MEMBRI_MAX) return { errore: 'La ciurma è al completo.' };
  const r = g.richieste.splice(i, 1)[0];
  if (diUid(r.uid)) return { errore: 'Nel frattempo ha giurato altrove.' };
  g.membri.push({ uid: r.uid, nome: r.nome, ruolo: 'marinaio' });
  annota(g, `⛵ ${r.nome} è stato ammesso`, t);
  return { gilda: g, ammesso: r };
}

function rifiuta(id, uidRichiesta, daUid) {
  const g = gilde.get(id);
  if (!g) return { errore: 'Fratellanza sconosciuta.' };
  const ruolo = ruoloDi(g, daUid);
  if (ruolo !== 'capitano' && ruolo !== 'ufficiale') return { errore: 'Solo capitano e ufficiali rifiutano.' };
  const i = g.richieste.findIndex(r => r.uid === uidRichiesta);
  if (i < 0) return { errore: 'Richiesta non trovata.' };
  g.richieste.splice(i, 1);
  return { gilda: g };
}

function lascia(id, uid, t = Date.now()) {
  const g = gilde.get(id);
  if (!g) return { errore: 'Fratellanza sconosciuta.' };
  const m = g.membri.find(x => x.uid === uid);
  if (!m) return { errore: 'Non sei della Fratellanza.' };
  if (m.ruolo === 'capitano') return { errore: 'Il capitano non abbandona: può solo sciogliere.' };
  g.membri = g.membri.filter(x => x.uid !== uid);
  annota(g, `🌊 ${m.nome} ha lasciato la Fratellanza`, t);
  return { gilda: g };
}

function promuovi(id, uidMembro, daUid, t = Date.now()) {
  const g = gilde.get(id);
  if (!g) return { errore: 'Fratellanza sconosciuta.' };
  if (ruoloDi(g, daUid) !== 'capitano') return { errore: 'Solo il capitano promuove.' };
  const m = g.membri.find(x => x.uid === uidMembro);
  if (!m || m.ruolo !== 'marinaio') return { errore: 'Si promuovono i marinai.' };
  m.ruolo = 'ufficiale';
  annota(g, `⭐ ${m.nome} è ora ufficiale`, t);
  return { gilda: g };
}

function espelli(id, uidMembro, daUid, t = Date.now()) {
  const g = gilde.get(id);
  if (!g) return { errore: 'Fratellanza sconosciuta.' };
  const ruolo = ruoloDi(g, daUid);
  const m = g.membri.find(x => x.uid === uidMembro);
  if (!m) return { errore: 'Non è della Fratellanza.' };
  const puo = ruolo === 'capitano' ? m.ruolo !== 'capitano'
    : ruolo === 'ufficiale' ? m.ruolo === 'marinaio' : false;
  if (!puo) return { errore: 'Non hai i galloni per espellerlo.' };
  g.membri = g.membri.filter(x => x.uid !== uidMembro);
  annota(g, `⚓ ${m.nome} è stato sbarcato`, t);
  return { gilda: g, espulso: m };
}

function sciogli(id, daUid) {
  const g = gilde.get(id);
  if (!g) return { errore: 'Fratellanza sconosciuta.' };
  if (ruoloDi(g, daUid) !== 'capitano') return { errore: 'Solo il capitano scioglie.' };
  gilde.delete(id);
  return { gilda: g, sciolta: true };
}

// la scheda pubblica: niente uid in giro per i client
function scheda(g) {
  return {
    id: g.id, nome: g.nome, tag: g.tag, motto: g.motto, categoria: g.categoria,
    bandiera: g.bandiera, aperta: g.aperta, fondata: g.fondata,
    membri: g.membri.map(m => ({ nome: m.nome, ruolo: m.ruolo })),
    log: g.log.slice(0, 12),
  };
}

module.exports = {
  FONDAZIONE, MEMBRI_MAX, SFIDA_GIORNI, CATEGORIE, BANDIERA,
  setGilde, tutte, get, diUid, ruoloDi, annota, sanificaBandiera,
  fonda, richiedi, approva, rifiuta, lascia, promuovi, espelli, sciogli, scheda,
};
