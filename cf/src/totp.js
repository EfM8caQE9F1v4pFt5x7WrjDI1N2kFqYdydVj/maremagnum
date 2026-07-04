// TOTP (RFC 6238) fatto in casa con WebCrypto: niente password, niente email.
// Il segreto in base32 finisce nell'app di autenticazione del capitano;
// chi perde il generatore perde il forziere — da pirati veri.

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function generaSegreto() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

async function hotp(secretB32, counter) {
  const key = await crypto.subtle.importKey(
    'raw', base32Decode(secretB32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter));
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const off = mac[mac.length - 1] & 0x0f;
  const code = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

export async function codiceTotp(secretB32, tMs = Date.now(), slittamento = 0) {
  return hotp(secretB32, Math.floor(tMs / 30000) + slittamento);
}

// Accetta la finestra corrente ±1 (orologi dei telefoni mai perfetti).
export async function verificaTotp(secretB32, codice) {
  const c = String(codice || '').trim();
  if (!/^\d{6}$/.test(c)) return false;
  for (const slitta of [0, -1, 1]) {
    if ((await codiceTotp(secretB32, Date.now(), slitta)) === c) return true;
  }
  return false;
}

export function otpauthUri(handle, secretB32) {
  const label = encodeURIComponent(`Maremagnum:${handle}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=Maremagnum&digits=6&period=30`;
}
