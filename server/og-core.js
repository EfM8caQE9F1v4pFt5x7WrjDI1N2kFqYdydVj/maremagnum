'use strict';

// Il Cartellone dell'isola (issue #27): l'anteprima Open Graph del sito che
// spunta quando la nave si accosta, SENZA premere F. Core puro e condiviso:
// il parsing sta qui, il fetch lo fa chi ha la rete (Game/Worker).

const TITOLO_MAX = 90;
const DESCR_MAX = 180;

// le entità che si incontrano davvero nei meta tag
const ENTITA = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  Agrave: 'À', Egrave: 'È', deg: '°', middot: '·', ndash: '–', mdash: '—',
  laquo: '«', raquo: '»', hellip: '…', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', trade: '™', copy: '©', reg: '®',
};

function decodifica(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16) || 63))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d || 63))
    .replace(/&([a-zA-Z]+);/g, (m, nome) => ENTITA[nome] ?? m);
}

function pulisci(s, max) {
  const testo = decodifica(String(s)).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return testo.length > max ? testo.slice(0, max - 1).trimEnd() + '…' : testo;
}

// Cerca il content di un meta tag per property/name, con l'ordine dei
// fallback del mestiere: og: → twitter: → tag classici.
function meta(html, nomi) {
  for (const nome of nomi) {
    // property/name prima o dopo content, virgolette singole o doppie
    // (l'apostrofo DENTRO il content è legittimo: "l'enciclopedia")
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${nome}["'][^>]*content=(?:"([^"]*)"|'([^']*)')`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=(?:"([^"]*)"|'([^']*)')[^>]*(?:property|name)=["']${nome}["']`, 'i');
    const m = html.match(re1) || html.match(re2);
    const valore = m && (m[1] ?? m[2]);
    if (valore && valore.trim()) return valore.trim();
  }
  return null;
}

// Estrae l'anteprima OG da un HTML. Ritorna { titolo, descrizione, immagine }
// (immagine = URL assoluto o null). `base` risolve le immagini relative.
function estraiOG(html, base) {
  const testa = String(html).slice(0, 200000); // i meta stanno in <head>: basta l'inizio
  const titoloTag = testa.match(/<title[^>]*>([^<]*)<\/title>/i);
  const titolo = meta(testa, ['og:title', 'twitter:title']) || (titoloTag && titoloTag[1]) || '';
  const descrizione = meta(testa, ['og:description', 'twitter:description', 'description']) || '';
  let immagine = meta(testa, ['og:image', 'og:image:url', 'twitter:image']) || null;
  if (immagine) {
    try { immagine = new URL(decodifica(immagine), base).href; } catch { immagine = null; }
    if (immagine && !/^https?:/.test(immagine)) immagine = null;
  }
  return {
    titolo: pulisci(titolo, TITOLO_MAX),
    descrizione: pulisci(descrizione, DESCR_MAX),
    immagine,
  };
}

module.exports = { estraiOG, pulisci, decodifica };
