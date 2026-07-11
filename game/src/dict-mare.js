// La lingua del MARE, lato client (i18n fetta 2): l'italiano arriva dalla
// FONTE UNICA del server (lingua-mare.js, CJS che esbuild ingloba), qui c'è
// l'inglese — e i ferri del mestiere: tMsg() risolve i parametri X_k/X_d
// nella lingua corrente, nomeIsola() compone i toponimi.

import { addDict, t } from './i18n.js';
import LINGUA from '../../server/lingua-mare.js';

const en = {
  // — nomi —
  'npc.merc': 'Merchant',
  'npc.ghost': 'Ghost Corsair',
  'npc.cacciatore': 'Bounty Hunter',
  'npc.convoglio.capo': 'Convoy Merchant',
  'npc.convoglio.scorta': 'Convoy Escort',
  'npc.tesoro.capo': 'Treasure Galleon',
  'npc.tesoro.scorta': 'Treasure Guard',
  'mostro.drago': 'Sea Dragon',
  'mostro.kraken': 'Kraken',
  'mostro.serpente': 'Abyssal Serpent',
  'tipo.goletta': 'Schooner',
  'tipo.guerra': 'War Brigantine',
  'tipo.galeone': 'Galleon',
  'tipo.sciabecco': 'Xebec',
  'isola.porto': 'Free Port',
  'isola.oracolo': "The Oracle's Lighthouse",
  'isola.fortezza': 'Forbidden Fortress of {d}',
  'isola.k.com': '{d} Island',
  'isola.k.org': '{d} Atoll',
  'isola.k.net': '{d} Archipelago',
  'isola.k.it': '{d} Rock',
  'isola.k.edu': '{d} Academy',
  'isola.k.gov': '{d} Bastion',
  'isola.k.io': '{d} Islet',
  'isola.k.dev': '{d} Cove',
  'isola.k.ai': '{d} Lagoon',
  'arma.colubrina': 'Culverin',
  'arma.cannone': '24-pounder Cannon',
  'arma.carronata': 'Carronade',
  'arma.mortaio': 'Mortar',
  'arma.organo': "Da Vinci's Organ",
  'arma.lunga': 'Long Culverin',
  'arma.pesante': 'Heavy Carronade',
  'arma.falconetto': 'Repeating Falconet',
  'munizione.palle': 'Round shot',
  'munizione.catene': 'Chain shot',
  'munizione.mitraglia': 'Grapeshot',
  'abilita.goletta.nome': 'Ram',
  'abilita.guerra.nome': 'Smokescreen',
  'abilita.galeone.nome': 'Double Broadside',
  'abilita.sciabecco.nome': 'Gust of Wind',
  'abilita.goletta.effetto': 'you charge for {durata}s and ram: {dmg} damage to the target, {autodanno} to your own timber',
  'abilita.guerra.effetto': 'a smoke curtain ({durata}s): inside, ghosts and towers cannot target you',
  'abilita.galeone.effetto': 'for {durata}s every gun fires double, with barrels instantly fresh',
  'abilita.sciabecco.effetto': 'a full-sail dash for {durata}s: you catch a duel, or slip away from one',
  'motto.goletta': 'He who flees lives to fight tomorrow',
  'motto.guerra': 'The timeless template',
  'motto.galeone': 'The fortress that sails',
  'motto.sciabecco': 'The sea has no walls',

  // — the Crew (#16): the fifteen of the roster and how they sign on —
  'pirata.mozzo': 'Ugo "the Cabin Boy"',
  'pirata.cuoca': 'Rosa "the Cook"',
  'pirata.nostromo': 'Bruno "the Bosun"',
  'pirata.vedetta': 'Lena "the Lookout"',
  'pirata.mastrodascia': 'Tobia "the Shipwright"',
  'pirata.bucaniera': 'Morgana "the Buccaneer"',
  'pirata.gabbiere': 'Ciro "the Topman"',
  'pirata.polena': 'Dante "Figurehead"',
  'pirata.mezzamiccia': 'Bice "Short Fuse"',
  'pirata.timoniere': 'Salvo "the Helmsman"',
  'pirata.filodifumo': 'Filippo "Wisp of Smoke"',
  'pirata.sergente': 'Ada "the Sergeant"',
  'pirata.ammiraglia': 'Bianca "the Flagship"',
  'pirata.corsaro': 'Tariq "the Corsair"',
  'pirata.senzanome': 'The Nameless Captain',
  'pirata.via.base': 'Founding crew',
  'pirata.via.scafo': 'Signs on at Hull {lvl}',
  'pirata.via.ciurma': 'Signs on with Crew point {lvl}',
  'pirata.via.varo': 'Signs on when you launch: {tipo}',
  'pirata.via.campagna': "Earned by completing a Pathmaster campaign",

  // — il feed di bordo —
  'feed.salpato': '⚓ {nome} has set sail on the Sea of the Internet',
  'feed.terraferma': '{nome} has gone ashore',
  'feed.ripescato': "💰 {nome} fished out the runaway's loot (+{oro} 🪙)",
  'feed.varato': '⚓ {nome} launched: now sailing a {tipo}!',
  'feed.taglia': '⚔ A bounty hangs over {nome}: a Hunter is on the trail!',
  'feed.saccheggio': '⚓ {nome} plundered {preda} (+{oro} 🪙)',
  'feed.resa': '🏳 {preda} strikes its colours: whoever touches it plunders it!',
  'feed.svincolato': '⛵ {nome} broke free of the blockade',
  'feed.difeseFortezza': '🏰 The defences of {isola} have fallen!',
  'feed.difeseDungeon': '⚔ The defences of {isola} have fallen!',
  'feed.mareaRitira': "⚓ The tide recedes from {isola}: the Pathmaster's defences vanish.",
  'feed.ricostruita': '🏰 {isola} has been rebuilt. The blockade is active again.',
  'kill.riga': '💥 {killer} sank {victim}!',

  // — i mostri —
  'mostro.rituffa': '🌊 {mostro} dives back into the abyss.',
  'mostro.emerge': '🌊 {mostro} SURFACES from the abyss beneath {preda}!',
  'mostro.tracce': '🌊 {mostro} vanishes without a trace into the abyss.',
  'mostro.ombra': '🌊 An enormous shadow swells beneath the keel of {preda}...',
  'mostro.abbattuto': '🐉⚔ {nome} slew the {mostro}! (+{oro} 🪙)',

  // — le carovane —
  'carovana.convoglio.salpato': '🚢 An escorted convoy has set sail: from {da} to {a}, holds full!',
  'carovana.convoglio.salpatoVia': '🚢 An escorted convoy has set sail: from {da} to {a} calling at {via}, holds full!',
  'carovana.convoglio.scalo': '⚓ The convoy calls at {qui}: departing shortly for {poi}.',
  'carovana.convoglio.arrivo': '⚓ The convoy has arrived safe and sound at {a}.',
  'carovana.convoglio.perduto': '🌊 The convoy merchant is lost: its escort, orphaned, hunts the culprits.',
  'carovana.tesoro.salpato': '👑 THE TREASURE GALLEON has set sail: from {da} to {a} — close guard, holds of gold!',
  'carovana.tesoro.salpatoVia': '👑 THE TREASURE GALLEON has set sail: from {da} to {a} calling at {via} — close guard, holds of gold!',
  'carovana.tesoro.scalo': '👑 The Treasure Galleon calls at {qui}: departing shortly for {poi}.',
  'carovana.tesoro.arrivo': '👑 The Treasure Galleon has arrived safely at {a}: the gold is ashore.',
  'carovana.tesoro.perduto': '🌊 The Treasure Galleon lies in the abyss with its gold: the Guard, orphaned, seeks revenge.',
  'caccia.rinuncia': '⚔ The Hunter gives up: {nome} got away with it.',
  'feed.svuotato': '💰 {nome} emptied the holds: {preda} relieved of its cargo!',

  // — le voci della Gazzetta —
  'fuga.annuncio': '💰 {nome} FLED the battle by pulling the plug: {oro} 🪙 float where they struck their colours!',
  'gilda.fondata': '🏴 {nome} founded the Brotherhood «{gnome}» [{tag}] ({cat})',
  'gilda.entrato': '⛵ {nome} joined the Brotherhood «{gnome}» [{tag}]',
  'gilda.ammesso': '⛵ {nome} was admitted into the Brotherhood «{gnome}» [{tag}]',
  'gilda.sciolta': '🌊 The Brotherhood «{gnome}» [{tag}] has been dissolved',
  'campagna.compiuta': '⚔ {nome} completed the campaign "{cnome}"! (+{oro} 🪙)',
  'livrea.sfoggio': '🎨 {nome} shows off a new livery: "{lnome}"!',
  'espugnazione.annuncio': '🏰⚔️ {nome} STORMED {isola}! The blockade has fallen.',
  'dungeon.alleanza': '⚔ The alliance of {nomi} stormed the daily dungeon "{dnome}" on {isola}! (+{oro} 🪙 each)',
  'dungeon.solo': '⚔ {nome} stormed the daily dungeon "{dnome}" on {isola}! (+{oro} 🪙)',
  'arrembaggio.annuncio': '⚔ {chi} BOARDED {preda}!',
  'arrembaggio.annuncioOro': '⚔ {chi} BOARDED {preda}! (+{oro} 🪙)',
  'nome.ilmare': 'The sea',

  // — le causali dell'oro —
  'oro.riscatto': 'The Shipyard bought back: {armi}',
  'oro.ripescato': "Runaway's loot fished out!",
  'oro.fondata': 'The Brotherhood «{gnome}» is founded',
  'oro.campagna': 'Campaign "{cnome}" completed!',
  'oro.scoperta': 'Land discovered!',
  'oro.saccheggio': 'You plundered {preda} without firing a shot!',
  'oro.espugnata': 'You stormed {isola}!',
  'oro.dungeon': 'Daily dungeon stormed: "{dnome}"!',
  'oro.bloccato': 'Disabled! A quarter of the chest in play goes to the victor',
  'oro.blocco': 'You disabled {preda}: touch it for the boarding!',
  'oro.arrembaggio': "Boarding! {preda}'s chest is yours",
  'oro.affondataDa': 'You sank {preda}!',
  'oro.doppiofondo': "The hold's false bottom saved something",
  'oro.alvincitore': 'The chest goes to the victor',
  'oro.abbordatoSalvo': 'Boarded! The false bottom saved something',
  'oro.abbordato': 'Boarded! The chest goes to the victor',
  'oro.missione': 'Daily mission completed: {desc}',
  'oro.tris1': 'Daily treble! ({n}-day streak)',
  'oro.tris': 'Daily treble! ({n}-day streak)',
  'oro.settimana': 'Full week: the treble every single day!',
  'feed.missione': '📜 {nome} completed a daily mission (+{oro} 🪙)',
  'feed.tris': '🌟 {nome} completed the daily treble (streak ×{n})',
  'feed.settimana': '👑 {nome} completed the full week (+{oro} 🪙)',
  'feed.assedio': '⚔️ {nome} called a Siege! Report to the Port board.',

  // — le tappe delle campagne del Mastro —
  'tappa.mercantili': 'Sink {n} Merchants',
  'tappa.scoperte': 'Discover {n} never-visited islands',
  'tappa.fantasmi': 'Sink {n} Ghost Corsairs',
  'tappa.espugnazione': 'Storm the defences of {b}',
  'tappa.espugnazioneFortezza': 'Storm a Forbidden Fortress',

  // — le missioni del giorno —
  'missione.tld': 'Dock at a .{tld} island',
  'missione.discover': 'Discover {n} never-visited islands',
  'missione.merc': 'Sink 2 merchants',
  'missione.ghost': 'Sink a Ghost Corsair',
};

addDict(LINGUA.IT, en);

// compone un messaggio A CHIAVE nella lingua corrente, risolvendo i
// parametri X_k (chiave annidata) e X_d (il {d} della chiave-isola)
export function tMsg(chiave, p) {
  const pp = {};
  if (p) {
    for (const k in p) {
      if (k.endsWith('_k')) {
        const nome = k.slice(0, -2);
        pp[nome] = t(p[k], p[nome + '_d'] != null ? { d: p[nome + '_d'] } : undefined);
      } else if (!k.endsWith('_d')) {
        pp[k] = p[k];
      }
    }
  }
  return t(chiave, pp);
}

// il toponimo di un'isola nella lingua corrente (nk/nd dal server); le
// isole d'annata senza chiave restano col loro nome storico
export function nomeIsola(i) {
  if (!i) return '';
  return i.nk ? t('isola.' + i.nk, i.nd != null ? { d: i.nd } : undefined) : (i.name || '');
}

// il nome di una nave nella lingua corrente: gli NPC per chiave (nk),
// i capitani veri col loro nome
export function nomeNave(s) {
  return s && s.nk ? t(s.nk) : (s && s.name) || '';
}
