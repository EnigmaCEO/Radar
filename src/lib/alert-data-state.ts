// Canonical data-state model for every first-party alert read.
//
// The product rule this file exists to enforce: an empty collection is only
// valid after a successful upstream response that contained a valid empty
// collection. Upstream failures must never collapse into `[]`, `null`, or a
// normal empty state, because that renders as a false "nothing is happening"
// signal when the truth is "Radar cannot verify what is happening".

export type AlertDataState = "available" | "empty" | "degraded" | "unavailable";

/** Detail reads add `not_found`: a *successful* lookup for an unknown id. */
export type AlertDetailState = "available" | "not_found" | "degraded" | "unavailable";

export type AlertDataErrorCode =
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_UNAUTHORIZED"
  | "UPSTREAM_RATE_LIMITED"
  | "INVALID_UPSTREAM_RESPONSE"
  | "CONFIGURATION_ERROR";

export interface AlertDataError {
  code: AlertDataErrorCode;
  retryable: boolean;
  requestId?: string;
}

export interface AlertCollectionResult<TAlert> {
  state: AlertDataState;
  alerts: TAlert[];
  source: "sce" | "cache";
  /** When this read was performed. */
  fetchedAt: string;
  /** When the data being shown was last confirmed live from SCE. */
  lastSuccessfulAt?: string;
  stale?: boolean;
  cacheAgeSeconds?: number;
  error?: AlertDataError;
}

export interface AlertDetailResult<TAlert> {
  state: AlertDetailState;
  alert: TAlert | null;
  source: "sce" | "cache";
  fetchedAt: string;
  lastSuccessfulAt?: string;
  stale?: boolean;
  cacheAgeSeconds?: number;
  error?: AlertDataError;
}

/** Retryable means "the same request may succeed shortly without operator action". */
const RETRYABLE_CODES: ReadonlySet<AlertDataErrorCode> = new Set<AlertDataErrorCode>([
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_UNAVAILABLE",
  "UPSTREAM_RATE_LIMITED",
]);

export function isRetryableAlertErrorCode(code: AlertDataErrorCode): boolean {
  return RETRYABLE_CODES.has(code);
}

export function alertDataError(
  code: AlertDataErrorCode,
  requestId?: string | null,
): AlertDataError {
  return {
    code,
    retryable: isRetryableAlertErrorCode(code),
    ...(requestId ? { requestId } : {}),
  };
}

/** True when Radar successfully reached SCE for this read. */
export function isConfirmedAlertState(state: AlertDataState | AlertDetailState): boolean {
  return state === "available" || state === "empty" || state === "not_found";
}

/** True when the caller has records it may render (live or last-confirmed). */
export function hasRenderableAlertData(state: AlertDataState): boolean {
  return state === "available" || state === "degraded";
}

/**
 * HTTP status for a Radar-owned alert API.
 *
 * `degraded` stays 200 because the body carries usable, explicitly-labelled
 * last-confirmed data. `unavailable` must never be 200: there is no data and a
 * 200 would let a consumer read it as a confirmed empty result.
 */
export function alertStateHttpStatus(
  state: AlertDataState | AlertDetailState,
  error?: AlertDataError,
): number {
  if (state !== "unavailable") return 200;
  if (error?.code === "UPSTREAM_TIMEOUT") return 504;
  if (error?.code === "UPSTREAM_UNAUTHORIZED" || error?.code === "CONFIGURATION_ERROR") {
    return 503;
  }
  return 502;
}

export function mapAlertCollection<TIn, TOut>(
  result: AlertCollectionResult<TIn>,
  transform: (alerts: TIn[]) => TOut[],
): AlertCollectionResult<TOut> {
  const alerts = transform(result.alerts);
  return {
    ...result,
    alerts,
    // Filtering an `available` collection down to nothing does not make it a
    // confirmed-empty upstream result, but it is still a confirmed read, so
    // `empty` is the honest state. Failures keep their state untouched.
    state: result.state === "available" && alerts.length === 0 ? "empty" : result.state,
  };
}

/** Collection envelope safe to return to a browser: no upstream bodies, no secrets. */
export interface PublicAlertCollectionEnvelope<TAlert> {
  state: AlertDataState;
  alerts: TAlert[];
  count: number;
  pageCount: number;
  source: "sce" | "cache";
  fetchedAt: string;
  lastSuccessfulAt?: string;
  stale?: boolean;
  cacheAgeSeconds?: number;
  error?: AlertDataError;
}

export function toPublicAlertEnvelope<TAlert>(
  result: AlertCollectionResult<TAlert>,
  counts?: { count?: number; pageCount?: number },
): PublicAlertCollectionEnvelope<TAlert> {
  return {
    state: result.state,
    alerts: result.alerts,
    count: counts?.count ?? result.alerts.length,
    pageCount: counts?.pageCount ?? result.alerts.length,
    source: result.source,
    fetchedAt: result.fetchedAt,
    ...(result.lastSuccessfulAt ? { lastSuccessfulAt: result.lastSuccessfulAt } : {}),
    ...(result.stale ? { stale: true } : {}),
    ...(typeof result.cacheAgeSeconds === "number"
      ? { cacheAgeSeconds: result.cacheAgeSeconds }
      : {}),
    ...(result.error ? { error: result.error } : {}),
  };
}

// ── Counter presentation ─────────────────────────────────────────────────────

export const UNMEASURED_COUNT_PLACEHOLDER = "—";

/**
 * True when a count derived from this state was actually measured. `degraded`
 * counts are real measurements, just older ones — the accompanying banner says
 * so. `unavailable` and an absent state were never measured at all.
 */
export function isMeasuredAlertCount(state: AlertDataState | undefined): boolean {
  return state === "available" || state === "empty" || state === "degraded";
}

/**
 * Render a count, or a placeholder when nothing was measured. Prevents an
 * unavailable alert source from displaying as a confident "0".
 */
export function formatAlertCount(
  value: number,
  state: AlertDataState | undefined,
): string {
  return isMeasuredAlertCount(state) ? String(value) : UNMEASURED_COUNT_PLACEHOLDER;
}

// ── User-facing copy ─────────────────────────────────────────────────────────
// Centralised so the page, the landing feed, the dashboard, and the health-scan
// assertions cannot drift apart.

export const ALERT_EMPTY_HEADLINE = "No active public alerts";
export const ALERT_EMPTY_DETAIL_PREFIX = "Radar successfully checked its alert source at";

export const ALERT_DEGRADED_HEADLINE = "Showing the last confirmed alert data";
export const ALERT_DEGRADED_DETAIL_PREFIX =
  "Live alert data is temporarily unavailable. Last successful update:";

export const ALERT_UNAVAILABLE_HEADLINE = "Alert data is temporarily unavailable";
export const ALERT_UNAVAILABLE_DETAIL =
  "Radar cannot confirm the current public-alert state. Try again shortly.";

export const ALERT_DETAIL_UNAVAILABLE_HEADLINE = "Alert data is temporarily unavailable";
export const ALERT_DETAIL_UNAVAILABLE_DETAIL =
  "Radar cannot confirm the current state of this alert. This does not mean the alert is missing. Try again shortly.";
