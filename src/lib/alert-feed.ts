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
  recentActivity: RadarAlert[];
}

export const EMPTY_DASHBOARD_ALERT_SUMMARY: DashboardAlertSummary = {
  totalActiveAlerts: 0,
  criticalCount: 0,
  warningCount: 0,
  watchCount: 0,
  recentAlerts: [],
  recentActivity: [],
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

export function sortAlertsByUpdatedAt(alerts: RadarAlert[]): RadarAlert[] {
  return [...alerts].sort((a, b) => {
    const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function summarizeDashboardAlerts(
  activeAlerts: RadarAlert[],
  allAlerts: RadarAlert[] = activeAlerts,
): DashboardAlertSummary {
  return {
    totalActiveAlerts: activeAlerts.length,
    criticalCount: activeAlerts.filter((alert) => alert.severity === "critical").length,
    warningCount: activeAlerts.filter((alert) => alert.severity === "warning").length,
    watchCount: activeAlerts.filter((alert) => alert.severity === "watch").length,
    recentAlerts: sortAlertsBySeverityAndCreatedAt(activeAlerts).slice(
      0,
      DASHBOARD_RECENT_ALERT_PREVIEW_LIMIT,
    ),
    recentActivity: sortAlertsByUpdatedAt(allAlerts).slice(0, DASHBOARD_RECENT_ALERT_PREVIEW_LIMIT),
  };
}

export async function loadDashboardAlertSummary(
  fetchAlerts: AlertFetcher,
): Promise<DashboardAlertSummary> {
  const [activeAlerts, allAlerts] = await Promise.all([
    fetchAlerts({
      status: "active",
      limit: DASHBOARD_ACTIVE_ALERT_FETCH_LIMIT,
    }),
    fetchAlerts({
      limit: DASHBOARD_ACTIVE_ALERT_FETCH_LIMIT,
    }),
  ]);

  return summarizeDashboardAlerts(activeAlerts, allAlerts);
}
