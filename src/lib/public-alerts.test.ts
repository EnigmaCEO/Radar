import { describe, expect, it } from "vitest";
import { buildMonitorCtaHref, toPublicRadarAlert } from "./public-alerts";

describe("toPublicRadarAlert", () => {
  it("keeps only public-safe alert fields", () => {
    const publicAlert = toPublicRadarAlert({
      id: "RADAR-1",
      monitorType: "oracle",
      provider: "Chainlink",
      chain: "Base",
      asset: "USDC",
      assetPair: "USDC/USD",
      route: null,
      poolName: null,
      objectId: "oracle-feed:chainlink:base:usdc-usd",
      objectType: "oracle_feed",
      purpose: "commercial_priority",
      severity: "warning",
      status: "active",
      reasonCode: "ORACLE_STALE",
      summary: "private summary",
      publicSummary: "public summary",
      signalClass: "coverage",
      evidenceSummary: "evidence",
      tags: ["technical_smoke", "sagitta_dependency"],
      whatHappened: "what happened",
      whyItMatters: "why it matters",
      radarStatus: "public-safe status",
      nextWatch: "next watch",
      evidenceExplanation: "evidence explanation",
      thresholdName: "critical_after_seconds",
      observedValueLabel: "Observed: 18h",
      thresholdValueLabel: "Threshold: 12h",
      lastSuccessfulObservationAt: "2026-07-10T00:00:00.000Z",
      lastObservationAttemptAt: "2026-07-10T01:00:00.000Z",
      consecutiveFailedCycles: 3,
      objectState: "unknown",
      failureCause: "status_source_unavailable",
      coverageTier: "coverage_warning",
      openedAt: "2026-07-10T00:00:00.000Z",
      resolvedAt: null,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T01:00:00.000Z",
      configEncrypted: "should-not-leak",
      destinationUrl: "should-not-leak",
    } as never);

    expect(publicAlert).toEqual({
      id: "RADAR-1",
      severity: "warning",
      status: "active",
      monitorType: "oracle",
      provider: "Chainlink",
      chain: "Base",
      asset: "USDC",
      assetPair: "USDC/USD",
      route: null,
      poolName: null,
      summary: "public summary",
      whatHappened: "what happened",
      whyItMatters: "why it matters",
      radarStatus: "public-safe status",
      nextWatch: "next watch",
      severityExplanation: null,
      thresholdExplanation: null,
      evidenceExplanation: "evidence explanation",
      evidenceSummary: "evidence",
      humanRiskSummary: null,
      thresholdName: "critical_after_seconds",
      observedValueLabel: "Observed: 18h",
      thresholdValueLabel: "Threshold: 12h",
      lastSuccessfulObservationAt: "2026-07-10T00:00:00.000Z",
      lastObservationAttemptAt: "2026-07-10T01:00:00.000Z",
      consecutiveFailedCycles: 3,
      objectState: "unknown",
      failureCause: "status_source_unavailable",
      coverageTier: "coverage_warning",
      openedAt: "2026-07-10T00:00:00.000Z",
      resolvedAt: null,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T01:00:00.000Z",
    });
    expect("purpose" in publicAlert).toBe(false);
    expect("tags" in publicAlert).toBe(false);
    expect("objectId" in publicAlert).toBe(false);
    expect("destinationUrl" in publicAlert).toBe(false);
    expect("configEncrypted" in publicAlert).toBe(false);
  });
});

describe("buildMonitorCtaHref", () => {
  it("builds a signup CTA for unauthenticated public alert pages", () => {
    expect(buildMonitorCtaHref(false, "obj_1")).toBe(
      "/auth/login?screen_hint=signup&returnTo=%2Fdashboard%2Fwatchlists%3FobjectId%3Dobj_1",
    );
  });

  it("builds a direct watchlist CTA for authenticated users", () => {
    expect(buildMonitorCtaHref(true, "obj_1")).toBe("/dashboard/watchlists?objectId=obj_1");
  });
});
