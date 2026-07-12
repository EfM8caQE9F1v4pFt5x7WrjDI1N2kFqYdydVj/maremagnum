'use strict';

// La lingua del MARE (i18n fetta 2): i template ITALIANI dei messaggi che il
// server compone — FONTE UNICA. Il server ci fabbrica `msg` (l'italiano resta
// la lingua dei test, dell'albo legacy e il fallback), e spedisce ANCHE la
// chiave `k` + i parametri `p` additivi: ogni client compone nella propria
// lingua (il bundle importa questo CJS via esbuild e ci affianca l'inglese
// in dict-mare.js).
//
// Convenzione dei parametri: un parametro `X` può arrivare come `X_k`
// (chiave da risolvere nel dizionario: npc.merc, tipo.goletta, mostro.drago)
// con l'eventuale `X_d` (il {d} della chiave, per le isole: isola.k.com +
// X_d='Cumino' → «Isola di Cumino»). componi() li risolve in italiano; il
// client fa lo stesso con t().

const IT = {
  // — nomi: NPC, mostri, tipi, isole, armi, munizioni —
  'npc.merc': 'Mercantile',
  'npc.ghost': 'Corsaro Fantasma',
  'npc.cacciatore': 'Cacciatore di Taglie',
  'npc.convoglio.capo': 'Mercantile di Convoglio',
  'npc.convoglio.scorta': 'Scorta del Convoglio',
  'npc.tesoro.capo': 'Galeone del Tesoro',
  'npc.tesoro.scorta': 'Guardia del Tesoro',
  'mostro.drago': 'Drago di Mare',
  'mostro.kraken': 'Kraken',
  'mostro.serpente': 'Serpente Abissale',
  'tipo.goletta': 'Goletta',
  'tipo.guerra': 'Brigantino da Guerra',
  'tipo.galeone': 'Galeone',
  'tipo.sciabecco': 'Sciabecco',
  'isola.porto': 'Porto Franco',
  'isola.oracolo': "Faro dell'Oracolo",
  'isola.fortezza': 'Fortezza Proibita di {d}',
  'isola.k.com': 'Isola di {d}',
  'isola.k.org': 'Atollo di {d}',
  'isola.k.net': 'Arcipelago di {d}',
  'isola.k.it': 'Scoglio di {d}',
  'isola.k.edu': 'Accademia di {d}',
  'isola.k.gov': 'Bastione di {d}',
  'isola.k.io': 'Isolotto di {d}',
  'isola.k.dev': 'Cala di {d}',
  'isola.k.ai': 'Laguna di {d}',
  'arma.colubrina': 'Colubrina',
  'arma.cannone': 'Cannone da 24',
  'arma.carronata': 'Carronata',
  'arma.mortaio': 'Mortaio',
  'arma.organo': 'Organo di Da Vinci',
  'arma.lunga': 'Colubrina Lunga',
  'arma.pesante': 'Carronata Pesante',
  'arma.falconetto': 'Falconetto a Ripetizione',
  'munizione.palle': 'Palle piene',
  'munizione.catene': 'Palle incatenate',
  'munizione.mitraglia': 'Mitraglia',
  'abilita.goletta.nome': 'Speronamento',
  'abilita.guerra.nome': 'Fumogeno',
  'abilita.galeone.nome': 'Bordata Doppia',
  'abilita.sciabecco.nome': 'Colpo di Vento',
  'abilita.goletta.effetto': 'carichi per {durata}s e speroni: {dmg} danni al bersaglio, {autodanno} al tuo legno',
  'abilita.guerra.effetto': 'una cortina di fumo ({durata}s): dentro, fantasmi e torri non ti prendono di mira',
  'abilita.galeone.effetto': 'per {durata}s ogni bocca spara il doppio, con le canne subito fresche',
  'abilita.sciabecco.effetto': 'scatto a vele piene per {durata}s: agganci un duello, o te ne sganci',
  'motto.goletta': 'Chi fugge vive per combattere domani',
  'motto.guerra': 'La matrice di sempre',
  'motto.galeone': 'La fortezza che naviga',
  'motto.sciabecco': 'Il mare non ha muri',

  // — la Ciurma (#16): i quindici del roster e le vie d'arruolo —
  'pirata.mozzo': 'Ugo «il Mozzo»',
  'pirata.cuoca': 'Rosa «la Cuoca»',
  'pirata.nostromo': 'Bruno «il Nostromo»',
  'pirata.vedetta': 'Lena «la Vedetta»',
  'pirata.mastrodascia': "Tobia «Mastro d'Ascia»",
  'pirata.bucaniera': 'Morgana «la Bucaniera»',
  'pirata.gabbiere': 'Ciro «il Gabbiere»',
  'pirata.polena': 'Dante «Polena»',
  'pirata.mezzamiccia': 'Bice «Mezzamiccia»',
  'pirata.timoniere': 'Salvo «il Timoniere»',
  'pirata.filodifumo': 'Filippo «Filo di Fumo»',
  'pirata.sergente': 'Ada «la Sergente»',
  'pirata.ammiraglia': "Bianca «l'Ammiraglia»",
  'pirata.corsaro': 'Tariq «il Corsaro»',
  'pirata.senzanome': 'Il Capitano Senzanome',
  'pirata.via.base': 'Ciurma di partenza',
  'pirata.via.scafo': 'Si arruola a Scafo {lvl}',
  'pirata.via.ciurma': 'Si arruola col punto Ciurma {lvl}',
  'pirata.via.varo': 'Si arruola varando: {tipo}',
  'pirata.via.campagna': 'Si guadagna compiendo una campagna del Mastro',

  // — il feed di bordo —
  'feed.salpato': "⚓ {nome} è salpato nel Mare dell'Internet",
  'feed.terraferma': '{nome} è tornato sulla terraferma',
  'feed.ripescato': '💰 {nome} ha ripescato il bottino del fuggiasco (+{oro} 🪙)',
  'feed.varato': '⚓ {nome} ha varato: ora naviga su un {tipo}!',
  'feed.taglia': '⚔ Una taglia pende su {nome}: un Cacciatore gli dà la caccia!',
  'feed.saccheggio': '⚓ {nome} ha saccheggiato {preda} (+{oro} 🪙)',
  'feed.resa': '🏳 {preda} ammaina bandiera: chi lo tocca lo saccheggia!',
  'feed.svincolato': '⛵ {nome} si è svincolato dal blocco',
  'feed.difeseFortezza': '🏰 Le difese di {isola} sono cadute!',
  'feed.difeseDungeon': '⚔ Le difese di {isola} sono cadute!',
  'feed.mareaRitira': '⚓ La marea si ritira da {isola}: le difese del Mastro svaniscono.',
  'feed.ricostruita': '🏰 {isola} è stata ricostruita. Il blocco è di nuovo attivo.',
  'kill.riga': '💥 {killer} ha affondato {victim}!',

  // — i mostri —
  'mostro.rituffa': '🌊 {mostro} si rituffa negli abissi.',
  'mostro.emerge': '🌊 {mostro} EMERGE dagli abissi sotto {preda}!',
  'mostro.tracce': '🌊 {mostro} fa perdere le proprie tracce negli abissi.',
  'mostro.ombra': "🌊 Un'ombra enorme si gonfia sotto la chiglia di {preda}...",
  'mostro.abbattuto': '🐉⚔ {nome} ha abbattuto il {mostro}! (+{oro} 🪙)',

  // — le carovane —
  'carovana.convoglio.salpato': '🚢 Un convoglio scortato è salpato: da {da} verso {a}, stive piene!',
  'carovana.convoglio.salpatoVia': '🚢 Un convoglio scortato è salpato: da {da} verso {a} con scalo a {via}, stive piene!',
  'carovana.convoglio.scalo': '⚓ Il convoglio fa scalo a {qui}: riparte a breve verso {poi}.',
  'carovana.convoglio.arrivo': '⚓ Il convoglio è giunto sano e salvo a {a}.',
  'carovana.convoglio.perduto': '🌊 Il mercantile di convoglio è perduto: la scorta, orfana, dà la caccia ai colpevoli.',
  'carovana.tesoro.salpato': '👑 IL GALEONE DEL TESORO è salpato: da {da} verso {a} — scorta serrata, stive d\'oro!',
  'carovana.tesoro.salpatoVia': '👑 IL GALEONE DEL TESORO è salpato: da {da} verso {a} con scalo a {via} — scorta serrata, stive d\'oro!',
  'carovana.tesoro.scalo': '👑 Il Galeone del Tesoro fa scalo a {qui}: riparte a breve verso {poi}.',
  'carovana.tesoro.arrivo': '👑 Il Galeone del Tesoro è giunto al sicuro a {a}: l\'oro è sbarcato.',
  'carovana.tesoro.perduto': '🌊 Il Galeone del Tesoro è negli abissi col suo oro: la Guardia, orfana, cerca vendetta.',
  'caccia.rinuncia': "⚔ Il Cacciatore rinuncia: {nome} l'ha fatta franca.",
  'feed.svuotato': '💰 {nome} ha svuotato le stive: {preda} alleggerito!',

  // — le voci della Gazzetta —
  'fuga.annuncio': '💰 {nome} è FUGGITO dalla battaglia staccando la spina: {oro} 🪙 galleggiano dove ammainava!',
  'gilda.fondata': '🏴 {nome} ha fondato la Fratellanza «{gnome}» [{tag}] ({cat})',
  'gilda.entrato': '⛵ {nome} è entrato nella Fratellanza «{gnome}» [{tag}]',
  'gilda.ammesso': '⛵ {nome} è stato ammesso nella Fratellanza «{gnome}» [{tag}]',
  'gilda.sciolta': '🌊 La Fratellanza «{gnome}» [{tag}] è stata sciolta',
  'campagna.compiuta': '⚔ {nome} ha compiuto la campagna "{cnome}"! (+{oro} 🪙)',
  'livrea.sfoggio': '🎨 {nome} sfoggia una livrea nuova: "{lnome}"!',
  'espugnazione.annuncio': '🏰⚔️ {nome} ha ESPUGNATO {isola}! Il blocco è caduto.',
  'espugnazione.alleanza': '🏰⚔️ L\'alleanza di {nomi} ha ESPUGNATO {isola}! Il blocco è caduto. (+{oro} 🪙 a testa)',
  'dungeon.alleanza': '⚔ L\'alleanza di {nomi} ha espugnato il dungeon del giorno "{dnome}" su {isola}! (+{oro} 🪙 a testa)',
  'dungeon.solo': '⚔ {nome} ha espugnato il dungeon del giorno "{dnome}" su {isola}! (+{oro} 🪙)',
  'arrembaggio.annuncio': '⚔ {chi} ha ABBORDATO {preda}!',
  'arrembaggio.annuncioOro': '⚔ {chi} ha ABBORDATO {preda}! (+{oro} 🪙)',
  'nome.ilmare': 'Il mare',

  // — le causali dell'oro —
  'oro.riscatto': 'Il Cantiere ha riscattato: {armi}',
  'oro.ripescato': 'Bottino del fuggiasco ripescato!',
  'oro.fondata': 'La Fratellanza «{gnome}» è fondata',
  'oro.campagna': 'Campagna "{cnome}" compiuta!',
  'oro.scoperta': 'Terra scoperta!',
  'oro.saccheggio': 'Hai saccheggiato {preda} senza colpo ferire!',
  'oro.espugnata': 'Hai espugnato {isola}!',
  'oro.dungeon': 'Dungeon del giorno espugnato: "{dnome}"!',
  'oro.bloccato': 'Bloccato! Un quarto del forziere in gioco è del vincitore',
  'oro.blocco': "Hai bloccato {preda}: toccala per l'arrembaggio!",
  'oro.arrembaggio': 'Arrembaggio! Il forziere di {preda} è tuo',
  'oro.affondataDa': 'Hai affondato {preda}!',
  'oro.doppiofondo': 'Il doppiofondo della stiva ha salvato qualcosa',
  'oro.alvincitore': 'Il forziere è del vincitore',

  'oro.abbordatoSalvo': 'Abbordato! Il doppiofondo ha salvato qualcosa',
  'oro.abbordato': 'Abbordato! Il forziere è del vincitore',
  'oro.missione': 'Missione del giorno compiuta: {desc}',
  'oro.tris1': 'Tris del giorno! (strike di {n} giorno)',
  'oro.tris': 'Tris del giorno! (strike di {n} giorni)',
  'oro.settimana': 'Settimana piena: il tris tutti i giorni!',
  'feed.missione': '📜 {nome} ha compiuto una missione del giorno (+{oro} 🪙)',
  'feed.tris': '🌟 {nome} ha compiuto il tris del giorno (strike ×{n})',
  'feed.settimana': '👑 {nome} ha compiuto la settimana piena (+{oro} 🪙)',
  'feed.assedio': '⚔️ {nome} ha bandito un Assedio! Presentarsi alla Bacheca del Porto.',

  // — le tappe delle campagne del Mastro (meccanica code-owned) —
  'tappa.mercantili': 'Affonda {n} Mercantili',
  'tappa.scoperte': 'Scopri {n} isole mai visitate',
  'tappa.fantasmi': 'Affonda {n} Corsari Fantasma',
  'tappa.espugnazione': 'Espugna le difese di {b}',
  'tappa.espugnazioneFortezza': 'Espugna una Fortezza Proibita',

  // — le missioni del giorno (composte dal client per chiave) —
  'missione.tld': "Attracca a un'isola .{tld}",
  'missione.discover': 'Scopri {n} isole mai visitate',
  'missione.merc': 'Affonda 2 mercantili',
  'missione.ghost': 'Affonda un Corsaro Fantasma',
};

// risolve i parametri `X_k`/`X_d` e interpola {x} nel template italiano
function componi(chiave, p) {
  const pp = {};
  if (p) {
    for (const k in p) {
      if (k.endsWith('_k')) {
        const nome = k.slice(0, -2);
        let s = IT[p[k]] || p[k];
        if (p[nome + '_d'] != null) s = s.split('{d}').join(p[nome + '_d']);
        pp[nome] = s;
      } else if (!k.endsWith('_d')) {
        pp[k] = p[k];
      }
    }
  }
  let s = IT[chiave] || chiave;
  for (const k in pp) s = s.split('{' + k + '}').join(pp[k]);
  return s;
}

module.exports = { IT, componi };
