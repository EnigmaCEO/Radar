// Server-only SCE clients. These helpers must only be imported from server
// components or route handlers because they read SCE_ADMIN_API_KEY.
// Browser-facing alert pages continue to use src/lib/api.ts.

import { readAlertCollection, storeAlertCollection } from "./alert-cache";
import {
  alertDataError,
  type AlertCollectionResult,
  type AlertDataErrorCode,
  type AlertDetailResult,
} from "./alert-data-state";
import { recordAlertRead } from "./alert-telemetry";
import { stripTrailingSlash } from "./utils";

export interface SceAlert {
  id: string;
  monitorType: string;
  provider: string;
  chain: string | null;
  asset: string | null;
  assetPair?: string | null;
  route: string | null;
  poolName?: string | null;
  objectId: string | null;
  objectType?: string | null;
  purpose: string | null;
  severity: string;
  status: string;
  reasonCode: string;
  summary: string;
  publicSummary?: string | null;
  signalClass?: string | null;
  evidenceSummary?: string | null;
  tags?: string[];
  severityExplanation?: string | null;
  thresholdExplanation?: string | null;
  humanRiskSummary?: string | null;
  whatHappened?: string | null;
  whyItMatters?: string | null;
  radarStatus?: string | null;
  nextWatch?: string | null;
  evidenceExplanation?: string | null;
  thresholdName?: string | null;
  observedValueLabel?: string | null;
  thresholdValueLabel?: string | null;
  declaredHeartbeatSeconds?: number | null;
  appliedThresholdSeconds?: number | null;
  appliedThresholdKind?: string | null;
  thresholdSourceLabel?: string | null;
  evidenceState?: string | null;
  publicVerificationState?: string | null;
  lastSuccessfulObservationAt?: string | null;
  lastObservationAttemptAt?: string | null;
  consecutiveFailedCycles?: number | null;
  objectState?: string | null;
  failureCause?: string | null;
  coverageTier?: string | null;
  lpTotalLiquidityUsd?: number | null;
  lpPriorTotalLiquidityUsd?: number | null;
  lpLiquidityUsdDropPct?: number | null;
  lpTvlSource?: string | null;
  openedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SceAlertLedgerEvent {
  alertId: string;
  eventId: string;
  cursor: string | null;
  eventType: string;
  monitorType: string;
  provider: string;
  chain: string | null;
  asset: string | null;
  assetPair: string | null;
  route: string | null;
  poolName: string | null;
  objectId: string | null;
  objectType: string | null;
  severity: string;
  signalClass: string | null;
  status: string;
  reasonCode: string;
  summary: string;
  publicSummary: string | null;
  createdAt: string;
  sourceAlertCreatedAt: string | null;
  updatedAt: string;
  sourceAlertUpdatedAt: string | null;
  openedAt: string | null;
  resolvedAt: string | null;
  evidenceSummary: string | null;
  tags: string[];
  purpose: string | null;
  severityExplanation: string | null;
  thresholdExplanation: string | null;
  humanRiskSummary: string | null;
  whatHappened: string | null;
  whyItMatters: string | null;
  radarStatus: string | null;
  nextWatch: string | null;
  evidenceExplanation: string | null;
  thresholdName: string | null;
  observedValueLabel: string | null;
  thresholdValueLabel: string | null;
  declaredHeartbeatSeconds?: number | null;
  appliedThresholdSeconds?: number | null;
  appliedThresholdKind?: string | null;
  thresholdSourceLabel?: string | null;
  evidenceState?: string | null;
  publicVerificationState?: string | null;
  lastSuccessfulObservationAt?: string | null;
  lastObservationAttemptAt?: string | null;
  consecutiveFailedCycles?: number | null;
  objectState?: string | null;
  failureCause?: string | null;
  coverageTier?: string | null;
  lpTotalLiquidityUsd?: number | null;
  lpPriorTotalLiquidityUsd?: number | null;
  lpLiquidityUsdDropPct?: number | null;
  lpTvlSource?: string | null;
}

export interface SceAlertLedgerPage {
  events: SceAlertLedgerEvent[];
  count: number;
  pageCount: number;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
}

function firstStringFromObject(
  object: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstStringFromSources(
  sources: Array<Record<string, unknown> | null>,
  ...keys: string[]
): string | null {
  for (const source of sources) {
    if (!source) continue;
    const value = firstStringFromObject(source, ...keys);
    if (value) return value;
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function normalizeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

function normalizeFloat(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

interface LpDepthFields {
  lpTotalLiquidityUsd: number | null;
  lpPriorTotalLiquidityUsd: number | null;
  lpLiquidityUsdDropPct: number | null;
  lpTvlSource: string | null;
}

// LP alerts carry Moralis-sourced dollar depth in the nested lpEvidence object.
// Radar surfaces it so LP_LIQUIDITY_DROP copy can show before -> after TVL.
function extractLpDepthFields(raw: Record<string, unknown>): LpDepthFields {
  const lpEvidence = asRecord(raw.lpEvidence) ?? asRecord(raw.lp_evidence);
  const readNumber = (camel: string, snake: string): number | null =>
    normalizeFloat(lpEvidence?.[camel] ?? lpEvidence?.[snake] ?? undefined);
  return {
    lpTotalLiquidityUsd: readNumber("totalLiquidityUsd", "total_liquidity_usd"),
    lpPriorTotalLiquidityUsd: readNumber("priorTotalLiquidityUsd", "prior_total_liquidity_usd"),
    lpLiquidityUsdDropPct: readNumber("liquidityUsdDropPct", "liquidity_usd_drop_pct"),
    lpTvlSource: firstString(
      lpEvidence?.tvlSource,
      lpEvidence?.tvl_source,
    ),
  };
}

function normalizeSeverity(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "warn") return "warning";
  if (["info", "watch", "warning", "critical"].includes(normalized)) return normalized;
  return "info";
}

function normalizeDateString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getAlertFieldSources(raw: Record<string, unknown>): Array<Record<string, unknown> | null> {
  const evidence = asRecord(raw.evidence);
  const evidenceExplanation = asRecord(evidence?.explanation);
  const evidenceSummary = asRecord(raw.evidenceSummary) ?? asRecord(raw.evidence_summary);
  const explanations = asRecord(raw.explanations) ?? asRecord(raw.explanation);
  return [raw, explanations, evidenceSummary, evidence, evidenceExplanation];
}

function readExplanationField(raw: Record<string, unknown>, camel: string, snake: string): string | null {
  return firstStringFromSources(getAlertFieldSources(raw), camel, snake);
}

function sanitizeAlert(raw: Record<string, unknown>): SceAlert | null {
  const id = firstString(raw.id, raw.alertId);
  const monitorType = firstString(raw.monitorType, raw.monitor_type);
  if (id === null || monitorType === null) return null;

  const createdAt =
    normalizeDateString(firstString(raw.createdAt, raw.created_at, raw.timestamp)) ??
    new Date(0).toISOString();
  const updatedAt =
    normalizeDateString(
      firstString(
        raw.updatedAt,
        raw.updated_at,
        raw.lastUpdatedAt,
        raw.last_updated_at,
        raw.timestamp,
      ),
    ) ??
    createdAt;
  const openedAt = normalizeDateString(
    firstString(raw.openedAt, raw.opened_at, raw.sourceAlertCreatedAt, raw.source_alert_created_at),
  );
  const resolvedAt = normalizeDateString(firstString(raw.resolvedAt, raw.resolved_at));
  const evidenceSummary =
    firstString(raw.evidenceSummary, raw.evidence_summary) ??
    firstStringFromSources(getAlertFieldSources(raw), "summary");

  return {
    id,
    monitorType,
    provider: firstString(raw.source, raw.provider) ?? "",
    chain: firstString(raw.chain),
    asset: firstString(raw.asset, raw.pair, raw.assetPair, raw.asset_pair),
    assetPair: firstString(raw.assetPair, raw.asset_pair, raw.pair),
    route: firstString(raw.route),
    poolName: firstString(raw.poolName, raw.pool_name),
    objectId: firstString(raw.monitorObjectId, raw.monitor_object_id, raw.objectId, raw.object_id),
    objectType: firstString(raw.objectType, raw.object_type),
    purpose: firstString(raw.objectPurpose, raw.object_purpose, raw.purpose),
    severity: normalizeSeverity(raw.severity),
    status: firstString(raw.status, raw.state) ?? "unknown",
    reasonCode: firstString(raw.reasonCode, raw.reason_code, raw.alertType, raw.alert_type) ?? "",
    summary: firstString(raw.summary, raw.title) ?? "",
    publicSummary: firstString(raw.publicSummary, raw.public_summary),
    signalClass: firstString(raw.signalClass, raw.signal_class),
    evidenceSummary,
    tags: toStringArray(raw.tags),
    severityExplanation: readExplanationField(raw, "severityExplanation", "severity_explanation"),
    thresholdExplanation: readExplanationField(raw, "thresholdExplanation", "threshold_explanation"),
    humanRiskSummary: readExplanationField(raw, "humanRiskSummary", "human_risk_summary"),
    whatHappened: readExplanationField(raw, "whatHappened", "what_happened"),
    whyItMatters: readExplanationField(raw, "whyItMatters", "why_it_matters"),
    radarStatus: readExplanationField(raw, "radarStatus", "radar_status"),
    nextWatch: readExplanationField(raw, "nextWatch", "next_watch"),
    evidenceExplanation: readExplanationField(raw, "evidenceExplanation", "evidence_explanation"),
    thresholdName: readExplanationField(raw, "thresholdName", "threshold_name"),
    observedValueLabel: readExplanationField(raw, "observedValueLabel", "observed_value_label"),
    thresholdValueLabel: readExplanationField(raw, "thresholdValueLabel", "threshold_value_label"),
    declaredHeartbeatSeconds: normalizeInteger(
      raw.declaredHeartbeatSeconds ?? raw.declared_heartbeat_seconds,
    ),
    appliedThresholdSeconds: normalizeInteger(
      raw.appliedThresholdSeconds ?? raw.applied_threshold_seconds,
    ),
    appliedThresholdKind: firstString(raw.appliedThresholdKind, raw.applied_threshold_kind),
    thresholdSourceLabel: firstString(raw.thresholdSourceLabel, raw.threshold_source_label),
    evidenceState: firstString(raw.evidenceState, raw.evidence_state),
    publicVerificationState: firstString(
      raw.publicVerificationState,
      raw.public_verification_state,
    ),
    lastSuccessfulObservationAt: normalizeDateString(
      firstString(raw.lastSuccessfulObservationAt, raw.last_successful_observation_at),
    ),
    lastObservationAttemptAt: normalizeDateString(
      firstString(raw.lastObservationAttemptAt, raw.last_observation_attempt_at),
    ),
    consecutiveFailedCycles: normalizeInteger(
      raw.consecutiveFailedCycles ?? raw.consecutive_failed_cycles,
    ),
    objectState: firstString(raw.objectState, raw.object_state),
    failureCause: firstString(raw.failureCause, raw.failure_cause),
    coverageTier: firstString(raw.coverageTier, raw.coverage_tier),
    ...extractLpDepthFields(raw),
    openedAt,
    resolvedAt,
    createdAt,
    updatedAt,
  };
}

function sanitizeLedgerEvent(raw: Record<string, unknown>): SceAlertLedgerEvent | null {
  const alertId = firstString(raw.alertId, raw.alert_id, raw.id);
  const eventId = firstString(raw.eventId, raw.event_id, raw.id);
  const monitorType = firstString(raw.monitorType, raw.monitor_type);
  const eventType = firstString(raw.eventType, raw.event_type);
  const createdAt = normalizeDateString(
    firstString(
      raw.createdAt,
      raw.created_at,
      raw.eventAt,
      raw.event_at,
      raw.timestamp,
      raw.updatedAt,
      raw.updated_at,
      raw.sourceAlertUpdatedAt,
      raw.source_alert_updated_at,
      raw.sourceAlertCreatedAt,
      raw.source_alert_created_at,
      raw.openedAt,
      raw.opened_at,
      raw.resolvedAt,
      raw.resolved_at,
    ),
  );

  if (!alertId || !eventId || !monitorType || !eventType || !createdAt) return null;

  const updatedAt =
    normalizeDateString(
      firstString(raw.updatedAt, raw.updated_at, raw.lastUpdatedAt, raw.last_updated_at),
    ) ?? createdAt;
  const evidenceSummary =
    firstString(raw.evidenceSummary, raw.evidence_summary) ??
    (typeof raw.evidence === "object" && raw.evidence !== null
      ? firstStringFromObject(raw.evidence as Record<string, unknown>, "summary")
      : null);
  const explanationField = (camel: string, snake: string) => readExplanationField(raw, camel, snake);

  return {
    alertId,
    eventId,
    cursor: firstString(raw.cursor, raw.after),
    eventType,
    monitorType,
    provider: firstString(raw.provider, raw.source) ?? "",
    chain: firstString(raw.chain),
    asset: firstString(raw.asset),
    assetPair: firstString(raw.assetPair, raw.asset_pair, raw.pair),
    route: firstString(raw.route),
    poolName: firstString(raw.poolName, raw.pool_name),
    objectId: firstString(
      raw.objectId,
      raw.object_id,
      raw.monitorObjectId,
      raw.monitor_object_id,
    ),
    objectType: firstString(raw.objectType, raw.object_type),
    severity: normalizeSeverity(raw.severity),
    signalClass: firstString(raw.signalClass, raw.signal_class),
    status: firstString(raw.status, raw.state) ?? "unknown",
    reasonCode: firstString(raw.reasonCode, raw.reason_code, raw.alertType, raw.alert_type) ?? "",
    summary: firstString(raw.summary, raw.title, raw.publicSummary, raw.public_summary) ?? "",
    publicSummary: firstString(raw.publicSummary, raw.public_summary),
    createdAt,
    sourceAlertCreatedAt: normalizeDateString(
      firstString(raw.sourceAlertCreatedAt, raw.source_alert_created_at, raw.openedAt, raw.opened_at),
    ),
    updatedAt,
    sourceAlertUpdatedAt: normalizeDateString(
      firstString(
        raw.sourceAlertUpdatedAt,
        raw.source_alert_updated_at,
        raw.lastSourceAlertUpdatedAt,
        raw.last_source_alert_updated_at,
      ),
    ),
    openedAt: normalizeDateString(firstString(raw.openedAt, raw.opened_at)),
    resolvedAt: normalizeDateString(firstString(raw.resolvedAt, raw.resolved_at)),
    evidenceSummary,
    tags: toStringArray(raw.tags),
    purpose: firstString(raw.purpose, raw.objectPurpose, raw.object_purpose),
    severityExplanation: explanationField("severityExplanation", "severity_explanation"),
    thresholdExplanation: explanationField("thresholdExplanation", "threshold_explanation"),
    humanRiskSummary: explanationField("humanRiskSummary", "human_risk_summary"),
    whatHappened: explanationField("whatHappened", "what_happened"),
    whyItMatters: explanationField("whyItMatters", "why_it_matters"),
    radarStatus: explanationField("radarStatus", "radar_status"),
    nextWatch: explanationField("nextWatch", "next_watch"),
    evidenceExplanation: explanationField("evidenceExplanation", "evidence_explanation"),
    thresholdName: explanationField("thresholdName", "threshold_name"),
    observedValueLabel: explanationField("observedValueLabel", "observed_value_label"),
    thresholdValueLabel: explanationField("thresholdValueLabel", "threshold_value_label"),
    declaredHeartbeatSeconds: normalizeInteger(
      raw.declaredHeartbeatSeconds ?? raw.declared_heartbeat_seconds,
    ),
    appliedThresholdSeconds: normalizeInteger(
      raw.appliedThresholdSeconds ?? raw.applied_threshold_seconds,
    ),
    appliedThresholdKind: firstString(raw.appliedThresholdKind, raw.applied_threshold_kind),
    thresholdSourceLabel: firstString(raw.thresholdSourceLabel, raw.threshold_source_label),
    evidenceState: firstString(raw.evidenceState, raw.evidence_state),
    publicVerificationState: firstString(
      raw.publicVerificationState,
      raw.public_verification_state,
    ),
    lastSuccessfulObservationAt: normalizeDateString(
      firstString(raw.lastSuccessfulObservationAt, raw.last_successful_observation_at),
    ),
    lastObservationAttemptAt: normalizeDateString(
      firstString(raw.lastObservationAttemptAt, raw.last_observation_attempt_at),
    ),
    consecutiveFailedCycles: normalizeInteger(
      raw.consecutiveFailedCycles ?? raw.consecutive_failed_cycles,
    ),
    objectState: firstString(raw.objectState, raw.object_state),
    failureCause: firstString(raw.failureCause, raw.failure_cause),
    coverageTier: firstString(raw.coverageTier, raw.coverage_tier),
    ...extractLpDepthFields(raw),
  };
}

function getSceBaseUrl(): string {
  return stripTrailingSlash(
    process.env.SCE_API_BASE_URL
      ?? process.env.NEXT_PUBLIC_API_URL
      ?? "https://continuityengineserver.fly.dev",
  );
}

export class SceAlertsError extends Error {
  constructor(
    message: string,
    readonly code: AlertDataErrorCode = "UPSTREAM_UNAVAILABLE",
    readonly upstreamStatus: number | null = null,
    readonly requestId: string | null = null,
  ) {
    super(message);
  }
}

const SCE_REQUEST_TIMEOUT_MS = 20_000;

const ALERTS_PATH = "/v1/sce/radar/alerts";

type SceFetchOutcome =
  | { ok: true; data: unknown; status: number; requestId: string | null; latencyMs: number }
  | {
      ok: false;
      code: AlertDataErrorCode;
      status: number | null;
      requestId: string | null;
      latencyMs: number;
    };

// Maps a completed upstream response to an error code. 404 is deliberately not
// handled here: for a collection read it means route/deployment drift, and for a
// detail read it means the record does not exist. Each caller decides.
function classifyStatus(status: number): AlertDataErrorCode {
  if (status === 401 || status === 403) return "UPSTREAM_UNAUTHORIZED";
  if (status === 408 || status === 504) return "UPSTREAM_TIMEOUT";
  if (status === 429) return "UPSTREAM_RATE_LIMITED";
  return "UPSTREAM_UNAVAILABLE";
}

function classifyThrown(error: unknown): AlertDataErrorCode {
  const name = error instanceof Error ? error.name : "";
  return name === "TimeoutError" || name === "AbortError"
    ? "UPSTREAM_TIMEOUT"
    : "UPSTREAM_UNAVAILABLE";
}

/**
 * Perform one SCE read and classify the result. Never throws, never returns a
 * bare `null` that a caller could mistake for "no data": a failure is always an
 * `ok: false` outcome carrying an explicit code.
 */
async function requestSce(path: string, query: URLSearchParams): Promise<SceFetchOutcome> {
  const startedAt = Date.now();
  const adminKey = process.env.SCE_ADMIN_API_KEY;
  if (!adminKey) {
    return {
      ok: false,
      code: "CONFIGURATION_ERROR",
      status: null,
      requestId: null,
      latencyMs: 0,
    };
  }

  const queryString = query.toString();
  let res: Response;
  try {
    res = await fetch(`${getSceBaseUrl()}${path}${queryString ? `?${queryString}` : ""}`, {
      headers: { "X-SCE-Admin-Key": adminKey },
      cache: "no-store",
      signal: AbortSignal.timeout(SCE_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      code: classifyThrown(error),
      status: null,
      requestId: null,
      latencyMs: Date.now() - startedAt,
    };
  }

  const requestId = res.headers?.get?.("x-request-id") ?? null;

  if (!res.ok) {
    return {
      ok: false,
      code: res.status === 404 ? "CONFIGURATION_ERROR" : classifyStatus(res.status),
      status: res.status,
      requestId,
      latencyMs: Date.now() - startedAt,
    };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      code: "INVALID_UPSTREAM_RESPONSE",
      status: res.status,
      requestId,
      latencyMs: Date.now() - startedAt,
    };
  }

  return { ok: true, data, status: res.status, requestId, latencyMs: Date.now() - startedAt };
}

// ── Payload validation ───────────────────────────────────────────────────────

/**
 * A record must carry the canonical identifier, a status, a monitor type, and a
 * parseable timestamp before Radar will call the collection containing it
 * `available`. Anything less is an unexpected upstream shape, not an alert.
 */
function isValidRawAlert(value: unknown): value is Record<string, unknown> {
  const raw = asRecord(value);
  if (!raw) return false;
  if (firstString(raw.id, raw.alertId) === null) return false;
  if (firstString(raw.monitorType, raw.monitor_type) === null) return false;
  if (firstString(raw.status, raw.state) === null) return false;
  return (
    normalizeDateString(firstString(raw.createdAt, raw.created_at, raw.timestamp)) !== null
  );
}

/**
 * Accepts the SCE alert-collection shape (a bare array) and returns sanitized
 * alerts, or null when the payload is not a valid collection. A valid empty
 * array returns an empty array — that is a real result, not a failure.
 */
export function validateSceAlertCollection(data: unknown): SceAlert[] | null {
  if (!Array.isArray(data)) return null;
  if (!data.every(isValidRawAlert)) return null;

  const alerts = data.map((raw) => sanitizeAlert(raw as Record<string, unknown>));
  return alerts.every((alert): alert is SceAlert => alert !== null) ? alerts : null;
}

export function validateSceAlertDetail(data: unknown): SceAlert | null {
  return isValidRawAlert(data) ? sanitizeAlert(data) : null;
}

// ── Collection reads ─────────────────────────────────────────────────────────

export interface SceAlertReadOptions {
  status?: string;
  limit?: number;
  /** Radar-side surface performing the read; recorded in telemetry only. */
  surface?: string;
}

function collectionCacheKey(status: string | undefined, limit: number): string {
  return `alerts:${status ?? "*"}:${limit}`;
}

/**
 * Build the failure half of the state machine: serve last-confirmed data as
 * `degraded` when an acceptable cache entry exists, otherwise `unavailable`.
 * Neither branch ever produces a confirmed-empty result.
 */
function degradedOrUnavailable<TAlert>(
  cacheKey: string,
  code: AlertDataErrorCode,
  requestId: string | null,
  now: Date,
): AlertCollectionResult<TAlert> {
  const error = alertDataError(code, requestId);
  const cached = readAlertCollection<TAlert>(cacheKey, now);

  if (cached) {
    return {
      state: "degraded",
      alerts: cached.alerts,
      source: "cache",
      fetchedAt: now.toISOString(),
      lastSuccessfulAt: cached.lastSuccessfulAt,
      stale: true,
      cacheAgeSeconds: cached.ageSeconds,
      error,
    };
  }

  return {
    state: "unavailable",
    alerts: [],
    source: "sce",
    fetchedAt: now.toISOString(),
    error,
  };
}

/**
 * Read the SCE public alert collection as an explicit data state.
 *
 * This is the only supported entry point for alert-collection reads. It never
 * returns a bare array, so a caller cannot accidentally render an upstream
 * failure as "nothing is happening".
 */
export async function fetchSceAlertCollection(
  options?: SceAlertReadOptions,
): Promise<AlertCollectionResult<SceAlert>> {
  const limit = options?.limit ?? 200;
  const query = new URLSearchParams();
  if (options?.status) query.set("status", options.status);
  query.set("limit", String(limit));

  const cacheKey = collectionCacheKey(options?.status, limit);
  const outcome = await requestSce(ALERTS_PATH, query);
  const now = new Date();

  const result: AlertCollectionResult<SceAlert> = (() => {
    if (!outcome.ok) {
      return degradedOrUnavailable<SceAlert>(cacheKey, outcome.code, outcome.requestId, now);
    }

    const alerts = validateSceAlertCollection(outcome.data);
    if (alerts === null) {
      return degradedOrUnavailable<SceAlert>(
        cacheKey,
        "INVALID_UPSTREAM_RESPONSE",
        outcome.requestId,
        now,
      );
    }

    storeAlertCollection(cacheKey, alerts, now);
    return {
      state: alerts.length > 0 ? "available" : "empty",
      alerts,
      source: "sce",
      fetchedAt: now.toISOString(),
      lastSuccessfulAt: now.toISOString(),
    };
  })();

  recordAlertRead({
    route: options?.surface ?? "unknown",
    upstreamPath: ALERTS_PATH,
    state: result.state,
    upstreamStatus: outcome.ok ? outcome.status : outcome.status,
    latencyMs: outcome.latencyMs,
    alertCount: result.alerts.length,
    source: result.source,
    ...(typeof result.cacheAgeSeconds === "number"
      ? { cacheAgeSeconds: result.cacheAgeSeconds }
      : {}),
    ...(result.error ? { errorCode: result.error.code } : {}),
    ...(outcome.requestId ? { requestId: outcome.requestId } : {}),
    ...(result.lastSuccessfulAt ? { lastSuccessfulAt: result.lastSuccessfulAt } : {}),
  });

  return result;
}

/**
 * Read a single alert as an explicit data state.
 *
 * `not_found` is reserved for a successful upstream lookup that returned 404 or
 * a null body. An outage produces `unavailable` or `degraded` — never
 * `not_found` — so a public detail page can never render an SCE outage as
 * "Alert not found".
 */
export async function fetchSceAlertDetail(id: string): Promise<AlertDetailResult<SceAlert>> {
  const path = `${ALERTS_PATH}/${encodeURIComponent(id)}`;
  const cacheKey = `alert:${id}`;
  const outcome = await requestSce(path, new URLSearchParams());
  const now = new Date();

  const result: AlertDetailResult<SceAlert> = (() => {
    if (!outcome.ok) {
      // A 404 on a specific alert id is a confirmed "no such record", not the
      // route drift that the same status means for the collection endpoint.
      if (outcome.status === 404) {
        return {
          state: "not_found" as const,
          alert: null,
          source: "sce" as const,
          fetchedAt: now.toISOString(),
          lastSuccessfulAt: now.toISOString(),
        };
      }

      const collection = degradedOrUnavailable<SceAlert>(
        cacheKey,
        outcome.code,
        outcome.requestId,
        now,
      );
      return {
        state: collection.state === "degraded" ? ("degraded" as const) : ("unavailable" as const),
        alert: collection.alerts[0] ?? null,
        source: collection.source,
        fetchedAt: collection.fetchedAt,
        lastSuccessfulAt: collection.lastSuccessfulAt,
        stale: collection.stale,
        cacheAgeSeconds: collection.cacheAgeSeconds,
        error: collection.error,
      };
    }

    if (outcome.data === null || outcome.data === undefined) {
      return {
        state: "not_found" as const,
        alert: null,
        source: "sce" as const,
        fetchedAt: now.toISOString(),
        lastSuccessfulAt: now.toISOString(),
      };
    }

    const alert = validateSceAlertDetail(outcome.data);
    if (!alert) {
      const collection = degradedOrUnavailable<SceAlert>(
        cacheKey,
        "INVALID_UPSTREAM_RESPONSE",
        outcome.requestId,
        now,
      );
      return {
        state: collection.state === "degraded" ? ("degraded" as const) : ("unavailable" as const),
        alert: collection.alerts[0] ?? null,
        source: collection.source,
        fetchedAt: collection.fetchedAt,
        lastSuccessfulAt: collection.lastSuccessfulAt,
        stale: collection.stale,
        cacheAgeSeconds: collection.cacheAgeSeconds,
        error: collection.error,
      };
    }

    storeAlertCollection(cacheKey, [alert], now);
    return {
      state: "available" as const,
      alert,
      source: "sce" as const,
      fetchedAt: now.toISOString(),
      lastSuccessfulAt: now.toISOString(),
    };
  })();

  recordAlertRead({
    route: "public-alert-detail",
    upstreamPath: `${ALERTS_PATH}/:alertId`,
    state: result.state,
    upstreamStatus: outcome.status,
    latencyMs: outcome.latencyMs,
    alertCount: result.alert ? 1 : 0,
    source: result.source,
    ...(typeof result.cacheAgeSeconds === "number"
      ? { cacheAgeSeconds: result.cacheAgeSeconds }
      : {}),
    ...(result.error ? { errorCode: result.error.code } : {}),
    ...(outcome.requestId ? { requestId: outcome.requestId } : {}),
    ...(result.lastSuccessfulAt ? { lastSuccessfulAt: result.lastSuccessfulAt } : {}),
  });

  return result;
}

export async function fetchSceAlertLedger(options: {
  since: string;
  until: string;
  limit?: number;
  after?: string;
  monitorType?: string;
  status?: string;
  signalClass?: string;
}): Promise<SceAlertLedgerEvent[]> {
  const page = await fetchSceAlertLedgerPage(options);
  return page.events;
}

export async function fetchSceAlertLedgerPage(options: {
  since: string;
  until: string;
  limit?: number;
  after?: string;
  monitorType?: string;
  status?: string;
  signalClass?: string;
}): Promise<SceAlertLedgerPage> {
  const query = new URLSearchParams();
  query.set("since", options.since);
  query.set("until", options.until);
  query.set("limit", String(options.limit ?? 200));
  if (options.after) query.set("after", options.after);
  if (options.monitorType) query.set("monitorType", options.monitorType);
  if (options.status) query.set("status", options.status);
  if (options.signalClass) query.set("signalClass", options.signalClass);

  const outcome = await requestSce("/v1/sce/radar/alert-ledger", query);
  if (!outcome.ok) {
    throw new SceAlertsError(
      "SCE alert ledger is unavailable.",
      outcome.code,
      outcome.status,
      outcome.requestId,
    );
  }
  const { data } = outcome;
  const rawEvents =
    Array.isArray(data)
      ? data
      : typeof data === "object" && data !== null && Array.isArray((data as { events?: unknown }).events)
        ? (data as { events: unknown[] }).events
        : typeof data === "object" && data !== null && Array.isArray((data as { alerts?: unknown }).alerts)
        ? (data as { alerts: unknown[] }).alerts
        : null;
  // A shape Radar does not recognise is an upstream failure, not an empty page.
  if (rawEvents === null) {
    throw new SceAlertsError(
      "SCE alert ledger returned an unexpected response shape.",
      "INVALID_UPSTREAM_RESPONSE",
      outcome.status,
      outcome.requestId,
    );
  }
  const events = (rawEvents as Record<string, unknown>[])
    .map(sanitizeLedgerEvent)
    .filter((event): event is SceAlertLedgerEvent => event !== null);
  const countValue =
    typeof data === "object" && data !== null && typeof (data as { count?: unknown }).count === "number"
      ? Math.max(0, Math.trunc((data as { count: number }).count))
      : events.length;

  return {
    events,
    count: countValue,
    pageCount: events.length,
  };
}
