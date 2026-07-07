import type { RadarAlert, RadarSeverity } from "./api-types";

export const DASHBOARD_ACTIVE_ALERT_FETCH_LIMIT = 200;
export const DASHBOARD_RECENT_ALERT_PREVIEW_LIMIT = 5;

const ALERTS_PAGE_SEVERITY_RANK: Record<RadarSeverity, number> = {
  critical: 0,
  warning: 1,
  watch: 2,
};

type AlertFetcher = (params?: {
  status?: string;
  severity?: string;
  monitorType?: string;
  limit?: number;
}) => Promise<RadarAlert[]>;

export interface DashboardAlertSummary {
  totalActiveAlerts: number;
  criticalCount: number;
  warningCount: number;
  watchCount: number;
  recentAlerts: RadarAlert[];
}

export const EMPTY_DASHBOARD_ALERT_SUMMARY: DashboardAlertSummary = {
  totalActiveAlerts: 0,
  criticalCount: 0,
  warningCount: 0,
  watchCount: 0,
  recentAlerts: [],
};

export function sortAlertsNewestFirst(alerts: RadarAlert[]): RadarAlert[] {
  return [...alerts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function sortAlertsBySeverityAndCreatedAt(alerts: RadarAlert[]): RadarAlert[] {
  return [...alerts].sort((a, b) => {
    const rankDiff = ALERTS_PAGE_SEVERITY_RANK[a.severity] - ALERTS_PAGE_SEVERITY_RANK[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function summarizeDashboardAlerts(alerts: RadarAlert[]): DashboardAlertSummary {
  return {
    totalActiveAlerts: alerts.length,
    criticalCount: alerts.filter((alert) => alert.severity === "critical").length,
    warningCount: alerts.filter((alert) => alert.severity === "warning").length,
    watchCount: alerts.filter((alert) => alert.severity === "watch").length,
    recentAlerts: sortAlertsBySeverityAndCreatedAt(alerts).slice(0, DASHBOARD_RECENT_ALERT_PREVIEW_LIMIT),
  };
}

export async function loadDashboardAlertSummary(
  fetchAlerts: AlertFetcher,
): Promise<DashboardAlertSummary> {
  const alerts = await fetchAlerts({
    status: "active",
    limit: DASHBOARD_ACTIVE_ALERT_FETCH_LIMIT,
  });

  return summarizeDashboardAlerts(alerts);
}
