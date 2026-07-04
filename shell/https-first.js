'use strict';

// HTTPS-first: si prova sempre la rotta cifrata; se il porto non la regge
// (errori di connessione o TLS) si ripiega su http e ci si ricorda del
// porto per il resto della sessione. Funzioni pure, testabili senza Electron.

// Errori per cui ha senso il fallback a http: il server non parla https.
// (I fallimenti di rete generici — DNS, offline — fallirebbero anche in http.)
const FALLBACK_ERRORS = new Set([
  -102, // CONNECTION_REFUSED
  -107, // SSL_PROTOCOL_ERROR
  -113, // SSL_VERSION_OR_CIPHER_MISMATCH
  -324, // EMPTY_RESPONSE
  -501, // INSECURE_RESPONSE
]);

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

// Decide con quale URL salpare: https se possibile, http se il porto è noto
// per non reggerlo. Ritorna { url, upgraded }.
function decideUpgrade(url, httpOnlyHosts) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:') return { url, upgraded: false };
    if (httpOnlyHosts.has(u.hostname)) return { url, upgraded: false };
    u.protocol = 'https:';
    return { url: u.toString(), upgraded: true };
  } catch {
    return { url, upgraded: false };
  }
}

// Dopo un fallimento di caricamento: se era un nostro upgrade e l'errore è
// da fallback, ritorna l'URL http su cui ripiegare (e segna il porto).
function decideFallback(failedUrl, errorCode, isMainFrame, upgradedFrom, httpOnlyHosts) {
  if (!isMainFrame || !upgradedFrom) return null;
  const isCertError = errorCode <= -200 && errorCode >= -218; // ERR_CERT_*
  if (!FALLBACK_ERRORS.has(errorCode) && !isCertError) return null;
  const failedHost = hostOf(failedUrl);
  const originalHost = hostOf(upgradedFrom);
  if (!failedHost || failedHost !== originalHost) return null;
  httpOnlyHosts.add(failedHost);
  return upgradedFrom;
}

module.exports = { decideUpgrade, decideFallback, FALLBACK_ERRORS };
