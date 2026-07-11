// Tutta la UI DOM sopra il canvas: barra della rotta, HUD, plance e pergamene.

import { drawTreasureMap } from './mapgen.js';
import { disegnaBandiera, TINTE, TAGLI, EMBLEMI } from './bandiera.js';

const CATEGORIE_GILDA = ['corsari', 'mercanti', 'esploratori', 'accademici', 'guardiani'];

const $ = (id) => document.getElementById(id);

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

// "2 ore fa": il tempo delle notizie, alla buona e in italiano
function faTempo(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return 'adesso';
  if (s < 3600) return `${Math.round(s / 60)} min fa`;
  if (s < 86400) { const h = Math.round(s / 3600); return h === 1 ? "un'ora fa" : `${h} ore fa`; }
  const g = Math.round(s / 86400);
  return g === 1 ? 'ieri' : `${g} giorni fa`;
}

// ordine di priorità degli overlay quando sono impilati (es. Manuale sul Cantiere)
const OVERLAY_ORDINE = ['gildaOverlay', 'alleanzaOverlay', 'gazzettaOverlay', 'registroOverlay', 'helpOverlay', 'settingsOverlay', 'assedioOverlay',
  'mapOverlay', 'shopOverlay', 'searchOverlay', 'siteOverlay', 'deathOverlay', 'salpaOverlay', 'nameOverlay'];

// La disciplina dei pannelli (issue #18): i fluttuanti si ESCLUDONO a vicenda
// (aprirne uno chiude l'altro), quelli di banchina si SOSPENDONO sotto e
// tornano a galla alla chiusura — mai due pannelli impilati a schermo.
const FLUTTUANTI = ['gildaOverlay', 'alleanzaOverlay', 'gazzettaOverlay', 'registroOverlay', 'helpOverlay', 'settingsOverlay', 'assedioOverlay', 'mapOverlay'];
const DI_BANCHINA = ['shopOverlay', 'searchOverlay', 'siteOverlay'];
// I documenti lunghi si aprono dall'INIZIO: fuoco al pannello (2.4.3 resta:
// il fuoco entra comunque nel dialogo), non al primo campo in fondo.
const DALL_INIZIO = ['gildaOverlay', 'alleanzaOverlay', 'gazzettaOverlay', 'registroOverlay', 'helpOverlay', 'settingsOverlay', 'shopOverlay'];

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.deathTimer = null;
    this.mapTimer = null;

    $('courseForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('courseInput').value.trim();
      if (q) this.h.onCourse(q);
      $('courseInput').blur();
    });
    $('sailBtn').addEventListener('click', () => this.hide('mapOverlay'));
    $('shopClose').addEventListener('click', () => this.h.onUndock());
    $('siteClose').addEventListener('click', () => this.h.onUndock());
    $('searchClose').addEventListener('click', () => this.h.onUndock());
    $('setSailBtn').addEventListener('click', () => this.h.onUndock());
    $('searchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('searchInput').value.trim();
      if (q) { this.hide('searchOverlay'); this.h.onSearch(q); }
    });
    $('favBtn').addEventListener('click', () => this.h.onFav());
    $('favBtnSito').addEventListener('click', () => this.h.onFav());
    $('navBack').addEventListener('click', () => this.h.onNavBack());
    $('navFwd').addEventListener('click', () => this.h.onNavFwd());
    $('navReload').addEventListener('click', () => this.h.onNavReload());
    $('openExt').addEventListener('click', () => this.h.onOpenExt());
    $('settingsBtn').addEventListener('click', () => this.show('settingsOverlay'));
    $('settingsClose').addEventListener('click', () => this.hide('settingsOverlay'));
    $('helpBtn').addEventListener('click', () => this.h.onHelp());
    $('helpClose').addEventListener('click', () => this.hide('helpOverlay'));
    $('gazzettaBtn').addEventListener('click', () => this.h.onGazzetta());
    $('gazzettaClose').addEventListener('click', () => this.hide('gazzettaOverlay'));
    $('gildaOpen').addEventListener('click', () => this.h.onFratellanze());
    $('gildaClose').addEventListener('click', () => this.hide('gildaOverlay'));
    // le Alleanze temporanee (issue #37): pannello dal bottone 🤝
    $('alleanzaBtn').addEventListener('click', () => this.h.onAlleanze());
    $('alleanzaClose').addEventListener('click', () => this.hide('alleanzaOverlay'));
    // la ricerca del capitano: filtra l'elenco senza ricostruire il pannello
    $('alleanzaCerca').addEventListener('input', () => this._renderAlleanzaPresenti());
    // il Cantiere a schede (issue #24): meno muro, più bottega
    this._shopScheda = 'nave';
    for (const [id, scheda] of [['tabNave', 'nave'], ['tabVaro', 'varo'], ['tabArmi', 'armi'], ['tabLivree', 'livree']]) {
      $(id).addEventListener('click', () => this._shopMostra(scheda));
    }
    // il Registro delle Collezioni (issue #25): vetrina, si apre ovunque
    $('registroBtn').addEventListener('click', () => this.h.onRegistro());
    $('registroClose').addEventListener('click', () => this.hide('registroOverlay'));
    // l'editor della bandiera: select popolati dai set fissi, anteprima viva
    const scelte = [
      ['gfFondo', 'Campo', TINTE.map(t => t[0])],
      ['gfTaglio', 'Taglio', TAGLI],
      ['gfTinta2', 'Seconda tinta', TINTE.map(t => t[0])],
      ['gfEmblema', 'Emblema', EMBLEMI],
      ['gfTintaEmblema', "Tinta dell'emblema", TINTE.map(t => t[0])],
    ];
    for (const [id, label, voci] of scelte) {
      const wrap = document.createElement('label');
      wrap.textContent = label + ' ';
      const sel = document.createElement('select');
      sel.id = id;
      sel.setAttribute('aria-label', label + ' della bandiera');
      voci.forEach((v, i) => {
        const o = document.createElement('option');
        o.value = i; o.textContent = v;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => this._anteprimaBandiera());
      wrap.appendChild(sel);
      $('gfScelte').appendChild(wrap);
    }
    $('gfTintaEmblema').value = 4; // oro sul nero: si parte già piratissimi
    $('gfEmblema').value = 0;
    this._anteprimaBandiera();
    for (const c of CATEGORIE_GILDA) {
      const o = document.createElement('option');
      o.value = c; o.textContent = c.charAt(0).toUpperCase() + c.slice(1);
      $('gfCategoria').appendChild(o);
    }
    $('gildaFondaForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.h.onGildaFonda({
        nome: $('gfNome').value, tag: $('gfTag').value, motto: $('gfMotto').value,
        categoria: $('gfCategoria').value, aperta: $('gfAperta').checked,
        bandiera: this._bandieraBozza(),
      });
    });
    $('riscattoForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.h.onRiscatto($('riscattoDominio').value.trim(), $('riscattoContatto').value.trim());
    });
    const emitSettings = () => {
      this.h.onSettings({
        music: $('setMusic').checked,
        sfx: $('setSfx').checked,
        guard: $('setGuard').checked,
        calma: $('setCalma').checked,
        notte: $('setNotte').checked,
        volume: $('setVol').valueAsNumber / 100,
      });
    };
    $('setMusic').addEventListener('change', emitSettings);
    $('setSfx').addEventListener('change', emitSettings);
    $('setGuard').addEventListener('change', emitSettings);
    $('setCalma').addEventListener('change', emitSettings);
    $('setNotte').addEventListener('change', emitSettings);
    $('setVol').addEventListener('input', emitSettings);
    $('assedioOpen').addEventListener('click', () => { this.show('assedioOverlay'); });
    $('assedioClose').addEventListener('click', () => this.hide('assedioOverlay'));
    $('joinCorr').addEventListener('click', () => this.h.onAssedioJoin('corridori'));
    $('joinBlocc').addEventListener('click', () => this.h.onAssedioJoin('bloccatori'));

    // click fuori dal pannello = chiudi (solo overlay non distruttivi)
    for (const oid of ['mapOverlay', 'settingsOverlay', 'assedioOverlay', 'helpOverlay', 'gazzettaOverlay', 'alleanzaOverlay']) {
      $(oid).addEventListener('click', (e) => { if (e.target.id === oid) this.hide(oid); });
    }

    // dialoghi: il fuoco entra all'apertura, torna indietro alla chiusura
    // (WCAG 2.4.3) e Tab gira DENTRO il pannello senza mai restare in trappola
    // (2.1.2: ESC chiude sempre)
    this._focusStack = [];
    this._sospeso = null; // pannello di banchina sotto un fluttuante (issue #18)
    addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const panel = this.topPanel();
      if (!panel) return;
      const fuochi = [...panel.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.disabled && el.offsetParent !== null);
      if (!fuochi.length) { e.preventDefault(); return; }
      const primo = fuochi[0], ultimo = fuochi[fuochi.length - 1];
      const dentro = panel.contains(document.activeElement);
      if (!dentro) { e.preventDefault(); primo.focus(); }
      else if (e.shiftKey && document.activeElement === primo) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primo.focus(); }
    });
  }

  topPanel() {
    for (const oid of OVERLAY_ORDINE) {
      const el = $(oid);
      if (el && !el.classList.contains('hidden')) {
        return el.querySelector('[role="dialog"], [role="alertdialog"]') || el;
      }
    }
    return null;
  }

  // il Manuale del Corsaro; se siamo attraccati a un sito, il riscatto
  // parte già compilato con quell'isola
  showHelp(dominio) {
    if (dominio && !$('riscattoDominio').value) $('riscattoDominio').value = dominio;
    $('riscattoEsito').textContent = '';
    this.show('helpOverlay');
  }
  setRiscattoEsito(msg) { $('riscattoEsito').textContent = msg; }

  // ESC: prima libera il timone dai campi di DIGITAZIONE, poi chiude
  // l'overlay in cima (su checkbox e bottoni chiude subito: niente vicoli
  // ciechi da tastiera). Sui pannelli d'attracco equivale a salpare.
  escape() {
    const a = document.activeElement;
    const digitando = a && (a.tagName === 'TEXTAREA' ||
      (a.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'submit'].includes(a.type)));
    if (digitando) { a.blur(); return; }
    for (const oid of ['gazzettaOverlay', 'alleanzaOverlay', 'registroOverlay', 'helpOverlay', 'settingsOverlay', 'assedioOverlay', 'mapOverlay']) {
      if (!$(oid).classList.contains('hidden')) { this.hide(oid); return; }
    }
    for (const oid of ['shopOverlay', 'searchOverlay', 'siteOverlay']) {
      if (!$(oid).classList.contains('hidden')) { this.h.onUndock(); return; }
    }
  }

  show(id) {
    const el = $(id);
    const eraNascosto = el.classList.contains('hidden');
    if (eraNascosto && FLUTTUANTI.includes(id)) {
      for (const oid of FLUTTUANTI) {
        if (oid !== id && !$(oid).classList.contains('hidden')) this.hide(oid);
      }
      for (const oid of DI_BANCHINA) {
        if (!$(oid).classList.contains('hidden')) {
          $(oid).classList.add('hidden'); // sospeso, non chiuso: nessun giro di fuoco
          this._sospeso = oid;
        }
      }
    }
    el.classList.remove('hidden');
    if (eraNascosto && el.classList.contains('overlay')) {
      this._focusStack.push(document.activeElement);
      const panel = el.querySelector('[role="dialog"], [role="alertdialog"]') || el;
      const primo = DALL_INIZIO.includes(id) ? null
        : panel.querySelector('input:not([type="checkbox"]), button');
      if (primo) primo.focus();
      else {
        panel.tabIndex = -1;
        panel.focus();
        panel.scrollTop = 0; // il Manuale si apre dal titolo, non dal modulo in fondo
      }
    }
    this._sipario();
  }
  hide(id) {
    const el = $(id);
    const eraVisibile = !el.classList.contains('hidden');
    el.classList.add('hidden');
    if (eraVisibile && el.classList.contains('overlay')) {
      const prima = this._focusStack.pop();
      if (prima && prima !== document.body && document.contains(prima)) prima.focus();
      else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      // il pannello di banchina sospeso torna a galla
      if (FLUTTUANTI.includes(id) && this._sospeso) {
        $(this._sospeso).classList.remove('hidden');
        this._sospeso = null;
      }
    }
    this._sipario();
  }

  // con un pannello aperto la legenda dei comandi tace (F18): meno rumore
  _sipario() {
    const aperto = OVERLAY_ORDINE.some((oid) => {
      const el = $(oid);
      return el && !el.classList.contains('hidden');
    });
    document.body.classList.toggle('conPannello', aperto);
  }
  // il timone tace quando il fuoco è su un campo (SPAZIO su una casella la
  // spunta, le frecce muovono il volume — non la nave); sui BOTTONI invece
  // solo SPAZIO e INVIO appartengono al bottone: il resto governa
  typing() {
    const a = document.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'
      || a.isContentEditable);
  }
  bottoneAlFuoco() {
    const a = document.activeElement;
    return !!a && (a.tagName === 'BUTTON' || a.tagName === 'A');
  }

  setSettings({ music, sfx, guard, calma, notte, volume }) {
    $('setMusic').checked = music;
    $('setSfx').checked = sfx;
    $('setGuard').checked = guard;
    $('setCalma').checked = !!calma;
    $('setNotte').checked = !!notte;
    $('setVol').value = Math.round(volume * 100);
    $('guardInfo').classList.toggle('spento', !guard);
  }

  // la munizione caricata (#41 fetta 2): emoji + nome dal catalogo del welcome
  setMunizione(tipo, catalogo) {
    const m = (catalogo && catalogo[tipo]) || { emoji: '⚫', name: 'Palle piene' };
    $('munizioneVal').textContent = `${m.emoji} ${m.name}`;
  }

  // l'abilità in corso (#41 fetta 2-bis): la barra R arde finché dura
  setAbilityAttiva(v) {
    $('abilityBar').classList.toggle('attiva', !!v);
  }

  // --- timoneria: tasti rimappabili (WCAG 2.1.4) ---

  setKeymap(l) {
    this.tasti = l;
    $('rlKeyLeft').textContent = `${l.bordataSin} ◀`;
    $('rlKeyRight').textContent = `${l.bordataDes} ▶`;
    $('rlKeyAxial').textContent = `${l.pruaPoppa === 'SPAZIO' ? '␣' : l.pruaPoppa} ⇅`;
    if (this._abilityEmoji) $('abilityKey').textContent = `${l.abilita} ${this._abilityEmoji}`;
    $('munizioneKey').textContent = l.munizione;
    $('hint').innerHTML =
      `Vela <b>${esc(l.su)} ${esc(l.sinistra)} ${esc(l.giu)} ${esc(l.destra)}</b> · ` +
      `Bordata sin. <b>${esc(l.bordataSin)}</b> / des. <b>${esc(l.bordataDes)}</b> · ` +
      `Prua/Poppa <b>${esc(l.pruaPoppa)}</b> · Munizioni <b>${esc(l.munizione)}</b> · Abilità <b>${esc(l.abilita)}</b> · ` +
      `Attracca <b>${esc(l.attracca)}</b> · Zoom <b>${esc(l.zoom)}</b> · Classifica <b>${esc(l.classifica)}</b>`;
  }

  groupLabel(g) {
    const l = this.tasti || { bordataSin: 'Q', bordataDes: 'E', pruaPoppa: 'SPAZIO' };
    return {
      left: `◀ Fiancata sinistra (${l.bordataSin})`,
      right: `▶ Fiancata destra (${l.bordataDes})`,
      bow: `▲ Prua (${l.pruaPoppa})`,
      stern: `▼ Poppa (${l.pruaPoppa})`,
    }[g];
  }

  setTimoneria(azioni) {
    const box = $('tastiRows');
    box.innerHTML = '';
    for (const a of azioni) {
      const row = document.createElement('div');
      row.className = 'tastoRow';
      const nome = document.createElement('span');
      nome.textContent = a.nome;
      const btn = document.createElement('button');
      btn.textContent = a.inAscolto ? 'premi un tasto…' : a.label;
      if (a.inAscolto) btn.className = 'inAscolto';
      btn.setAttribute('aria-label', `Tasto per ${a.nome}: ora ${a.label}. Attiva e premi il nuovo tasto (ESC annulla)`);
      btn.addEventListener('click', () => this.h.onRebind(a.azione));
      row.append(nome, btn);
      box.appendChild(row);
    }
  }

  setGuardCount(n) {
    $('guardInfo').textContent = `🛡 ${n}`;
  }

  setShipName(name) { $('shipName').textContent = name; }
  setGold(v) { $('goldVal').textContent = v; }
  setHp(hp, maxHp) {
    const bar = $('hpBar');
    const frac = Math.max(0, Math.min(1, hp / maxHp));
    bar.style.width = (frac * 100) + '%';
    // tre soglie (#19): il giallo avvisa quando c'è ancora tempo per
    // scappare — i gradienti stanno in style.css coi token, non qui
    bar.classList.toggle('media', frac <= 0.6 && frac > 0.35);
    bar.classList.toggle('critica', frac <= 0.35);
    const v = Math.ceil(hp);
    if (v !== this._hpDetto) {
      this._hpDetto = v;
      $('hpText').textContent = `${v} / ${maxHp}`;
      const wrap = $('hpWrap');
      wrap.setAttribute('aria-valuenow', v);
      wrap.setAttribute('aria-valuemax', maxHp);
    }
  }

  setReloads({ left, right, axial, ability }) {
    $('rlLeft').style.width = (Math.max(0, Math.min(1, left)) * 100) + '%';
    $('rlRight').style.width = (Math.max(0, Math.min(1, right)) * 100) + '%';
    $('rlAxial').style.width = (Math.max(0, Math.min(1, axial)) * 100) + '%';
    if (ability !== undefined) $('abilityBar').style.width = (Math.max(0, Math.min(1, ability)) * 100) + '%';
  }

  // La riga dell'abilità di tipo (tasto R): compare solo dopo il varo.
  setAbility(tipo) {
    const EMO = { goletta: '🐏', guerra: '💨', galeone: '💥', sciabecco: '🌬' };
    this._abilityEmoji = EMO[tipo] || null;
    $('abilityRow').classList.toggle('hidden', !EMO[tipo]);
    if (EMO[tipo]) $('abilityKey').textContent = `${(this.tasti && this.tasti.abilita) || 'R'} ${EMO[tipo]}`;
  }

  setGroupsAvailable({ axial }) {
    $('rlAxialRow').classList.toggle('hidden', !axial);
  }

  setDockHint(text) {
    // solo ai cambi: è una live region, non deve balbettare a ogni frame
    if (this._dockHint === (text || '')) return;
    this._dockHint = text || '';
    $('dockHint').textContent = this._dockHint;
  }

  setAssedio(m) {
    this._assedio = m;
    const hud = $('assedioHud');
    if (!m || !m.phase) {
      hud.classList.add('hidden');
      $('assedioInfo').textContent = 'Nessun assedio in corso. Banditene uno: scegli il tuo ruolo!';
      $('assedioTeams').innerHTML = '';
      $('joinCorr').disabled = $('joinBlocc').disabled = false;
      return;
    }
    const target = m.target ? m.target.name : '?';
    const phases = {
      lobby: `⚔ Assedio a ${target}: in cerca di sfidanti…`,
      countdown: `⚔ Assedio a ${target}: si salpa tra ${m.timeLeft}s!`,
      running: `⚔ ASSEDIO IN CORSO su ${target} — ${m.timeLeft}s`,
    };
    hud.textContent = phases[m.phase] || '';
    hud.classList.remove('hidden');
    $('assedioInfo').textContent = phases[m.phase];
    $('assedioTeams').innerHTML =
      `<div><b>🏴 Corridori</b><br>${m.corridori.map(esc).join('<br>') || '—'}</div>` +
      `<div><b>⚓ Bloccatori</b><br>${m.bloccatori.map(esc).join('<br>') || '—'}</div>`;
    const closed = m.phase === 'running';
    $('joinCorr').disabled = $('joinBlocc').disabled = closed;
  }

  toast(msg, ms = 2600) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add('hidden'), ms);
  }

  feed(msg) {
    const el = document.createElement('div');
    el.className = 'feedItem';
    el.textContent = msg;
    $('killfeed').prepend(el);
    setTimeout(() => el.classList.add('fading'), 5200);
    setTimeout(() => el.remove(), 6400);
    while ($('killfeed').children.length > 6) $('killfeed').lastChild.remove();
  }

  setBoard(rows) { this._board = rows; }
  showBoard(visible) {
    if (!visible) { this.hide('board'); return; }
    const rows = this._board || [];
    $('boardTable').innerHTML = '<tr><th scope="col">Corsaro</th><th scope="col">Affondate</th><th scope="col">Perdute</th><th scope="col">Monete 🪙</th></tr>' +
      rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.gold}</td></tr>`).join('');
    this.show('board');
  }

  showTreasureMap(from, island, url) {
    const canvas = $('mapCanvas');
    const w = Math.min(1060, innerWidth * 0.82);
    canvas.width = w; canvas.height = Math.round(w * 0.62);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Mappa del tesoro: rotta tracciata verso ${island.name}`);
    drawTreasureMap(canvas, { from, island });
    this.show('mapOverlay');
    // niente auto-chiusura: la pergamena resta finché il capitano non salpa
    // (bottone, ESC o click fuori) — è lui a decidere quando ha letto.
  }

  // --- Cantiere ---

  // le schede del Cantiere (issue #24): una alla volta, niente muro
  _shopMostra(scheda) {
    this._shopScheda = scheda;
    $('shopShip').classList.toggle('hidden', scheda !== 'nave');
    $('shopVaro').classList.toggle('hidden', scheda !== 'varo');
    $('shopWeapons').classList.toggle('hidden', scheda !== 'armi');
    $('shopLivree').classList.toggle('hidden', scheda !== 'livree');
    $('tabNave').setAttribute('aria-pressed', scheda === 'nave');
    $('tabVaro').setAttribute('aria-pressed', scheda === 'varo');
    $('tabArmi').setAttribute('aria-pressed', scheda === 'armi');
    $('tabLivree').setAttribute('aria-pressed', scheda === 'livree');
  }

  // il mastro d'ascia consiglia: l'acquisto più grosso che ti puoi
  // permettere ORA; se il forziere non basta, il primo obiettivo utile
  _shopConsiglia(m) {
    const candidati = [];
    const linee = [
      ['Scafo', m.ship.hullCost, 'stat-hull'], ['Vele', m.ship.sailsCost, 'stat-sails'],
      ['Timone', m.ship.helmCost ?? null, 'stat-helm'], ['Ciurma', m.ship.crewCost ?? null, 'stat-crew'],
      ['Stiva', m.ship.holdCost ?? null, 'stat-hold'],
    ];
    for (const [nome, costo, fk] of linee) {
      if (costo !== null && costo !== undefined) candidati.push({ testo: `un punto ${nome}`, costo, fk, scheda: 'nave' });
    }
    for (const [g, data] of Object.entries(m.groups)) {
      for (const s of data.slots) {
        if (s.upCost !== null) candidati.push({ testo: `potenziare la ${s.name} (${this.groupLabel(g)})`, costo: s.upCost, fk: `up-${g}-${s.slot}`, scheda: 'armi' });
        else if (s.replace) candidati.push({ testo: `passare a ${s.replace.name} (${this.groupLabel(g)})`, costo: s.replace.cost, fk: `rep-${g}-${s.slot}`, scheda: 'armi' });
      }
      if (data.nextSlotCost !== null) candidati.push({ testo: `uno slot in più (${this.groupLabel(g)})`, costo: data.nextSlotCost, fk: `slot-${g}`, scheda: 'armi' });
    }
    const box = $('shopConsiglio');
    box.innerHTML = '';
    if (!candidati.length) {
      box.textContent = '👑 La nave è al completo: da qui in poi si fa la leggenda.';
      box.classList.remove('hidden');
      return;
    }
    const abbordabili = candidati.filter(c => c.costo <= m.gold).sort((a, b) => b.costo - a.costo);
    if (abbordabili.length) {
      const c = abbordabili[0];
      const testo = document.createElement('span');
      testo.textContent = `⭐ Il mastro d'ascia consiglia: ${c.testo} · ${c.costo} 🪙 `;
      const vai = document.createElement('button');
      vai.className = 'linkish';
      vai.textContent = 'Portamici';
      vai.setAttribute('aria-label', `Vai a ${c.testo}`);
      vai.addEventListener('click', () => {
        this._shopMostra(c.scheda);
        const el = $('shopOverlay').querySelector(`[data-fk="${c.fk}"]`);
        if (el) { el.focus(); el.classList.add('occhiolino'); setTimeout(() => el.classList.remove('occhiolino'), 1600); }
      });
      box.append(testo, vai);
    } else {
      const c = candidati.sort((a, b) => a.costo - b.costo)[0];
      box.textContent = `🪙 Riempi il forziere: il primo acquisto utile è ${c.testo} a ${c.costo} 🪙 (ne hai ${m.gold}).`;
    }
    box.classList.remove('hidden');
  }

  showShop(m) {
    // il pannello si ricostruisce a ogni acquisto: ricordati dov'era il
    // fuoco della tastiera per rimettercelo (WCAG 2.4.3)
    const fk = document.activeElement && document.activeElement.dataset
      ? document.activeElement.dataset.fk : null;
    $('shopGold').textContent = m.gold;
    const ship = $('shopShip');
    ship.innerHTML = '';
    // l'insegna: col varo la classe è il TIPO scelto; senza, si conquista
    // a colpi di scafo come un tempo
    const h = m.ship.hullLvl, v = m.ship.sailsLvl;
    const tuoTipo = m.varo && m.varo.tipo ? m.varo.tipi[m.varo.tipo] : null;
    const banner = document.createElement('div');
    banner.className = 'shipClass';
    if (tuoTipo) {
      // la scala visiva del tipo (issue #11): scafo e vele al massimo = veterana
      const pieno = h >= 4 && v >= 4;
      const nome = !pieno ? esc(tuoTipo.nome)
        : m.varo.tipo === 'galeone' ? 'Galeone Dorato'
          : m.varo.tipo === 'goletta' ? 'Goletta Veterana'
            : m.varo.tipo === 'guerra' ? 'Brigantino Veterano' : esc(tuoTipo.nome);
      banner.innerHTML = `⚓ La tua nave: <b>${nome}</b> — ${esc(tuoTipo.motto)}`;
    } else {
      const classe = h >= 4 ? (v >= 4 ? 'Galeone Dorato' : 'Galeone') : h >= 2 ? 'Brigantino' : 'Sloop';
      const prossima = h >= 4
        ? (v >= 4 ? 'la regina dei mari: non c\'è legno migliore' : 'con Vele 4 diventa <b>Galeone Dorato</b>')
        : h >= 2 ? 'con Scafo 4 diventa <b>Galeone</b>' : 'con Scafo 2 diventa <b>Brigantino</b>';
      banner.innerHTML = `⚓ La tua nave: <b>${classe}</b> — ${prossima}`;
    }
    ship.appendChild(banner);
    ship.appendChild(this.statRow('🛡 Scafo', 'Legno di quercia, ossa dure', m.ship.hullLvl, 4, m.ship.hullCost, m.gold,
      () => this.h.onBuyShip('hull'), 'stat-hull'));
    ship.appendChild(this.statRow('⛵ Vele', 'Chi fugge vive per combattere domani', m.ship.sailsLvl, 4, m.ship.sailsCost, m.gold,
      () => this.h.onBuyShip('sails'), 'stat-sails'));
    ship.appendChild(this.statRow('☸ Timone', 'Vira come un pesce, non come un tronco', m.ship.helmLvl | 0, 4, m.ship.helmCost ?? null, m.gold,
      () => this.h.onBuyShip('helm'), 'stat-helm'));
    ship.appendChild(this.statRow('💪 Ciurma', 'Più braccia, bordate più fitte', m.ship.crewLvl | 0, 4, m.ship.crewCost ?? null, m.gold,
      () => this.h.onBuyShip('crew'), 'stat-crew'));
    ship.appendChild(this.statRow('🛢 Stiva', 'Un doppiofondo che i vincitori non trovano', m.ship.holdLvl | 0, 4, m.ship.holdCost ?? null, m.gold,
      () => this.h.onBuyShip('hold'), 'stat-hold'));
    const varoBox = $('shopVaro');
    varoBox.innerHTML = '';
    $('tabVaro').classList.toggle('hidden', !m.varo);
    if (m.varo) varoBox.appendChild(this.varoBlock(m.varo, m.gold));
    const livreeBox = $('shopLivree');
    livreeBox.innerHTML = '';
    $('tabLivree').classList.toggle('hidden', !m.negozio);
    if (m.negozio) livreeBox.appendChild(this.livreeBlock(m.negozio, m.gold));
    this._shopConsiglia(m);

    const wep = $('shopWeapons');
    wep.innerHTML = '';
    // l'abilità R spiegata DOVE la si cerca (audit 4): chi pensa «R =
    // potenziamento» apre Armamenti, non il Varo — quindi la risposta
    // sta QUI, in testa: cos'è, cosa fa la TUA, dove si cambia
    const EMOJI_AB = { goletta: '🐏', guerra: '💨', galeone: '💥', sciabecco: '🌬' };
    const abBox = document.createElement('div');
    abBox.className = 'shopRow';
    const mioTipo = m.varo && m.varo.tipo && m.varo.tipi && m.varo.tipi[m.varo.tipo];
    if (mioTipo && mioTipo.abilitaInfo) {
      const i = mioTipo.abilitaInfo;
      const effetto = /[.!?]$/.test(i.effetto.trim()) ? i.effetto.trim() : i.effetto.trim() + '.';
      abBox.innerHTML = `<div class="shopInfo"><b>✦ La tua abilità — tasto R: ${EMOJI_AB[m.varo.tipo] || '✦'} ${esc(i.nome)}</b>
        <span>Effetto MOMENTANEO: ${esc(effetto)} Poi si ricarica (${i.cd}s: la barra R sotto le fiancate).</span>
        <span class="effetti">L'abilità viaggia col TIPO di nave (${esc(mioTipo.nome)}), non coi cannoni: per averne un'altra devi varare un altro tipo.</span></div>`;
    } else {
      abBox.innerHTML = `<div class="shopInfo"><b>✦ Abilità R: non ne hai ancora una</b>
        <span>L'abilità speciale (tasto R) viene col TIPO di nave: scegline uno al Varo e la trovi a bordo.</span></div>`;
    }
    const vaiVaro = document.createElement('button');
    vaiVaro.textContent = '⚓ Cambia al Varo';
    vaiVaro.setAttribute('aria-label', 'Apri la scheda Varo: le abilità si cambiano varando un altro tipo di nave');
    vaiVaro.addEventListener('click', () => this._shopMostra('varo'));
    abBox.appendChild(vaiVaro);
    wep.appendChild(abBox);
    // le altre tre, in una riga sola: si capisce il menu senza cambiare scheda
    if (m.varo && m.varo.tipi) {
      const altre = Object.entries(m.varo.tipi)
        .filter(([k]) => k !== m.varo.tipo)
        .map(([k, t]) => `${EMOJI_AB[k] || '✦'} ${(t.abilitaInfo && t.abilitaInfo.nome) || t.abilita} (${t.nome})`)
        .join(' · ');
      if (altre) {
        const notaAb = document.createElement('p');
        notaAb.className = 'shopNota';
        notaAb.textContent = `✦ Le altre abilità: ${altre} — ognuna viene col suo scafo, la scheda Varo le spiega tutte.`;
        wep.appendChild(notaAb);
      }
    }
    // il ponte fra Cantiere e mare (audit Cantiere): le munizioni si
    // scelgono al timone, ma è QUI che uno se lo chiede
    const nota = document.createElement('p');
    nota.className = 'shopNota';
    nota.textContent = '⚫ In mare ogni bocca spara la munizione scelta col tasto X: palle piene (danno pieno), catene (tagliano le vele), mitraglia (falcidia la ciurma). Il colpo in poppa morde ×1.5. Le esclusive comprate restano nel tuo arsenale: col ⇄ torni al Mortaio e viceversa, gratis.';
    wep.appendChild(nota);
    for (const [g, data] of Object.entries(m.groups)) {
      // il tipo non regge il gruppo (galeone senza assiali): niente vetrina vuota
      if (!data.max && !data.slots.length) continue;
      const block = document.createElement('div');
      block.className = 'wgroup';
      const head = document.createElement('div');
      head.className = 'wgroupHead';
      head.innerHTML = `<b>${this.groupLabel(g)}</b><span>${data.slots.length}/${data.max} slot</span>`;
      block.appendChild(head);
      for (const s of data.slots) {
        const row = document.createElement('div');
        row.className = 'wslot';
        const pips = '●'.repeat(s.lvl) + '○'.repeat(3 - s.lvl);
        // la scheda dell'arma (audit Cantiere): i numeri del livello attuale
        const statRiga = s.stats
          ? `<span class="wstat">${s.stats.dmg} danni · gittata ${s.stats.range} · ricarica ${s.stats.reload}s</span>` : '';
        row.innerHTML = `<div class="wname"><b>${esc(s.name)}</b> <span class="tier">Tier ${ROMAN[s.tier - 1]}</span><span class="pips">${pips}</span>${statRiga}</div>`;
        // la colonna delle azioni (audit Cantiere 2): potenzia/sostituisci
        // E il ripensamento ⇄ delle esclusive convivono, impilati
        const azioni = document.createElement('div');
        azioni.className = 'wazioni';
        if (s.upCost !== null) {
          const b = document.createElement('button');
          b.textContent = `Potenzia · ${s.upCost} 🪙`;
          b.setAttribute('aria-label', `Potenzia ${s.name} (${this.groupLabel(g)}) per ${s.upCost} monete`);
          b.dataset.fk = `up-${g}-${s.slot}`;
          b.disabled = m.gold < s.upCost;
          if (b.disabled) b.title = `Servono ${s.upCost} 🪙 — ne hai ${m.gold}`;
          b.addEventListener('click', () => this.h.onUpgradeWeapon(g, s.slot));
          azioni.appendChild(b);
        } else if (s.replace) {
          const b = document.createElement('button');
          b.className = 'tierUp';
          const gratis = s.replace.posseduta;
          b.textContent = gratis ? `→ ${s.replace.name} · già tua` : `→ ${s.replace.name} · ${s.replace.cost} 🪙`;
          const conStats = s.replace.stats
            ? ` (${s.replace.stats.dmg} danni, gittata ${s.replace.stats.range}, ricarica ${s.replace.stats.reload}s)` : '';
          b.setAttribute('aria-label', gratis
            ? `Rimonta ${s.replace.name}${conStats}: è nel tuo arsenale, gratis`
            : `Sostituisci ${s.name} con ${s.replace.name}${conStats} per ${s.replace.cost} monete`);
          b.dataset.fk = `rep-${g}-${s.slot}`;
          b.disabled = !gratis && m.gold < s.replace.cost;
          b.title = b.disabled
            ? `Servono ${s.replace.cost} 🪙 — ne hai ${m.gold}`
            : `${s.replace.name}${conStats}`;
          b.addEventListener('click', () => this.h.onReplaceWeapon(g, s.slot));
          azioni.appendChild(b);
        } else if (!s.indietro) {
          const span = document.createElement('span');
          span.className = 'maxed';
          span.textContent = 'Arma suprema';
          azioni.appendChild(span);
        }
        if (s.indietro) {
          const b = document.createElement('button');
          b.textContent = `⇄ ${s.indietro.name} · gratis`;
          b.setAttribute('aria-label', `Rimonta ${s.indietro.name} al posto di ${s.name}: gratis, l'esclusiva resta nel tuo arsenale`);
          b.dataset.fk = `giu-${g}-${s.slot}`;
          b.title = 'Il ripensamento è gratis: l\'esclusiva resta tua, il Mortaio torna al livello massimo';
          b.addEventListener('click', () => this.h.onTornaMortaio(g, s.slot));
          azioni.appendChild(b);
        }
        row.appendChild(azioni);
        block.appendChild(row);
      }
      if (data.nextSlotCost !== null) {
        const add = document.createElement('button');
        add.className = 'addSlot';
        add.textContent = `+ Nuovo slot (con colubrina) · ${data.nextSlotCost} 🪙`;
        add.dataset.fk = `slot-${g}`;
        add.disabled = m.gold < data.nextSlotCost;
        if (add.disabled) add.title = `Servono ${data.nextSlotCost} 🪙 — ne hai ${m.gold}`;
        add.addEventListener('click', () => this.h.onBuySlot(g));
        block.appendChild(add);
      }
      wep.appendChild(block);
    }
    this._shopMostra(this._shopScheda);
    this.show('shopOverlay');
    if (fk) {
      const di_nuovo = $('shopOverlay').querySelector(`[data-fk="${fk}"]`);
      if (di_nuovo && !di_nuovo.disabled) di_nuovo.focus();
    }
  }

  // Il varo: tre tipi di nave, uno alla volta. Effetti riassunti dai
  // moltiplicatori che arrivano dal server: una sola fonte di verità.
  varoBlock(varo, gold) {
    const LINEA = { hullLvl: 'Scafo', sailsLvl: 'Vele', helmLvl: 'Timone', crewLvl: 'Ciurma', holdLvl: 'Stiva' };
    const EMOJI = { goletta: '🐟', guerra: '⚔', galeone: '🏰', sciabecco: '🌊' };
    const pct = (mul) => `${mul > 1 ? '+' : ''}${Math.round((mul - 1) * 100)}%`;
    // niente scatola-nella-scatola (audit Cantiere 2): le carte del varo
    // stanno nel ritmo della scheda come ogni altra riga del Cantiere
    const block = document.createDocumentFragment();
    const nota = document.createElement('p');
    nota.className = 'shopNota';
    nota.textContent = varo.tipo
      ? `⚓ Cambiare identità costa ${varo.cost} 🪙 (raddoppia a ogni giro). Le esclusive comprate restano tue.`
      : `⚓ Scegli il tipo della tua nave: il primo varo costa ${varo.cost} 🪙.`;
    block.appendChild(nota);
    for (const [key, t] of Object.entries(varo.tipi)) {
      const eff = [];
      if (t.hpMul !== 1) eff.push(`scafo ${pct(t.hpMul)}`);
      if (t.speedMul !== 1) eff.push(`velocità ${pct(t.speedMul)}`);
      if (t.turnMul !== 1) eff.push(`virata ${pct(t.turnMul)}`);
      eff.push(`${LINEA[t.sconto]} a metà prezzo`);
      const row = document.createElement('div');
      row.className = 'shopRow';
      // la carta spiega (audit Cantiere): cosa fa R, quanto dura, ogni
      // quanto torna — e l'esclusiva coi suoi numeri, non solo il nome
      const ab = t.abilitaInfo;
      const es = t.esclusivaInfo;
      const righeExtra = ab
        ? `<span class="effetti abilitaRiga">✦ <b>R — ${esc(ab.nome)}</b> (ricarica ${ab.cd}s): ${esc(ab.effetto)}</span>
           <span class="effetti esclusivaRiga">☄ esclusiva: <b>${esc(t.esclusiva)}</b>${es ? ` — ${es.dmg} danni · gittata ${es.range} · ricarica ${es.reload}s` : ''}</span>`
        : `<span class="effetti">abilità: ${esc(t.abilita || '—')} · esclusiva: ${esc(t.esclusiva)}</span>`;
      row.innerHTML = `<div class="shopInfo"><b>${EMOJI[key] || '⚓'} ${esc(t.nome)}</b><span>${esc(t.motto)}</span>
        <span class="effetti">${esc(eff.join(' · '))}</span>${righeExtra}</div>`;
      const btn = document.createElement('button');
      btn.dataset.fk = `varo-${key}`;
      if (varo.tipo === key) { btn.textContent = 'La tua nave'; btn.disabled = true; }
      else {
        btn.textContent = `Vara · ${varo.cost} 🪙`;
        btn.setAttribute('aria-label', `Vara ${t.nome} per ${varo.cost} monete`);
        btn.disabled = gold < varo.cost;
        if (btn.disabled) btn.title = `Servono ${varo.cost} 🪙 — ne hai ${gold}`;
        btn.addEventListener('click', () => this.h.onVaro(key));
      }
      row.appendChild(btn);
      block.appendChild(row);
    }
    return block;
  }

  // Il Negozio delle Livree (issue #25): pay to show, mai pay to win —
  // vendita diretta, prezzi in chiaro, l'edizione-impresa non si compra.
  livreeBlock(negozio, gold) {
    // scheda piatta nel ritmo dei token (audit Cantiere 2): niente
    // scatolone, sezioni con il titolo di casa (.shopSection)
    const block = document.createDocumentFragment();
    const nota = document.createElement('p');
    nota.className = 'shopNota';
    nota.textContent = '🎨 Il Negozio delle Livree — solo estetica, mai vantaggio.';
    block.appendChild(nota);
    // anteprima FEDELE della nave (issue #34): mostra la nave con la livrea
    // indossata — feedback immediato, dato che attraccati la nave è invisibile
    const anteprima = document.createElement('div');
    anteprima.className = 'livreaPreview';
    anteprima.innerHTML = '<span class="sub">anteprima della nave…</span>';
    block.appendChild(anteprima);
    if (this.h.onLivreaPreview) {
      this.h.onLivreaPreview(negozio.livrea || null, negozio.vele || null).then((canvas) => {
        anteprima.innerHTML = '';
        if (canvas) { canvas.className = 'livreaPreviewCanvas'; anteprima.appendChild(canvas); }
        else anteprima.innerHTML = '<span class="sub">Salpa per vedere la livrea in mare.</span>';
      }).catch(() => { anteprima.innerHTML = ''; });
    }
    const possedute = new Set(negozio.possedute || []);
    // tre sezioni, una per GENERE: ogni genere veste il suo slot e basta
    // (mai collassare l'uno nell'altro: era la trappola livree/vele). Un
    // genere che questo client non conosce non si mostra: non si può
    // indossare quel che non si sa dove va.
    const SEZIONI = [
      ['livrea', '🎨 Livree', 'l\'abito completo: scafo, finiture e tela'],
      ['vele', '⛵ Vele', 'solo la tela, sopra qualunque livrea'],
      ['scia', '🌊 Scie', 'la strada che lasci sul mare'],
    ];
    for (const [genere, titolo, sotto] of SEZIONI) {
      const voci = Object.entries(negozio.catalogo || {}).filter(([, l]) => l.genere === genere);
      if (!voci.length) continue;
      const sHead = document.createElement('h3');
      sHead.className = 'shopSection';
      sHead.innerHTML = `${titolo} <span class="sezioneSotto">— ${esc(sotto)}</span>`;
      block.appendChild(sHead);
      for (const [id, l] of voci) {
        const row = document.createElement('div');
        row.className = 'shopRow';
        // lo swatch: per le vele la TINTA della tela, per il resto la scia
        const colore = '#' + ((genere === 'vele' && l.tinta != null ? l.tinta : l.scia) | 0).toString(16).padStart(6, '0');
        row.innerHTML = `<div class="shopInfo"><b><span class="swatch" style="background:${colore}" aria-hidden="true"></span> ${esc(l.nome)}</b>
          <span>${esc(l.motto || '')}</span></div>`;
        const btn = document.createElement('button');
        btn.dataset.fk = `livrea-${id}`;
        const indossata = negozio[genere] === id;
        if (indossata) {
          btn.textContent = 'Riponi';
          btn.setAttribute('aria-label', `Riponi ${l.nome}`);
          btn.addEventListener('click', () => this.h.onIndossaLivrea(null, genere));
          row.classList.add('indossata');
        } else if (possedute.has(id)) {
          btn.textContent = 'Indossa';
          btn.setAttribute('aria-label', `Indossa ${l.nome}`);
          btn.addEventListener('click', () => this.h.onIndossaLivrea(id, genere));
        } else if (l.prezzo === null) {
          btn.textContent = 'Si guadagna';
          btn.disabled = true;
          btn.title = 'Compi la campagna del Mastro di Rotte per guadagnarla';
        } else {
          btn.textContent = `Compra · ${l.prezzo} 🪙`;
          btn.setAttribute('aria-label', `Compra ${l.nome} per ${l.prezzo} monete`);
          btn.disabled = gold < l.prezzo;
          if (btn.disabled) btn.title = `Servono ${l.prezzo} 🪙 — ne hai ${gold}`;
          btn.addEventListener('click', () => this.h.onCompraLivrea(id));
        }
        row.appendChild(btn);
        block.appendChild(row);
      }
    }
    // il vessillo personale: identità gratuita, come il nome. Sventola in
    // targhetta per chi NON ha una Fratellanza (la bandiera di gilda vince).
    const vHead = document.createElement('div');
    vHead.className = 'wgroupHead';
    vHead.innerHTML = '<b>🚩 Il tuo vessillo</b><span>gratis — la gilda, se ce l\'hai, vince</span>';
    block.appendChild(vHead);
    const vRow = document.createElement('div');
    vRow.className = 'vessillo';
    const canvas = document.createElement('canvas');
    canvas.width = 90; canvas.height = 60;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Anteprima del vessillo');
    const b = negozio.bandiera || { fondo: 0, taglio: 0, tinta2: 1, emblema: 0, tintaEmblema: 4 };
    const scelte = document.createElement('div');
    scelte.className = 'gfScelte';
    const sels = {};
    for (const [campo, label, voci] of [
      ['fondo', 'Campo', TINTE.map(t => t[0])], ['taglio', 'Taglio', TAGLI],
      ['tinta2', 'Seconda tinta', TINTE.map(t => t[0])], ['emblema', 'Emblema', EMBLEMI],
      ['tintaEmblema', "Tinta dell'emblema", TINTE.map(t => t[0])],
    ]) {
      const wrap = document.createElement('label');
      wrap.textContent = label + ' ';
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', label + ' del vessillo');
      voci.forEach((v, i) => {
        const o = document.createElement('option');
        o.value = i; o.textContent = v;
        sel.appendChild(o);
      });
      sel.value = b[campo] | 0;
      sel.addEventListener('change', () => ridisegna());
      sels[campo] = sel;
      wrap.appendChild(sel);
      scelte.appendChild(wrap);
    }
    const bozza = () => Object.fromEntries(Object.entries(sels).map(([k, s]) => [k, +s.value]));
    const ridisegna = () => disegnaBandiera(canvas, bozza());
    ridisegna();
    const issa = document.createElement('button');
    issa.dataset.fk = 'vessillo-issa';
    issa.textContent = negozio.bandiera ? 'Cambia il vessillo' : 'Issa il vessillo';
    issa.addEventListener('click', () => this.h.onVessillo(bozza()));
    vRow.append(canvas, scelte, issa);
    if (negozio.bandiera) {
      const ammaina = document.createElement('button');
      ammaina.className = 'linkish';
      ammaina.textContent = 'Ammaina';
      ammaina.setAttribute('aria-label', 'Ammaina il vessillo personale');
      ammaina.addEventListener('click', () => this.h.onVessillo(null));
      vRow.appendChild(ammaina);
    }
    block.appendChild(vRow);
    return block;
  }

  // Il Registro delle Collezioni (issue #25): la leggenda agli atti.
  showRegistro(d) {
    const box = $('registroVoci');
    box.innerHTML = '';
    const TIPI_NOMI = { goletta: 'Goletta', guerra: 'Brigantino da Guerra', galeone: 'Galeone', sciabecco: 'Sciabecco' };
    const sez = (titolo, righe) => {
      const s = document.createElement('div');
      s.className = 'wgroup';
      const head = document.createElement('div');
      head.className = 'wgroupHead';
      head.innerHTML = `<b>${titolo}</b>`;
      s.appendChild(head);
      for (const r of righe) {
        const el = document.createElement('div');
        el.className = 'registroRiga';
        el.innerHTML = r;
        s.appendChild(el);
      }
      box.appendChild(s);
    };
    sez('⛵ La nave', [
      d.tipo ? `Tipo: <b>${esc(TIPI_NOMI[d.tipo] || d.tipo)}</b> (${d.vari | 0} vari all'attivo)` : 'Nessun varo ancora: il Cantiere aspetta',
      `Battaglie: <b>${d.kills | 0}</b> vittorie · ${d.deaths | 0} naufragi`,
    ]);
    const armi = {};
    for (const g of Object.values(d.mounts || {})) {
      for (const w of g || []) {
        const nome = (d.arsenal && d.arsenal.types[w.type] && d.arsenal.types[w.type].name) || w.type;
        armi[nome] = Math.max(armi[nome] || 0, w.lvl);
      }
    }
    sez('⚔ L\'arsenale a bordo', Object.entries(armi).length
      ? Object.entries(armi).map(([n, l]) => `${esc(n)} <span class="pips">${'●'.repeat(l)}${'○'.repeat(3 - l)}</span>`)
      : ['Nessuna bocca da fuoco (come ci sei arrivato fin qui?)']);
    sez('🏰 Fortezze espugnate', (d.conquered || []).length
      ? d.conquered.slice(0, 20).map(x => esc(x)).concat(d.conquered.length > 20 ? [`…e altre ${d.conquered.length - 20}`] : [])
      : ['Ancora nessuna: le mura aspettano le tue bordate']);
    sez('⭐ Approdi preferiti', (d.preferiti || []).length ? d.preferiti.map(x => esc(x)) : ['Il mare è grande: segna i porti che ami']);
    const cat = d.catalogo || {};
    const tot = Object.keys(cat).length;
    sez(`🎨 Il guardaroba (${(d.livree || []).length}/${tot})`, tot
      ? Object.entries(cat).map(([id, l]) => {
        const ha = (d.livree || []).includes(id);
        const addosso = d.livrea === id || d.vele === id || d.scia === id;
        return `${ha ? '✅' : '◻️'} ${esc(l.nome)}${addosso ? ' <b>(addosso)</b>' : ''}${!ha && l.impresa ? ' — si guadagna con la campagna' : ''}`;
      })
      : ['Il Negozio delle Livree apre al Porto Franco']);
    if (d.campagna && d.campagna.completata) {
      sez('⚔ Il Mastro di Rotte', ['Campagna della settimana: <b>compiuta</b>']);
    }
    this.show('registroOverlay');
  }

  statRow(title, desc, lvl, maxLvl, cost, gold, onBuy, fk) {
    const row = document.createElement('div');
    row.className = 'shopRow';
    row.innerHTML = `<div class="shopInfo"><b>${title}</b><span>${desc}</span>
      <span class="pips" role="img" aria-label="livello ${lvl} di ${maxLvl}">${'●'.repeat(lvl)}${'○'.repeat(maxLvl - lvl)}</span></div>`;
    const btn = document.createElement('button');
    if (fk) btn.dataset.fk = fk;
    if (cost === null) { btn.textContent = 'Massimo'; btn.disabled = true; }
    else {
      btn.textContent = `${cost} 🪙`;
      btn.setAttribute('aria-label', `Compra un punto ${title.replace(/^\S+ /, '')} per ${cost} monete`);
      btn.disabled = gold < cost;
      if (btn.disabled) btn.title = `Servono ${cost} 🪙 — ne hai ${gold}`;
      btn.addEventListener('click', onBuy);
    }
    row.appendChild(btn);
    return row;
  }

  showSearch() { this.show('searchOverlay'); $('searchInput').value = ''; $('searchInput').focus(); }

  showSiteFallback(island, url) {
    $('siteTitle').textContent = `⚓ Attraccato: ${island.name}`;
    $('siteLink').href = url;
    this.show('siteOverlay');
  }

  showDockbar(island, url) {
    $('dockInfo').textContent = `⚓ ${island.name}`;
    $('dockUrl').textContent = url;
    this.show('dockbar');
    document.body.classList.add('attraccato'); // le pillole HUD scendono
  }
  setDockUrl(url) { $('dockUrl').textContent = url; }

  // --- le Fratellanze (issue #5) ---

  _bandieraBozza() {
    return {
      fondo: +$('gfFondo').value, taglio: +$('gfTaglio').value, tinta2: +$('gfTinta2').value,
      emblema: +$('gfEmblema').value, tintaEmblema: +$('gfTintaEmblema').value,
    };
  }

  _anteprimaBandiera() { disegnaBandiera($('gfBandiera'), this._bandieraBozza()); }

  _bandierina(b, w = 48, h = 32) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', 'Bandiera della Fratellanza');
    disegnaBandiera(c, b);
    return c;
  }

  // il pannello: la MIA gilda, oppure l'elenco + la fondazione
  showFratellanze({ mia, elenco, fondazione }) {
    $('gildaMia').classList.toggle('hidden', !mia);
    $('gildaSenza').classList.toggle('hidden', !!mia);
    if (mia) this._renderMiaGilda(mia);
    else this._renderElencoGilde(elenco || [], fondazione || 25000);
    this.show('gildaOverlay');
  }

  _renderMiaGilda(g) {
    const box = $('gildaMia');
    box.innerHTML = '';
    const testa = document.createElement('div');
    testa.className = 'gildaTesta';
    testa.appendChild(this._bandierina(g.bandiera, 120, 80));
    const info = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.textContent = `«${g.nome}» [${g.tag}]`;
    const sub = document.createElement('p');
    sub.className = 'sub';
    sub.textContent = `${g.categoria} · ${g.aperta ? 'porte aperte' : 'porte chiuse'}` + (g.motto ? ` · “${g.motto}”` : '');
    info.append(h3, sub);
    testa.appendChild(info);
    box.appendChild(testa);

    // le richieste in rada (solo per chi ha i galloni)
    if (g.richieste && g.richieste.length) {
      const h4 = document.createElement('h3');
      h4.className = 'shopSection';
      h4.textContent = '✉ Richieste in rada';
      box.appendChild(h4);
      for (const r of g.richieste) {
        const riga = document.createElement('div');
        riga.className = 'gildaRiga';
        const nome = document.createElement('span');
        nome.textContent = r.nome;
        const si = document.createElement('button');
        si.textContent = '⛵ Ammetti';
        si.addEventListener('click', () => this.h.onGildaApprova(r.uid));
        const no = document.createElement('button');
        no.className = 'linkish';
        no.textContent = 'Rifiuta';
        no.addEventListener('click', () => this.h.onGildaRifiuta(r.uid));
        riga.append(nome, si, no);
        box.appendChild(riga);
      }
    }

    const h4m = document.createElement('h3');
    h4m.className = 'shopSection';
    h4m.textContent = `⚓ La ciurma (${g.membri.length}/24)`;
    box.appendChild(h4m);
    const capitano = g.mioRuolo === 'capitano';
    const membri = g.membriUid || g.membri;
    for (const m of membri) {
      const riga = document.createElement('div');
      riga.className = 'gildaRiga';
      const nome = document.createElement('span');
      nome.textContent = `${m.ruolo === 'capitano' ? '👑' : m.ruolo === 'ufficiale' ? '⭐' : '⚓'} ${m.nome} — ${m.ruolo}`;
      riga.appendChild(nome);
      if (capitano && m.uid && m.ruolo === 'marinaio') {
        const pr = document.createElement('button');
        pr.textContent = '⭐ Promuovi';
        pr.addEventListener('click', () => this.h.onGildaPromuovi(m.uid));
        riga.appendChild(pr);
      }
      if (m.uid && m.ruolo !== 'capitano' && (capitano || (g.mioRuolo === 'ufficiale' && m.ruolo === 'marinaio'))) {
        const ex = document.createElement('button');
        ex.className = 'linkish';
        ex.textContent = 'Sbarca';
        ex.addEventListener('click', () => this.h.onGildaEspelli(m.uid));
        riga.appendChild(ex);
      }
      box.appendChild(riga);
    }

    if (g.log && g.log.length) {
      const h4l = document.createElement('h3');
      h4l.className = 'shopSection';
      h4l.textContent = '📖 Il log della Fratellanza';
      box.appendChild(h4l);
      for (const v of g.log) {
        const riga = document.createElement('p');
        riga.className = 'gildaLog';
        riga.textContent = v.testo;
        box.appendChild(riga);
      }
    }

    const azioni = document.createElement('div');
    azioni.className = 'row';
    if (capitano) {
      const sc = document.createElement('button');
      sc.className = 'linkish';
      sc.textContent = '🌊 Sciogli la Fratellanza';
      sc.addEventListener('click', () => {
        if (sc.dataset.conferma) this.h.onGildaSciogli();
        else { sc.dataset.conferma = '1'; sc.textContent = '🌊 Sicuro? Premi di nuovo per sciogliere'; }
      });
      azioni.appendChild(sc);
    } else {
      const la = document.createElement('button');
      la.className = 'linkish';
      la.textContent = '🌊 Lascia la Fratellanza';
      la.addEventListener('click', () => this.h.onGildaLascia());
      azioni.appendChild(la);
    }
    box.appendChild(azioni);
  }

  _renderElencoGilde(elenco, fondazione) {
    $('gfFonda').textContent = `🏴 Fonda la Fratellanza (${fondazione} 🪙)`;
    const box = $('gildaElencoBox');
    box.innerHTML = '';
    if (!elenco.length) {
      const p = document.createElement('p');
      p.className = 'sub';
      p.textContent = 'Nessuna Fratellanza batte ancora bandiera: la prima potrebbe essere la tua.';
      box.appendChild(p);
      return;
    }
    for (const g of elenco) {
      const riga = document.createElement('div');
      riga.className = 'gildaRiga';
      riga.appendChild(this._bandierina(g.bandiera));
      const info = document.createElement('span');
      info.className = 'gildaInfo';
      info.textContent = `«${g.nome}» [${g.tag}] — ${g.categoria} · ${g.membri.length}/24 · ${g.aperta ? 'aperta' : 'chiusa'}`;
      riga.appendChild(info);
      const chiedi = document.createElement('button');
      chiedi.textContent = g.sfidabile ? "⚔ Chiedi l'ingresso" : '⚔ Prima il rito';
      chiedi.disabled = !g.sfidabile;
      chiedi.title = g.sfidabile
        ? 'Hai conquistato il diritto: la richiesta parte subito'
        : 'Blocca una loro nave per conquistare il diritto (vale 7 giorni)';
      chiedi.addEventListener('click', () => this.h.onGildaRichiesta(g.id));
      riga.appendChild(chiedi);
      box.appendChild(riga);
    }
  }

  // --- le Alleanze temporanee (issue #37) ---

  // il pallino degli inviti in rada sul bottone 🤝
  setAlleanzaBadge(n) {
    const b = $('alleanzaBadge');
    b.textContent = n > 9 ? '9+' : String(n);
    b.classList.toggle('hidden', n <= 0);
    $('alleanzaBtn').setAttribute('aria-label',
      n > 0 ? `Alleanze temporanee: ${n} inviti in rada` : 'Alleanze temporanee');
  }

  // Apre il pannello. `d` = { mia: {membri,aperta,max}|null, inviti:[{id,nome}],
  // bandiere:[{id,nomi,posti}], presenti:[{id,nome}] }
  showAlleanze(d) {
    this._alleanza = d || {};
    this._renderAlleanza();
    this.show('alleanzaOverlay');
  }

  // aggiorna il pannello sotto gli occhi (se è aperto), a nuovi dati dal server
  refreshAlleanze(d) {
    if ($('alleanzaOverlay').classList.contains('hidden')) return;
    this._alleanza = d || {};
    this._renderAlleanza();
  }

  _renderAlleanza() {
    const d = this._alleanza || {};
    const riga = (box) => { const r = document.createElement('div'); r.className = 'gildaRiga'; box.appendChild(r); return r; };
    const titolo = (box, t) => { const h = document.createElement('h3'); h.className = 'shopSection'; h.textContent = t; box.appendChild(h); };

    // la MIA alleanza: membri pari, scioglimento e bandiera aperta
    const mia = $('alleanzaMia');
    mia.innerHTML = '';
    if (d.mia) {
      titolo(mia, `🤝 La tua alleanza (${d.mia.membri.length}/${d.mia.max})`);
      for (const m of d.mia.membri) {
        const r = riga(mia);
        const nome = document.createElement('span');
        nome.textContent = `⛵ ${m.nome}${m.id === d.meId ? ' — tu' : ''}`;
        r.appendChild(nome);
      }
      const azioni = document.createElement('div');
      azioni.className = 'row';
      const bandiera = document.createElement('button');
      bandiera.textContent = d.mia.aperta ? '🏳 Ammaina la bandiera aperta' : '🏴 Issa la bandiera aperta';
      bandiera.title = d.mia.aperta
        ? 'Chiudi l\'arruolamento: nessun altro potrà unirsi da solo'
        : 'Chiunque potrà unirsi finché c\'è posto';
      bandiera.addEventListener('click', () => d.mia.aperta ? this.h.onAlleanzaChiudi() : this.h.onAlleanzaApri());
      const lascia = document.createElement('button');
      lascia.className = 'linkish';
      lascia.textContent = '🌊 Sciogli le vele';
      lascia.setAttribute('aria-label', 'Lascia l\'alleanza');
      lascia.addEventListener('click', () => this.h.onAlleanzaLascia());
      azioni.append(bandiera, lascia);
      mia.appendChild(azioni);
    }

    // gli inviti in rada: si accetta o si declina
    const inviti = $('alleanzaInviti');
    inviti.innerHTML = '';
    if ((d.inviti || []).length) {
      titolo(inviti, '✉ Inviti in rada');
      for (const i of d.inviti) {
        const r = riga(inviti);
        const nome = document.createElement('span');
        nome.textContent = `${i.nome} ti propone un'alleanza`;
        const si = document.createElement('button');
        si.textContent = '🤝 Accetta';
        si.disabled = !!d.mia;
        if (si.disabled) si.title = 'Sei già in un\'alleanza: prima sciogli le vele';
        si.addEventListener('click', () => this.h.onAlleanzaAccetta(i.id));
        const no = document.createElement('button');
        no.className = 'linkish';
        no.textContent = 'Declina';
        no.addEventListener('click', () => this.h.onAlleanzaRifiuta(i.id));
        r.append(nome, si, no);
      }
    }

    // le bandiere aperte degli altri: ci si unisce con un click (chi è già
    // in un'alleanza non ne può abbordare un'altra: la sezione tace)
    const bandiere = $('alleanzaBandiere');
    bandiere.innerHTML = '';
    if ((d.bandiere || []).length && !d.mia) {
      titolo(bandiere, '🏴 Bandiere aperte');
      for (const b of d.bandiere) {
        const r = riga(bandiere);
        const nome = document.createElement('span');
        nome.textContent = `Alleanza di ${b.nomi.join(', ')} — ${b.posti} ${b.posti === 1 ? 'posto' : 'posti'}`;
        const btn = document.createElement('button');
        btn.textContent = '🤝 Unisciti';
        btn.setAttribute('aria-label', `Unisciti all'alleanza di ${b.nomi.join(', ')}`);
        btn.addEventListener('click', () => this.h.onAlleanzaUnisciti(b.id));
        r.append(nome, btn);
      }
    }

    this._renderAlleanzaPresenti();
  }

  // l'elenco dei capitani presenti, col filtro di ricerca testuale: con tanta
  // gente in mare si cerca per nome invece di scorrere all'infinito
  _renderAlleanzaPresenti() {
    const d = this._alleanza || {};
    const box = $('alleanzaPresentiBox');
    box.innerHTML = '';
    const filtro = $('alleanzaCerca').value.trim().toLowerCase();
    const tutti = d.presenti || [];
    const scelti = filtro ? tutti.filter(p => p.nome.toLowerCase().includes(filtro)) : tutti;
    if (!tutti.length) {
      const p = document.createElement('p');
      p.className = 'sub';
      p.textContent = 'Nessun altro capitano in queste acque, per ora.';
      box.appendChild(p);
      return;
    }
    if (!scelti.length) {
      const p = document.createElement('p');
      p.className = 'sub';
      p.textContent = `Nessun capitano risponde a «${filtro}».`;
      box.appendChild(p);
      return;
    }
    const pieno = d.mia && d.mia.membri.length >= d.mia.max;
    for (const c of scelti) {
      const r = document.createElement('div');
      r.className = 'gildaRiga';
      const nome = document.createElement('span');
      nome.textContent = `⛵ ${c.nome}`;
      const btn = document.createElement('button');
      btn.textContent = '✉ Invita';
      btn.setAttribute('aria-label', `Invita ${c.nome} nell'alleanza`);
      btn.disabled = !!pieno;
      if (pieno) btn.title = 'L\'alleanza è al completo';
      btn.addEventListener('click', () => this.h.onAlleanzaInvita(c.id));
      r.append(nome, btn);
      box.appendChild(r);
    }
  }

  // Il Diario del Capitano (issue #39): il pallino delle novità (notizie del mare
  // non lette). Id legacy gazzetta* per riuso del plumbing dell'overlay.
  setGazzettaBadge(n) {
    const b = $('gazzettaBadge');
    b.textContent = n > 9 ? '9+' : String(n);
    b.classList.toggle('hidden', n <= 0);
    $('gazzettaBtn').setAttribute('aria-label',
      n > 0 ? `Diario del Capitano: ${n} novità nelle Cronache` : 'Diario del Capitano');
  }

  // Apre il Diario e lo popola. `state` = { campagna, dungeon,
  // giornaliere:{giornaliere,tris,strike,settimana,scadenza},
  // gazzetta:[voci del mare], cronache:[eventi miei], lettaFino }
  showDiario(state) {
    this._diario = state || {};
    this._montaSchede();
    this.renderImprese();
    this.renderCronache();
    this._mostraSchedaDiario(this._diarioTab || 'imprese');
    this.show('gazzettaOverlay');
  }

  // aggiorna il Diario senza riaprirlo (se è già a schermo), a nuovi dati dal server
  refreshDiario(state) {
    if ($('gazzettaOverlay').classList.contains('hidden')) return;
    this._diario = state || {};
    this.renderImprese();
    this.renderCronache();
  }

  _montaSchede() {
    if (this._schedeMontate) return;
    this._schedeMontate = true;
    $('tabImprese').addEventListener('click', () => this._mostraSchedaDiario('imprese'));
    $('tabCronache').addEventListener('click', () => this._mostraSchedaDiario('cronache'));
  }

  _mostraSchedaDiario(quale) {
    this._diarioTab = quale;
    const imp = quale === 'imprese';
    $('tabImprese').setAttribute('aria-selected', imp ? 'true' : 'false');
    $('tabCronache').setAttribute('aria-selected', imp ? 'false' : 'true');
    $('diarioImprese').classList.toggle('hidden', !imp);
    $('diarioCronache').classList.toggle('hidden', imp);
  }

  _sez(t) { const h = document.createElement('div'); h.className = 'diarioSez'; h.textContent = t; return h; }
  _vuoto(t) { const p = document.createElement('p'); p.className = 'diarioVuoto'; p.textContent = t; return p; }

  // scheda ① Imprese: in corso (campagna, dungeon) + le tre del giorno
  renderImprese() {
    const box = $('diarioImprese');
    box.innerHTML = '';
    const s = this._diario || {};
    box.appendChild(this._sez('In corso'));
    let qualcosa = false;
    if (s.campagna) { box.appendChild(this._cardCampagna(s.campagna)); qualcosa = true; }
    if (s.dungeon && !s.dungeon.fatto) { box.appendChild(this._cardDungeon(s.dungeon)); qualcosa = true; }
    if (!qualcosa) box.appendChild(this._vuoto('Nessuna impresa del Mastro in corso.'));
    box.appendChild(this._sez('Le tre del giorno'));
    const g = s.giornaliere;
    if (!g || !(g.giornaliere || []).length) {
      box.appendChild(this._vuoto('Le rotte del giorno arrivano col mare: salpa e torna a leggere.'));
      return;
    }
    for (const m of g.giornaliere) box.appendChild(this._cardMissione(m));
    box.appendChild(this._cardGiorno(g));
  }

  // una giornaliera: niente da accettare, si compie e basta (una volta al giorno)
  _cardMissione(m) {
    const c = document.createElement('div');
    c.className = 'impresaCard' + (m.fatta ? ' fatta' : '');
    const h = document.createElement('h4'); h.textContent = (m.fatta ? '✓ ' : '') + m.desc;
    const r = document.createElement('span'); r.className = 'reward';
    r.textContent = m.fatta ? `+${m.reward} 🪙 incassati` : `+${m.reward} 🪙`;
    c.append(h, r);
    if (!m.fatta) {
      const barra = document.createElement('div'); barra.className = 'impresaBarra';
      const i = document.createElement('i'); i.style.width = Math.round(100 * (m.progress || 0) / m.n) + '%';
      barra.appendChild(i);
      const sub = document.createElement('p'); sub.className = 'sub'; sub.textContent = `${m.progress || 0}/${m.n}`;
      c.append(barra, sub);
    }
    return c;
  }

  // il conto del giorno: tris, strike, settimana — il motivo per tornare domani
  _cardGiorno(g) {
    const c = document.createElement('div');
    c.className = 'impresaCard giorno';
    const tris = g.tris || { fatto: false, premio: 0 };
    const strike = g.strike || { n: 0, bonus: 0, cap: 7 };
    const sett = g.settimana || { pieni: 0, premio: 0 };
    // il tris di oggi vale premio + strike (la catena di oggi, cappata)
    const catena = tris.fatto ? strike.n : strike.n + 1;
    const valeOggi = tris.premio + strike.bonus * Math.min(catena, strike.cap);
    const riga = (testo) => { const p = document.createElement('p'); p.className = 'sub'; p.textContent = testo; return p; };
    const h = document.createElement('h4');
    h.textContent = tris.fatto ? '✓ Tris del giorno incassato' : 'Il tris del giorno';
    c.appendChild(h);
    c.appendChild(riga(tris.fatto
      ? `🌟 Tutte e tre compiute: +${valeOggi} 🪙 (strike di ${strike.n} ${strike.n === 1 ? 'giorno' : 'giorni'})`
      : `🌟 Compi tutte e tre e incassi +${valeOggi} 🪙 (tris ${tris.premio} + strike ×${Math.min(catena, strike.cap)})`));
    c.appendChild(riga(`📅 Settimana piena: ${sett.pieni}/7 giorni col tris — a 7/7 valgono +${sett.premio} 🪙`));
    if (g.scadenza) {
      const ms = Math.max(0, g.scadenza - Date.now());
      const ore = Math.floor(ms / 36e5), minuti = Math.floor((ms % 36e5) / 6e4);
      c.appendChild(riga(`⏳ Le rotte si rinnovano tra ${ore}h ${minuti}m`));
    }
    return c;
  }

  _cardCampagna(campagna) {
    const cb = document.createElement('div'); cb.className = 'impresaCard mastro';
    const h = document.createElement('h4'); h.textContent = `⚔ Campagna della settimana: «${campagna.nome}»`;
    cb.appendChild(h);
    if (campagna.lore) { const l = document.createElement('p'); l.className = 'campagnaLore'; l.textContent = campagna.lore; cb.appendChild(l); }
    const lista = document.createElement('ol'); lista.className = 'campagnaTappe';
    (campagna.tappe || []).forEach((t, i) => {
      const li = document.createElement('li');
      const fatta = campagna.completata || i < campagna.tappa;
      const corrente = !campagna.completata && i === campagna.tappa;
      li.className = fatta ? 'fatta' : corrente ? 'corrente' : 'futura';
      li.textContent = (fatta ? '✓ ' : corrente ? '➤ ' : '· ') + t.desc +
        (corrente && campagna.fatto > 0 ? ` (${campagna.fatto}/${t.n})` : '');
      if (t.lore && (corrente || fatta)) li.title = t.lore;
      lista.appendChild(li);
    });
    cb.appendChild(lista);
    const premio = document.createElement('p'); premio.className = 'reward';
    premio.textContent = campagna.completata ? `⭐ Compiuta! (+${campagna.premio} 🪙)` : `Premio del Mastro: ${campagna.premio} 🪙`;
    cb.appendChild(premio);
    return cb;
  }

  _cardDungeon(d) {
    const c = document.createElement('div'); c.className = 'impresaCard dungeon';
    const h = document.createElement('h4'); h.textContent = `🗺 Dungeon del giorno: «${d.nome}»`;
    c.appendChild(h);
    const sub = document.createElement('p'); sub.className = 'sub';
    sub.textContent = d.bersaglio ? `Assalta le difese di ${d.bersaglio}` : 'Espugna una Fortezza Proibita';
    c.appendChild(sub);
    const premio = document.createElement('p'); premio.className = 'reward'; premio.textContent = `+${d.premio} 🪙`;
    c.appendChild(premio);
    return c;
  }

  // scheda ② Cronache: le mie imprese (accumulate) o tutto il mare (ex-Gazzetta)
  renderCronache() {
    const box = $('diarioCronache');
    box.innerHTML = '';
    const s = this._diario || {};
    if (!this._cronacheFiltro) this._cronacheFiltro = 'tutte';
    const filtro = document.createElement('div'); filtro.className = 'diarioFiltro';
    for (const [key, lab] of [['mie', 'Le mie'], ['tutte', 'Tutto il mare']]) {
      const b = document.createElement('button');
      b.textContent = lab;
      b.setAttribute('aria-pressed', this._cronacheFiltro === key ? 'true' : 'false');
      b.addEventListener('click', () => { this._cronacheFiltro = key; this.renderCronache(); });
      filtro.appendChild(b);
    }
    box.appendChild(filtro);
    const voci = this._cronacheFiltro === 'mie' ? (s.cronache || []) : (s.gazzetta || []);
    if (!voci.length) {
      box.appendChild(this._vuoto(this._cronacheFiltro === 'mie'
        ? 'Nessuna tua impresa, per ora. Salpa e falle parlare!'
        : 'Il mare è quieto: nessuna notizia.'));
      return;
    }
    for (const v of voci) {
      const riga = document.createElement('div');
      riga.className = 'gazzettaVoce' + (s.lettaFino != null && v.t > s.lettaFino ? ' nuova' : '');
      const quando = document.createElement('time');
      quando.textContent = faTempo(v.t);
      quando.dateTime = new Date(v.t).toISOString();
      const testo = document.createElement('p');
      testo.textContent = v.testo;
      riga.append(quando, testo);
      box.appendChild(riga);
    }
  }

  // la stella dell'approdo preferito (issue #13), su dockbar e pannello sito
  setFav(on) {
    $('favBtn').textContent = on ? '★' : '☆';
    $('favBtn').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('favBtnSito').textContent = on ? '★ Approdo preferito' : '☆ Segna come approdo preferito';
    $('favBtnSito').setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  hideDockbar() { this.hide('dockbar'); document.body.classList.remove('attraccato'); }

  showDeath(seconds, dettagli = {}) {
    // la morte racconta (issue #23): chi, quanto perso, quanto in salvo
    const conto = $('deathConto');
    const consiglio = $('deathConsiglio');
    if (dettagli.da) {
      let testo = dettagli.da === 'Il Mare'
        ? 'Il mare si è preso la tua nave.' : `Affondato da ${dettagli.da}.`;
      if (dettagli.perso > 0) {
        testo += ` Il forziere in gioco è passato al vincitore: −${dettagli.perso} 🪙` +
          (dettagli.salvo > 0 ? ` — il doppiofondo della Stiva ne ha salvati ${dettagli.salvo}.` : '.');
      } else {
        testo += ' Il forziere è rimasto a bordo: gli abissi non fanno bottino.';
      }
      conto.textContent = testo;
      const stivaPiena = (dettagli.holdLvl | 0) >= 4;
      consiglio.textContent = 'Ogni punto di Stiva mette al riparo un 10% in più del forziere.';
      consiglio.classList.toggle('hidden', !(dettagli.perso > 0) || stivaPiena);
    } else {
      conto.textContent = '';
      consiglio.classList.add('hidden');
    }
    let left = seconds;
    $('deathCount').textContent = left;
    this.show('deathOverlay');
    clearInterval(this.deathTimer);
    this.deathTimer = setInterval(() => {
      left--;
      $('deathCount').textContent = Math.max(0, left);
      if (left <= 0) clearInterval(this.deathTimer);
    }, 1000);
  }
  hideDeath() { clearInterval(this.deathTimer); this.hide('deathOverlay'); }

  closeDockOverlays() {
    this._sospeso = null; // si salpa: niente pannelli di banchina da riesumare
    this.hide('shopOverlay'); this.hide('searchOverlay'); this.hide('siteOverlay');
    this.hide('assedioOverlay');
    this.hideDockbar();
  }

  setCourseInput(v) { $('courseInput').value = v; }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
