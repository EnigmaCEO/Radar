import { describe, expect, it, vi } from "vitest";
import type { RadarAlert } from "./api-types";
import {
  DASHBOARD_ACTIVE_ALERT_FETCH_LIMIT,
  DASHBOARD_RECENT_ALERT_PREVIEW_LIMIT,
  loadDashboardAlertSummary,
  sortAlertsBySeverityAndCreatedAt,
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
    const alerts = Array.from({ length: 11 }, (_, index) =>
      makeAlert({
        id: `alert-${index + 1}`,
        dedupeKey: `dedupe-${index + 1}`,
        severity: index < 3 ? "critical" : index < 7 ? "warning" : "watch",
        createdAt: `2026-07-04T00:00:${String(index).padStart(2, "0")}.000Z`,
        updatedAt: `2026-07-04T00:00:${String(index).padStart(2, "0")}.000Z`,
      }),
    );
    const fetchAlerts = vi.fn().mockResolvedValue(alerts);

    const summary = await loadDashboardAlertSummary(fetchAlerts);

    expect(fetchAlerts).toHaveBeenCalledWith({
      status: "active",
      limit: DASHBOARD_ACTIVE_ALERT_FETCH_LIMIT,
    });
    expect(summary.totalActiveAlerts).toBe(11);
    expect(summary.recentAlerts).toHaveLength(DASHBOARD_RECENT_ALERT_PREVIEW_LIMIT);
  });

  it("keeps the dashboard recent alerts preview limited to the latest 5 alerts", () => {
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

  it("returns zero counts and an empty recent list for an empty active alert set", () => {
    expect(summarizeDashboardAlerts([])).toEqual({
      totalActiveAlerts: 0,
      criticalCount: 0,
      warningCount: 0,
      watchCount: 0,
      recentAlerts: [],
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
});
