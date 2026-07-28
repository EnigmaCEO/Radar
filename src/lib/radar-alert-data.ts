import type {
  RadarAlert,
  RadarMonitorType,
  RadarSeverity,
  RadarStatus,
} from "@/lib/api-types";
import {
  fetchSceAlertLedgerPage,
  type SceAlert,
  type SceAlertLedgerEvent,
} from "@/lib/sce-alerts";

export const LEDGER_WINDOW_MS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
} as const;

export type LedgerWindow = keyof typeof LEDGER_WINDOW_MS | "all";

function toSeverity(value: string): RadarSeverity {
  if (value === "critical" || value === "warning" || value === "watch") {
    return value;
  }
  return "watch";
}

function toStatus(value: string): RadarStatus {
  if (value === "active" || value === "resolved" || value === "superseded" || value === "disabled") {
    return value;
  }
  return "active";
}

function toMonitorType(value: string): RadarMonitorType {
  if (
    value === "oracle" ||
    value === "bridge" ||
    value === "governance" ||
    value === "sce_heartbeat" ||
    value === "dependency" ||
    value === "lp"
  ) {
    return value;
  }
  return "dependency";
}

export function toRadarAlert(alert: SceAlert): RadarAlert {
  return {
    id: alert.id,
    dedupeKey: alert.id,
    monitorType: toMonitorType(alert.monitorType),
    source: alert.provider,
    severity: toSeverity(alert.severity),
    status: toStatus(alert.status),
    confidence: 1,
    summary: alert.publicSummary ?? alert.summary,
    reasonCode: alert.reasonCode,
    visibility: "private",
    provenance: "live",
    signalClass: alert.signalClass ?? undefined,
    tags: alert.tags ?? undefined,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
    publicSummary: alert.publicSummary ?? undefined,
    oracle: alert.monitorType === "oracle" ? alert.provider : undefined,
    bridge: alert.monitorType === "bridge" ? alert.provider : undefined,
    asset: alert.asset ?? undefined,
    assetPair: alert.assetPair ?? undefined,
    chain: alert.chain ?? undefined,
    route: alert.route ?? undefined,
    poolName: alert.poolName ?? undefined,
    objectId: alert.objectId ?? undefined,
    thresholdName: alert.thresholdName ?? undefined,
    observedValueLabel: alert.observedValueLabel ?? undefined,
    thresholdValueLabel: alert.thresholdValueLabel ?? undefined,
    declaredHeartbeatSeconds: alert.declaredHeartbeatSeconds ?? undefined,
    appliedThresholdSeconds: alert.appliedThresholdSeconds ?? undefined,
    appliedThresholdKind: alert.appliedThresholdKind ?? undefined,
    thresholdSourceLabel: alert.thresholdSourceLabel ?? undefined,
    evidenceState: alert.evidenceState ?? undefined,
    publicVerificationState: alert.publicVerificationState ?? undefined,
    whatHappened: alert.whatHappened ?? undefined,
    whyItMatters: alert.whyItMatters ?? undefined,
    radarStatus: alert.radarStatus ?? undefined,
    evidenceExplanation: alert.evidenceExplanation ?? undefined,
    lastSuccessfulObservationAt: alert.lastSuccessfulObservationAt ?? undefined,
    lastObservationAttemptAt: alert.lastObservationAttemptAt ?? undefined,
    consecutiveFailedCycles: alert.consecutiveFailedCycles ?? undefined,
    objectState: alert.objectState ?? undefined,
    failureCause: alert.failureCause ?? undefined,
    coverageTier: alert.coverageTier ?? undefined,
    openedAt: alert.openedAt ?? undefined,
    resolvedAt: alert.resolvedAt ?? undefined,
  };
}

export function toRadarAlertFromLedger(event: SceAlertLedgerEvent): RadarAlert {
  return {
    id: event.alertId,
    dedupeKey: event.eventId,
    monitorType: toMonitorType(event.monitorType),
    source: event.provider,
    severity: toSeverity(event.severity),
    status: toStatus(event.status),
    confidence: 1,
    summary: event.publicSummary ?? event.summary,
    reasonCode: event.reasonCode,
    visibility: "private",
    provenance: "live",
    signalClass: event.signalClass ?? undefined,
    tags: event.tags ?? undefined,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt ?? event.createdAt,
    publicSummary: event.publicSummary ?? undefined,
    oracle: event.monitorType === "oracle" ? event.provider : undefined,
    bridge: event.monitorType === "bridge" ? event.provider : undefined,
    asset: event.asset ?? undefined,
    assetPair: event.assetPair ?? undefined,
    chain: event.chain ?? undefined,
    route: event.route ?? undefined,
    poolName: event.poolName ?? undefined,
    objectId: event.objectId ?? undefined,
    thresholdName: event.thresholdName ?? undefined,
    observedValueLabel: event.observedValueLabel ?? undefined,
    thresholdValueLabel: event.thresholdValueLabel ?? undefined,
    declaredHeartbeatSeconds: event.declaredHeartbeatSeconds ?? undefined,
    appliedThresholdSeconds: event.appliedThresholdSeconds ?? undefined,
    appliedThresholdKind: event.appliedThresholdKind ?? undefined,
    thresholdSourceLabel: event.thresholdSourceLabel ?? undefined,
    evidenceState: event.evidenceState ?? undefined,
    publicVerificationState: event.publicVerificationState ?? undefined,
    whatHappened: event.whatHappened ?? undefined,
    whyItMatters: event.whyItMatters ?? undefined,
    radarStatus: event.radarStatus ?? undefined,
    evidenceExplanation: event.evidenceExplanation ?? undefined,
    lastSuccessfulObservationAt: event.lastSuccessfulObservationAt ?? undefined,
    lastObservationAttemptAt: event.lastObservationAttemptAt ?? undefined,
    consecutiveFailedCycles: event.consecutiveFailedCycles ?? undefined,
    objectState: event.objectState ?? undefined,
    failureCause: event.failureCause ?? undefined,
    coverageTier: event.coverageTier ?? undefined,
    openedAt: event.openedAt ?? event.sourceAlertCreatedAt ?? undefined,
    resolvedAt: event.resolvedAt ?? undefined,
  };
}

export function isWithinHistoryWindow(alert: SceAlert, historyDays: number, now: Date): boolean {
  if (alert.status === "active") return true;

  const cutoff = now.getTime() - historyDays * 24 * 60 * 60 * 1000;
  const candidateTimestamp =
    alert.resolvedAt ??
    alert.updatedAt ??
    alert.openedAt ??
    alert.createdAt;
  const timestamp = new Date(candidateTimestamp).getTime();
  return Number.isFinite(timestamp) && timestamp >= cutoff;
}

export function parseLedgerWindow(value: string | null): LedgerWindow {
  if (
    value === "24h" ||
    value === "7d" ||
    value === "30d" ||
    value === "90d" ||
    value === "all"
  ) {
    return value;
  }
  return "30d";
}

export function windowStartForLedger(options: {
  window: LedgerWindow;
  historyDays: number | null;
  accountCreatedAt?: string | null;
  now: Date;
}): string {
  const { window, historyDays, accountCreatedAt, now } = options;
  const historyCutoff =
    historyDays === null
      ? null
      : now.getTime() - historyDays * 24 * 60 * 60 * 1000;

  if (window === "all") {
    if (historyCutoff !== null) return new Date(historyCutoff).toISOString();
    const createdAt = accountCreatedAt ? new Date(accountCreatedAt).getTime() : NaN;
    return Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : new Date(0).toISOString();
  }

  const requestedCutoff = now.getTime() - LEDGER_WINDOW_MS[window];
  const effectiveCutoff =
    historyCutoff === null ? requestedCutoff : Math.max(requestedCutoff, historyCutoff);
  return new Date(effectiveCutoff).toISOString();
}

export async function fetchLedgerHistory(options: {
  since: string;
  until: string;
  limit: number;
  monitorType?: string;
  status?: string;
}): Promise<{ events: SceAlertLedgerEvent[]; count: number }> {
  const events: SceAlertLedgerEvent[] = [];
  let count = 0;
  let after: string | undefined;

  while (events.length < options.limit) {
    const remaining = options.limit - events.length;
    const pageLimit = Math.min(remaining, 200);
    const page = await fetchSceAlertLedgerPage({
      since: options.since,
      until: options.until,
      limit: pageLimit,
      after,
      monitorType: options.monitorType,
      status: options.status,
    });
    count = Math.max(count, page.count);

    if (page.events.length === 0) break;
    events.push(...page.events);

    const nextCursor = page.events[page.events.length - 1]?.cursor ?? undefined;
    if (!nextCursor || page.events.length < pageLimit) break;
    after = nextCursor;
  }

  return {
    events: events.slice(0, options.limit),
    count: Math.max(count, events.length),
  };
}
