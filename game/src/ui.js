// Tutta la UI DOM sopra il canvas: barra della rotta, HUD, plance e pergamene.

import { drawTreasureMap } from './mapgen.js';
import { t as tr } from './i18n.js';
import { tMsg, nomeIsola } from './dict-mare.js';
import { disegnaBandiera, TINTE, TAGLI, EMBLEMI } from './bandiera.js';

const CATEGORIE_GILDA = ['corsari', 'mercanti', 'esploratori', 'accademici', 'guardiani'];

const $ = (id) => document.getElementById(id);

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

// "2 ore fa": il tempo delle notizie, alla buona e in italiano
function faTempo(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return tr('tempo.adesso');
  if (s < 3600) return tr('tempo.min', { n: Math.round(s / 60) });
  if (s < 86400) { const h = Math.round(s / 3600); return h === 1 ? tr('tempo.unora') : tr('tempo.ore', { n: h }); }
  const g = Math.round(s / 86400);
  return g === 1 ? tr('tempo.ieri') : tr('tempo.giorni', { n: g });
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
      sel.setAttribute('aria-label', tr('bandiera.sel.aria', { label }));
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
    const k = 'munizione.' + tipo;
    const nome = tr(k) === k ? m.name : tr(k);
    $('munizioneVal').textContent = `${m.emoji} ${nome}`;
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
    $('hint').innerHTML = tr('hud.hint.tasti', {
      su: esc(l.su), sinistra: esc(l.sinistra), giu: esc(l.giu), destra: esc(l.destra),
      bs: esc(l.bordataSin), bd: esc(l.bordataDes), pp: esc(l.pruaPoppa),
      mun: esc(l.munizione), ab: esc(l.abilita), att: esc(l.attracca),
      zoom: esc(l.zoom), cla: esc(l.classifica),
    });
  }

  // il nome di un'arma nella lingua corrente: per id, col nome del
  // server come fallback (i18n fetta 2)
  nomeArma(tipo, fallback) {
    const k = 'arma.' + tipo;
    const v = tr(k);
    return v === k ? fallback : v;
  }

  groupLabel(g) {
    const l = this.tasti || { bordataSin: 'Q', bordataDes: 'E', pruaPoppa: 'SPAZIO' };
    return {
      left: tr('gruppo.left', { k: l.bordataSin }),
      right: tr('gruppo.right', { k: l.bordataDes }),
      bow: tr('gruppo.bow', { k: l.pruaPoppa }),
      stern: tr('gruppo.stern', { k: l.pruaPoppa }),
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
      btn.textContent = a.inAscolto ? tr('timoneria.premi') : a.label;
      if (a.inAscolto) btn.className = 'inAscolto';
      btn.setAttribute('aria-label', tr('timoneria.tasto.aria', { nome: a.nome, label: a.label }));
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
      $('assedioInfo').textContent = tr('assedio.nessuno');
      $('assedioTeams').innerHTML = '';
      $('joinCorr').disabled = $('joinBlocc').disabled = false;
      return;
    }
    const target = m.target ? m.target.name : '?';
    const phases = {
      lobby: tr('assedio.lobby', { t: target }),
      countdown: tr('assedio.countdown', { t: target, s: m.timeLeft }),
      running: tr('assedio.running', { t: target, s: m.timeLeft }),
    };
    hud.textContent = phases[m.phase] || '';
    hud.classList.remove('hidden');
    $('assedioInfo').textContent = phases[m.phase];
    $('assedioTeams').innerHTML =
      `<div><b>${tr('assedio.corridori')}</b><br>${m.corridori.map(esc).join('<br>') || '—'}</div>` +
      `<div><b>${tr('assedio.bloccatori')}</b><br>${m.bloccatori.map(esc).join('<br>') || '—'}</div>`;
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
    $('boardTable').innerHTML = tr('board.testata') +
      rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.gold}</td></tr>`).join('');
    this.show('board');
  }

  showTreasureMap(from, island, url) {
    const canvas = $('mapCanvas');
    const w = Math.min(1060, innerWidth * 0.82);
    canvas.width = w; canvas.height = Math.round(w * 0.62);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', tr('map.verso.aria', { nome: nomeIsola(island) }));
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
      [tr('nave.scafo'), m.ship.hullCost, 'stat-hull'], [tr('nave.vele'), m.ship.sailsCost, 'stat-sails'],
      [tr('nave.timone'), m.ship.helmCost ?? null, 'stat-helm'], [tr('nave.ciurma'), m.ship.crewCost ?? null, 'stat-crew'],
      [tr('nave.stiva'), m.ship.holdCost ?? null, 'stat-hold'],
    ];
    for (const [nome, costo, fk] of linee) {
      if (costo !== null && costo !== undefined) candidati.push({ testo: tr('consiglio.punto', { nome }), costo, fk, scheda: 'nave' });
    }
    for (const [g, data] of Object.entries(m.groups)) {
      for (const s of data.slots) {
        if (s.upCost !== null) candidati.push({ testo: tr('consiglio.potenzia', { arma: this.nomeArma(s.type, s.name), gruppo: this.groupLabel(g) }), costo: s.upCost, fk: `up-${g}-${s.slot}`, scheda: 'armi' });
        else if (s.replace) candidati.push({ testo: tr('consiglio.passa', { arma: this.nomeArma(s.replace.type, s.replace.name), gruppo: this.groupLabel(g) }), costo: s.replace.cost, fk: `rep-${g}-${s.slot}`, scheda: 'armi' });
      }
      if (data.nextSlotCost !== null) candidati.push({ testo: tr('consiglio.slot', { gruppo: this.groupLabel(g) }), costo: data.nextSlotCost, fk: `slot-${g}`, scheda: 'armi' });
    }
    const box = $('shopConsiglio');
    box.innerHTML = '';
    if (!candidati.length) {
      box.textContent = tr('consiglio.completo');
      box.classList.remove('hidden');
      return;
    }
    const abbordabili = candidati.filter(c => c.costo <= m.gold).sort((a, b) => b.costo - a.costo);
    if (abbordabili.length) {
      const c = abbordabili[0];
      const testo = document.createElement('span');
      testo.textContent = tr('consiglio.consiglia', { cosa: c.testo, costo: c.costo });
      const vai = document.createElement('button');
      vai.className = 'linkish';
      vai.textContent = tr('consiglio.portamici');
      vai.setAttribute('aria-label', tr('consiglio.vai.aria', { cosa: c.testo }));
      vai.addEventListener('click', () => {
        this._shopMostra(c.scheda);
        const el = $('shopOverlay').querySelector(`[data-fk="${c.fk}"]`);
        if (el) { el.focus(); el.classList.add('occhiolino'); setTimeout(() => el.classList.remove('occhiolino'), 1600); }
      });
      box.append(testo, vai);
    } else {
      const c = candidati.sort((a, b) => a.costo - b.costo)[0];
      box.textContent = tr('consiglio.riempi', { cosa: c.testo, costo: c.costo, oro: m.gold });
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
      const nome = !pieno ? esc(tr('tipo.' + m.varo.tipo))
        : m.varo.tipo === 'galeone' ? tr('classe.dorato')
          : m.varo.tipo === 'goletta' ? tr('classe.golettavet')
            : m.varo.tipo === 'guerra' ? tr('classe.guerravet') : esc(tr('tipo.' + m.varo.tipo));
      banner.innerHTML = tr('shop.nave.banner', { nome, sotto: esc(tr('motto.' + m.varo.tipo)) });
    } else {
      const classe = h >= 4 ? (v >= 4 ? tr('classe.dorato') : tr('classe.galeone')) : h >= 2 ? tr('classe.brigantino') : tr('classe.sloop');
      const prossima = h >= 4
        ? (v >= 4 ? tr('classe.regina') : tr('classe.versoDorato'))
        : h >= 2 ? tr('classe.versoGaleone') : tr('classe.versoBrigantino');
      banner.innerHTML = tr('shop.nave.banner', { nome: classe, sotto: prossima });
    }
    ship.appendChild(banner);
    ship.appendChild(this.statRow('🛡 ' + tr('nave.scafo'), tr('nave.scafo.desc'), m.ship.hullLvl, 4, m.ship.hullCost, m.gold,
      () => this.h.onBuyShip('hull'), 'stat-hull'));
    ship.appendChild(this.statRow('⛵ ' + tr('nave.vele'), tr('nave.vele.desc'), m.ship.sailsLvl, 4, m.ship.sailsCost, m.gold,
      () => this.h.onBuyShip('sails'), 'stat-sails'));
    ship.appendChild(this.statRow('☸ ' + tr('nave.timone'), tr('nave.timone.desc'), m.ship.helmLvl | 0, 4, m.ship.helmCost ?? null, m.gold,
      () => this.h.onBuyShip('helm'), 'stat-helm'));
    ship.appendChild(this.statRow('💪 ' + tr('nave.ciurma'), tr('nave.ciurma.desc'), m.ship.crewLvl | 0, 4, m.ship.crewCost ?? null, m.gold,
      () => this.h.onBuyShip('crew'), 'stat-crew'));
    ship.appendChild(this.statRow('🛢 ' + tr('nave.stiva'), tr('nave.stiva.desc'), m.ship.holdLvl | 0, 4, m.ship.holdCost ?? null, m.gold,
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
      const nomeAb = tr('abilita.' + m.varo.tipo + '.nome');
      const effettoRaw = i.ap ? tr('abilita.' + m.varo.tipo + '.effetto', i.ap) : i.effetto;
      const effetto = /[.!?]$/.test(effettoRaw.trim()) ? effettoRaw.trim() : effettoRaw.trim() + '.';
      abBox.innerHTML = tr('armi.r.mia', { emo: EMOJI_AB[m.varo.tipo] || '✦', nome: esc(nomeAb), effetto: esc(effetto), cd: i.cd, tipo: esc(tr('tipo.' + m.varo.tipo)) });
    } else {
      abBox.innerHTML = tr('armi.r.nessuna');
    }
    const vaiVaro = document.createElement('button');
    vaiVaro.textContent = tr('armi.cambiavaro');
    vaiVaro.setAttribute('aria-label', tr('armi.cambiavaro.aria'));
    vaiVaro.addEventListener('click', () => this._shopMostra('varo'));
    abBox.appendChild(vaiVaro);
    wep.appendChild(abBox);
    // le altre tre, in una riga sola: si capisce il menu senza cambiare scheda
    if (m.varo && m.varo.tipi) {
      const altre = Object.entries(m.varo.tipi)
        .filter(([k]) => k !== m.varo.tipo)
        .map(([k]) => `${EMOJI_AB[k] || '✦'} ${tr('abilita.' + k + '.nome')} (${tr('tipo.' + k)})`)
        .join(' · ');
      if (altre) {
        const notaAb = document.createElement('p');
        notaAb.className = 'shopNota';
        notaAb.textContent = tr('armi.altre', { lista: altre });
        wep.appendChild(notaAb);
      }
    }
    // il ponte fra Cantiere e mare (audit Cantiere): le munizioni si
    // scelgono al timone, ma è QUI che uno se lo chiede
    const nota = document.createElement('p');
    nota.className = 'shopNota';
    nota.textContent = tr('armi.nota');
    wep.appendChild(nota);
    for (const [g, data] of Object.entries(m.groups)) {
      // il tipo non regge il gruppo (galeone senza assiali): niente vetrina vuota
      if (!data.max && !data.slots.length) continue;
      const block = document.createElement('div');
      block.className = 'wgroup';
      const head = document.createElement('div');
      head.className = 'wgroupHead';
      head.innerHTML = `<b>${this.groupLabel(g)}</b><span>${tr('armi.slotcount', { n: data.slots.length, max: data.max })}</span>`;
      block.appendChild(head);
      for (const s of data.slots) {
        const row = document.createElement('div');
        row.className = 'wslot';
        const pips = '●'.repeat(s.lvl) + '○'.repeat(3 - s.lvl);
        // la scheda dell'arma (audit Cantiere): i numeri del livello attuale
        const statRiga = s.stats
          ? `<span class="wstat">${tr('armi.stats', { dmg: s.stats.dmg, range: s.stats.range, reload: s.stats.reload })}</span>` : '';
        row.innerHTML = `<div class="wname"><b>${esc(this.nomeArma(s.type, s.name))}</b> <span class="tier">${tr('armi.tier', { r: ROMAN[s.tier - 1] })}</span><span class="pips">${pips}</span>${statRiga}</div>`;
        // la colonna delle azioni (audit Cantiere 2): potenzia/sostituisci
        // E il ripensamento ⇄ delle esclusive convivono, impilati
        const azioni = document.createElement('div');
        azioni.className = 'wazioni';
        if (s.upCost !== null) {
          const b = document.createElement('button');
          b.textContent = tr('armi.potenzia', { costo: s.upCost });
          b.setAttribute('aria-label', tr('armi.potenzia.aria', { nome: this.nomeArma(s.type, s.name), gruppo: this.groupLabel(g), costo: s.upCost }));
          b.dataset.fk = `up-${g}-${s.slot}`;
          b.disabled = m.gold < s.upCost;
          if (b.disabled) b.title = tr('costo.mancano', { costo: s.upCost, oro: m.gold });
          b.addEventListener('click', () => this.h.onUpgradeWeapon(g, s.slot));
          azioni.appendChild(b);
        } else if (s.replace) {
          const b = document.createElement('button');
          b.className = 'tierUp';
          const gratis = s.replace.posseduta;
          b.textContent = gratis ? tr('armi.giatua', { nome: this.nomeArma(s.replace.type, s.replace.name) }) : tr('armi.sostituisci', { nome: this.nomeArma(s.replace.type, s.replace.name), costo: s.replace.cost });
          const conStats = s.replace.stats
            ? ` (${tr('armi.stats.brevi', { dmg: s.replace.stats.dmg, range: s.replace.stats.range, reload: s.replace.stats.reload })})` : '';
          b.setAttribute('aria-label', gratis
            ? tr('armi.rimonta.aria', { nome: s.replace.name, stats: conStats })
            : tr('armi.sostituisci.aria', { da: s.name, a: s.replace.name, stats: conStats, costo: s.replace.cost }));
          b.dataset.fk = `rep-${g}-${s.slot}`;
          b.disabled = !gratis && m.gold < s.replace.cost;
          b.title = b.disabled
            ? tr('costo.mancano', { costo: s.replace.cost, oro: m.gold })
            : `${s.replace.name}${conStats}`;
          b.addEventListener('click', () => this.h.onReplaceWeapon(g, s.slot));
          azioni.appendChild(b);
        } else if (!s.indietro) {
          const span = document.createElement('span');
          span.className = 'maxed';
          span.textContent = tr('armi.suprema');
          azioni.appendChild(span);
        }
        if (s.indietro) {
          const b = document.createElement('button');
          b.textContent = tr('armi.indietro', { nome: this.nomeArma('mortaio', s.indietro.name) });
          b.setAttribute('aria-label', tr('armi.indietro.aria', { a: s.indietro.name, da: s.name }));
          b.dataset.fk = `giu-${g}-${s.slot}`;
          b.title = tr('armi.indietro.title');
          b.addEventListener('click', () => this.h.onTornaMortaio(g, s.slot));
          azioni.appendChild(b);
        }
        row.appendChild(azioni);
        block.appendChild(row);
      }
      if (data.nextSlotCost !== null) {
        const add = document.createElement('button');
        add.className = 'addSlot';
        add.textContent = tr('armi.nuovoslot', { costo: data.nextSlotCost });
        add.dataset.fk = `slot-${g}`;
        add.disabled = m.gold < data.nextSlotCost;
        if (add.disabled) add.title = tr('costo.mancano', { costo: data.nextSlotCost, oro: m.gold });
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
      ? tr('varo.nota.cambia', { costo: varo.cost })
      : tr('varo.nota.primo', { costo: varo.cost });
    block.appendChild(nota);
    for (const [key, t] of Object.entries(varo.tipi)) {
      const eff = [];
      if (t.hpMul !== 1) eff.push(tr('varo.eff.scafo', { pct: pct(t.hpMul) }));
      if (t.speedMul !== 1) eff.push(tr('varo.eff.velocita', { pct: pct(t.speedMul) }));
      if (t.turnMul !== 1) eff.push(tr('varo.eff.virata', { pct: pct(t.turnMul) }));
      eff.push(tr('varo.eff.sconto', { linea: LINEA[t.sconto] }));
      const row = document.createElement('div');
      row.className = 'shopRow';
      // la carta spiega (audit Cantiere): cosa fa R, quanto dura, ogni
      // quanto torna — e l'esclusiva coi suoi numeri, non solo il nome
      const ab = t.abilitaInfo;
      const es = t.esclusivaInfo;
      const nomeAbil = ab ? tr('abilita.' + key + '.nome') : (t.abilita || '—');
      const effettoAbil = ab ? (ab.ap ? tr('abilita.' + key + '.effetto', ab.ap) : ab.effetto) : '';
      const nomeEscl = t.esclusivaId ? this.nomeArma(t.esclusivaId, t.esclusiva) : t.esclusiva;
      const righeExtra = ab
        ? `<span class="effetti abilitaRiga">${tr('varo.abilita.riga', { nome: esc(nomeAbil), cd: ab.cd, effetto: esc(effettoAbil) })}</span>
           <span class="effetti esclusivaRiga">${tr('varo.esclusiva.riga', { nome: esc(nomeEscl) })}${es ? ` — ${tr('armi.stats', { dmg: es.dmg, range: es.range, reload: es.reload })}` : ''}</span>`
        : `<span class="effetti">${tr('varo.riga.breve', { abilita: esc(nomeAbil), esclusiva: esc(nomeEscl) })}</span>`;
      row.innerHTML = `<div class="shopInfo"><b>${EMOJI[key] || '⚓'} ${esc(tr('tipo.' + key))}</b><span>${esc(tr('motto.' + key))}</span>
        <span class="effetti">${esc(eff.join(' · '))}</span>${righeExtra}</div>`;
      const btn = document.createElement('button');
      btn.dataset.fk = `varo-${key}`;
      if (varo.tipo === key) { btn.textContent = tr('varo.tuanave'); btn.disabled = true; }
      else {
        btn.textContent = tr('varo.vara', { costo: varo.cost });
        btn.setAttribute('aria-label', tr('varo.vara.aria', { nome: tr('tipo.' + key), costo: varo.cost }));
        btn.disabled = gold < varo.cost;
        if (btn.disabled) btn.title = tr('costo.mancano', { costo: varo.cost, oro: gold });
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
    nota.textContent = tr('livree.nota');
    block.appendChild(nota);
    // anteprima FEDELE della nave (issue #34): mostra la nave con la livrea
    // indossata — feedback immediato, dato che attraccati la nave è invisibile
    const anteprima = document.createElement('div');
    anteprima.className = 'livreaPreview';
    anteprima.innerHTML = `<span class="sub">${tr('livree.anteprima')}</span>`;
    block.appendChild(anteprima);
    if (this.h.onLivreaPreview) {
      this.h.onLivreaPreview(negozio.livrea || null, negozio.vele || null).then((canvas) => {
        anteprima.innerHTML = '';
        if (canvas) { canvas.className = 'livreaPreviewCanvas'; anteprima.appendChild(canvas); }
        else anteprima.innerHTML = `<span class="sub">${tr('livree.salpa')}</span>`;
      }).catch(() => { anteprima.innerHTML = ''; });
    }
    const possedute = new Set(negozio.possedute || []);
    // tre sezioni, una per GENERE: ogni genere veste il suo slot e basta
    // (mai collassare l'uno nell'altro: era la trappola livree/vele). Un
    // genere che questo client non conosce non si mostra: non si può
    // indossare quel che non si sa dove va.
    const SEZIONI = [
      ['livrea', tr('livree.sez.livrea'), tr('livree.sez.livrea.desc')],
      ['vele', tr('livree.sez.vele'), tr('livree.sez.vele.desc')],
      ['scia', tr('livree.sez.scia'), tr('livree.sez.scia.desc')],
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
          btn.textContent = tr('livree.riponi');
          btn.setAttribute('aria-label', tr('livree.riponi.aria', { nome: l.nome }));
          btn.addEventListener('click', () => this.h.onIndossaLivrea(null, genere));
          row.classList.add('indossata');
        } else if (possedute.has(id)) {
          btn.textContent = tr('livree.indossa');
          btn.setAttribute('aria-label', tr('livree.indossa.aria', { nome: l.nome }));
          btn.addEventListener('click', () => this.h.onIndossaLivrea(id, genere));
        } else if (l.prezzo === null) {
          btn.textContent = tr('livree.guadagna');
          btn.disabled = true;
          btn.title = tr('livree.guadagna.title');
        } else {
          btn.textContent = tr('livree.compra', { costo: l.prezzo });
          btn.setAttribute('aria-label', tr('livree.compra.aria', { nome: l.nome, costo: l.prezzo }));
          btn.disabled = gold < l.prezzo;
          if (btn.disabled) btn.title = tr('costo.mancano', { costo: l.prezzo, oro: gold });
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
    vHead.innerHTML = tr('vessillo.head');
    block.appendChild(vHead);
    const vRow = document.createElement('div');
    vRow.className = 'vessillo';
    const canvas = document.createElement('canvas');
    canvas.width = 90; canvas.height = 60;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', tr('vessillo.anteprima.aria'));
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
      sel.setAttribute('aria-label', tr('vessillo.sel.aria', { label }));
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
    issa.textContent = negozio.bandiera ? tr('vessillo.cambia') : tr('vessillo.issa');
    issa.addEventListener('click', () => this.h.onVessillo(bozza()));
    vRow.append(canvas, scelte, issa);
    if (negozio.bandiera) {
      const ammaina = document.createElement('button');
      ammaina.className = 'linkish';
      ammaina.textContent = tr('vessillo.ammaina');
      ammaina.setAttribute('aria-label', tr('vessillo.ammaina.aria'));
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
    const TIPI_NOMI = { goletta: tr('tipo.goletta'), guerra: tr('tipo.guerra'), galeone: tr('tipo.galeone'), sciabecco: tr('tipo.sciabecco') };
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
    sez(tr('reg.nave'), [
      d.tipo ? tr('reg.tipo', { nome: esc(TIPI_NOMI[d.tipo] || d.tipo), n: d.vari | 0 }) : tr('reg.senzavaro'),
      tr('reg.battaglie', { v: d.kills | 0, n: d.deaths | 0 }),
    ]);
    const armi = {};
    for (const g of Object.values(d.mounts || {})) {
      for (const w of g || []) {
        const nome = (d.arsenal && d.arsenal.types[w.type] && d.arsenal.types[w.type].name) || w.type;
        armi[nome] = Math.max(armi[nome] || 0, w.lvl);
      }
    }
    sez(tr('reg.arsenale'), Object.entries(armi).length
      ? Object.entries(armi).map(([n, l]) => `${esc(n)} <span class="pips">${'●'.repeat(l)}${'○'.repeat(3 - l)}</span>`)
      : [tr('reg.arsenale.vuoto')]);
    sez(tr('reg.fortezze'), (d.conquered || []).length
      ? d.conquered.slice(0, 20).map(x => esc(x)).concat(d.conquered.length > 20 ? [tr('reg.altre', { n: d.conquered.length - 20 })] : [])
      : [tr('reg.fortezze.vuoto')]);
    sez(tr('reg.approdi'), (d.preferiti || []).length ? d.preferiti.map(x => esc(x)) : [tr('reg.approdi.vuoto')]);
    const cat = d.catalogo || {};
    const tot = Object.keys(cat).length;
    sez(tr('reg.guardaroba', { n: (d.livree || []).length, tot }), tot
      ? Object.entries(cat).map(([id, l]) => {
        const ha = (d.livree || []).includes(id);
        const addosso = d.livrea === id || d.vele === id || d.scia === id;
        return `${ha ? '✅' : '◻️'} ${esc(l.nome)}${addosso ? ' <b>' + tr('reg.addosso') + '</b>' : ''}${!ha && l.impresa ? ' — ' + tr('reg.concampagna') : ''}`;
      })
      : [tr('reg.negozio.vuoto')]);
    if (d.campagna && d.campagna.completata) {
      sez(tr('reg.mastro'), [tr('reg.mastro.compiuta')]);
    }
    this.show('registroOverlay');
  }

  statRow(title, desc, lvl, maxLvl, cost, gold, onBuy, fk) {
    const row = document.createElement('div');
    row.className = 'shopRow';
    row.innerHTML = `<div class="shopInfo"><b>${title}</b><span>${desc}</span>
      <span class="pips" role="img" aria-label="${tr('statrow.livello.aria', { lvl, max: maxLvl })}">${'●'.repeat(lvl)}${'○'.repeat(maxLvl - lvl)}</span></div>`;
    const btn = document.createElement('button');
    if (fk) btn.dataset.fk = fk;
    if (cost === null) { btn.textContent = tr('azione.massimo'); btn.disabled = true; }
    else {
      btn.textContent = `${cost} 🪙`;
      btn.setAttribute('aria-label', tr('statrow.compra.aria', { cosa: title.replace(/^\S+ /, ''), costo: cost }));
      btn.disabled = gold < cost;
      if (btn.disabled) btn.title = tr('costo.mancano', { costo: cost, oro: gold });
      btn.addEventListener('click', onBuy);
    }
    row.appendChild(btn);
    return row;
  }

  showSearch() { this.show('searchOverlay'); $('searchInput').value = ''; $('searchInput').focus(); }

  showSiteFallback(island, url) {
    $('siteTitle').textContent = tr('sito.attraccato', { nome: nomeIsola(island) });
    $('siteLink').href = url;
    this.show('siteOverlay');
  }

  showDockbar(island, url) {
    $('dockInfo').textContent = `⚓ ${nomeIsola(island)}`;
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
    sub.textContent = `${g.categoria} · ${g.aperta ? tr('gilda.aperte') : tr('gilda.chiuse')}` + (g.motto ? ` · “${g.motto}”` : '');
    info.append(h3, sub);
    testa.appendChild(info);
    box.appendChild(testa);

    // le richieste in rada (solo per chi ha i galloni)
    if (g.richieste && g.richieste.length) {
      const h4 = document.createElement('h3');
      h4.className = 'shopSection';
      h4.textContent = tr('gilda.richieste');
      box.appendChild(h4);
      for (const r of g.richieste) {
        const riga = document.createElement('div');
        riga.className = 'gildaRiga';
        const nome = document.createElement('span');
        nome.textContent = r.nome;
        const si = document.createElement('button');
        si.textContent = tr('gilda.ammetti');
        si.addEventListener('click', () => this.h.onGildaApprova(r.uid));
        const no = document.createElement('button');
        no.className = 'linkish';
        no.textContent = tr('gilda.rifiuta');
        no.addEventListener('click', () => this.h.onGildaRifiuta(r.uid));
        riga.append(nome, si, no);
        box.appendChild(riga);
      }
    }

    const h4m = document.createElement('h3');
    h4m.className = 'shopSection';
    h4m.textContent = tr('gilda.ciurma', { n: g.membri.length });
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
        pr.textContent = tr('gilda.promuovi');
        pr.addEventListener('click', () => this.h.onGildaPromuovi(m.uid));
        riga.appendChild(pr);
      }
      if (m.uid && m.ruolo !== 'capitano' && (capitano || (g.mioRuolo === 'ufficiale' && m.ruolo === 'marinaio'))) {
        const ex = document.createElement('button');
        ex.className = 'linkish';
        ex.textContent = tr('gilda.sbarcalo');
        ex.addEventListener('click', () => this.h.onGildaEspelli(m.uid));
        riga.appendChild(ex);
      }
      box.appendChild(riga);
    }

    if (g.log && g.log.length) {
      const h4l = document.createElement('h3');
      h4l.className = 'shopSection';
      h4l.textContent = tr('gilda.log');
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
      sc.textContent = tr('gilda.sciogli');
      sc.addEventListener('click', () => {
        if (sc.dataset.conferma) this.h.onGildaSciogli();
        else { sc.dataset.conferma = '1'; sc.textContent = tr('gilda.sciogli.conferma'); }
      });
      azioni.appendChild(sc);
    } else {
      const la = document.createElement('button');
      la.className = 'linkish';
      la.textContent = tr('gilda.lasciala');
      la.addEventListener('click', () => this.h.onGildaLascia());
      azioni.appendChild(la);
    }
    box.appendChild(azioni);
  }

  _renderElencoGilde(elenco, fondazione) {
    $('gfFonda').textContent = tr('gilda.fonda.costo', { costo: fondazione });
    const box = $('gildaElencoBox');
    box.innerHTML = '';
    if (!elenco.length) {
      const p = document.createElement('p');
      p.className = 'sub';
      p.textContent = tr('gilda.nessuna');
      box.appendChild(p);
      return;
    }
    for (const g of elenco) {
      const riga = document.createElement('div');
      riga.className = 'gildaRiga';
      riga.appendChild(this._bandierina(g.bandiera));
      const info = document.createElement('span');
      info.className = 'gildaInfo';
      info.textContent = `«${g.nome}» [${g.tag}] — ${g.categoria} · ${g.membri.length}/24 · ${g.aperta ? tr('gilda.tag.aperta') : tr('gilda.tag.chiusa')}`;
      riga.appendChild(info);
      const chiedi = document.createElement('button');
      chiedi.textContent = g.sfidabile ? tr('gilda.chiedi') : tr('gilda.rito.prima');
      chiedi.disabled = !g.sfidabile;
      chiedi.title = g.sfidabile
        ? tr('gilda.chiedi.title')
        : tr('gilda.rito.title');
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
      titolo(mia, tr('alleanza.mia', { n: d.mia.membri.length, max: d.mia.max }));
      for (const m of d.mia.membri) {
        const r = riga(mia);
        const nome = document.createElement('span');
        nome.textContent = `⛵ ${m.nome}${m.id === d.meId ? tr('alleanza.tu') : ''}`;
        r.appendChild(nome);
      }
      const azioni = document.createElement('div');
      azioni.className = 'row';
      const bandiera = document.createElement('button');
      bandiera.textContent = d.mia.aperta ? tr('alleanza.ammaina') : tr('alleanza.issa');
      bandiera.title = d.mia.aperta
        ? 'Chiudi l\'arruolamento: nessun altro potrà unirsi da solo'
        : 'Chiunque potrà unirsi finché c\'è posto';
      bandiera.addEventListener('click', () => d.mia.aperta ? this.h.onAlleanzaChiudi() : this.h.onAlleanzaApri());
      const lascia = document.createElement('button');
      lascia.className = 'linkish';
      lascia.textContent = tr('alleanza.sciogli');
      lascia.setAttribute('aria-label', tr('alleanza.lascia.aria'));
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
        nome.textContent = tr('alleanza.propone', { nome: i.nome });
        const si = document.createElement('button');
        si.textContent = tr('alleanza.accetta');
        si.disabled = !!d.mia;
        if (si.disabled) si.title = tr('alleanza.giadentro');
        si.addEventListener('click', () => this.h.onAlleanzaAccetta(i.id));
        const no = document.createElement('button');
        no.className = 'linkish';
        no.textContent = tr('alleanza.declina');
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
        nome.textContent = tr('alleanza.bandiera.riga', { nomi: b.nomi.join(', '), n: b.posti, posti: b.posti === 1 ? tr('alleanza.posto') : tr('alleanza.posti') });
        const btn = document.createElement('button');
        btn.textContent = tr('alleanza.unisciti');
        btn.setAttribute('aria-label', tr('alleanza.unisciti.aria', { nomi: b.nomi.join(', ') }));
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
      p.textContent = tr('alleanza.nessuno');
      box.appendChild(p);
      return;
    }
    if (!scelti.length) {
      const p = document.createElement('p');
      p.className = 'sub';
      p.textContent = tr('alleanza.nonrisponde', { f: filtro });
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
      btn.textContent = tr('alleanza.invita');
      btn.setAttribute('aria-label', tr('alleanza.invita.aria', { nome: c.nome }));
      btn.disabled = !!pieno;
      if (pieno) btn.title = tr('alleanza.piena');
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
    box.appendChild(this._sez(tr('diario.incorso')));
    let qualcosa = false;
    if (s.campagna) { box.appendChild(this._cardCampagna(s.campagna)); qualcosa = true; }
    if (s.dungeon && !s.dungeon.fatto) { box.appendChild(this._cardDungeon(s.dungeon)); qualcosa = true; }
    if (!qualcosa) box.appendChild(this._vuoto(tr('diario.vuoto.mastro')));
    box.appendChild(this._sez(tr('diario.tredelgiorno')));
    const g = s.giornaliere;
    if (!g || !(g.giornaliere || []).length) {
      box.appendChild(this._vuoto(tr('diario.vuoto.rotte')));
      return;
    }
    for (const m of g.giornaliere) box.appendChild(this._cardMissione(m));
    box.appendChild(this._cardGiorno(g));
  }

  // una giornaliera: niente da accettare, si compie e basta (una volta al giorno)
  _cardMissione(m) {
    const c = document.createElement('div');
    c.className = 'impresaCard' + (m.fatta ? ' fatta' : '');
    const h = document.createElement('h4'); h.textContent = (m.fatta ? '✓ ' : '') + (m.key ? tMsg('missione.' + m.key, { tld: m.tld, n: m.n }) : m.desc);
    const r = document.createElement('span'); r.className = 'reward';
    r.textContent = m.fatta ? tr('diario.incassati', { r: m.reward }) : `+${m.reward} 🪙`;
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
    h.textContent = tris.fatto ? tr('diario.tris.fatto') : tr('diario.tris');
    c.appendChild(h);
    c.appendChild(riga(tris.fatto
      ? tr('diario.tris.tutte', { v: valeOggi, n: strike.n, giorni: strike.n === 1 ? tr('diario.giorno') : tr('diario.giorni') })
      : tr('diario.tris.compi', { v: valeOggi, p: tris.premio, x: Math.min(catena, strike.cap) })));
    c.appendChild(riga(tr('diario.settimana', { n: sett.pieni, p: sett.premio })));
    if (g.scadenza) {
      const ms = Math.max(0, g.scadenza - Date.now());
      const ore = Math.floor(ms / 36e5), minuti = Math.floor((ms % 36e5) / 6e4);
      c.appendChild(riga(tr('diario.rinnovo', { h: ore, m: minuti })));
    }
    return c;
  }

  _cardCampagna(campagna) {
    const cb = document.createElement('div'); cb.className = 'impresaCard mastro';
    const h = document.createElement('h4'); h.textContent = tr('diario.campagna', { nome: campagna.nome });
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
    premio.textContent = campagna.completata ? tr('diario.compiuta', { p: campagna.premio }) : tr('diario.premio', { p: campagna.premio });
    cb.appendChild(premio);
    return cb;
  }

  _cardDungeon(d) {
    const c = document.createElement('div'); c.className = 'impresaCard dungeon';
    const h = document.createElement('h4'); h.textContent = tr('diario.dungeon', { nome: d.nome });
    c.appendChild(h);
    const sub = document.createElement('p'); sub.className = 'sub';
    sub.textContent = d.bersaglio ? tr('diario.assalta', { b: d.bersaglio }) : tr('diario.espugna');
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
    for (const [key, lab] of [['mie', tr('diario.mie')], ['tutte', tr('diario.tutte')]]) {
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
        ? tr('diario.vuoto.mie')
        : tr('diario.vuoto.tutte')));
      return;
    }
    for (const v of voci) {
      const riga = document.createElement('div');
      riga.className = 'gazzettaVoce' + (s.lettaFino != null && v.t > s.lettaFino ? ' nuova' : '');
      const quando = document.createElement('time');
      quando.textContent = faTempo(v.t);
      quando.dateTime = new Date(v.t).toISOString();
      const testo = document.createElement('p');
      testo.textContent = v.k ? tMsg(v.k, v.p) : v.testo;
      riga.append(quando, testo);
      box.appendChild(riga);
    }
  }

  // la stella dell'approdo preferito (issue #13), su dockbar e pannello sito
  setFav(on) {
    $('favBtn').textContent = on ? '★' : '☆';
    $('favBtn').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('favBtnSito').textContent = on ? tr('sito.pref.on') : tr('sito.preferito');
    $('favBtnSito').setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  hideDockbar() { this.hide('dockbar'); document.body.classList.remove('attraccato'); }

  showDeath(seconds, dettagli = {}) {
    // la morte racconta (issue #23): chi, quanto perso, quanto in salvo
    const conto = $('deathConto');
    const consiglio = $('deathConsiglio');
    if (dettagli.da) {
      let testo = dettagli.da === 'Il Mare'
        ? tr('morte.mare') : tr('morte.da', { chi: dettagli.da });
      if (dettagli.perso > 0) {
        testo += tr('morte.perso', { p: dettagli.perso }) +
          (dettagli.salvo > 0 ? tr('morte.salvo', { s: dettagli.salvo }) : '.');
      } else {
        testo += tr('morte.abissi');
      }
      conto.textContent = testo;
      const stivaPiena = (dettagli.holdLvl | 0) >= 4;
      consiglio.textContent = tr('morte.consiglio');
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
