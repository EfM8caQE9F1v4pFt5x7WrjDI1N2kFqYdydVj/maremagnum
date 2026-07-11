// I dizionari it/en (issue #33). Registrazione per effetto: importare
// './dict.js' popola i18n con TUTTE le voci — qui la plancia storica, in
// dict-pagina.js il telaio di index.html, in dict-manuale.js il Manuale,
// in dict-bordo.js le stringhe dinamiche di ui.js/main.js (fetta 1).

import { addDict } from './i18n.js';
import './dict-pagina.js';
import './dict-manuale.js';
import './dict-bordo.js';
import './dict-mare.js';

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
