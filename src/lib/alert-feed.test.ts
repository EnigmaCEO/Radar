import { describe, expect, it, vi } from "vitest";
import type { RadarAlert } from "./api-types";
import {
  DASHBOARD_ACTIVE_ALERT_FETCH_LIMIT,
  DASHBOARD_RECENT_ALERT_PREVIEW_LIMIT,
  loadDashboardAlertSummary,
  sortAlertsBySeverityAndCreatedAt,
  sortAlertsByUpdatedAt,
  summarizeDashboardAlerts,
} from "./alert-feed";

function makeAlert(overrides: Partial<RadarAlert> = {}): RadarAlert {
  return {
    id: "alert-1",
    dedupeKey: "dedupe-1",
    monitorType: "oracle",
    source: "Chainlink",
    severity: "warning",
    status: "active",
    confidence: 0.9,
    summary: "Test alert",
    reasonCode: "TEST_ALERT",
    visibility: "public",
    provenance: "manual",
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
    ...overrides,
  };
}

describe("alert-feed", () => {
  it("uses the full active alert fetch for dashboard totals instead of the preview size", async () => {
    const activeAlerts = Array.from({ length: 11 }, (_, index) =>
      makeAlert({
        id: `alert-${index + 1}`,
        dedupeKey: `dedupe-${index + 1}`,
        severity: index < 3 ? "critical" : index < 7 ? "warning" : "watch",
        createdAt: `2026-07-04T00:00:${String(index).padStart(2, "0")}.000Z`,
        updatedAt: `2026-07-04T00:00:${String(index).padStart(2, "0")}.000Z`,
      }),
    );
    const allAlerts = [
      ...activeAlerts,
      makeAlert({
        id: "resolved-1",
        dedupeKey: "dedupe-resolved-1",
        status: "resolved",
        updatedAt: "2026-07-04T00:01:00.000Z",
        resolvedAt: "2026-07-04T00:01:00.000Z",
      }),
    ];
    const fetchAlerts = vi
      .fn()
      .mockResolvedValueOnce(activeAlerts)
      .mockResolvedValueOnce(allAlerts);

    const summary = await loadDashboardAlertSummary(fetchAlerts);

    expect(fetchAlerts).toHaveBeenNthCalledWith(1, {
      status: "active",
      limit: DASHBOARD_ACTIVE_ALERT_FETCH_LIMIT,
    });
    expect(fetchAlerts).toHaveBeenNthCalledWith(2, {
      limit: DASHBOARD_ACTIVE_ALERT_FETCH_LIMIT,
    });
    expect(summary.totalActiveAlerts).toBe(11);
    expect(summary.recentAlerts).toHaveLength(DASHBOARD_RECENT_ALERT_PREVIEW_LIMIT);
    expect(summary.recentActivity[0]?.id).toBe("resolved-1");
  });

  it("keeps the dashboard recent alerts preview limited to the latest 5 active alerts", () => {
    const alerts = Array.from({ length: 7 }, (_, index) =>
      makeAlert({
        id: `alert-${index + 1}`,
        dedupeKey: `dedupe-${index + 1}`,
        createdAt: `2026-07-04T00:00:${String(index).padStart(2, "0")}.000Z`,
        updatedAt: `2026-07-04T00:00:${String(index).padStart(2, "0")}.000Z`,
      }),
    );

    const summary = summarizeDashboardAlerts(alerts);

    expect(summary.recentAlerts.map((alert) => alert.id)).toEqual([
      "alert-7",
      "alert-6",
      "alert-5",
      "alert-4",
      "alert-3",
    ]);
  });

  it("surfaces recent activity using the latest update time across all statuses", () => {
    const activeAlerts = [
      makeAlert({ id: "active-1", dedupeKey: "dedupe-active-1", updatedAt: "2026-07-04T00:00:00.000Z" }),
    ];
    const allAlerts = [
      ...activeAlerts,
      makeAlert({
        id: "resolved-1",
        dedupeKey: "dedupe-resolved-1",
        status: "resolved",
        updatedAt: "2026-07-04T00:05:00.000Z",
        resolvedAt: "2026-07-04T00:05:00.000Z",
      }),
    ];

    const summary = summarizeDashboardAlerts(activeAlerts, allAlerts);

    expect(summary.recentActivity.map((alert) => alert.id)).toEqual(["resolved-1", "active-1"]);
  });

  it("calculates dashboard severity counts from the full active alert set", () => {
    const summary = summarizeDashboardAlerts([
      makeAlert({ severity: "critical" }),
      makeAlert({ id: "alert-2", dedupeKey: "dedupe-2", severity: "critical" }),
      makeAlert({ id: "alert-3", dedupeKey: "dedupe-3", severity: "warning" }),
      makeAlert({ id: "alert-4", dedupeKey: "dedupe-4", severity: "warning" }),
      makeAlert({ id: "alert-5", dedupeKey: "dedupe-5", severity: "warning" }),
      makeAlert({ id: "alert-6", dedupeKey: "dedupe-6", severity: "watch" }),
    ]);

    expect(summary.totalActiveAlerts).toBe(6);
    expect(summary.criticalCount).toBe(2);
    expect(summary.warningCount).toBe(3);
    expect(summary.watchCount).toBe(1);
  });

  it("returns zero counts and empty previews for an empty active alert set", () => {
    expect(summarizeDashboardAlerts([])).toEqual({
      totalActiveAlerts: 0,
      criticalCount: 0,
      warningCount: 0,
      watchCount: 0,
      recentAlerts: [],
      recentActivity: [],
    });
  });

  it("preserves the alerts page severity-first then newest-first ordering", () => {
    const sorted = sortAlertsBySeverityAndCreatedAt([
      makeAlert({
        id: "watch-newest",
        dedupeKey: "dedupe-watch-newest",
        severity: "watch",
        createdAt: "2026-07-04T00:00:10.000Z",
        updatedAt: "2026-07-04T00:00:10.000Z",
      }),
      makeAlert({
        id: "critical-oldest",
        dedupeKey: "dedupe-critical-oldest",
        severity: "critical",
        createdAt: "2026-07-04T00:00:01.000Z",
        updatedAt: "2026-07-04T00:00:01.000Z",
      }),
      makeAlert({
        id: "warning-mid",
        dedupeKey: "dedupe-warning-mid",
        severity: "warning",
        createdAt: "2026-07-04T00:00:05.000Z",
        updatedAt: "2026-07-04T00:00:05.000Z",
      }),
      makeAlert({
        id: "critical-newest",
        dedupeKey: "dedupe-critical-newest",
        severity: "critical",
        createdAt: "2026-07-04T00:00:09.000Z",
        updatedAt: "2026-07-04T00:00:09.000Z",
      }),
    ]);

    expect(sorted.map((alert) => alert.id)).toEqual([
      "critical-newest",
      "critical-oldest",
      "warning-mid",
      "watch-newest",
    ]);
  });

  it("sorts recent activity by latest update time", () => {
    const sorted = sortAlertsByUpdatedAt([
      makeAlert({ id: "older", dedupeKey: "dedupe-older", updatedAt: "2026-07-04T00:00:01.000Z" }),
      makeAlert({ id: "newer", dedupeKey: "dedupe-newer", updatedAt: "2026-07-04T00:00:09.000Z" }),
    ]);

    expect(sorted.map((alert) => alert.id)).toEqual(["newer", "older"]);
  });
});
