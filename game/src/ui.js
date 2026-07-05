// Tutta la UI DOM sopra il canvas: barra della rotta, HUD, plance e pergamene.

import { drawTreasureMap } from './mapgen.js';

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
const OVERLAY_ORDINE = ['gazzettaOverlay', 'helpOverlay', 'settingsOverlay', 'assedioOverlay',
  'mapOverlay', 'shopOverlay', 'searchOverlay', 'siteOverlay', 'deathOverlay', 'salpaOverlay', 'nameOverlay'];

// La disciplina dei pannelli (issue #18): i fluttuanti si ESCLUDONO a vicenda
// (aprirne uno chiude l'altro), quelli di banchina si SOSPENDONO sotto e
// tornano a galla alla chiusura — mai due pannelli impilati a schermo.
const FLUTTUANTI = ['gazzettaOverlay', 'helpOverlay', 'settingsOverlay', 'assedioOverlay', 'mapOverlay'];
const DI_BANCHINA = ['shopOverlay', 'searchOverlay', 'siteOverlay'];
// I documenti lunghi si aprono dall'INIZIO: fuoco al pannello (2.4.3 resta:
// il fuoco entra comunque nel dialogo), non al primo campo in fondo.
const DALL_INIZIO = ['gazzettaOverlay', 'helpOverlay', 'settingsOverlay', 'shopOverlay'];

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
    if (m.varo) ship.appendChild(this.varoBlock(m.varo, m.gold));

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
          b.addEventListener('click', () => this.h.onUpgradeWeapon(g, s.slot));
          row.appendChild(b);
        } else if (s.replace) {
          const b = document.createElement('button');
          b.className = 'tierUp';
          b.textContent = `→ ${s.replace.name} · ${s.replace.cost} 🪙`;
          b.setAttribute('aria-label', `Sostituisci ${s.name} con ${s.replace.name} per ${s.replace.cost} monete`);
          b.dataset.fk = `rep-${g}-${s.slot}`;
          b.disabled = m.gold < s.replace.cost;
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
        add.addEventListener('click', () => this.h.onBuySlot(g));
        block.appendChild(add);
      }
      wep.appendChild(block);
    }
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

  // la Gazzetta del Corsaro (issue #4): il badge dei non-letti e l'albo
  setGazzettaBadge(n) {
    const b = $('gazzettaBadge');
    b.textContent = n > 9 ? '9+' : String(n);
    b.classList.toggle('hidden', n <= 0);
    $('gazzettaBtn').setAttribute('aria-label',
      n > 0 ? `Gazzetta del Corsaro: ${n} notizie non lette` : 'Gazzetta del Corsaro');
  }

  showGazzetta(voci, lettaFino) {
    const box = $('gazzettaVoci');
    box.innerHTML = '';
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

  showDeath(seconds) {
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
