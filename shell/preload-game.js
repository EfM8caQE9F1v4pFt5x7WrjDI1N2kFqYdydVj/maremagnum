'use strict';

// Ponte fra il gioco e il guscio: superficie minima, niente di più.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('navigareShell', {
  openSite: (url) => ipcRenderer.invoke('open-site', url),
  closeSite: () => ipcRenderer.invoke('close-site'),
  navBack: () => ipcRenderer.invoke('nav-back'),
  navFwd: () => ipcRenderer.invoke('nav-fwd'),
  navReload: () => ipcRenderer.invoke('nav-reload'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onNavRequest: (cb) => ipcRenderer.on('nav-request', (_e, data) => cb(data)),
  onSiteState: (cb) => ipcRenderer.on('site-state', (_e, data) => cb(data)),
  setGuard: (on) => ipcRenderer.invoke('guard-set', !!on),
  onGuardReport: (cb) => ipcRenderer.on('guard-report', (_e, data) => cb(data)),
});
