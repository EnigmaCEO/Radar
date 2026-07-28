import type { RadarAlert, RadarMonitorType, RadarSeverity } from "./api-types";
import { isCoverageGapAlert } from "./alert-classification";
import { extractAlertEvidenceDetails } from "./alert-evidence-display";
import { collapseAlertsToLatestState } from "./alert-feed";

export const PROVIDER_RELIABILITY_DEFAULT_WINDOW_LABEL = "30d history window";
export const MIN_PROVIDER_CONDITION_FINDINGS = 3;

export type ProviderReliabilityConfidence = "low" | "medium" | "high";
export type ProviderCurrentCondition =
  | "Stable"
  | "Degraded"
  | "Critical"
  | "No active issues";
export type ProviderConditionPattern =
  | "Clean"
  | "Recurring"
  | "Persistent"
  | "Insufficient evidence";

export interface ProviderScoreFactor {
  label: string;
  count: number;
  impact: number;
  detail?: string;
}

export interface ProviderReliabilityRow {
  provider: string;
  currentCondition: ProviderCurrentCondition;
  patternLabel: ProviderConditionPattern;
  observabilityScore: number;
  confidence: ProviderReliabilityConfidence;
  findingsEvaluated: number;
  verifiedFindings: number;
  approvedFindings: number;
  resolvedFindings: number;
  observationCount: number;
  successfulObservations: number;
  failedObservations: number;
  scoringWindowLabel: string;
  totalAlerts: number;
  activeIncidents: number;
  criticalFindings: number;
  coverageIncidents: number;
  excludedRecords: number;
  medianDurationHours: number;
  longestDurationHours: number;
  recoveryRate: number;
  recurrenceCount: number;
  recurrenceRate: number;
  totalBurden: number;
  durationBurden: number;
  recurrenceBurden: number;
  dominantMonitorType: RadarMonitorType | null;
  latestEventAt: string | null;
  conditionFactors: ProviderScoreFactor[];
  observabilityFactors: ProviderScoreFactor[];
}

export interface IntelSummaryBucket {
  label: string;
  count: number;
}

export interface IntelAlertAggregateRow {
  label: string;
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  criticalAlerts: number;
  coverageAlerts: number;
  latestAt: string | null;
}

export interface IntelAlertsAggregation {
  byObject: IntelAlertAggregateRow[];
  byChain: IntelAlertAggregateRow[];
  byType: IntelAlertAggregateRow[];
}

export interface IntelWindowSummary {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  watchAlerts: number;
  coverageAlerts: number;
  providersTracked: number;
  topProviders: IntelSummaryBucket[];
  topChains: IntelSummaryBucket[];
  topMonitorTypes: IntelSummaryBucket[];
}

export interface IntelReportWindow {
  title: string;
  days: number;
  summary: IntelWindowSummary;
}

export interface InfrastructureTrendPoint {
  dateKey: string;
  label: string;
  watchOpened: number;
  warningOpened: number;
  criticalOpened: number;
  coverageOpened: number;
  totalFindingsOpened: number;
  totalTimelineActivity: number;
  resolvedFindings: number;
  backlogFindings: number;
}

export interface InfrastructureHealthSummary {
  timeline: InfrastructureTrendPoint[];
  firstRecordedDateKey: string | null;
  firstRecordedLabel: string | null;
  windowStartDateKey: string;
  windowEndDateKey: string;
  recordedActivityTotal: number;
  findingsOpenedTotal: number;
  resolvedFindingsTotal: number;
  coverageIncidentsTotal: number;
  activeBacklogTotal: number;
  historyByMonitor: IntelSummaryBucket[];
  historyByChain: IntelSummaryBucket[];
}

function toTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function alertOpenedTimestamp(alert: RadarAlert): number | null {
  return toTimestamp(alert.openedAt ?? alert.createdAt);
}

function alertResolvedTimestamp(alert: RadarAlert): number | null {
  return toTimestamp(alert.resolvedAt);
}

function alertActivityTimestamp(alert: RadarAlert): number | null {
  return (
    toTimestamp(alert.updatedAt) ??
    alertResolvedTimestamp(alert) ??
    alertOpenedTimestamp(alert)
  );
}

function isWithinWindow(timestamp: number | null, cutoff: number): boolean {
  return timestamp !== null && timestamp >= cutoff;
}

function getUtcDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function getShortDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function utcMidnightTimestamp(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function providerName(alert: RadarAlert): string {
  const value =
    alert.source ||
    alert.oracle ||
    alert.bridge ||
    alert.affectedProtocol ||
    "Unknown provider";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Unknown provider";
}

function firstString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function objectLabel(alert: RadarAlert): string {
  const bridgeRoute = [alert.bridge, alert.asset, alert.route]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
  if (bridgeRoute.length > 0) {
    return alert.chain ? `${bridgeRoute} · ${alert.chain}` : bridgeRoute;
  }

  const core =
    firstString(
      alert.poolName,
      alert.route,
      alert.assetPair,
      alert.asset,
      alert.objectId,
      alert.summary,
    ) ?? "Unknown object";
  return alert.chain ? `${core} · ${alert.chain}` : core;
}

function typeLabel(alert: RadarAlert): string {
  return isCoverageGapAlert(alert) ? "coverage" : alert.monitorType;
}

function aggregateAlertsByLabel(
  alerts: RadarAlert[],
  labelForAlert: (alert: RadarAlert) => string | null,
): IntelAlertAggregateRow[] {
  const grouped = new Map<string, RadarAlert[]>();

  for (const alert of alerts) {
    const label = labelForAlert(alert)?.trim();
    if (!label) continue;
    const current = grouped.get(label) ?? [];
    current.push(alert);
    grouped.set(label, current);
  }

  return [...grouped.entries()]
    .map(([label, groupedAlerts]) => ({
      label,
      totalAlerts: groupedAlerts.length,
      activeAlerts: groupedAlerts.filter((alert) => alert.status === "active").length,
      resolvedAlerts: groupedAlerts.filter((alert) => alert.status === "resolved").length,
      criticalAlerts: groupedAlerts.filter((alert) => alert.severity === "critical").length,
      coverageAlerts: groupedAlerts.filter((alert) => isCoverageGapAlert(alert)).length,
      latestAt:
        groupedAlerts
          .map((alert) => alert.updatedAt ?? alert.resolvedAt ?? alert.openedAt ?? alert.createdAt)
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null,
    }))
    .sort((a, b) => {
      if (a.activeAlerts !== b.activeAlerts) return b.activeAlerts - a.activeAlerts;
      if (a.totalAlerts !== b.totalAlerts) return b.totalAlerts - a.totalAlerts;
      const latestA = a.latestAt ? Date.parse(a.latestAt) : 0;
      const latestB = b.latestAt ? Date.parse(b.latestAt) : 0;
      if (latestA !== latestB) return latestB - latestA;
      return a.label.localeCompare(b.label);
    });
}

function countBy<T extends string>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function toTopBuckets(counts: Map<string, number>, limit = 5): IntelSummaryBucket[] {
  return [...counts.entries()]
    .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

type ProviderConditionKind =
  | "oracle_freshness"
  | "reference_deviation"
  | "bridge_latency"
  | "lp_imbalance"
  | "lp_liquidity_drop";

type ProviderEvidenceTier =
  | "verified"
  | "approved"
  | "pending"
  | "quarantined"
  | "diagnostic";

const NON_PROVIDER_KEYS = new Set([
  "oracle_reference",
  "rpc",
  "api",
  "adapter",
  "metadata",
  "unknown provider",
]);

const REFERENCE_PROVIDER_TAG_KEYS = new Set([
  "provider",
  "providers",
  "reference_provider",
  "reference-provider",
  "reference_providers",
  "reference-providers",
  "referenceproviders",
  "provider_attribution",
  "provider-attribution",
  "providerattribution",
]);

const CONDITION_KIND_LABELS: Record<ProviderConditionKind, string> = {
  oracle_freshness: "Oracle freshness",
  reference_deviation: "Reference deviation",
  bridge_latency: "Bridge latency",
  lp_imbalance: "LP imbalance",
  lp_liquidity_drop: "LP liquidity drop",
};

const CONDITION_SEVERITY_UNITS: Record<RadarSeverity, number> = {
  watch: 3,
  warning: 7,
  critical: 16,
};

const CONDITION_DURATION_MULTIPLIER: Record<RadarSeverity, number> = {
  watch: 0.6,
  warning: 1,
  critical: 1.5,
};

const CONDITION_RECURRENCE_UNITS: Record<RadarSeverity, number> = {
  watch: 0.5,
  warning: 1.5,
  critical: 3.5,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundBurden(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle] ?? 0;
}

function normalizeProviderKey(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  if (NON_PROVIDER_KEYS.has(trimmed)) return null;
  return trimmed;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }
  return items;
}

function directProviderAttribution(alert: RadarAlert): string[] {
  return uniqueStrings([
    normalizeProviderKey(alert.source),
    normalizeProviderKey(alert.oracle),
    normalizeProviderKey(alert.bridge),
    normalizeProviderKey(alert.affectedProtocol),
  ]);
}

function parseProviderAttributionTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags) || tags.length === 0) return [];

  const providers: string[] = [];
  for (const rawTag of tags) {
    if (typeof rawTag !== "string") continue;
    const tag = rawTag.trim();
    if (tag.length === 0) continue;

    const colonIndex = tag.indexOf(":");
    const equalsIndex = tag.indexOf("=");
    const separatorIndex =
      colonIndex === -1
        ? equalsIndex
        : equalsIndex === -1
          ? colonIndex
          : Math.min(colonIndex, equalsIndex);
    if (separatorIndex === -1) continue;

    const key = tag.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = tag.slice(separatorIndex + 1).trim();
    if (!REFERENCE_PROVIDER_TAG_KEYS.has(key) || rawValue.length === 0) continue;

    for (const token of rawValue.split(/[|,]/)) {
      const provider = normalizeProviderKey(token);
      if (provider) providers.push(provider);
    }
  }

  return uniqueStrings(providers);
}

function normalizedReasonCode(alert: RadarAlert): string {
  return alert.reasonCode.trim().toUpperCase();
}

function isReferenceDeviationAlert(alert: RadarAlert): boolean {
  return (
    normalizedReasonCode(alert) === "ORACLE_REFERENCE_DEVIATION" ||
    alert.source.trim().toLowerCase() === "oracle_reference"
  );
}

function conditionKindForAlert(alert: RadarAlert): ProviderConditionKind | null {
  if (isCoverageGapAlert(alert) || alert.signalClass?.trim().toLowerCase() === "diagnostic") {
    return null;
  }

  const reasonCode = normalizedReasonCode(alert);
  if (reasonCode === "ORACLE_STALE") return "oracle_freshness";
  if (reasonCode === "ORACLE_REFERENCE_DEVIATION") return "reference_deviation";
  if (reasonCode === "BRIDGE_ROUTE_LATENCY" || reasonCode === "BRIDGE_ROUTE_DELAYED") {
    return "bridge_latency";
  }
  if (reasonCode === "LP_POOL_IMBALANCE") return "lp_imbalance";
  if (reasonCode === "LP_LIQUIDITY_DROP") return "lp_liquidity_drop";
  return null;
}

function providerEvidenceTier(alert: RadarAlert): ProviderEvidenceTier {
  if (alert.signalClass?.trim().toLowerCase() === "diagnostic" || isCoverageGapAlert(alert)) {
    return "diagnostic";
  }

  const lifecycleText = `${alert.summary} ${alert.radarStatus ?? ""}`.toLowerCase();
  if (
    alert.status === "superseded" ||
    lifecycleText.includes("quarantined") ||
    lifecycleText.includes("superseded")
  ) {
    return "quarantined";
  }

  const parsed = extractAlertEvidenceDetails(alert.evidenceExplanation);
  const publicState = (
    alert.publicVerificationState ??
    parsed.publicVerificationState ??
    ""
  ).toLowerCase();
  const evidenceState = (alert.evidenceState ?? parsed.evidenceState ?? "").toLowerCase();
  const explanation = (alert.evidenceExplanation ?? "").toLowerCase();

  if (
    (publicState.includes("verified") && publicState.includes("public")) ||
    (evidenceState.includes("complete") && evidenceState.includes("observed"))
  ) {
    return "verified";
  }
  if (
    publicState.includes("approved") ||
    evidenceState.includes("approved") ||
    explanation.includes("baseline_configured")
  ) {
    return "approved";
  }
  return "pending";
}

function attributedProvidersForCondition(alert: RadarAlert): string[] {
  if (isReferenceDeviationAlert(alert)) {
    return parseProviderAttributionTags(alert.tags);
  }
  return directProviderAttribution(alert);
}

function attributedProvidersForObservability(alert: RadarAlert): string[] {
  if (isReferenceDeviationAlert(alert)) return [];
  return directProviderAttribution(alert);
}

function isObservabilityEvent(alert: RadarAlert): boolean {
  if (alert.signalClass?.trim().toLowerCase() === "diagnostic" || isCoverageGapAlert(alert)) {
    return true;
  }

  const reasonCode = normalizedReasonCode(alert);
  if (reasonCode.includes("READ_ERROR")) return true;

  const failureCause = (alert.failureCause ?? "").toLowerCase();
  if (
    failureCause.includes("source_unavailable") ||
    failureCause.includes("missing_adapter") ||
    failureCause.includes("adapter_missing") ||
    failureCause.includes("metadata")
  ) {
    return true;
  }

  const text = `${alert.summary} ${alert.radarStatus ?? ""} ${alert.evidenceExplanation ?? ""}`.toLowerCase();
  return (
    text.includes("source unavailable") ||
    text.includes("missing adapter") ||
    text.includes("adapter missing") ||
    text.includes("unresolved metadata") ||
    text.includes("read failure") ||
    text.includes("rpc read failure") ||
    text.includes("api read failure")
  );
}

function observabilityFailureLabel(alert: RadarAlert): string {
  const failureCause = (alert.failureCause ?? "").toLowerCase();
  const reasonCode = normalizedReasonCode(alert);
  const text = `${alert.summary} ${alert.radarStatus ?? ""} ${alert.evidenceExplanation ?? ""}`.toLowerCase();

  if (failureCause.includes("missing_adapter") || failureCause.includes("adapter_missing")) {
    return "Missing adapter";
  }
  if (failureCause.includes("metadata") || text.includes("unresolved metadata")) {
    return "Unresolved metadata";
  }
  if (
    reasonCode.includes("READ_ERROR") ||
    text.includes("read failure") ||
    text.includes("rpc read failure") ||
    text.includes("api read failure")
  ) {
    return "Read failures";
  }
  if (isCoverageGapAlert(alert) || text.includes("source unavailable")) {
    return "Coverage incidents";
  }
  return "Diagnostic events";
}

function conditionStatusMultiplier(alert: RadarAlert): number {
  return alert.status === "active" ? 1.2 : 0.35;
}

function conditionEvidenceMultiplier(tier: ProviderEvidenceTier): number {
  return tier === "approved" ? 0.9 : 1;
}

function conditionDurationUnits(hours: number): number {
  if (hours >= 72) return 10;
  if (hours >= 24) return 6;
  if (hours >= 6) return 2.5;
  if (hours >= 1) return 0.8;
  if (hours > 0) return 0.2;
  return 0;
}

function alertDurationHours(alert: RadarAlert, now: Date): number {
  const openedAt =
    toTimestamp(alert.openedAt ?? alert.createdAt) ??
    toTimestamp(alert.createdAt);
  const closedAt =
    alert.status === "active"
      ? now.getTime()
      : toTimestamp(alert.resolvedAt ?? alert.updatedAt) ?? now.getTime();
  if (openedAt === null || !Number.isFinite(closedAt) || closedAt <= openedAt) return 0;
  return (closedAt - openedAt) / (60 * 60 * 1000);
}

function severityRank(severity: RadarSeverity): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function peakSeverity(severities: RadarSeverity[]): RadarSeverity {
  return severities.reduce<RadarSeverity>(
    (current, candidate) =>
      severityRank(candidate) > severityRank(current) ? candidate : current,
    "watch",
  );
}

function conditionBaseBurden(alert: RadarAlert, tier: ProviderEvidenceTier): number {
  return (
    CONDITION_SEVERITY_UNITS[alert.severity] *
    conditionStatusMultiplier(alert) *
    conditionEvidenceMultiplier(tier)
  );
}

function conditionDurationBurden(
  alert: RadarAlert,
  tier: ProviderEvidenceTier,
  now: Date,
): number {
  return (
    conditionDurationUnits(alertDurationHours(alert, now)) *
    CONDITION_DURATION_MULTIPLIER[alert.severity] *
    conditionStatusMultiplier(alert) *
    conditionEvidenceMultiplier(tier)
  );
}

function observabilityFailureUnits(label: string): number {
  if (label === "Missing adapter") return 1.15;
  if (label === "Unresolved metadata") return 1.1;
  if (label === "Read failures") return 1.1;
  if (label === "Coverage incidents") return 1;
  return 0.85;
}

function confidenceForEvidence(
  findingsEvaluated: number,
  observationCount: number,
): ProviderReliabilityConfidence {
  if (findingsEvaluated >= 8 && observationCount >= 12) return "high";
  if (findingsEvaluated >= 4 && observationCount >= 6) return "medium";
  return "low";
}

function classifyCurrentCondition(input: {
  findingsEvaluated: number;
  activeIncidents: number;
  activeCriticalFindings: number;
  longestActiveDurationHours: number;
}): ProviderCurrentCondition {
  if (input.activeIncidents === 0) {
    return input.findingsEvaluated > 0 ? "Stable" : "No active issues";
  }
  if (
    input.activeCriticalFindings > 0 ||
    input.longestActiveDurationHours >= 24 ||
    input.activeIncidents >= 2
  ) {
    return "Critical";
  }
  return "Degraded";
}

function classifyConditionPattern(input: {
  findingsEvaluated: number;
  activeIncidents: number;
  criticalFindings: number;
  longestDurationHours: number;
  recoveryRate: number;
  recurrenceRate: number;
  totalBurden: number;
}): ProviderConditionPattern {
  if (input.findingsEvaluated < MIN_PROVIDER_CONDITION_FINDINGS) {
    return "Insufficient evidence";
  }
  if (
    input.activeIncidents === 0 &&
    input.criticalFindings === 0 &&
    input.recurrenceRate === 0 &&
    input.recoveryRate >= 80 &&
    input.longestDurationHours < 6 &&
    input.totalBurden < 6
  ) {
    return "Clean";
  }
  if (
    (input.activeIncidents > 0 && input.longestDurationHours >= 24) ||
    input.activeIncidents >= 2 ||
    input.criticalFindings >= 2 ||
    input.longestDurationHours >= 72 ||
    (input.recurrenceRate >= 40 && input.recoveryRate < 80) ||
    input.recoveryRate < 60
  ) {
    return "Persistent";
  }
  return "Recurring";
}

function latestEventTimestamp(alert: RadarAlert): number | null {
  return (
    toTimestamp(alert.updatedAt) ??
    toTimestamp(alert.resolvedAt) ??
    toTimestamp(alert.openedAt) ??
    toTimestamp(alert.createdAt)
  );
}

function alertRecordedTimestamp(alert: RadarAlert): number | null {
  return (
    alertOpenedTimestamp(alert) ??
    toTimestamp(alert.createdAt) ??
    alertActivityTimestamp(alert)
  );
}

function alertClosureTimestamp(alert: RadarAlert): number | null {
  if (alert.status === "active") return null;
  return alertResolvedTimestamp(alert) ?? alertActivityTimestamp(alert);
}

function monitorTypeForDominance(alert: RadarAlert): RadarMonitorType | null {
  return isCoverageGapAlert(alert) ? null : alert.monitorType;
}

function isTrustedConditionTier(tier: ProviderEvidenceTier): boolean {
  return tier === "verified" || tier === "approved";
}

type ProviderAttributedAlert = {
  alert: RadarAlert;
  conditionKind: ProviderConditionKind | null;
  evidenceTier: ProviderEvidenceTier;
  conditionBaseBurden: number;
  conditionDurationBurden: number;
  observabilityFailureUnits: number;
  observabilityLabel: string | null;
};

type ProviderWorkingState = {
  provider: string;
  totalAlerts: number;
  allAttributedAlerts: ProviderAttributedAlert[];
  conditionCandidates: ProviderAttributedAlert[];
  trustedConditionFindings: ProviderAttributedAlert[];
  observabilityEvents: ProviderAttributedAlert[];
  successfulObservationEvents: ProviderAttributedAlert[];
  monitorCounts: Map<RadarMonitorType, number>;
  latestEventAt: string | null;
};

function recordProviderAlert(
  grouped: Map<string, ProviderWorkingState>,
  provider: string,
  alert: ProviderAttributedAlert,
): void {
  const current =
    grouped.get(provider) ??
    {
      provider,
      totalAlerts: 0,
      allAttributedAlerts: [],
      conditionCandidates: [],
      trustedConditionFindings: [],
      observabilityEvents: [],
      successfulObservationEvents: [],
      monitorCounts: new Map<RadarMonitorType, number>(),
      latestEventAt: null,
    };

  current.totalAlerts += 1;
  current.allAttributedAlerts.push(alert);

  if (alert.conditionKind !== null) {
    current.conditionCandidates.push(alert);
    if (isTrustedConditionTier(alert.evidenceTier)) {
      current.trustedConditionFindings.push(alert);
    }
  }
  if (alert.observabilityLabel) {
    current.observabilityEvents.push(alert);
  } else {
    current.successfulObservationEvents.push(alert);
  }

  const monitorType = monitorTypeForDominance(alert.alert);
  if (monitorType) {
    current.monitorCounts.set(monitorType, (current.monitorCounts.get(monitorType) ?? 0) + 1);
  }

  const latestTimestamp = latestEventTimestamp(alert.alert);
  const currentLatest = current.latestEventAt ? Date.parse(current.latestEventAt) : NaN;
  if (
    latestTimestamp !== null &&
    (!Number.isFinite(currentLatest) || latestTimestamp > currentLatest)
  ) {
    current.latestEventAt = new Date(latestTimestamp).toISOString();
  }

  grouped.set(provider, current);
}

function observationKey(alert: RadarAlert): string {
  return (
    firstString(
      alert.objectId,
      alert.route,
      alert.poolName,
      alert.assetPair,
      alert.asset,
    ) ?? `${alert.monitorType}:${alert.source}:${alert.chain ?? "unknown"}:${alert.reasonCode}`
  );
}

type QualifiedExposureAggregate = {
  key: string;
  findings: ProviderAttributedAlert[];
  activeCount: number;
  resolvedCount: number;
  peakSeverity: RadarSeverity;
};

export function summarizeIntelWindow(
  alerts: RadarAlert[],
  days: number,
  now = new Date(),
): IntelWindowSummary {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  const visible = alerts.filter((alert) => {
    if (alert.status === "active") return true;
    return isWithinWindow(alertActivityTimestamp(alert), cutoff);
  });

  const providerCounts = countBy(visible.map(providerName));
  const chainCounts = countBy(
    visible
      .map((alert) => alert.chain?.trim())
      .filter((value): value is string => Boolean(value)),
  );
  const monitorCounts = countBy(
    visible.map((alert) => (isCoverageGapAlert(alert) ? "coverage" : alert.monitorType)),
  );

  return {
    totalAlerts: visible.length,
    activeAlerts: visible.filter((alert) => alert.status === "active").length,
    resolvedAlerts: visible.filter((alert) => alert.status === "resolved").length,
    criticalAlerts: visible.filter((alert) => alert.severity === "critical").length,
    warningAlerts: visible.filter((alert) => alert.severity === "warning").length,
    watchAlerts: visible.filter((alert) => alert.severity === "watch").length,
    coverageAlerts: visible.filter((alert) => isCoverageGapAlert(alert)).length,
    providersTracked: providerCounts.size,
    topProviders: toTopBuckets(providerCounts),
    topChains: toTopBuckets(chainCounts),
    topMonitorTypes: toTopBuckets(monitorCounts),
  };
}

export function buildIntelReportWindows(
  alerts: RadarAlert[],
  now = new Date(),
): IntelReportWindow[] {
  return [
    { title: "Weekly report", days: 7, summary: summarizeIntelWindow(alerts, 7, now) },
    { title: "Monthly report", days: 30, summary: summarizeIntelWindow(alerts, 30, now) },
  ];
}

export function buildIntelAlertsAggregation(
  alerts: RadarAlert[],
): IntelAlertsAggregation {
  return {
    byObject: aggregateAlertsByLabel(alerts, objectLabel),
    byChain: aggregateAlertsByLabel(
      alerts,
      (alert) => alert.chain?.trim() || (isCoverageGapAlert(alert) ? "Unspecified chain" : null),
    ),
    byType: aggregateAlertsByLabel(alerts, typeLabel),
  };
}

export function buildProviderReliabilityRows(alerts: RadarAlert[]): ProviderReliabilityRow[] {
  return buildProviderReliabilityRowsWithOptions(alerts, {});
}

export function buildProviderReliabilityRowsWithOptions(
  alerts: RadarAlert[],
  options: {
    now?: Date;
    scoringWindowLabel?: string;
  },
): ProviderReliabilityRow[] {
  const now = options.now ?? new Date();
  const scoringWindowLabel =
    options.scoringWindowLabel ?? PROVIDER_RELIABILITY_DEFAULT_WINDOW_LABEL;
  const grouped = new Map<string, ProviderWorkingState>();

  for (const alert of alerts) {
    const conditionKind = conditionKindForAlert(alert);
    const evidenceTier = providerEvidenceTier(alert);
    const observabilityLabel = isObservabilityEvent(alert)
      ? observabilityFailureLabel(alert)
      : null;
    const attributedAlert: ProviderAttributedAlert = {
      alert,
      conditionKind,
      evidenceTier,
      conditionBaseBurden:
        conditionKind !== null && isTrustedConditionTier(evidenceTier)
          ? conditionBaseBurden(alert, evidenceTier)
          : 0,
      conditionDurationBurden:
        conditionKind !== null && isTrustedConditionTier(evidenceTier)
          ? conditionDurationBurden(alert, evidenceTier, now)
          : 0,
      observabilityFailureUnits: observabilityLabel
        ? observabilityFailureUnits(observabilityLabel)
        : 0,
      observabilityLabel,
    };

    const conditionProviders =
      conditionKind !== null ? attributedProvidersForCondition(alert) : [];
    const observabilityProviders = observabilityLabel
      ? attributedProvidersForObservability(alert)
      : [];
    const providers = uniqueStrings([...conditionProviders, ...observabilityProviders]);

    for (const provider of providers) {
      recordProviderAlert(grouped, provider, attributedAlert);
    }
  }

  return [...grouped.values()]
    .map((state) => {
      const dominantMonitorType =
        [...state.monitorCounts.entries()].sort((a, b) =>
          b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1],
        )[0]?.[0] ?? null;

      const findingsEvaluated = state.trustedConditionFindings.length;
      const verifiedFindings = state.trustedConditionFindings.filter(
        ({ evidenceTier }) => evidenceTier === "verified",
      ).length;
      const approvedFindings = state.trustedConditionFindings.filter(
        ({ evidenceTier }) => evidenceTier === "approved",
      ).length;
      const resolvedFindings = state.trustedConditionFindings.filter(
        ({ alert }) => alert.status === "resolved",
      ).length;
      const activeIncidents = state.trustedConditionFindings.filter(
        ({ alert }) => alert.status === "active",
      ).length;
      const activeCriticalFindings = state.trustedConditionFindings.filter(
        ({ alert }) => alert.status === "active" && alert.severity === "critical",
      ).length;
      const criticalFindings = state.trustedConditionFindings.filter(
        ({ alert }) => alert.severity === "critical",
      ).length;
      const coverageIncidents = state.observabilityEvents.filter(({ alert }) =>
        isCoverageGapAlert(alert),
      ).length;
      const successfulObservations = state.successfulObservationEvents.length;
      const failedObservations = state.observabilityEvents.length;
      const observationCount = successfulObservations + failedObservations;
      const excludedRecords = state.allAttributedAlerts.length - findingsEvaluated;
      const qualifiedDurations = state.trustedConditionFindings.map(({ alert }) =>
        alertDurationHours(alert, now),
      );
      const activeDurations = state.trustedConditionFindings
        .filter(({ alert }) => alert.status === "active")
        .map(({ alert }) => alertDurationHours(alert, now));

      const severityBurdenRaw = state.trustedConditionFindings.reduce(
        (total, finding) => total + finding.conditionBaseBurden,
        0,
      );
      const durationBurdenRaw = state.trustedConditionFindings.reduce(
        (total, finding) => total + finding.conditionDurationBurden,
        0,
      );
      const exposureAggregates = new Map<string, QualifiedExposureAggregate>();
      for (const finding of state.trustedConditionFindings) {
        const key = observationKey(finding.alert);
        const current =
          exposureAggregates.get(key) ??
          {
            key,
            findings: [],
            activeCount: 0,
            resolvedCount: 0,
            peakSeverity: "watch",
          };
        current.findings.push(finding);
        if (finding.alert.status === "active") current.activeCount += 1;
        if (finding.alert.status === "resolved") current.resolvedCount += 1;
        current.peakSeverity = peakSeverity([
          current.peakSeverity,
          finding.alert.severity,
        ]);
        exposureAggregates.set(key, current);
      }

      const qualifiedExposureCount = Math.max(1, exposureAggregates.size);
      const recurrenceBurdenRaw = [...exposureAggregates.values()].reduce((total, exposure) => {
        const extraFindings = Math.max(0, exposure.findings.length - 1);
        if (extraFindings === 0) return total;
        const multiplier = exposure.activeCount > 0 ? 1 : 0.7;
        return (
          total +
          extraFindings *
            CONDITION_RECURRENCE_UNITS[exposure.peakSeverity] *
            multiplier
        );
      }, 0);
      const totalBurdenRaw =
        severityBurdenRaw + durationBurdenRaw + recurrenceBurdenRaw;
      const totalBurden = totalBurdenRaw / qualifiedExposureCount;
      const durationBurden = durationBurdenRaw / qualifiedExposureCount;
      const recurrenceBurden = recurrenceBurdenRaw / qualifiedExposureCount;
      const recurrenceCount = [...exposureAggregates.values()].reduce(
        (total, exposure) => total + Math.max(0, exposure.findings.length - 1),
        0,
      );
      const recurrenceRate =
        qualifiedExposureCount === 0
          ? 0
          : roundPercent((recurrenceCount / qualifiedExposureCount) * 100);
      const medianDurationHours = median(qualifiedDurations);
      const longestDurationHours = Math.max(0, ...qualifiedDurations);
      const recoveryRate =
        findingsEvaluated === 0
          ? 100
          : roundPercent((resolvedFindings / findingsEvaluated) * 100);
      const currentCondition = classifyCurrentCondition({
        findingsEvaluated,
        activeIncidents,
        activeCriticalFindings,
        longestActiveDurationHours: Math.max(0, ...activeDurations),
      });
      const patternLabel = classifyConditionPattern({
        findingsEvaluated,
        activeIncidents,
        criticalFindings,
        longestDurationHours,
        recoveryRate,
        recurrenceRate,
        totalBurden,
      });

      const conditionKindCounts = new Map<ProviderConditionKind, number>();
      for (const finding of state.trustedConditionFindings) {
        if (!finding.conditionKind) continue;
        conditionKindCounts.set(
          finding.conditionKind,
          (conditionKindCounts.get(finding.conditionKind) ?? 0) + 1,
        );
      }

      const conditionFactors: ProviderScoreFactor[] = [
        ...[...conditionKindCounts.entries()]
          .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))
          .map(([kind, count]) => ({
            label: CONDITION_KIND_LABELS[kind],
            count,
            impact: 0,
          })),
      ];
      if (severityBurdenRaw > 0) {
        conditionFactors.push({
          label: "Severity burden",
          count: findingsEvaluated,
          impact: roundBurden(
            totalBurdenRaw === 0 ? 0 : severityBurdenRaw / qualifiedExposureCount,
          ),
        });
      }
      if (recurrenceBurden > 0) {
        conditionFactors.push({
          label: "Recurrence",
          count: recurrenceCount,
          impact: roundBurden(recurrenceBurden),
          detail: `${recurrenceRate}% repeated exposure rate`,
        });
      }
      if (durationBurden > 0) {
        conditionFactors.push({
          label: "Incident duration",
          count: state.trustedConditionFindings.filter(
            (finding) => finding.conditionDurationBurden > 0,
          ).length,
          impact: roundBurden(durationBurden),
        });
      }
      if (findingsEvaluated > 0) {
        conditionFactors.push({
          label: "Burden normalization",
          count: qualifiedExposureCount,
          impact: 0,
          detail: `${qualifiedExposureCount} qualified exposure unit${qualifiedExposureCount === 1 ? "" : "s"}`,
        });
      }

      const observabilityCounts = new Map<string, number>();
      for (const event of state.observabilityEvents) {
        const label = event.observabilityLabel ?? "Diagnostic events";
        observabilityCounts.set(label, (observabilityCounts.get(label) ?? 0) + 1);
      }

      const observabilityScore = clampScore(
        observationCount === 0 ? 100 : (successfulObservations / observationCount) * 100,
      );
      const observabilityFactors: ProviderScoreFactor[] = [
        ...[...observabilityCounts.entries()]
          .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))
          .map(([label, count]) => ({
            label,
            count,
            impact: 0,
          })),
        {
          label: "Successful observations",
          count: successfulObservations,
          impact: 0,
        },
        {
          label: "Observation volume",
          count: observationCount,
          impact: 0,
          detail: scoringWindowLabel,
        },
      ];

      return {
        provider: state.provider,
        currentCondition,
        patternLabel,
        observabilityScore,
        confidence: confidenceForEvidence(findingsEvaluated, observationCount),
        findingsEvaluated,
        verifiedFindings,
        approvedFindings,
        resolvedFindings,
        observationCount,
        successfulObservations,
        failedObservations,
        scoringWindowLabel,
        totalAlerts: state.totalAlerts,
        activeIncidents,
        criticalFindings,
        coverageIncidents,
        excludedRecords,
        medianDurationHours: roundBurden(medianDurationHours),
        longestDurationHours: roundBurden(longestDurationHours),
        recoveryRate,
        recurrenceCount,
        recurrenceRate,
        totalBurden: roundBurden(totalBurden),
        durationBurden: roundBurden(durationBurden),
        recurrenceBurden: roundBurden(recurrenceBurden),
        dominantMonitorType,
        latestEventAt: state.latestEventAt,
        conditionFactors,
        observabilityFactors,
      };
    })
    .sort((a, b) => {
      const currentConditionOrder: Record<ProviderCurrentCondition, number> = {
        Critical: 0,
        Degraded: 1,
        Stable: 2,
        "No active issues": 3,
      };
      const patternOrder: Record<ProviderConditionPattern, number> = {
        Persistent: 0,
        Recurring: 1,
        Clean: 2,
        "Insufficient evidence": 3,
      };
      if (currentConditionOrder[a.currentCondition] !== currentConditionOrder[b.currentCondition]) {
        return currentConditionOrder[a.currentCondition] - currentConditionOrder[b.currentCondition];
      }
      if (patternOrder[a.patternLabel] !== patternOrder[b.patternLabel]) {
        return patternOrder[a.patternLabel] - patternOrder[b.patternLabel];
      }
      if (a.observabilityScore !== b.observabilityScore) {
        return a.observabilityScore - b.observabilityScore;
      }
      if (a.activeIncidents !== b.activeIncidents) return b.activeIncidents - a.activeIncidents;
      if (a.totalAlerts !== b.totalAlerts) return b.totalAlerts - a.totalAlerts;
      return a.provider.localeCompare(b.provider);
    });
}

export function buildInfrastructureHealthSummary(
  alerts: RadarAlert[],
  days: number | null = 14,
  now = new Date(),
): InfrastructureHealthSummary {
  const lifecycleAlerts = collapseAlertsToLatestState(alerts);
  const findingLifecycleAlerts = lifecycleAlerts.filter((alert) => !isCoverageGapAlert(alert));
  const coverageLifecycleAlerts = lifecycleAlerts.filter((alert) => isCoverageGapAlert(alert));
  const timeline: InfrastructureTrendPoint[] = [];
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dayMs = 24 * 60 * 60 * 1000;
  const firstRecordedTimestamp = alerts
    .map((alert) => alertRecordedTimestamp(alert))
    .filter((timestamp): timestamp is number => timestamp !== null)
    .reduce<number | null>(
      (earliest, timestamp) => (earliest === null ? timestamp : Math.min(earliest, timestamp)),
      null,
    );
  const firstRecordedDateKey =
    firstRecordedTimestamp === null ? null : getUtcDayKey(firstRecordedTimestamp);
  const firstRecordedLabel =
    firstRecordedDateKey === null ? null : getShortDayLabel(firstRecordedDateKey);
  const windowStartTimestamp =
    days === null
      ? firstRecordedTimestamp === null
        ? today.getTime()
        : utcMidnightTimestamp(firstRecordedTimestamp)
      : today.getTime() - Math.max(0, days - 1) * dayMs;

  for (
    let timestamp = windowStartTimestamp;
    timestamp <= today.getTime();
    timestamp += dayMs
  ) {
    const day = new Date(timestamp);
    const dateKey = day.toISOString().slice(0, 10);
    timeline.push({
      dateKey,
      label: getShortDayLabel(dateKey),
      watchOpened: 0,
      warningOpened: 0,
      criticalOpened: 0,
      coverageOpened: 0,
      totalFindingsOpened: 0,
      totalTimelineActivity: 0,
      resolvedFindings: 0,
      backlogFindings: 0,
    });
  }

  const timelineByDay = new Map(timeline.map((point) => [point.dateKey, point]));
  const rawRecordedActivityAlerts =
    days === null
      ? alerts
      : alerts.filter((alert) => {
          const openedAt = alertOpenedTimestamp(alert);
          return openedAt !== null && openedAt >= windowStartTimestamp;
        });

  for (const alert of findingLifecycleAlerts) {
    const openedAt = alertOpenedTimestamp(alert);
    if (openedAt !== null) {
      const openedBucket = timelineByDay.get(getUtcDayKey(openedAt));
      if (openedBucket) {
        openedBucket.totalFindingsOpened += 1;
        openedBucket.totalTimelineActivity += 1;
        if (alert.severity === "critical") {
          openedBucket.criticalOpened += 1;
        } else if (alert.severity === "warning") {
          openedBucket.warningOpened += 1;
        } else {
          openedBucket.watchOpened += 1;
        }
      }
    }

    const resolvedAt = alertResolvedTimestamp(alert);
    if (resolvedAt !== null) {
      const resolvedBucket = timelineByDay.get(getUtcDayKey(resolvedAt));
      if (resolvedBucket) resolvedBucket.resolvedFindings += 1;
    }
  }

  for (const alert of coverageLifecycleAlerts) {
    const openedAt = alertOpenedTimestamp(alert);
    if (openedAt === null) continue;
    const openedBucket = timelineByDay.get(getUtcDayKey(openedAt));
    if (!openedBucket) continue;
    openedBucket.coverageOpened += 1;
    openedBucket.totalTimelineActivity += 1;
  }

  for (const point of timeline) {
    const dayEndTimestamp = Date.parse(`${point.dateKey}T00:00:00.000Z`) + dayMs;
    point.backlogFindings = findingLifecycleAlerts.filter((alert) => {
      const openedAt = alertOpenedTimestamp(alert);
      if (openedAt === null || openedAt >= dayEndTimestamp) return false;
      const closedAt = alertClosureTimestamp(alert);
      return closedAt === null || closedAt >= dayEndTimestamp;
    }).length;
  }

  const findingsOpenedTotal = timeline.reduce(
    (total, point) => total + point.totalFindingsOpened,
    0,
  );
  const resolvedFindingsTotal = timeline.reduce(
    (total, point) => total + point.resolvedFindings,
    0,
  );
  const coverageIncidentsTotal = timeline.reduce(
    (total, point) => total + point.coverageOpened,
    0,
  );

  return {
    timeline,
    firstRecordedDateKey,
    firstRecordedLabel,
    windowStartDateKey: timeline[0]?.dateKey ?? today.toISOString().slice(0, 10),
    windowEndDateKey: timeline[timeline.length - 1]?.dateKey ?? today.toISOString().slice(0, 10),
    recordedActivityTotal: rawRecordedActivityAlerts.length,
    findingsOpenedTotal,
    resolvedFindingsTotal,
    coverageIncidentsTotal,
    activeBacklogTotal: timeline[timeline.length - 1]?.backlogFindings ?? 0,
    historyByMonitor: toTopBuckets(
      countBy(
        rawRecordedActivityAlerts.map((alert) =>
          isCoverageGapAlert(alert) ? "coverage" : alert.monitorType,
        ),
      ),
    ),
    historyByChain: toTopBuckets(
      countBy(
        rawRecordedActivityAlerts
          .map(
            (alert) =>
              alert.chain?.trim() || (isCoverageGapAlert(alert) ? "Unspecified chain" : null),
          )
          .filter((value): value is string => Boolean(value)),
      ),
    ),
  };
}
