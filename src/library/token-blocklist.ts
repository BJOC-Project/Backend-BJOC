import { LRUCache } from "lru-cache";

/**
 * In-memory JWT blocklist for token revocation.
 *
 * Limitations (known):
 * - State is lost on process restart. Tokens issued before a restart cannot
 *   be revoked via this mechanism after the restart. Acceptable for the
 *   current deployment model; switch to Redis if persistence is required.
 * - Per-user revocation on suspension is not supported — we have no
 *   per-user token registry. Suspension already blocks re-login immediately
 *   via the status check in authLogin.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const blocklist = new LRUCache<string, true>({
  max: 10_000,
  ttl: SEVEN_DAYS_MS,
});

/**
 * Adds a jti to the blocklist until the token's own expiry time.
 * @param jti  The JWT ID claim from the token.
 * @param exp  The JWT exp claim (Unix seconds).
 */
export function addToBlocklist(jti: string, exp: number) {
  const ttl = Math.max(0, exp * 1000 - Date.now());
  blocklist.set(jti, true, { ttl });
}

export function isBlocklisted(jti: string) {
  return blocklist.has(jti);
}
