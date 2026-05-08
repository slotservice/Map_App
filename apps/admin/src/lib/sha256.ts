import { sha256 as jsSha256 } from 'js-sha256';

/**
 * Hex-encoded SHA-256 of the given bytes.
 *
 * Prefers the browser's native Web Crypto (`crypto.subtle.digest`) — it's
 * faster and zero-dep. But Web Crypto is *only* exposed in secure
 * contexts (HTTPS, or http://localhost). The demo currently lives at
 * `http://80.241.222.224/` — a plain-HTTP public IP — where
 * `window.crypto.subtle` is `undefined`. In that case we fall back to a
 * pure-JS SHA-256 (~5KB, ~30-50ms for a 5MB photo).
 *
 * Once the admin moves to HTTPS the native path always wins automatically.
 */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const digest = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Some browsers expose `crypto.subtle` but throw when called from
      // an insecure context — fall through to JS impl.
    }
  }
  return jsSha256(buf);
}
