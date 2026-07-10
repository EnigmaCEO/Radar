import type { RadarAlert, RadarMonitorType, RadarSeverity, RadarStatus } from "./api-types";
import { isCoverageGapAlert } from "./alert-classification";

const SEVERITY_RANK: Record<RadarSeverity, number> = {
  critical: 0,
  warning: 1,
  watch: 2,
};

const GROUP_WINDOW_MS: Record<RadarMonitorType, number> = {
  oracle: 90 * 60 * 1000,
  lp: 15 * 60 * 1000,
  bridge: 20 * 60 * 1000,
  governance: 30 * 60 * 1000,
  dependency: 30 * 60 * 1000,
  sce_heartbeat: 30 * 60 * 1000,
};

export interface CorrelatedAlertGroup {
  id: string;
  title: string;
  status: RadarStatus;
  severity: RadarSeverity;
  monitorType: RadarMonitorType;
  source: string;
  chain?: string;
  reasonCode: string;
  alertCount: number;
  alerts: RadarAlert[];
  openedAt: string;
  updatedAt: string;
  resolvedAt?: string;
  sharedToken?: string;
}

export type CorrelatedAlertListItem =
  | { kind: "group"; item: CorrelatedAlertGroup }
  | { kind: "alert"; item: RadarAlert };

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function providerLabel(value: string): string {
  return /[A-Z]/.test(value) ? value : titleCase(value);
}

function alertAnchorTime(alert: RadarAlert): number {
  return new Date(alert.openedAt ?? alert.createdAt).getTime();
}

function alertUpdatedTime(alert: RadarAlert): number {
  return new Date(alert.resolvedAt ?? alert.updatedAt ?? alert.createdAt).getTime();
}

function normalizeToken(token: string): string {
  return token.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function parseTokens(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[\/|,\s()-]+/)
    .map((token) => normalizeToken(token))
    .filter((token) => token.length >= 2);
}

function collectAlertTokens(alert: RadarAlert): string[] {
  const unique = new Set<string>();
  for (const value of [alert.assetPair, alert.asset]) {
    for (const token of parseTokens(value)) unique.add(token);
  }
  return Array.from(unique);
}

function sharedTokenForAlerts(alerts: RadarAlert[]): string | undefined {
  if (alerts.length < 2) return undefined;
  const counts = new Map<string, number>();
  for (const alert of alerts) {
    for (const token of collectAlertTokens(alert)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  const ranked = Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return ranked[0]?.[0];
}

function dominantSeverity(alerts: RadarAlert[]): RadarSeverity {
  return [...alerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )[0]?.severity ?? "watch";
}

function baseGroupKey(alert: RadarAlert): string {
  return [
    alert.monitorType,
    alert.source.trim().toLowerCase(),
    (alert.chain ?? "").trim().toLowerCase(),
    alert.reasonCode.trim().toUpperCase(),
    alert.status,
  ].join("|");
}

function alertsShareLpObject(clusterAlerts: RadarAlert[], candidate: RadarAlert): boolean {
  const candidateTokens = new Set(collectAlertTokens(candidate));
  if (candidateTokens.size === 0) {
    return clusterAlerts.some(
      (alert) =>
        Boolean(candidate.objectId && alert.objectId && candidate.objectId === alert.objectId) ||
        Boolean(candidate.poolName && alert.poolName && candidate.poolName === alert.poolName),
    );
  }

  return clusterAlerts.some((alert) =>
    collectAlertTokens(alert).some((token) => candidateTokens.has(token)),
  );
}

function shouldJoinCluster(clusterAlerts: RadarAlert[], candidate: RadarAlert): boolean {
  const lastAlert = clusterAlerts[clusterAlerts.length - 1];
  if (!lastAlert) return true;

  const baseMatches = baseGroupKey(lastAlert) === baseGroupKey(candidate);
  if (!baseMatches) return false;

  const timeDelta = Math.abs(alertAnchorTime(candidate) - alertAnchorTime(lastAlert));
  if (timeDelta > GROUP_WINDOW_MS[candidate.monitorType]) return false;

  if (candidate.monitorType === "lp") {
    return alertsShareLpObject(clusterAlerts, candidate);
  }

  return true;
}

function buildClusterTitle(alerts: RadarAlert[]): string {
  const first = alerts[0];
  const provider = providerLabel(first.source);
  const chain = first.chain?.trim();
  const sharedToken = sharedTokenForAlerts(alerts);

  if (first.reasonCode === "LP_POOL_IMBALANCE" && sharedToken) {
    return `${provider} ${sharedToken} concentration`;
  }
  if (first.reasonCode === "ORACLE_STALE") {
    return [provider, chain, "feed freshness"].filter(Boolean).join(" ");
  }
  if (first.reasonCode === "LP_POOL_IMBALANCE") {
    return `${provider} pool imbalance`;
  }
  if (first.reasonCode === "BRIDGE_ROUTE_LATENCY" || first.reasonCode === "BRIDGE_ROUTE_DELAYED") {
    return `${provider} route latency`;
  }

  const reason = titleCase(first.reasonCode.toLowerCase());
  return [provider, chain, reason].filter(Boolean).join(" ");
}

function buildCluster(alerts: RadarAlert[]): CorrelatedAlertGroup {
  const sorted = [...alerts].sort((a, b) => alertAnchorTime(a) - alertAnchorTime(b));
  const first = sorted[0];
  const newestUpdate = [...sorted].sort((a, b) => alertUpdatedTime(b) - alertUpdatedTime(a))[0];
  const resolvedAlerts = sorted.filter((alert) => Boolean(alert.resolvedAt));
  const resolvedAt =
    resolvedAlerts.length === sorted.length
      ? [...resolvedAlerts].sort((a, b) => alertUpdatedTime(b) - alertUpdatedTime(a))[0]?.resolvedAt
      : undefined;

  return {
    id: `group:${sorted.map((alert) => alert.id).join(",")}`,
    title: buildClusterTitle(sorted),
    status: first.status,
    severity: dominantSeverity(sorted),
    monitorType: first.monitorType,
    source: first.source,
    chain: first.chain,
    reasonCode: first.reasonCode,
    alertCount: sorted.length,
    alerts: sorted,
    openedAt: first.openedAt ?? first.createdAt,
    updatedAt: newestUpdate.updatedAt,
    resolvedAt,
    sharedToken: sharedTokenForAlerts(sorted),
  };
}

export function correlateAlerts(alerts: RadarAlert[]): CorrelatedAlertListItem[] {
  const buckets = new Map<string, RadarAlert[]>();
  for (const alert of alerts) {
    const key = baseGroupKey(alert);
    buckets.set(key, [...(buckets.get(key) ?? []), alert]);
  }

  const groupsOrSingles: CorrelatedAlertListItem[] = [];

  for (const bucketAlerts of buckets.values()) {
    const sorted = [...bucketAlerts].sort((a, b) => alertAnchorTime(a) - alertAnchorTime(b));
    const clusters: RadarAlert[][] = [];

    for (const alert of sorted) {
      const current = clusters[clusters.length - 1];
      if (!current || !shouldJoinCluster(current, alert)) {
        clusters.push([alert]);
        continue;
      }
      current.push(alert);
    }

    for (const cluster of clusters) {
      if (cluster.length > 1 && !cluster.some((alert) => isCoverageGapAlert(alert))) {
        groupsOrSingles.push({ kind: "group", item: buildCluster(cluster) });
        continue;
      }
      for (const alert of cluster) {
        groupsOrSingles.push({ kind: "alert", item: alert });
      }
    }
  }

  return groupsOrSingles.sort((a, b) => {
    const aTime =
      a.kind === "group"
        ? new Date(a.item.resolvedAt ?? a.item.updatedAt ?? a.item.openedAt).getTime()
        : alertUpdatedTime(a.item);
    const bTime =
      b.kind === "group"
        ? new Date(b.item.resolvedAt ?? b.item.updatedAt ?? b.item.openedAt).getTime()
        : alertUpdatedTime(b.item);
    if (aTime !== bTime) return bTime - aTime;

    const aSeverity = a.kind === "group" ? a.item.severity : a.item.severity;
    const bSeverity = b.kind === "group" ? b.item.severity : b.item.severity;
    return SEVERITY_RANK[aSeverity] - SEVERITY_RANK[bSeverity];
  });
}
