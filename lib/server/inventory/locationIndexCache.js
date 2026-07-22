import 'server-only';

/**
 * Short-lived in-memory index of active locations for cascade pickers.
 *
 * Why: every floor → racks call used to reload the full location tree.
 * Location hierarchy changes rarely compared to stock qty, so a brief TTL
 * is safe. Stock snapshots (qty) are never cached here — UI revalidates those.
 *
 * Invalidate on location create / update / delete so structure stays correct.
 */

const TTL_MS = 45_000;

/** @type {{ expiresAt: number, payload: object } | null} */
let cache = null;

export function peekLocationIndexCache() {
  if (!cache) return null;
  if (Date.now() > cache.expiresAt) {
    cache = null;
    return null;
  }
  return cache.payload;
}

export function setLocationIndexCache(payload) {
  cache = {
    expiresAt: Date.now() + TTL_MS,
    payload,
  };
  return payload;
}

export function invalidateLocationIndexCache() {
  cache = null;
}
