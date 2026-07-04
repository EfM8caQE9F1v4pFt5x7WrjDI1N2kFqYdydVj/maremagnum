// Tutta la UI DOM sopra il canvas: barra della rotta, HUD, plance e pergamene.

import { drawTreasureMap } from './mapgen.js';

const $ = (id) => document.getElementById(id);

const GROUP_LABELS = {
  left: '◀ Fiancata sinistra (Q)',
  right: '▶ Fiancata destra (E)',
  bow: '▲ Prua (SPAZIO)',
  stern: '▼ Poppa (SPAZIO)',
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

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
    $('navBack').addEventListener('click', () => this.h.onNavBack());
    $('navFwd').addEventListener('click', () => this.h.onNavFwd());
    $('navReload').addEventListener('click', () => this.h.onNavReload());
    $('openExt').addEventListener('click', () => this.h.onOpenExt());
    $('settingsBtn').addEventListener('click', () => this.show('settingsOverlay'));
    $('settingsClose').addEventListener('click', () => this.hide('settingsOverlay'));
    const emitSettings = (e) => {
      this.h.onSettings({
        music: $('setMusic').checked,
        sfx: $('setSfx').checked,
        guard: $('setGuard').checked,
        volume: $('setVol').valueAsNumber / 100,
      });
      if (e.target.type === 'checkbox') e.target.blur(); // non rubare il timone
    };
    $('setMusic').addEventListener('change', emitSettings);
    $('setSfx').addEventListener('change', emitSettings);
    $('setGuard').addEventListener('change', emitSettings);
    $('setVol').addEventListener('input', emitSettings);
    $('assedioOpen').addEventListener('click', () => { this.show('assedioOverlay'); });
    $('assedioClose').addEventListener('click', () => this.hide('assedioOverlay'));
    $('joinCorr').addEventListener('click', () => this.h.onAssedioJoin('corridori'));
    $('joinBlocc').addEventListener('click', () => this.h.onAssedioJoin('bloccatori'));

    // click fuori dal pannello = chiudi (solo overlay non distruttivi)
    for (const oid of ['mapOverlay', 'settingsOverlay', 'assedioOverlay']) {
      $(oid).addEventListener('click', (e) => { if (e.target.id === oid) this.hide(oid); });
    }
  }

  // ESC: prima libera il timone dagli input, poi chiude l'overlay in cima.
  // Sui pannelli d'attracco (cantiere/oracolo/sito) equivale a salpare.
  escape() {
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) { a.blur(); return; }
    for (const oid of ['settingsOverlay', 'assedioOverlay', 'mapOverlay']) {
      if (!$(oid).classList.contains('hidden')) { this.hide(oid); return; }
    }
    for (const oid of ['shopOverlay', 'searchOverlay', 'siteOverlay']) {
      if (!$(oid).classList.contains('hidden')) { this.h.onUndock(); return; }
    }
  }

  show(id) { $(id).classList.remove('hidden'); }
  hide(id) { $(id).classList.add('hidden'); }
  typing() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
  }

  setSettings({ music, sfx, guard, volume }) {
    $('setMusic').checked = music;
    $('setSfx').checked = sfx;
    $('setGuard').checked = guard;
    $('setVol').value = Math.round(volume * 100);
    $('guardInfo').classList.toggle('spento', !guard);
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
    bar.style.background = frac > 0.35 ? 'linear-gradient(#6cd072,#3d9944)' : 'linear-gradient(#e8783f,#b23a1a)';
    $('hpText').textContent = `${Math.ceil(hp)} / ${maxHp}`;
  }

  setReloads({ left, right, axial }) {
    $('rlLeft').style.width = (Math.max(0, Math.min(1, left)) * 100) + '%';
    $('rlRight').style.width = (Math.max(0, Math.min(1, right)) * 100) + '%';
    $('rlAxial').style.width = (Math.max(0, Math.min(1, axial)) * 100) + '%';
  }

  setGroupsAvailable({ axial }) {
    $('rlAxialRow').classList.toggle('hidden', !axial);
  }

  setDockHint(text) { $('dockHint').textContent = text || ''; }

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
    $('boardTable').innerHTML = '<tr><th>Corsaro</th><th>Affondate</th><th>Perdute</th><th>🪙</th></tr>' +
      rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.gold}</td></tr>`).join('');
    this.show('board');
  }

  showTreasureMap(from, island, url) {
    const canvas = $('mapCanvas');
    const w = Math.min(1060, innerWidth * 0.82);
    canvas.width = w; canvas.height = Math.round(w * 0.62);
    drawTreasureMap(canvas, { from, island });
    this.show('mapOverlay');
    // niente auto-chiusura: la pergamena resta finché il capitano non salpa
    // (bottone, ESC o click fuori) — è lui a decidere quando ha letto.
  }

  // --- Cantiere ---

  showShop(m) {
    $('shopGold').textContent = m.gold;
    const ship = $('shopShip');
    ship.innerHTML = '';
    ship.appendChild(this.statRow('🛡 Scafo', 'Legno di quercia, ossa dure', m.ship.hullLvl, 4, m.ship.hullCost, m.gold,
      () => this.h.onBuyShip('hull')));
    ship.appendChild(this.statRow('⛵ Vele', 'Chi fugge vive per combattere domani', m.ship.sailsLvl, 4, m.ship.sailsCost, m.gold,
      () => this.h.onBuyShip('sails')));

    const wep = $('shopWeapons');
    wep.innerHTML = '';
    for (const [g, data] of Object.entries(m.groups)) {
      const block = document.createElement('div');
      block.className = 'wgroup';
      const head = document.createElement('div');
      head.className = 'wgroupHead';
      head.innerHTML = `<b>${GROUP_LABELS[g]}</b><span>${data.slots.length}/${data.max} slot</span>`;
      block.appendChild(head);
      for (const s of data.slots) {
        const row = document.createElement('div');
        row.className = 'wslot';
        const pips = '●'.repeat(s.lvl) + '○'.repeat(3 - s.lvl);
        row.innerHTML = `<div class="wname"><b>${esc(s.name)}</b> <span class="tier">Tier ${ROMAN[s.tier - 1]}</span><span class="pips">${pips}</span></div>`;
        if (s.upCost !== null) {
          const b = document.createElement('button');
          b.textContent = `Potenzia · ${s.upCost} 🪙`;
          b.disabled = m.gold < s.upCost;
          b.addEventListener('click', () => this.h.onUpgradeWeapon(g, s.slot));
          row.appendChild(b);
        } else if (s.replace) {
          const b = document.createElement('button');
          b.className = 'tierUp';
          b.textContent = `→ ${s.replace.name} · ${s.replace.cost} 🪙`;
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
        add.disabled = m.gold < data.nextSlotCost;
        add.addEventListener('click', () => this.h.onBuySlot(g));
        block.appendChild(add);
      }
      wep.appendChild(block);
    }
    this.show('shopOverlay');
  }

  statRow(title, desc, lvl, maxLvl, cost, gold, onBuy) {
    const row = document.createElement('div');
    row.className = 'shopRow';
    row.innerHTML = `<div class="shopInfo"><b>${title}</b><span>${desc}</span>
      <span class="pips">${'●'.repeat(lvl)}${'○'.repeat(maxLvl - lvl)}</span></div>`;
    const btn = document.createElement('button');
    if (cost === null) { btn.textContent = 'Massimo'; btn.disabled = true; }
    else {
      btn.textContent = `${cost} 🪙`;
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
    this.hide('shopOverlay'); this.hide('searchOverlay'); this.hide('siteOverlay');
    this.hide('assedioOverlay');
    this.hideDockbar();
  }

  setCourseInput(v) { $('courseInput').value = v; }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
