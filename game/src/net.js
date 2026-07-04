// Connessione al Mare dell'Internet. In sviluppo browser il server è la stessa
// origine della pagina; nel guscio Electron l'URL arriva dal preload.

export class Net {
  constructor(url) {
    this.url = url;
    this.handlers = new Map();
    this.ws = null;
    this.open = false;
  }

  on(type, fn) { this.handlers.set(type, fn); return this; }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('open', () => { this.open = true; const h = this.handlers.get('_open'); if (h) h(); });
    this.ws.addEventListener('close', () => { this.open = false; const h = this.handlers.get('_close'); if (h) h(); });
    this.ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      const h = this.handlers.get(msg.t);
      if (h) h(msg);
    });
  }

  send(obj) { if (this.open) this.ws.send(JSON.stringify(obj)); }
}

export function serverUrl() {
  if (window.navigareShell && window.navigareShell.serverWs) return window.navigareShell.serverWs;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}`;
}
