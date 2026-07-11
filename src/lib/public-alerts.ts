import type { SceAlert } from "./sce-alerts";

export interface PublicRadarAlert {
  id: string;
  severity: string;
  status: string;
  monitorType: string;
  provider: string;
  chain: string | null;
  asset: string | null;
  assetPair: string | null;
  route: string | null;
  poolName: string | null;
  summary: string;
  whatHappened: string | null;
  whyItMatters: string | null;
  radarStatus: string | null;
  nextWatch: string | null;
  severityExplanation: string | null;
  thresholdExplanation: string | null;
  evidenceExplanation: string | null;
  evidenceSummary: string | null;
  humanRiskSummary: string | null;
  thresholdName: string | null;
  observedValueLabel: string | null;
  thresholdValueLabel: string | null;
  lastSuccessfulObservationAt: string | null;
  lastObservationAttemptAt: string | null;
  consecutiveFailedCycles: number | null;
  objectState: string | null;
  failureCause: string | null;
  coverageTier: string | null;
  openedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toPublicRadarAlert(alert: SceAlert): PublicRadarAlert {
  return {
    id: alert.id,
    severity: alert.severity,
    status: alert.status,
    monitorType: alert.monitorType,
    provider: alert.provider,
    chain: alert.chain ?? null,
    asset: alert.asset ?? null,
    assetPair: alert.assetPair ?? null,
    route: alert.route ?? null,
    poolName: alert.poolName ?? null,
    summary: alert.publicSummary ?? alert.summary,
    whatHappened: alert.whatHappened ?? null,
    whyItMatters: alert.whyItMatters ?? null,
    radarStatus: alert.radarStatus ?? null,
    nextWatch: alert.nextWatch ?? null,
    severityExplanation: alert.severityExplanation ?? null,
    thresholdExplanation: alert.thresholdExplanation ?? null,
    evidenceExplanation: alert.evidenceExplanation ?? null,
    evidenceSummary: alert.evidenceSummary ?? null,
    humanRiskSummary: alert.humanRiskSummary ?? null,
    thresholdName: alert.thresholdName ?? null,
    observedValueLabel: alert.observedValueLabel ?? null,
    thresholdValueLabel: alert.thresholdValueLabel ?? null,
    lastSuccessfulObservationAt: alert.lastSuccessfulObservationAt ?? null,
    lastObservationAttemptAt: alert.lastObservationAttemptAt ?? null,
    consecutiveFailedCycles: alert.consecutiveFailedCycles ?? null,
    objectState: alert.objectState ?? null,
    failureCause: alert.failureCause ?? null,
    coverageTier: alert.coverageTier ?? null,
    openedAt: alert.openedAt ?? null,
    resolvedAt: alert.resolvedAt ?? null,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
  };
}

export function buildMonitorCtaHref(isAuthenticated: boolean, objectId: string | null): string {
  const watchlistPath = objectId
    ? `/dashboard/watchlists?objectId=${encodeURIComponent(objectId)}`
    : "/dashboard/watchlists";

  if (isAuthenticated) return watchlistPath;

  const params = new URLSearchParams({
    screen_hint: "signup",
    returnTo: watchlistPath,
  });
  return `/auth/login?${params.toString()}`;
}
