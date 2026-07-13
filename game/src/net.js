// Connessione al Mare dell'Internet. In sviluppo browser il server è la stessa
// origine della pagina; nel guscio Electron l'URL arriva dal preload.

export class Net {
  constructor(url) {
    this.url = url;
    this.handlers = new Map();
    this.ws = null;
    this.open = false;
    this.activityAt = 0;
    this.activityTimer = null;
  }

  on(type, fn) { this.handlers.set(type, fn); return this; }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('open', () => { this.open = true; this.activityAt = Date.now(); const h = this.handlers.get('_open'); if (h) h(); });
    this.ws.addEventListener('close', (e) => {
      this.open = false;
      clearTimeout(this.activityTimer); this.activityTimer = null;
      const h = this.handlers.get('_close'); if (h) h(e);
    });
    this.ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      const h = this.handlers.get(msg.t);
      if (h) h(msg);
    });
  }

  send(obj) {
    if (!this.open) return;
    this.ws.send(JSON.stringify(obj));
    // Un comando di gioco è già attività lato server: annulla l'eventuale
    // segnale generico in coda. Il Cartellone è automatico e non conta.
    if (obj.t !== 'activity' && obj.t !== 'cartellone') {
      this.activityAt = Date.now();
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
  }

  // Al massimo un piccolo messaggio ogni 15s, e con invio "in coda": anche
  // l'ultimo gesto dentro la finestra viene registrato, quindi il server non
  // espelle mai prima di 350s reali di inattività.
  activity() {
    if (!this.open) return;
    const ogni = 15000;
    const invia = () => {
      this.activityTimer = null;
      this.activityAt = Date.now();
      this.send({ t: 'activity' });
    };
    const attesa = ogni - (Date.now() - this.activityAt);
    if (attesa <= 0) invia();
    else if (!this.activityTimer) this.activityTimer = setTimeout(invia, attesa);
  }
}

export function serverUrl() {
  if (window.navigareShell && window.navigareShell.serverWs) return window.navigareShell.serverWs;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  // /mare: sui Workers gli asset statici hanno la precedenza sul Worker,
  // quindi il WebSocket vive su un percorso che non è mai un file.
  return `${proto}//${location.host}/mare`;
}
