// Multilingua fatto in casa (issue #33), in sinergia col restyle #32.
// Dizionari it/en + t(chiave, params). La UI statica porta marcatori
// data-i18n* (li applica applyI18n); le stringhe dinamiche chiamano t().
//
// L'ITALIANO è la lingua SORGENTE: una chiave mancante ricade sull'italiano,
// mai su una chiave nuda. Le stringhe si estraggono a PARITÀ (l'IT resta
// identico a prima) mentre l'audit #32 tocca ogni componente.

const DICT = { it: {}, en: {} };
let lang = 'it';
const listeners = new Set();

// i componenti registrano le proprie stringhe (vedi dict.js)
export function addDict(it, en) {
  Object.assign(DICT.it, it || {});
  Object.assign(DICT.en, en || {});
}

export function getLang() { return lang; }
// endonimi: il nome di ogni lingua NELLA lingua stessa (non si traduce)
export function langs() { return [['it', 'Italiano'], ['en', 'English']]; }

export function t(key, params) {
  let s = (DICT[lang] && DICT[lang][key] != null) ? DICT[lang][key]
    : (DICT.it[key] != null ? DICT.it[key] : key);
  if (params) for (const k in params) s = String(s).split('{' + k + '}').join(params[k]);
  return s;
}

// default: profilo → ?lang= → INGLESE (ordine del capitano, i18n fetta 1:
// si punta all'utenza larga; l'italiano si sceglie col toggle e resta
// ricordato nel profilo come le altre preferenze di bordo)
export function initLang(profileLang) {
  const q = new URLSearchParams(location.search).get('lang');
  const scelta = profileLang || q || 'en';
  lang = scelta === 'it' ? 'it' : 'en';
  document.documentElement.lang = lang;
}

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'it';
  document.documentElement.lang = lang;
  applyI18n();
  for (const fn of listeners) fn(lang);
}

export function onLang(fn) { listeners.add(fn); }

// applica i marcatori del DOM statico: testo, aria-label, title, placeholder
// e — per i paragrafi del Manuale coi grassetti — html (SOLO stringhe dei
// dizionari: mai contenuto utente dentro data-i18n-html)
export function applyI18n(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.setAttribute('title', t(el.dataset.i18nTitle));
  for (const el of root.querySelectorAll('[data-i18n-ph]')) el.setAttribute('placeholder', t(el.dataset.i18nPh));
}
