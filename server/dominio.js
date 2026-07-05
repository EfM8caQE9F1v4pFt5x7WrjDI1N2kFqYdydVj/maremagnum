'use strict';

// Il dominio registrabile (eTLD+1) è la carta d'identità di un'isola:
// it.wikipedia.org, m.wikipedia.org e www.wikipedia.org sono la STESSA
// isola — wikipedia.org (issue #26: basta doppioni sulla mappa).
// Senza imbarcare la Public Suffix List intera, una lista compatta dei
// suffissi a due livelli copre le acque battute davvero; i TLD diversi
// (wikipedia.it vs wikipedia.org) restano isole DISTINTE per scelta:
// registrazioni diverse, proprietari potenzialmente diversi (riscatto #1).

const SUFFISSI2 = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'net.uk', 'me.uk', 'ltd.uk', 'plc.uk',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br',
  'com.ar', 'com.mx', 'gob.mx', 'com.co', 'com.pe', 'com.ve', 'com.uy',
  'co.nz', 'net.nz', 'org.nz', 'co.za', 'org.za', 'web.za',
  'co.in', 'net.in', 'org.in', 'ac.in', 'gov.in',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'com.hk', 'com.tw', 'com.sg', 'com.my', 'co.th',
  'co.kr', 'or.kr', 'ac.kr', 'com.tr', 'com.ua', 'com.pl', 'com.gr', 'com.pt',
  'com.eg', 'com.ng', 'co.il', 'org.il', 'ac.il',
]);

function dominioBase(host) {
  const parti = String(host || '').toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);
  if (parti.length <= 2) return parti.join('.');
  const coda2 = parti.slice(-2).join('.');
  const n = SUFFISSI2.has(coda2) ? 3 : 2;
  return parti.slice(-n).join('.');
}

module.exports = { dominioBase, SUFFISSI2 };
