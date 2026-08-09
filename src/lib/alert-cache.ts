// Last-known-good store for validated SCE alert reads.
//
// Scope is deliberately small: an in-process store held by the server runtime.
// On a warm instance it lets a failed live read degrade to explicitly-labelled
// last-confirmed data instead of collapsing to a false empty state. It is not a
// durable cache and never claims to be — every read it serves is marked
// `source="cache"`, `stale=true`, and carries its age.
//
// Invariants:
//   - only successfully validated upstream responses are ever stored;
//   - a failed or malformed response never overwrites or refreshes an entry;
//   - entries older than the maximum acceptable age are not served at all.

export const ALERT_CACHE_MAX_AGE_SECONDS = 15 * 60;

export interface CachedAlertEntry<TAlert> {
  alerts: TAlert[];
  /** When this data was confirmed live from SCE. Never advanced by a failure. */
  lastSuccessfulAt: string;
}

interface StoredEntry {
  alerts: unknown[];
  lastSuccessfulAt: number;
}

const store = new Map<string, StoredEntry>();

/**
 * Record a confirmed-live collection. Callers must only invoke this after the
 * upstream response was validated; an empty array is a legitimate value here
 * and stays distinguishable from "no cache" because the entry exists.
 */
export function storeAlertCollection(key: string, alerts: unknown[], fetchedAt: Date): void {
  store.set(key, { alerts: [...alerts], lastSuccessfulAt: fetchedAt.getTime() });
}

/**
 * Read the last confirmed collection for `key`, or null when none exists or the
 * entry has aged past `ALERT_CACHE_MAX_AGE_SECONDS`. Reading never extends
 * freshness.
 */
export function readAlertCollection<TAlert>(
  key: string,
  now: Date,
  maxAgeSeconds: number = ALERT_CACHE_MAX_AGE_SECONDS,
): (CachedAlertEntry<TAlert> & { ageSeconds: number }) | null {
  const entry = store.get(key);
  if (!entry) return null;

  const ageSeconds = Math.max(0, Math.floor((now.getTime() - entry.lastSuccessfulAt) / 1000));
  if (ageSeconds > maxAgeSeconds) return null;

  return {
    alerts: entry.alerts as TAlert[],
    lastSuccessfulAt: new Date(entry.lastSuccessfulAt).toISOString(),
    ageSeconds,
  };
}

/** Test hook. Not used by application code. */
export function clearAlertCache(): void {
  store.clear();
}
