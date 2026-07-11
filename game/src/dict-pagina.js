// Il dizionario della PAGINA (i18n fetta 1): plancia, banchina, HUD,
// pannelli e pergamene — tutto il telaio statico di index.html.
// L'italiano è la lingua sorgente (parità con il testo storico); l'inglese
// è la voce di bordo per l'utenza larga (default, ordine del capitano).

import { addDict } from './i18n.js';

const it = {
  'pagina.titolo': 'Maremagnum — il mare dell\'internet',
  'stage.aria': 'Il mare di gioco',
  'stage.descrizione': 'Vista dall\'alto del Mare dell\'Internet: la tua nave, le isole-sito e le navi degli altri corsari. Lo stato che conta — vita, oro, missione, eventi, approdi — è annunciato dai pannelli dell\'interfaccia. I comandi sono nel Manuale del Corsaro (bottone «Manuale» in alto) e si possono rimappare nelle Impostazioni di bordo.',

  // azioni comuni
  'azione.salpa': '⛵ Salpa',
  'azione.salpaEscl': '⛵ Salpa!',
  'azione.chiudi': 'Chiudi',
  'azione.conferma': 'Conferma',

  // plancia
  'diario.aria': 'Diario del Capitano',
  'diario.title': 'Il Diario del Capitano — imprese, bacheca e cronache del mare',
  'alleanza.aria': 'Alleanze temporanee',
  'alleanza.title': 'Le Alleanze temporanee — unisci le vele per un dungeon ostico',

  // banchina
  'dock.indietro.aria': 'Indietro nel sito',
  'dock.indietro': 'Indietro',
  'dock.avanti.aria': 'Avanti nel sito',
  'dock.avanti': 'Avanti',
  'dock.ricarica.aria': 'Ricarica il sito',
  'dock.ricarica': 'Ricarica',
  'dock.preferito.aria': 'Segna come approdo preferito',
  'dock.preferito.title': 'Approdo preferito: al prossimo varo potrai salpare da qui',
  'dock.esterno.aria': 'Apri il sito nel browser di sistema',
  'dock.esterno': 'Apri nel browser di sistema',

  // HUD
  'hud.vita.aria': 'Integrità della nave',
  'hud.ricariche.aria': 'Ricarica di cannoni e abilità (le barre si riempiono quando sono pronti)',
  'hud.munizione.aria': 'Munizione caricata',
  'hud.hint': 'Vela <b>W A S D</b> · Bordata sin. <b>Q</b> / des. <b>E</b> · Prua/Poppa <b>SPAZIO</b> · Abilità <b>R</b> · Attracca <b>F</b> · Zoom <b>Z</b> · Classifica <b>TAB</b>',
  'hud.minimappa.aria': 'Minimappa del mare: isole e navi in vista',
  'hud.vento.aria': 'Rosa dei venti',
  'hud.killfeed.aria': 'Diario di bordo',
  'board.titolo': '☠ Registro dei Corsari',
  'map.aria': 'Mappa del tesoro: la rotta è tracciata',

  // Cantiere
  'shop.titolo': '🛠 Cantiere del Porto Franco',
  'shop.sub': 'Scafo rattoppato e stive piene. Crediti a bordo: <b id="shopGold"></b> 🪙',
  'shop.tabs.aria': 'Le sezioni del Cantiere',
  'shop.tab.nave': '⛵ Nave',
  'shop.tab.varo': '⚓ Varo',
  'shop.tab.armi': '⚔ Armamenti',
  'shop.tab.livree': '🎨 Livree',
  'shop.tab.ciurma': '🏴‍☠️ Ciurma',
  'shop.assedi': '⚔ Bacheca degli Assedi',
  'shop.fratellanze': '🏴 Fratellanze',

  // Assedi
  'assedio.titolo': '⚔ Bacheca degli Assedi',
  'assedio.ruoli': '🏴 I Corridori forzano il blocco della fortezza — ⚓ i Bloccatori lo difendono',
  'assedio.corridori': '🏴 Corridori',
  'assedio.bloccatori': '⚓ Bloccatori',

  // Oracolo
  'oracolo.titolo': '🔭 Il Faro dell\'Oracolo',
  'oracolo.sub': 'Chiedi, e l\'Oracolo indicherà la rotta fra i sette mari.',
  'oracolo.cerca.aria': 'Cosa cerchi',
  'oracolo.cerca.ph': 'Cosa cerchi, capitano?',
  'oracolo.chiedi': 'Chiedi',
  'oracolo.salta': '⛵ Salpa senza chiedere',

  // Attraccato
  'sito.titolo': '⚓ Attraccato',
  'sito.sub': 'Nel guscio browser il sito si apre qui dentro; nel prototipo web si apre in una nuova scheda.',
  'sito.apri': '🗺 Apri il sito in una nuova scheda',
  'sito.preferito': '☆ Segna come approdo preferito',

  // Affondamento
  'morte.titolo': '☠️ La tua nave è affondata!',
  'morte.ritorno': 'I flutti ti riportano al Porto Franco per le riparazioni…',

  // Impostazioni
  'imp.titolo': '⚙ Impostazioni di bordo',
  'imp.musica': '🎵 Musica del mare',
  'imp.sfx': '🔊 Effetti sonori',
  'imp.guardia': '🛡 Ciurma di Guardia — respinge spie e pubblicità',
  'imp.volume': '🔉 Volume',
  'imp.volume.aria': 'Volume di musica ed effetti',
  'imp.calma': '🌊 Mare calmo — riduci scosse e movimenti di contorno',
  'imp.notte': '🌙 Notte chiara — più luce nelle ore buie',
  'imp.timoneria': '⌨ La timoneria — rimappa i tasti',
  'imp.timoneria.sub': 'Scegli tu i tasti del timone. Le frecce governano sempre, ESC chiude sempre.',
  'imp.ancora': '⚓ Ancoraggio del profilo',
  'imp.ancora.stato': 'Il tuo bottino vive solo su questa nave. Getta l\'ancora per salvarlo in mare aperto.',
  'imp.ancora.nome.aria': 'Nome dell\'ancoraggio',
  'imp.ancora.nome.ph': 'nome o mail — non la verifichiamo',
  'imp.ancora.getta': '⚓ Getta l\'ancora',
  'imp.ancora.qr': 'Inquadra con la tua app di autenticazione,<br>o inserisci la chiave a mano: <code id="ancoraSegreto"></code>',
  'imp.ancora.regole': 'Niente password, niente email di conferma. Se perdi il generatore perdi il forziere;<br>dopo 30 giorni senza entrare, il mare si riprende tutto.',

  // ancoraggio (campi comuni)
  'ancora.codice.aria': 'Codice a 6 cifre dall\'app di autenticazione',
  'ancora.codice.ph': 'codice a 6 cifre',
  'ancora.nome.aria': 'Nome d\'ancoraggio',
  'ancora.nome.ph': 'nome d\'ancoraggio',

  // Fratellanze
  'gilda.titolo': '🏴 Le Fratellanze',
  'gilda.rito': 'Il rito è tutto corsaro: per chiedere l\'ingresso devi prima <b>bloccare</b> una nave della Fratellanza. Il diritto conquistato vale 7 giorni. Serve l\'Ancoraggio.',
  'gilda.fonda.titolo': '⚓ Fonda la tua Fratellanza',
  'gilda.nome.ph': 'nome (3-24)',
  'gilda.nome.aria': 'Nome della Fratellanza',
  'gilda.tag.aria': 'Tag della Fratellanza (2-5 lettere)',
  'gilda.motto.ph': 'motto (facoltativo)',
  'gilda.motto.aria': 'Motto della Fratellanza',
  'gilda.categoria': 'Categoria',
  'gilda.categoria.aria': 'Categoria della Fratellanza',
  'gilda.aperta': 'Porte aperte (ammissione automatica)',
  'gilda.bandiera.aria': 'Anteprima della bandiera',
  'gilda.fonda': '🏴 Fonda la Fratellanza',

  // Diario
  'diario.titolo': '📖 Diario del Capitano',
  'diario.tabs.aria': 'Sezioni del Diario',
  'diario.imprese': '⚔ Imprese',
  'diario.cronache': '🗞 Cronache',

  // Alleanze
  'alleanza.titolo': '🤝 Le Alleanze temporanee',
  'alleanza.sub': 'Unisci le vele con altri corsari per un dungeon ostico: quando le difese cadono, la <b>squadra si spartisce il bottino</b>. L\'alleanza dura la sessione — chi sbarca ne è fuori. E la polvere non guarda in faccia nessuno: <b>anche i colpi degli alleati feriscono</b>.',
  'alleanza.presenti': '⚓ Capitani in mare',
  'alleanza.cerca.aria': 'Cerca un capitano per nome',
  'alleanza.cerca.ph': 'cerca un capitano per nome…',

  // Registro
  'registro.titolo': '🏆 Il Registro delle Collezioni',
  'registro.sub': 'Ciò che hai conquistato, scoperto e collezionato — la tua leggenda, agli atti.',

  // Da dove salpiamo
  'salpa.titolo': '⛵ Da dove salpiamo, capitano?',
  'salpa.sub': 'I tuoi approdi preferiti ti aspettano.',

  // Benvenuto
  'benvenuto.sub': 'L\'internet è un mare magnum: vasto, profondo e infestato di corsari.<br>Con che nome solcherai le onde?',
  'benvenuto.nome.aria': 'Il tuo nome di corsaro',
  'benvenuto.holancora': 'Ho già un ancoraggio',
  'benvenuto.gesto': 'Là sopra c\'è la barra della rotta: scrivi un sito qualsiasi<br>e diventa un\'isola da raggiungere — navigare È navigare.',
  'benvenuto.qr': 'Il tuo ancoraggio è <b id="benvenutoHandle"></b>.<br>Inquadralo con la tua app di autenticazione (Google Authenticator, Aegis, 1Password…):<br>il codice a 6 cifre ti farà rientrare nelle prossime sessioni.',
  'benvenuto.chiave': 'Chiave manuale: <code id="benvenutoSegreto"></code>',
  'benvenuto.gettaesalpa': '⚓ Getta l\'ancora e salpa',
  'benvenuto.salta': 'Salpa senza ancora — il bottino resterà solo su questa nave',
  'benvenuto.entra.sub': 'Bentornato, capitano. Nome d\'ancoraggio e codice dalla tua app.',
  'benvenuto.entra': '⛵ Entra',
  'benvenuto.nuovo': 'Sono nuovo da queste acque',

  // riscatto dell'isola
  'riscatto.dominio.aria': 'Dominio della tua isola',
  'riscatto.contatto.aria': 'Recapito: email o nome d\'ancoraggio',
  'riscatto.contatto.ph': 'come ti raggiungiamo (mail o ancoraggio)',
  'riscatto.prenota': '👑 Prenota il riscatto',

  // Manuale (testata; le sezioni vivono in dict-manuale.js)
  'man.titolo': '📜 Il Manuale del Corsaro',
  'man.sub': 'L\'internet è un mare magnum. Questo è un browser che lo prende alla lettera.',
};

const en = {
  'pagina.titolo': 'Maremagnum — the sea of the internet',
  'stage.aria': 'The game sea',
  'stage.descrizione': 'Top-down view of the Sea of the Internet: your ship, the site-islands and the other corsairs\' ships. Everything that matters — health, gold, missions, events, moorings — is announced by the interface panels. Controls are in the Corsair\'s Handbook (the "Handbook" button up top) and can be remapped in the Ship Settings.',

  'azione.salpa': '⛵ Set sail',
  'azione.salpaEscl': '⛵ Set sail!',
  'azione.chiudi': 'Close',
  'azione.conferma': 'Confirm',

  'diario.aria': 'Captain\'s Log',
  'diario.title': 'The Captain\'s Log — feats, mission board and chronicles of the sea',
  'alleanza.aria': 'Temporary alliances',
  'alleanza.title': 'Temporary Alliances — join sails for a tough dungeon',

  'dock.indietro.aria': 'Back within the site',
  'dock.indietro': 'Back',
  'dock.avanti.aria': 'Forward within the site',
  'dock.avanti': 'Forward',
  'dock.ricarica.aria': 'Reload the site',
  'dock.ricarica': 'Reload',
  'dock.preferito.aria': 'Mark as favourite mooring',
  'dock.preferito.title': 'Favourite mooring: next launch you can set sail from here',
  'dock.esterno.aria': 'Open the site in your system browser',
  'dock.esterno': 'Open in system browser',

  'hud.vita.aria': 'Ship integrity',
  'hud.ricariche.aria': 'Cannon and ability reload (bars fill when ready)',
  'hud.munizione.aria': 'Loaded ammunition',
  'hud.hint': 'Sails <b>W A S D</b> · Port broadside <b>Q</b> / starboard <b>E</b> · Bow/Stern <b>SPACE</b> · Ability <b>R</b> · Dock <b>F</b> · Zoom <b>Z</b> · Leaderboard <b>TAB</b>',
  'hud.minimappa.aria': 'Sea minimap: islands and ships in sight',
  'hud.vento.aria': 'Compass rose',
  'hud.killfeed.aria': 'Ship\'s log',
  'board.titolo': '☠ Corsairs\' Register',
  'map.aria': 'Treasure map: the course is charted',

  'shop.titolo': '🛠 Free Port Shipyard',
  'shop.sub': 'Hull patched and holds full. Credits aboard: <b id="shopGold"></b> 🪙',
  'shop.tabs.aria': 'Shipyard sections',
  'shop.tab.nave': '⛵ Ship',
  'shop.tab.varo': '⚓ Launch',
  'shop.tab.armi': '⚔ Armaments',
  'shop.tab.livree': '🎨 Liveries',
  'shop.tab.ciurma': '🏴‍☠️ Crew',
  'shop.assedi': '⚔ Siege Board',
  'shop.fratellanze': '🏴 Brotherhoods',

  'assedio.titolo': '⚔ Siege Board',
  'assedio.ruoli': '🏴 Runners force the fortress blockade — ⚓ Blockers defend it',
  'assedio.corridori': '🏴 Runners',
  'assedio.bloccatori': '⚓ Blockers',

  'oracolo.titolo': '🔭 The Oracle\'s Lighthouse',
  'oracolo.sub': 'Ask, and the Oracle shall point the course across the seven seas.',
  'oracolo.cerca.aria': 'What are you looking for',
  'oracolo.cerca.ph': 'What are you looking for, captain?',
  'oracolo.chiedi': 'Ask',
  'oracolo.salta': '⛵ Sail on without asking',

  'sito.titolo': '⚓ Docked',
  'sito.sub': 'In the browser shell the site opens right here; in the web prototype it opens in a new tab.',
  'sito.apri': '🗺 Open the site in a new tab',
  'sito.preferito': '☆ Mark as favourite mooring',

  'morte.titolo': '☠️ Your ship has sunk!',
  'morte.ritorno': 'The waves carry you back to Free Port for repairs…',

  'imp.titolo': '⚙ Ship Settings',
  'imp.musica': '🎵 Sea music',
  'imp.sfx': '🔊 Sound effects',
  'imp.guardia': '🛡 Watch Crew — repels trackers and ads',
  'imp.volume': '🔉 Volume',
  'imp.volume.aria': 'Music and effects volume',
  'imp.calma': '🌊 Calm sea — reduce shakes and side motion',
  'imp.notte': '🌙 Bright night — more light in the dark hours',
  'imp.timoneria': '⌨ The helm — remap the keys',
  'imp.timoneria.sub': 'Choose your own helm keys. Arrows always steer, ESC always closes.',
  'imp.ancora': '⚓ Profile Anchorage',
  'imp.ancora.stato': 'Your loot lives only on this ship. Drop anchor to save it on the open sea.',
  'imp.ancora.nome.aria': 'Anchorage name',
  'imp.ancora.nome.ph': 'name or email — we don\'t verify it',
  'imp.ancora.getta': '⚓ Drop anchor',
  'imp.ancora.qr': 'Scan with your authenticator app,<br>or enter the key by hand: <code id="ancoraSegreto"></code>',
  'imp.ancora.regole': 'No passwords, no confirmation emails. Lose the generator and you lose the chest;<br>after 30 days without logging in, the sea takes everything back.',

  'ancora.codice.aria': '6-digit code from your authenticator app',
  'ancora.codice.ph': '6-digit code',
  'ancora.nome.aria': 'Anchorage name',
  'ancora.nome.ph': 'anchorage name',

  'gilda.titolo': '🏴 The Brotherhoods',
  'gilda.rito': 'The rite is pure corsair: to ask for admission you must first <b>disable</b> a ship of that Brotherhood. The earned right lasts 7 days. Anchorage required.',
  'gilda.fonda.titolo': '⚓ Found your Brotherhood',
  'gilda.nome.ph': 'name (3-24)',
  'gilda.nome.aria': 'Brotherhood name',
  'gilda.tag.aria': 'Brotherhood tag (2-5 letters)',
  'gilda.motto.ph': 'motto (optional)',
  'gilda.motto.aria': 'Brotherhood motto',
  'gilda.categoria': 'Category',
  'gilda.categoria.aria': 'Brotherhood category',
  'gilda.aperta': 'Open doors (automatic admission)',
  'gilda.bandiera.aria': 'Flag preview',
  'gilda.fonda': '🏴 Found the Brotherhood',

  'diario.titolo': '📖 Captain\'s Log',
  'diario.tabs.aria': 'Log sections',
  'diario.imprese': '⚔ Feats',
  'diario.cronache': '🗞 Chronicles',

  'alleanza.titolo': '🤝 Temporary Alliances',
  'alleanza.sub': 'Join sails with other corsairs for a tough dungeon: when the defences fall, the <b>crew splits the loot</b>. The alliance lasts the session — whoever goes ashore is out. And gunpowder plays no favourites: <b>allied shots hurt too</b>.',
  'alleanza.presenti': '⚓ Captains at sea',
  'alleanza.cerca.aria': 'Search for a captain by name',
  'alleanza.cerca.ph': 'search for a captain by name…',

  'registro.titolo': '🏆 The Register of Collections',
  'registro.sub': 'What you have conquered, discovered and collected — your legend, on record.',

  'salpa.titolo': '⛵ Where do we sail from, captain?',
  'salpa.sub': 'Your favourite moorings await.',

  'benvenuto.sub': 'The internet is a mare magnum: vast, deep and infested with corsairs.<br>Under what name will you ride the waves?',
  'benvenuto.nome.aria': 'Your corsair name',
  'benvenuto.holancora': 'I already have an anchorage',
  'benvenuto.gesto': 'Up there is the course bar: type any website<br>and it becomes an island to reach — browsing IS sailing.',
  'benvenuto.qr': 'Your anchorage is <b id="benvenutoHandle"></b>.<br>Scan it with your authenticator app (Google Authenticator, Aegis, 1Password…):<br>the 6-digit code will let you back in next sessions.',
  'benvenuto.chiave': 'Manual key: <code id="benvenutoSegreto"></code>',
  'benvenuto.gettaesalpa': '⚓ Drop anchor and set sail',
  'benvenuto.salta': 'Sail without an anchor — your loot will live only on this ship',
  'benvenuto.entra.sub': 'Welcome back, captain. Anchorage name and code from your app.',
  'benvenuto.entra': '⛵ Enter',
  'benvenuto.nuovo': 'I\'m new to these waters',

  'riscatto.dominio.aria': 'Your island\'s domain',
  'riscatto.contatto.aria': 'Contact: email or anchorage name',
  'riscatto.contatto.ph': 'how we reach you (email or anchorage)',
  'riscatto.prenota': '👑 Book the claim',

  'man.titolo': '📜 The Corsair\'s Handbook',
  'man.sub': 'The internet is a mare magnum. This is a browser that takes it literally.',
};

addDict(it, en);
