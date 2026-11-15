// Durable last-known-good snapshot for the landing-page alert feed.
//
// `alert-cache.ts` keeps last-confirmed reads in process memory, which a fresh
// serverless instance does not have. On a cold instance the landing page waited
// on SCE (up to the 20s request timeout) and showed "unavailable" if the read
// failed. This layer stores the last confirmed landing read in Next's shared
// data cache with stale-while-revalidate semantics:
//
//   - once a read has been confirmed, every render is served the stored
//     snapshot immediately and a refresh runs in the background;
//   - only confirmed reads (`available` / `empty`) are stored. A failed or
//     degraded read throws inside the cached function, so it never replaces
//     the stored snapshot;
//   - a snapshot older than LANDING_SNAPSHOT_FRESH_SECONDS is relabelled
//     `degraded` with its age, so the page shows "Last confirmed:" rather than
//     presenting old data as live. Unlike the in-process cache there is no
//     cut-off age: the last confirmed feed is shown, always labelled with its
//     age, in place of an empty "unavailable" state.

import { unstable_cache } from "next/cache";
import { alertDataError, type AlertCollectionResult } from "./alert-data-state";
import { fetchSceAlertCollection, type SceAlert } from "./sce-alerts";

export const LANDING_SNAPSHOT_REVALIDATE_SECONDS = 60;
export const LANDING_SNAPSHOT_FRESH_SECONDS = 120;

/** Carries an unconfirmed read out of the cached function without caching it. */
export class UnconfirmedLandingReadError extends Error {
  constructor(readonly result: AlertCollectionResult<SceAlert>) {
    super(`landing feed read was ${result.state}`);
    this.name = "UnconfirmedLandingReadError";
  }
}

/** Throws unless the read was confirmed live, so failures are never cached. */
export async function confirmedLandingRead(
  read: () => Promise<AlertCollectionResult<SceAlert>>,
): Promise<AlertCollectionResult<SceAlert>> {
  const result = await read();
  if (result.state !== "available" && result.state !== "empty") {
    throw new UnconfirmedLandingReadError(result);
  }
  return result;
}

/** Relabel a stored snapshot that is no longer fresh as last-confirmed data. */
export function labelSnapshotAge(
  result: AlertCollectionResult<SceAlert>,
  now: Date,
): AlertCollectionResult<SceAlert> {
  const confirmedAt = result.lastSuccessfulAt ?? result.fetchedAt;
  const ageSeconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(confirmedAt).getTime()) / 1000),
  );
  if (!Number.isFinite(ageSeconds) || ageSeconds <= LANDING_SNAPSHOT_FRESH_SECONDS) {
    return result;
  }
  return {
    ...result,
    state: result.state === "available" ? "degraded" : result.state,
    source: "cache",
    fetchedAt: now.toISOString(),
    lastSuccessfulAt: confirmedAt,
    stale: true,
    cacheAgeSeconds: ageSeconds,
  };
}

/**
 * Serve the stored snapshot when one exists; otherwise return the live read's
 * own failure state (which may itself be `degraded` from the in-process cache).
 */
export async function readLandingSnapshot(
  cachedRead: () => Promise<AlertCollectionResult<SceAlert>>,
  now: () => Date = () => new Date(),
): Promise<AlertCollectionResult<SceAlert>> {
  try {
    return labelSnapshotAge(await cachedRead(), now());
  } catch (error) {
    if (error instanceof UnconfirmedLandingReadError) return error.result;
    return {
      state: "unavailable",
      alerts: [],
      source: "sce",
      fetchedAt: now().toISOString(),
      error: alertDataError("UPSTREAM_UNAVAILABLE"),
    };
  }
}

export function fetchLandingAlertCollection(limit: number): Promise<AlertCollectionResult<SceAlert>> {
  const cachedRead = unstable_cache(
    () =>
      confirmedLandingRead(() =>
        fetchSceAlertCollection({ limit, surface: "landing-page" }),
      ),
    ["radar-landing-feed-v1", String(limit)],
    { revalidate: LANDING_SNAPSHOT_REVALIDATE_SECONDS, tags: ["radar-landing-feed"] },
  );
  return readLandingSnapshot(cachedRead);
}
