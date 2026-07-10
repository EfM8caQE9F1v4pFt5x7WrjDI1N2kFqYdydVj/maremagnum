'use strict';

// Collaudo end-to-end del Maremagnum su Cloudflare: salute, assets, mare via
// WebSocket, e l'intero flusso d'Ancoraggio (TOTP calcolato qui in Node con
// lo stesso algoritmo del Worker).
// Uso: node scripts/test-cf.js https://maremagnum.maremagnum.workers.dev

const crypto = require('crypto');
const WebSocket = require('ws');

const BASE = process.argv[2] || 'https://maremagnum.maremagnum.workers.dev';
const WS = BASE.replace('https://', 'wss://') + '/mare';
const ok = (m) => console.log(`  ✅ ${m}`);
const die = (m) => { console.error(`  ❌ ${m}`); process.exit(1); };

function b32decode(str) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const out = [];
  for (const ch of str.toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    value = (value << 5) | A.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

function totp(secretB32, tMs = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(tMs / 30000)));
  const mac = crypto.createHmac('sha1', b32decode(secretB32)).update(counter).digest();
  const off = mac[mac.length - 1] & 0x0f;
  const code = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

function joinMare(nome, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS);
    const esito = { welcome: null, ws };
    const timer = setTimeout(() => reject(new Error('welcome mai arrivato')), 15000);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name: nome, profile: {}, token })));
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      // il Mastro (#36/#38) manda campagna e dungeon del giorno subito dopo il
      // welcome: si annotano man mano — il ws resta aperto per verificarli
      if (m.t === 'campagna') esito.campagna = m.stato || null;
      if (m.t === 'dungeon') esito.dungeon = m.stato || null;
      if (m.t === 'welcome') { clearTimeout(timer); esito.welcome = m; resolve(esito); }
    });
    ws.on('error', reject);
  });
}

async function main() {
  console.log(`— Collaudo di ${BASE}`);

  const salute = await (await fetch(BASE + '/salute')).json();
  if (!salute.ok) die('salute non ok');
  ok(`salute: mare ${salute.mare.mare}, ciurma ${salute.mare.ciurma}`);

  const home = await fetch(BASE + '/');
  if (!(await home.text()).includes('Maremagnum')) die('client web non servito');
  ok('client web servito dagli assets');

  // mare: join anonimo
  const anonimo = await joinMare('Collaudatore');
  if (!anonimo.welcome.islands || anonimo.welcome.you.gold == null) die('welcome incompleto');
  ok(`mare aperto: ${anonimo.welcome.islands.length} isole, oro iniziale ${anonimo.welcome.you.gold}`);

  // il Mastro di Rotte deve salpare SUBITO (issue #36): auto-seed al risveglio,
  // niente attesa del cron del lunedì — la campagna arriva al join, non solo in Gazzetta
  await new Promise(r => setTimeout(r, 1200)); // lascia arrivare il messaggio {t:'campagna'}
  const camp = anonimo.campagna;
  if (!camp || !camp.nome || !Array.isArray(camp.tappe) || !camp.tappe.length) {
    die('il Mastro non ha mandato la campagna al join: auto-seed non attivo?');
  }
  ok(`Mastro di Rotte: campagna «${camp.nome}» al join (${camp.tappe.length} tappe, premio ${camp.premio} 🪙)`);
  // il dungeon del giorno (#38): stesso auto-seed, obiettivo singolo con bersaglio reale
  const dun = anonimo.dungeon;
  if (!dun || !dun.nome) die('il Mastro non ha mandato il dungeon del giorno al join (#38)');
  ok(`Dungeon del giorno «${dun.nome}»${dun.bersaglio ? ' → ' + dun.bersaglio : ''} [${dun.difficolta}, ${dun.premio} 🪙]`);
  anonimo.ws.close();

  // ancoraggio: nuovo → conferma (TOTP) → entra
  const handle = 'collaudo-' + Date.now().toString(36);
  const nuovo = await (await fetch(BASE + '/ancora/nuovo', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle }),
  })).json();
  if (!nuovo.segreto || !nuovo.otpauth) die('nuovo ancoraggio fallito: ' + JSON.stringify(nuovo));
  ok(`bozza d'ancoraggio per "${handle}" (otpauth pronto per il QR)`);

  const conferma = await (await fetch(BASE + '/ancora/conferma', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle, codice: totp(nuovo.segreto) }),
  })).json();
  if (!conferma.token) die('conferma fallita: ' + JSON.stringify(conferma));
  ok('TOTP accettato: ancoraggio creato, token di sessione ricevuto');

  const sbagliato = await (await fetch(BASE + '/ancora/entra', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle, codice: '000000' }),
  })).json();
  if (!sbagliato.errore) die('un codice sbagliato è stato accettato!');
  ok('codice errato respinto');

  // join ancorato: il nome autorevole arriverà dal profilo salvato
  const ancorato = await joinMare('NomeCasualeCheVerraSovrascritto', conferma.token);
  ok(`join ancorato riuscito (oro ${ancorato.welcome.you.gold})`);
  ancorato.ws.close();
  await new Promise(r => setTimeout(r, 2500)); // lascia salvare il profilo al congedo

  const entra = await (await fetch(BASE + '/ancora/entra', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle, codice: totp(nuovo.segreto) }),
  })).json();
  if (!entra.token) die('login fallito: ' + JSON.stringify(entra));
  if (!entra.profilo || entra.profilo.gold == null) die('profilo non persistito: ' + JSON.stringify(entra));
  ok(`login da "altro dispositivo": profilo persistito (oro ${entra.profilo.gold}, nave ${entra.profilo.name})`);

  // lucchetto anti-bruteforce: 5 errori → 429
  for (let i = 0; i < 5; i++) {
    await fetch(BASE + '/ancora/entra', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle, codice: '111111' }),
    });
  }
  const bloccato = await (await fetch(BASE + '/ancora/entra', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle, codice: totp(nuovo.segreto) }),
  })).json();
  if (!bloccato.errore || !bloccato.errore.includes('riposa')) die('lucchetto anti-bruteforce non attivo: ' + JSON.stringify(bloccato));
  ok('lucchetto anti-bruteforce: dopo 5 errori anche il codice giusto riposa 15 minuti');

  const atlante = await (await fetch(BASE + '/atlante')).json();
  if (!atlante.isole) die('atlante non risponde');
  ok(`atlante pubblico attivo (${Object.keys(atlante.isole).length} isole sopra la soglia di anonimato)`);

  // la rada del riscatto: segnale valido accolto, dominio farlocco respinto
  const risc = await (await fetch(BASE + '/riscatto', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dominio: 'collaudo.example.com', contatto: 'collaudo@esempio.it' }),
  })).json();
  if (!risc.ok || risc.dominio !== 'collaudo.example.com') die('riscatto non accolto: ' + JSON.stringify(risc));
  ok(`riscatto in rada per ${risc.dominio} (posto n° ${risc.posto})`);
  const riscNo = await fetch(BASE + '/riscatto', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dominio: 'senza-punto', contatto: 'x' }),
  });
  if (riscNo.status !== 400) die('riscatto: dominio non valido non respinto');
  ok('riscatto: dominio senza punto respinto (400)');

  console.log('\nCOLLAUDO CLOUDFLARE VERDE ☁️⚓');
}

main().catch((e) => die(e.message));
