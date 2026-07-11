// Server-only SCE clients. These helpers must only be imported from server
// components or route handlers because they read SCE_ADMIN_API_KEY.
// Browser-facing alert pages continue to use src/lib/api.ts.

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
  };
}

function getSceBaseUrl(): string {
  return stripTrailingSlash(
    process.env.SCE_API_BASE_URL
      ?? process.env.NEXT_PUBLIC_API_URL
      ?? "https://continuityengineserver.fly.dev",
  );
}

function getSceAdminKey(): string {
  const adminKey = process.env.SCE_ADMIN_API_KEY;
  if (!adminKey) {
    throw new SceAlertsError("SCE_ADMIN_API_KEY is not configured.");
  }
  return adminKey;
}

async function fetchSceJson(path: string, query: URLSearchParams, unavailableMessage: string) {
  let res: Response;
  try {
    res = await fetch(`${getSceBaseUrl()}${path}?${query.toString()}`, {
      headers: { "X-SCE-Admin-Key": getSceAdminKey() },
      cache: "no-store",
    });
  } catch {
    throw new SceAlertsError(unavailableMessage);
  }

  if (!res.ok) {
    throw new SceAlertsError(`SCE request failed (${res.status}) for ${path}.`);
  }

  return res.json().catch(() => null);
}

export class SceAlertsError extends Error {}

export async function fetchSceAlerts(options?: {
  status?: string;
  limit?: number;
}): Promise<SceAlert[]> {
  const query = new URLSearchParams();
  if (options?.status) query.set("status", options.status);
  query.set("limit", String(options?.limit ?? 200));

  const data = await fetchSceJson(
    "/v1/sce/radar/alerts",
    query,
    "SCE alerts are unavailable.",
  );
  const rawAlerts = Array.isArray(data) ? data : [];

  return (rawAlerts as Record<string, unknown>[]).map(sanitizeAlert).filter((alert): alert is SceAlert => alert !== null);
}

export async function fetchSceAlertById(id: string): Promise<SceAlert | null> {
  const data = await fetchSceJson(
    `/v1/sce/radar/alerts/${encodeURIComponent(id)}`,
    new URLSearchParams(),
    "SCE alert detail is unavailable.",
  );

  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return sanitizeAlert(data as Record<string, unknown>);
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
  const query = new URLSearchParams();
  query.set("since", options.since);
  query.set("until", options.until);
  query.set("limit", String(options.limit ?? 200));
  if (options.after) query.set("after", options.after);
  if (options.monitorType) query.set("monitorType", options.monitorType);
  if (options.status) query.set("status", options.status);
  if (options.signalClass) query.set("signalClass", options.signalClass);

  const data = await fetchSceJson(
    "/v1/sce/radar/alert-ledger",
    query,
    "SCE alert ledger is unavailable.",
  );
  const rawEvents =
    Array.isArray(data)
      ? data
      : typeof data === "object" && data !== null && Array.isArray((data as { events?: unknown }).events)
        ? (data as { events: unknown[] }).events
        : typeof data === "object" && data !== null && Array.isArray((data as { alerts?: unknown }).alerts)
          ? (data as { alerts: unknown[] }).alerts
        : [];

  return (rawEvents as Record<string, unknown>[])
    .map(sanitizeLedgerEvent)
    .filter((event): event is SceAlertLedgerEvent => event !== null);
}
