/**
 * Timing-safe string comparison using Web Crypto API.
 * Hashes both inputs first so the comparison is always fixed-length (32 bytes),
 * preventing attackers from probing the secret length via timing side-channels.
 */
export async function timingSafeEqual(a, b) {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(hashA, hashB);
}
