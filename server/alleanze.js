'use strict';

// Le Alleanze temporanee (issue #37): due (o più) corsari presenti nello stesso
// mare uniscono le vele per un dungeon ostico — e domani per il tesoro del
// platform o l'arrembaggio in coppia. Il party è un PRIMITIVO del Game, non un
// attributo del dungeon: effimero come l'assedio (vive nel MareDO, muore quando
// il mare dorme), per ship-id (anche i non-ancorati), senza ruoli né galloni —
// i corsari alleati sono pari. Si forma per invito diretto O per bandiera
// aperta; dura la sessione (finché non si scioglie o si sbarca).
//
// La polvere non guarda in faccia nessuno: il fuoco amico RESTA acceso — il
// tradimento è parte del mestiere, e non serve nemmeno rompere l'alleanza.
//
// L'economia è blindata come da paletto (#38): la quota di spartizione è
// code-owned, mai da fuori. In co-op ogni partecipante incassa
// premio/N + bonus fisso (25% del premio): spartizione piratesca, ma cooperare
// non è mai in perdita secca. La diga contro il farming resta il tetto
// per-nave-per-periodo (dungeonGiorno), non la spartizione.

const ALLEANZA = {
  max: 4,        // tetto membri: una scialuppa, non una flotta
  invitoTtl: 90, // secondi di validità di un invito
  bonus: 0.25,   // il bonus alleanza: quota = premio/N + premio*bonus
  colpoTtl: 240, // un colpo alle difese "conta" per questa finestra (s)
};

// La quota SPENDIBILE di ogni alleato partecipante quando le difese cadono.
// Da soli (o alleati ma unici a sparare) resta il premio pieno di sempre.
function quotaAlleanza(premio, n) {
  const p = Math.max(0, premio | 0);
  if (!(n > 1)) return p;
  return Math.round(p / n) + Math.round(p * ALLEANZA.bonus);
}

class Alleanze {
  constructor(game) {
    this.game = game;
    this.alleanze = new Map(); // id -> { id, membri: Set<shipId>, aperta }
    this.nextId = 1;
  }

  di(ship) {
    return (ship && ship.alleanzaId && this.alleanze.get(ship.alleanzaId)) || null;
  }

  membriDi(a) {
    const out = [];
    for (const id of a.membri) {
      const s = this.game.ships.get(id);
      if (s) out.push(s);
    }
    return out;
  }

  handle(ship, msg) {
    if (ship.npc) return;
    switch (msg.t) {
      case 'alleanzaInvita': this.invita(ship, String(msg.id || '').slice(0, 24)); break;
      case 'alleanzaAccetta': this.accetta(ship, String(msg.id || '').slice(0, 24)); break;
      case 'alleanzaRifiuta': this.rifiuta(ship, String(msg.id || '').slice(0, 24)); break;
      case 'alleanzaLascia': this.lascia(ship); break;
      case 'alleanzaApri': this.apri(ship); break;
      case 'alleanzaChiudi': this.chiudi(ship); break;
      case 'alleanzaUnisciti': this.unisciti(ship, String(msg.id || '').slice(0, 24)); break;
    }
  }

  toast(ship, msg) { this.game.sendTo(ship, { t: 'toast', msg: '🤝 ' + msg }); }

  // l'invito diretto: da un capitano a un altro presente nello stesso mare
  invita(ship, targetId) {
    const target = this.game.ships.get(targetId);
    if (!target || target.npc || target === ship) return;
    // un freno alla grandine di inviti: uno ogni 2 secondi per mittente
    if (ship.invitoAt && this.game.now - ship.invitoAt < 2) return;
    ship.invitoAt = this.game.now;
    const mia = this.di(ship);
    if (mia && mia.membri.size >= ALLEANZA.max) { this.toast(ship, `L'alleanza è al completo (${ALLEANZA.max}).`); return; }
    if (this.di(target)) { this.toast(ship, `${target.name} naviga già sotto un'altra alleanza.`); return; }
    target.invitiAlleanza = target.invitiAlleanza || new Map();
    if (target.invitiAlleanza.size >= 8) { // mai una rada intasata
      for (const [k, fino] of target.invitiAlleanza) if (fino <= this.game.now) target.invitiAlleanza.delete(k);
      if (target.invitiAlleanza.size >= 8) return;
    }
    target.invitiAlleanza.set(ship.id, this.game.now + ALLEANZA.invitoTtl);
    this.game.sendTo(target, { t: 'alleanzaInvito', da: { id: ship.id, nome: ship.name }, ttl: ALLEANZA.invitoTtl });
    this.toast(ship, `Invito lanciato a ${target.name}: si decide entro ${ALLEANZA.invitoTtl}s.`);
  }

  // chi accetta entra nell'alleanza dell'invitante (o la fonda con lui)
  accetta(ship, daId) {
    const fino = ship.invitiAlleanza && ship.invitiAlleanza.get(daId);
    if (!fino) return;
    ship.invitiAlleanza.delete(daId);
    if (fino <= this.game.now) { this.toast(ship, "L'invito è scaduto con la marea."); return; }
    const da = this.game.ships.get(daId);
    if (!da || da.npc) { this.toast(ship, "Quel capitano non è più in mare."); return; }
    if (this.di(ship)) { this.toast(ship, 'Sei già in un\'alleanza: prima sciogli le vele da quella.'); return; }
    let a = this.di(da);
    if (a && a.membri.size >= ALLEANZA.max) { this.toast(ship, `L'alleanza di ${da.name} è al completo.`); return; }
    if (!a) a = this.crea(da);
    this.arruola(a, ship);
    this.game.broadcast({ t: 'feed', msg: `🤝 ${ship.name} e ${da.name} navigano in alleanza!` });
  }

  rifiuta(ship, daId) {
    if (ship.invitiAlleanza) ship.invitiAlleanza.delete(daId);
    const da = this.game.ships.get(daId);
    if (da) this.toast(da, `${ship.name} ha declinato l'alleanza.`);
  }

  // la bandiera aperta: chiunque può unirsi finché c'è posto
  apri(ship) {
    let a = this.di(ship);
    if (a && a.aperta) return;
    if (!a) a = this.crea(ship);
    a.aperta = true;
    this.sendStato(a);
    this.broadcastAperte();
    this.game.broadcast({ t: 'feed', msg: `🤝 ${ship.name} ha issato la bandiera d'alleanza: c'è posto a bordo!` });
  }

  chiudi(ship) {
    const a = this.di(ship);
    if (!a || !a.aperta) return;
    a.aperta = false;
    // una bandiera ammainata da soli non è un'alleanza: si scioglie
    if (a.membri.size < 2) { this.sciogli(a); return; }
    this.sendStato(a);
    this.broadcastAperte();
  }

  unisciti(ship, alleanzaId) {
    const a = this.alleanze.get(alleanzaId);
    if (!a || !a.aperta) { this.toast(ship, 'Quella bandiera non sventola più.'); return; }
    if (this.di(ship)) { this.toast(ship, 'Sei già in un\'alleanza: prima sciogli le vele da quella.'); return; }
    if (a.membri.size >= ALLEANZA.max) { this.toast(ship, `L'alleanza è al completo (${ALLEANZA.max}).`); return; }
    this.arruola(a, ship);
    const nomi = this.membriDi(a).filter(s => s !== ship).map(s => s.name).join(', ');
    this.game.broadcast({ t: 'feed', msg: `🤝 ${ship.name} si è unito all'alleanza di ${nomi}!` });
  }

  lascia(ship) {
    const a = this.di(ship);
    if (!a) return;
    this.sbarca(a, ship);
    this.toast(ship, 'Hai sciolto le vele dall\'alleanza.');
    this.game.broadcast({ t: 'feed', msg: `🌊 ${ship.name} ha rotto l'alleanza` });
  }

  // il congedo silenzioso: chi sbarca (disconnessione) esce e basta
  leave(ship) {
    const a = this.di(ship);
    if (a) this.sbarca(a, ship);
  }

  crea(ship) {
    const a = { id: 'a' + this.nextId++, membri: new Set([ship.id]), aperta: false };
    this.alleanze.set(a.id, a);
    ship.alleanzaId = a.id;
    return a;
  }

  arruola(a, ship) {
    a.membri.add(ship.id);
    ship.alleanzaId = a.id;
    this.sendStato(a);
    if (a.aperta) this.broadcastAperte();
  }

  sbarca(a, ship) {
    a.membri.delete(ship.id);
    ship.alleanzaId = null;
    this.sendStatoA(ship);
    // in uno resta un'alleanza solo la bandiera aperta (sta reclutando);
    // in zero non resta niente
    if (a.membri.size === 0 || (a.membri.size === 1 && !a.aperta)) this.sciogli(a);
    else { this.sendStato(a); if (a.aperta) this.broadcastAperte(); }
  }

  sciogli(a) {
    const rimasti = this.membriDi(a);
    this.alleanze.delete(a.id);
    for (const s of rimasti) {
      s.alleanzaId = null;
      this.sendStatoA(s);
      this.toast(s, "L'alleanza si è sciolta come schiuma.");
    }
    if (a.aperta) this.broadcastAperte();
  }

  // lo stato per un singolo membro (o per chi non è in alleanza: membri null)
  statoPer(ship) {
    const a = this.di(ship);
    return {
      t: 'alleanza',
      membri: a ? this.membriDi(a).map(s => ({ id: s.id, nome: s.name })) : null,
      aperta: a ? !!a.aperta : false,
      max: ALLEANZA.max,
    };
  }

  sendStatoA(ship) { this.game.sendTo(ship, this.statoPer(ship)); }
  sendStato(a) { for (const s of this.membriDi(a)) this.sendStatoA(s); }

  // le bandiere aperte, per il pannello di tutti (broadcast a ogni cambio)
  bandiereAperte() {
    const out = [];
    for (const a of this.alleanze.values()) {
      if (!a.aperta || a.membri.size >= ALLEANZA.max) continue;
      out.push({ id: a.id, nomi: this.membriDi(a).map(s => s.name), posti: ALLEANZA.max - a.membri.size });
    }
    return out;
  }

  broadcastAperte() { this.game.broadcast({ t: 'alleanzeAperte', bandiere: this.bandiereAperte() }); }

  // La SQUADRA dell'assalto: l'eroe del colpo di grazia più gli alleati che
  // hanno battuto le difese di quest'isola di recente (island.assalitori,
  // annotato da damageDefense). Chi guarda da lontano non è in squadra.
  squadra(hero, island) {
    const a = this.di(hero);
    if (!a) return [hero];
    const colpi = island.assalitori;
    const out = [hero];
    for (const id of a.membri) {
      if (id === hero.id) continue;
      const s = this.game.ships.get(id);
      if (!s || s.npc) continue;
      const t = colpi ? colpi.get(id) : undefined;
      if (t !== undefined && this.game.now - t <= ALLEANZA.colpoTtl) out.push(s);
    }
    return out;
  }
}

module.exports = { Alleanze, ALLEANZA, quotaAlleanza };
