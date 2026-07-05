// I dizionari it/en (issue #33). Crescono componente per componente insieme
// all'audit #32: qui c'è ciò che è già stato estratto (a parità di stringa IT).
// Registrazione per effetto: importare './dict.js' popola i18n.
//
// Componenti coperti finora: plancia (topbar) + selettore lingua.

import { addDict } from './i18n.js';

const it = {
  // --- plancia (topbar) ---
  'course.aria': 'Traccia la rotta: indirizzo di un sito o una ricerca',
  'course.ph': 'Dove facciamo rotta, capitano? (wikipedia.org — o una ricerca)',
  'course.submit': '🧭 Traccia la rotta',
  'gold.aria': 'monete d\'oro: ',
  'gazzetta.aria': 'Gazzetta del Corsaro',
  'gazzetta.title': 'La Gazzetta del Corsaro — le notizie del mare',
  'registro.aria': 'Registro delle Collezioni',
  'registro.title': 'Il Registro delle Collezioni — ciò che hai conquistato',
  'help.aria': 'Manuale del Corsaro',
  'help.title': 'Il Manuale del Corsaro — come funziona Maremagnum',
  'settings.aria': 'Impostazioni di bordo',
  'settings.title': 'Impostazioni di bordo',
  'guard.title': 'Parassiti respinti dalla Ciurma di Guardia (tracker e pubblicità bloccati)',
};

const en = {
  // --- helm (topbar) ---
  'course.aria': 'Chart a course: a site address or a search',
  'course.ph': 'Where to, captain? (wikipedia.org — or a search)',
  'course.submit': '🧭 Chart the course',
  'gold.aria': 'gold coins: ',
  'gazzetta.aria': 'The Corsair\'s Gazette',
  'gazzetta.title': 'The Corsair\'s Gazette — news from the sea',
  'registro.aria': 'Register of Collections',
  'registro.title': 'The Register of Collections — what you have won',
  'help.aria': 'The Corsair\'s Handbook',
  'help.title': 'The Corsair\'s Handbook — how Maremagnum works',
  'settings.aria': 'Ship settings',
  'settings.title': 'Ship settings',
  'guard.title': 'Parasites repelled by the Watch Crew (trackers and ads blocked)',
};

addDict(it, en);
