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
const OVERLAY_ORDINE = ['gildaOverlay', 'gazzettaOverlay', 'helpOverlay', 'settingsOverlay', 'assedioOverlay',
  'mapOverlay', 'shopOverlay', 'searchOverlay', 'siteOverlay', 'deathOverlay', 'salpaOverlay', 'nameOverlay'];

// La disciplina dei pannelli (issue #18): i fluttuanti si ESCLUDONO a vicenda
// (aprirne uno chiude l'altro), quelli di banchina si SOSPENDONO sotto e
// tornano a galla alla chiusura — mai due pannelli impilati a schermo.
const FLUTTUANTI = ['gildaOverlay', 'gazzettaOverlay', 'helpOverlay', 'settingsOverlay', 'assedioOverlay', 'mapOverlay'];
const DI_BANCHINA = ['shopOverlay', 'searchOverlay', 'siteOverlay'];
// I documenti lunghi si aprono dall'INIZIO: fuoco al pannello (2.4.3 resta:
// il fuoco entra comunque nel dialogo), non al primo campo in fondo.
const DALL_INIZIO = ['gildaOverlay', 'gazzettaOverlay', 'helpOverlay', 'settingsOverlay', 'shopOverlay'];

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
    // il Cantiere a schede (issue #24): meno muro, più bottega
    this._shopScheda = 'nave';
    for (const [id, scheda] of [['tabNave', 'nave'], ['tabVaro', 'varo'], ['tabArmi', 'armi']]) {
      $(id).addEventListener('click', () => this._shopMostra(scheda));
    }
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
        volume: $('setVol').valueAsNumber / 100,
      });
    };
    $('setMusic').addEventListener('change', emitSettings);
    $('setSfx').addEventListener('change', emitSettings);
    $('setGuard').addEventListener('change', emitSettings);
    $('setCalma').addEventListener('change', emitSettings);
    $('setVol').addEventListener('input', emitSettings);
    $('assedioOpen').addEventListener('click', () => { this.show('assedioOverlay'); });
    $('assedioClose').addEventListener('click', () => this.hide('assedioOverlay'));
    $('joinCorr').addEventListener('click', () => this.h.onAssedioJoin('corridori'));
    $('joinBlocc').addEventListener('click', () => this.h.onAssedioJoin('bloccatori'));

    // click fuori dal pannello = chiudi (solo overlay non distruttivi)
    for (const oid of ['mapOverlay', 'settingsOverlay', 'assedioOverlay', 'helpOverlay', 'gazzettaOverlay']) {
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
    for (const oid of ['gazzettaOverlay', 'helpOverlay', 'settingsOverlay', 'assedioOverlay', 'mapOverlay']) {
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

  setSettings({ music, sfx, guard, calma, volume }) {
    $('setMusic').checked = music;
    $('setSfx').checked = sfx;
    $('setGuard').checked = guard;
    $('setCalma').checked = !!calma;
    $('setVol').value = Math.round(volume * 100);
    $('guardInfo').classList.toggle('spento', !guard);
  }

  // --- timoneria: tasti rimappabili (WCAG 2.1.4) ---

  setKeymap(l) {
    this.tasti = l;
    $('rlKeyLeft').textContent = `${l.bordataSin} ◀`;
    $('rlKeyRight').textContent = `${l.bordataDes} ▶`;
    $('rlKeyAxial').textContent = `${l.pruaPoppa === 'SPAZIO' ? '␣' : l.pruaPoppa} ⇅`;
    if (this._abilityEmoji) $('abilityKey').textContent = `${l.abilita} ${this._abilityEmoji}`;
    $('hint').innerHTML =
      `Vela <b>${esc(l.su)} ${esc(l.sinistra)} ${esc(l.giu)} ${esc(l.destra)}</b> · ` +
      `Bordata sin. <b>${esc(l.bordataSin)}</b> / des. <b>${esc(l.bordataDes)}</b> · ` +
      `Prua/Poppa <b>${esc(l.pruaPoppa)}</b> · Abilità <b>${esc(l.abilita)}</b> · ` +
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
    // tre soglie (#19): il giallo avvisa quando c'è ancora tempo per scappare
    bar.style.background = frac > 0.6 ? 'linear-gradient(#6cd072,#3d9944)'
      : frac > 0.35 ? 'linear-gradient(#e5c34a,#b98f22)'
        : 'linear-gradient(#e8783f,#b23a1a)';
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
    const EMO = { goletta: '🐏', guerra: '💨', galeone: '💥' };
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

  setMission(m) {
    $('missionHud').innerHTML =
      `📜 <b>Missione:</b> ${esc(m.desc)} — <b>${m.progress}/${m.n}</b> <span class="reward">(+${m.reward} 🪙)</span>`;
    this.show('missionHud');
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

  // le tre schede del Cantiere (issue #24): una alla volta, niente muro
  _shopMostra(scheda) {
    this._shopScheda = scheda;
    $('shopShip').classList.toggle('hidden', scheda !== 'nave');
    $('shopVaro').classList.toggle('hidden', scheda !== 'varo');
    $('shopWeapons').classList.toggle('hidden', scheda !== 'armi');
    $('tabNave').setAttribute('aria-pressed', scheda === 'nave');
    $('tabVaro').setAttribute('aria-pressed', scheda === 'varo');
    $('tabArmi').setAttribute('aria-pressed', scheda === 'armi');
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
      const dorato = m.varo.tipo === 'galeone' && h >= 4 && v >= 4;
      banner.innerHTML = `⚓ La tua nave: <b>${dorato ? 'Galeone Dorato' : esc(tuoTipo.nome)}</b> — ${esc(tuoTipo.motto)}`;
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
    this._shopConsiglia(m);

    const wep = $('shopWeapons');
    wep.innerHTML = '';
    for (const [g, data] of Object.entries(m.groups)) {
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
        row.innerHTML = `<div class="wname"><b>${esc(s.name)}</b> <span class="tier">Tier ${ROMAN[s.tier - 1]}</span><span class="pips">${pips}</span></div>`;
        if (s.upCost !== null) {
          const b = document.createElement('button');
          b.textContent = `Potenzia · ${s.upCost} 🪙`;
          b.setAttribute('aria-label', `Potenzia ${s.name} (${this.groupLabel(g)}) per ${s.upCost} monete`);
          b.dataset.fk = `up-${g}-${s.slot}`;
          b.disabled = m.gold < s.upCost;
          if (b.disabled) b.title = `Servono ${s.upCost} 🪙 — ne hai ${m.gold}`;
          b.addEventListener('click', () => this.h.onUpgradeWeapon(g, s.slot));
          row.appendChild(b);
        } else if (s.replace) {
          const b = document.createElement('button');
          b.className = 'tierUp';
          b.textContent = `→ ${s.replace.name} · ${s.replace.cost} 🪙`;
          b.setAttribute('aria-label', `Sostituisci ${s.name} con ${s.replace.name} per ${s.replace.cost} monete`);
          b.dataset.fk = `rep-${g}-${s.slot}`;
          b.disabled = m.gold < s.replace.cost;
          if (b.disabled) b.title = `Servono ${s.replace.cost} 🪙 — ne hai ${m.gold}`;
          b.addEventListener('click', () => this.h.onReplaceWeapon(g, s.slot));
          row.appendChild(b);
        } else {
          const span = document.createElement('span');
          span.className = 'maxed';
          span.textContent = 'Arma suprema';
          row.appendChild(span);
        }
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
    const EMOJI = { goletta: '🐟', guerra: '⚔', galeone: '🏰' };
    const pct = (mul) => `${mul > 1 ? '+' : ''}${Math.round((mul - 1) * 100)}%`;
    const block = document.createElement('div');
    block.className = 'wgroup';
    const head = document.createElement('div');
    head.className = 'wgroupHead';
    head.innerHTML = `<b>⚓ Il varo${varo.tipo ? '' : ' — scegli il tipo della tua nave'}</b><span>${varo.cost} 🪙</span>`;
    block.appendChild(head);
    for (const [key, t] of Object.entries(varo.tipi)) {
      const eff = [];
      if (t.hpMul !== 1) eff.push(`scafo ${pct(t.hpMul)}`);
      if (t.speedMul !== 1) eff.push(`velocità ${pct(t.speedMul)}`);
      if (t.turnMul !== 1) eff.push(`virata ${pct(t.turnMul)}`);
      eff.push(`${LINEA[t.sconto]} a metà prezzo`);
      const row = document.createElement('div');
      row.className = 'shopRow';
      if (t.abilita) eff.push(`abilità: ${t.abilita}`);
      row.innerHTML = `<div class="shopInfo"><b>${EMOJI[key] || '⚓'} ${esc(t.nome)}</b><span>${esc(t.motto)}</span>
        <span class="effetti">${esc(eff.join(' · '))} · esclusiva: ${esc(t.esclusiva)}</span></div>`;
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

  // la Gazzetta del Corsaro (issue #4): il badge dei non-letti e l'albo
  setGazzettaBadge(n) {
    const b = $('gazzettaBadge');
    b.textContent = n > 9 ? '9+' : String(n);
    b.classList.toggle('hidden', n <= 0);
    $('gazzettaBtn').setAttribute('aria-label',
      n > 0 ? `Gazzetta del Corsaro: ${n} notizie non lette` : 'Gazzetta del Corsaro');
  }

  showGazzetta(voci, lettaFino, campagna) {
    const box = $('gazzettaVoci');
    box.innerHTML = '';
    // la campagna della settimana (issue #3): la vetrina del Mastro di Rotte
    if (campagna) {
      const cb = document.createElement('div');
      cb.className = 'campagnaBox';
      const titolo = document.createElement('h3');
      titolo.textContent = `⚔ La campagna della settimana: «${campagna.nome}»`;
      const lore = document.createElement('p');
      lore.className = 'campagnaLore';
      lore.textContent = campagna.lore || '';
      const lista = document.createElement('ol');
      lista.className = 'campagnaTappe';
      campagna.tappe.forEach((t, i) => {
        const li = document.createElement('li');
        const fatta = campagna.completata || i < campagna.tappa;
        const corrente = !campagna.completata && i === campagna.tappa;
        li.className = fatta ? 'fatta' : corrente ? 'corrente' : 'futura';
        li.textContent = (fatta ? '✓ ' : corrente ? '➤ ' : '· ') + t.desc +
          (corrente && campagna.fatto > 0 ? ` (${campagna.fatto}/${t.n})` : '');
        if (t.lore && (corrente || fatta)) li.title = t.lore;
        lista.appendChild(li);
      });
      const premio = document.createElement('p');
      premio.className = 'campagnaPremio';
      premio.textContent = campagna.completata
        ? `⭐ Compiuta! Il Mastro ti ha pagato ${campagna.premio} 🪙`
        : `Premio del Mastro: ${campagna.premio} 🪙`;
      cb.append(titolo, lore, lista, premio);
      box.appendChild(cb);
    }
    if (!voci.length) {
      const p = document.createElement('p');
      p.className = 'sub';
      p.textContent = 'Il mare è quieto: nessuna notizia, per ora.';
      box.appendChild(p);
    }
    for (const v of voci) {
      const riga = document.createElement('div');
      riga.className = 'gazzettaVoce' + (v.t > lettaFino ? ' nuova' : '');
      const quando = document.createElement('time');
      quando.textContent = faTempo(v.t);
      quando.dateTime = new Date(v.t).toISOString();
      const testo = document.createElement('p');
      testo.textContent = v.testo;
      riga.append(quando, testo);
      box.appendChild(riga);
    }
    this.show('gazzettaOverlay');
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
