import type { SceAlert, SceAlertLedgerEvent } from "./sce-alerts";

export const SEVERITY_RANK = {
  info: 0,
  watch: 1,
  warning: 2,
  critical: 3,
} as const;

export type CanonicalSeverity = keyof typeof SEVERITY_RANK;

const FILTER_KEYS = [
  "monitorTypes",
  "providers",
  "chains",
  "assets",
  "objectIds",
  "tags",
  "purposes",
  "statuses",
  "signalClasses",
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstStringFromObject(object: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
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

function normalizeDateString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeSeverity(value: unknown): CanonicalSeverity {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "warn") return "warning";
  if (normalized in SEVERITY_RANK) return normalized as CanonicalSeverity;
  return "info";
}

export function getSeverityRank(value: unknown): number {
  return SEVERITY_RANK[normalizeSeverity(value)];
}

export function meetsMinSeverity(severity: unknown, min: unknown): boolean {
  return getSeverityRank(severity) >= getSeverityRank(min);
}

export const DELIVERY_WINDOWS = ["15min", "1h", "24h"] as const;
export type DeliveryWindow = (typeof DELIVERY_WINDOWS)[number];

export const WINDOW_MS: Record<DeliveryWindow, number> = {
  "15min": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

export function isValidWindow(value: unknown): value is DeliveryWindow {
  return typeof value === "string" && (DELIVERY_WINDOWS as readonly string[]).includes(value);
}

function getWindowTimestampValue(
  value: string | Pick<MatchableAlert, "createdAt" | "updatedAt">,
): string | null {
  if (typeof value === "string") return value;
  return value.updatedAt ?? value.createdAt;
}

export function isWithinWindow(
  value: string | Pick<MatchableAlert, "createdAt" | "updatedAt">,
  window: DeliveryWindow,
  now: Date,
): boolean {
  const candidate = getWindowTimestampValue(value);
  if (!candidate) return false;
  const ts = new Date(candidate).getTime();
  if (Number.isNaN(ts)) return false;
  return now.getTime() - ts <= WINDOW_MS[window];
}

export function deriveSignalToken(reasonCode: string): string {
  return reasonCode.replace(/^(ORACLE_|BRIDGE_|LP_)/, "").toLowerCase();
}

export function matchesSignalClass(selected: string, token: string): boolean {
  const a = selected.toLowerCase();
  return a.length > 0 && token.length > 0 && (token.includes(a) || a.includes(token));
}

export interface MatchableAlert {
  alertId: string;
  id: string;
  eventId: string | null;
  cursor: string | null;
  eventType: string | null;
  title: string;
  summary: string;
  monitorType: string;
  provider: string;
  chain: string | null;
  asset: string | null;
  objectId: string | null;
  tags: string[];
  purpose: string | null;
  status: string;
  signalClass: string | null;
  severity: CanonicalSeverity;
  reasonCode: string;
  createdAt: string | null;
  updatedAt: string | null;
  assetPair?: string | null;
  route?: string | null;
  poolName?: string | null;
  objectType?: string | null;
  publicSummary?: string | null;
  evidenceSummary?: string | null;
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
}

export function normalizeAlert(
  input: SceAlert | SceAlertLedgerEvent | Record<string, unknown>,
): MatchableAlert | null {
  const raw = input as Record<string, unknown>;
  const evidence = asRecord(raw.evidence);
  const evidenceExplanation = asRecord(evidence?.explanation);
  const evidenceSummary = asRecord(raw.evidenceSummary) ?? asRecord(raw.evidence_summary);
  const explanations = asRecord(raw.explanations) ?? asRecord(raw.explanation);
  const fieldSources = [raw, explanations, evidenceSummary, evidence, evidenceExplanation];
  const explanationField = (camel: string, snake: string) =>
    firstStringFromSources(fieldSources, camel, snake);
  const alertId = firstString(raw.alertId, raw.alert_id, raw.id);
  const monitorType = firstString(raw.monitorType, raw.monitor_type);
  const eventId = firstString(raw.eventId, raw.event_id);
  const cursor = firstString(raw.cursor, raw.after);
  const eventType = firstString(raw.eventType, raw.event_type);
  const isLedgerEvent = eventId !== null || cursor !== null || eventType !== null;

  if (!alertId || !monitorType) return null;

  const summary = firstString(raw.summary, raw.publicSummary, raw.public_summary, raw.title) ?? "";
  const reasonCode =
    firstString(raw.reasonCode, raw.reason_code, raw.alertType, raw.alert_type) ?? "";
  const derivedSignalClass = reasonCode ? deriveSignalToken(reasonCode) : null;
  const explicitSignalClass = firstString(raw.signalClass, raw.signal_class);

  const createdAt = normalizeDateString(
    firstString(raw.createdAt, raw.created_at, raw.eventAt, raw.event_at, raw.timestamp),
  );
  const updatedAt = normalizeDateString(
    firstString(
      raw.updatedAt,
      raw.updated_at,
      raw.lastUpdatedAt,
      raw.last_updated_at,
      raw.sourceAlertUpdatedAt,
      raw.source_alert_updated_at,
      raw.timestamp,
    ),
  );

  return {
    alertId,
    id: eventId ?? alertId,
    eventId,
    cursor,
    eventType,
    title: firstString(raw.title, raw.summary) ?? summary,
    summary,
    monitorType,
    provider: firstString(raw.provider, raw.source) ?? "",
    chain: firstString(raw.chain),
    asset: firstString(raw.asset, raw.pair, raw.assetPair, raw.asset_pair),
    objectId: firstString(raw.objectId, raw.object_id, raw.monitorObjectId, raw.monitor_object_id),
    tags: toStringArray(raw.tags),
    purpose: firstString(raw.purpose, raw.objectPurpose, raw.object_purpose),
    status: firstString(raw.status, raw.state) ?? "unknown",
    signalClass: explicitSignalClass ?? (isLedgerEvent ? null : derivedSignalClass),
    severity: normalizeSeverity(raw.severity),
    reasonCode,
    createdAt,
    updatedAt: updatedAt ?? createdAt,
    assetPair: firstString(raw.assetPair, raw.asset_pair, raw.pair),
    route: firstString(raw.route),
    poolName: firstString(raw.poolName, raw.pool_name),
    objectType: firstString(raw.objectType, raw.object_type),
    publicSummary: firstString(raw.publicSummary, raw.public_summary),
    evidenceSummary:
      firstString(raw.evidenceSummary, raw.evidence_summary) ??
      firstStringFromSources(fieldSources, "summary"),
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
  };
}

export function toDeliveryAlert(
  input: SceAlert | SceAlertLedgerEvent | Record<string, unknown>,
): SceAlert | null {
  const raw = input as Record<string, unknown>;
  const normalized = normalizeAlert(input);
  if (!normalized) return null;

  return {
    id: normalized.alertId,
    monitorType: normalized.monitorType,
    provider: normalized.provider,
    chain: normalized.chain,
    asset: normalized.asset,
    assetPair: normalized.assetPair ?? null,
    route: normalized.route ?? firstString(raw.route) ?? null,
    poolName: normalized.poolName ?? null,
    objectId: normalized.objectId,
    objectType: normalized.objectType ?? null,
    purpose: normalized.purpose,
    severity: normalized.severity,
    status: normalized.status,
    reasonCode: normalized.reasonCode,
    summary: normalized.summary,
    publicSummary: normalized.publicSummary ?? null,
    signalClass: normalized.signalClass ?? null,
    evidenceSummary: normalized.evidenceSummary ?? null,
    tags: normalized.tags,
    severityExplanation: normalized.severityExplanation ?? null,
    thresholdExplanation: normalized.thresholdExplanation ?? null,
    humanRiskSummary: normalized.humanRiskSummary ?? null,
    whatHappened: normalized.whatHappened ?? null,
    whyItMatters: normalized.whyItMatters ?? null,
    radarStatus: normalized.radarStatus ?? null,
    nextWatch: normalized.nextWatch ?? null,
    evidenceExplanation: normalized.evidenceExplanation ?? null,
    thresholdName: normalized.thresholdName ?? null,
    observedValueLabel: normalized.observedValueLabel ?? null,
    thresholdValueLabel: normalized.thresholdValueLabel ?? null,
    createdAt:
      normalizeDateString(firstString(raw.sourceAlertCreatedAt, raw.source_alert_created_at)) ??
      normalized.createdAt ??
      new Date(0).toISOString(),
    updatedAt:
      normalizeDateString(firstString(raw.sourceAlertUpdatedAt, raw.source_alert_updated_at)) ??
      normalized.updatedAt ??
      normalized.createdAt ??
      new Date(0).toISOString(),
  };
}

export function toMatchableAlert(alert: SceAlert | SceAlertLedgerEvent): MatchableAlert | null {
  return normalizeAlert(alert);
}

export interface WatchlistFilterSet {
  id: string;
  name: string;
  matchMode: string;
  minSeverity: string;
  monitorTypes: string[];
  providers: string[];
  chains: string[];
  assets: string[];
  objectIds: string[];
  tags: string[];
  purposes: string[];
  statuses: string[];
  signalClasses: string[];
}

function ciIncludes(list: string[], value: string): boolean {
  const v = value.toLowerCase();
  return list.some((item) => item.toLowerCase() === v);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function mismatchReason(key: FilterKey): string {
  switch (key) {
    case "monitorTypes":
      return "monitor_type_mismatch";
    case "providers":
      return "provider_mismatch";
    case "chains":
      return "chain_mismatch";
    case "assets":
      return "asset_mismatch";
    case "objectIds":
      return "object_id_mismatch";
    case "tags":
      return "tag_mismatch";
    case "purposes":
      return "purpose_mismatch";
    case "statuses":
      return "status_mismatch";
    case "signalClasses":
      return "signal_class_mismatch";
  }
}

function getActiveFilters(watchlist: WatchlistFilterSet): Array<{ key: FilterKey; values: string[] }> {
  return FILTER_KEYS.map((key) => ({ key, values: watchlist[key] ?? [] })).filter(({ values }) => values.length > 0);
}

export function hasWatchlistFilters(watchlist: WatchlistFilterSet): boolean {
  return getActiveFilters(watchlist).length > 0;
}

export interface WatchlistMatchEvaluation {
  matched: boolean;
  matchedDimensions: string[];
  skippedReasons: string[];
}

export function evaluateWatchlistMatch(
  alert: MatchableAlert,
  watchlist: WatchlistFilterSet,
): WatchlistMatchEvaluation {
  if (
    alert.status.toLowerCase() === "resolved" &&
    !watchlist.statuses.some((status) => status.toLowerCase() === "resolved")
  ) {
    return {
      matched: false,
      matchedDimensions: [],
      skippedReasons: ["resolved_status_not_requested"],
    };
  }

  if (!meetsMinSeverity(alert.severity, watchlist.minSeverity)) {
    return {
      matched: false,
      matchedDimensions: [],
      skippedReasons: ["below_watchlist_min_severity"],
    };
  }

  const activeFilters = getActiveFilters(watchlist);
  if (activeFilters.length === 0) {
    return { matched: true, matchedDimensions: [], skippedReasons: [] };
  }

  const signalToken =
    alert.signalClass ??
    (alert.eventId !== null || alert.eventType !== null || alert.cursor !== null
      ? ""
      : deriveSignalToken(alert.reasonCode));
  const dimensions = activeFilters.map(({ key, values }) => {
    switch (key) {
      case "monitorTypes":
        return { key, matched: ciIncludes(values, alert.monitorType) };
      case "providers":
        return { key, matched: ciIncludes(values, alert.provider) };
      case "chains":
        return { key, matched: !!alert.chain && ciIncludes(values, alert.chain) };
      case "assets":
        return { key, matched: !!alert.asset && ciIncludes(values, alert.asset) };
      case "objectIds":
        return { key, matched: !!alert.objectId && values.includes(alert.objectId) };
      case "tags":
        return {
          key,
          matched: alert.tags.some((tag) => ciIncludes(values, tag)),
        };
      case "purposes":
        return { key, matched: !!alert.purpose && ciIncludes(values, alert.purpose) };
      case "statuses":
        return { key, matched: ciIncludes(values, alert.status) };
      case "signalClasses":
        return {
          key,
          matched: values.some((selected) => matchesSignalClass(selected, signalToken)),
        };
    }
  });

  const matchedDimensions = dimensions.filter((dimension) => dimension.matched).map((dimension) => dimension.key);
  const matched =
    watchlist.matchMode === "all"
      ? dimensions.every((dimension) => dimension.matched)
      : dimensions.some((dimension) => dimension.matched);

  if (matched) {
    return { matched: true, matchedDimensions, skippedReasons: [] };
  }

  return {
    matched: false,
    matchedDimensions,
    skippedReasons:
      watchlist.matchMode === "all"
        ? unique(dimensions.filter((dimension) => !dimension.matched).map((dimension) => mismatchReason(dimension.key)))
        : ["no_filter_dimension_matched"],
  };
}

export function matchesWatchlist(alert: MatchableAlert, watchlist: WatchlistFilterSet): boolean {
  return evaluateWatchlistMatch(alert, watchlist).matched;
}

export const FREQUENCY_MS: Record<string, number> = {
  "15min": 15 * 60 * 1000,
  "30min": 30 * 60 * 1000,
  "1hr": 60 * 60 * 1000,
  "24hr": 24 * 60 * 60 * 1000,
};

export function isDestinationDue(lastPolledAt: Date | null, pollingFrequency: string, now: Date): boolean {
  if (!lastPolledAt) return true;
  const freqMs = FREQUENCY_MS[pollingFrequency] ?? FREQUENCY_MS["1hr"];
  return now.getTime() - lastPolledAt.getTime() >= freqMs;
}
