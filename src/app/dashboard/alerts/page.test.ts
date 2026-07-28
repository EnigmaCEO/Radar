import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RadarAlert } from "@/lib/api-types";
import { correlateAlerts } from "@/lib/alert-correlation";
import { groupCoverageGapAlerts } from "@/lib/coverage-gap-grouping";
import {
  buildIntelBurdenAggregation,
  buildIntelEvidenceQuality,
  categoryDonutSegments,
  buildIntelFindingsTimeline,
  buildIntelResolutionDistribution,
  DEFAULT_AGGREGATE_WINDOW,
  INTEL_AGGREGATE_HEADING,
  INTEL_AGGREGATE_SUBTITLE,
  IntelAggregateHistoryHeader,
  summarizeRadarIntelAggregateHistory,
} from "./page";

function correlatedFindings(alerts: RadarAlert[]) {
  return correlateAlerts(alerts).filter((row) => {
    const sample = row.kind === "group" ? row.item.alerts[0] : row.item;
    return sample?.signalClass !== "coverage" && sample?.signalClass !== "diagnostic";
  });
}

function makeAlert(overrides: Partial<RadarAlert>): RadarAlert {
  return {
    id: overrides.id ?? "alert-1",
    dedupeKey: overrides.id ?? "alert-1",
    monitorType: overrides.monitorType ?? "oracle",
    source: overrides.source ?? "chainlink",
    severity: overrides.severity ?? "warning",
    status: overrides.status ?? "active",
    confidence: 1,
    summary: overrides.summary ?? "summary",
    reasonCode: overrides.reasonCode ?? "ORACLE_STALE",
    visibility: overrides.visibility ?? "private",
    provenance: overrides.provenance ?? "live",
    createdAt: overrides.createdAt ?? "2026-07-10T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("dashboard aggregate history page", () => {
  it("renders the Radar Intel heading", () => {
    const html = renderToStaticMarkup(
      React.createElement(IntelAggregateHistoryHeader, {
        activeWindow: DEFAULT_AGGREGATE_WINDOW,
      }),
    );

    expect(html).toContain(INTEL_AGGREGATE_HEADING);
    expect(html).toContain(INTEL_AGGREGATE_SUBTITLE);
  });

  it("renders the time window selector", () => {
    const html = renderToStaticMarkup(
      React.createElement(IntelAggregateHistoryHeader, {
        activeWindow: DEFAULT_AGGREGATE_WINDOW,
      }),
    );

    expect(html).toContain("Time window");
    expect(html).toContain(">24h<");
    expect(html).toContain(">7d<");
    expect(html).toContain(">30d<");
    expect(html).toContain(">90d<");
    expect(html).toContain(">All<");
  });

  it("defaults the time window selector to 30d", () => {
    const html = renderToStaticMarkup(
      React.createElement(IntelAggregateHistoryHeader, {
        activeWindow: DEFAULT_AGGREGATE_WINDOW,
      }),
    );

    expect(DEFAULT_AGGREGATE_WINDOW).toBe("30d");
    expect(html).toContain('aria-pressed="true">30d<');
  });

  it("builds summary cards from rows inside the selected window", () => {
    const summary = summarizeRadarIntelAggregateHistory(
      [
        makeAlert({
          id: "active-recent",
          source: "chainlink",
          asset: "ETH",
          chain: "Ethereum",
          severity: "warning",
          status: "active",
          openedAt: "2026-07-12T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        }),
        makeAlert({
          id: "resolved-recent-1",
          source: "pyth",
          asset: "SOL",
          chain: "Solana",
          severity: "warning",
          status: "resolved",
          openedAt: "2026-07-11T00:00:00.000Z",
          updatedAt: "2026-07-11T01:00:00.000Z",
          resolvedAt: "2026-07-11T01:00:00.000Z",
        }),
        makeAlert({
          id: "resolved-recent-2",
          source: "wormhole",
          monitorType: "bridge",
          asset: "USDC",
          route: "Ethereum -> Base",
          chain: "Base",
          severity: "critical",
          status: "resolved",
          reasonCode: "BRIDGE_ROUTE_DELAYED",
          openedAt: "2026-07-12T00:00:00.000Z",
          updatedAt: "2026-07-12T03:00:00.000Z",
          resolvedAt: "2026-07-12T03:00:00.000Z",
        }),
        makeAlert({
          id: "coverage-recent",
          source: "rpc",
          monitorType: "dependency",
          chain: "Base",
          severity: "warning",
          status: "active",
          signalClass: "coverage",
          reasonCode: "OBSERVATION_GAP",
          summary: "source unavailable",
          openedAt: "2026-07-13T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        }),
        makeAlert({
          id: "resolved-old",
          source: "redstone",
          asset: "BTC",
          chain: "Ethereum",
          severity: "critical",
          status: "resolved",
          openedAt: "2026-05-10T00:00:00.000Z",
          updatedAt: "2026-05-10T01:00:00.000Z",
          resolvedAt: "2026-05-10T01:00:00.000Z",
        }),
      ],
      "30d",
      new Date("2026-07-14T00:00:00.000Z"),
    );

    expect(summary).toMatchObject({
      totalFindings: 3,
      activeFindings: 1,
      resolvedFindings: 2,
      criticalFindings: 1,
      coverageIncidents: 1,
    });
  });

  it("computes median resolution time correctly", () => {
    const summary = summarizeRadarIntelAggregateHistory(
      [
        makeAlert({
          id: "resolved-short",
          source: "pyth",
          asset: "SOL",
          chain: "Solana",
          severity: "warning",
          status: "resolved",
          openedAt: "2026-07-11T00:00:00.000Z",
          updatedAt: "2026-07-11T01:00:00.000Z",
          resolvedAt: "2026-07-11T01:00:00.000Z",
        }),
        makeAlert({
          id: "resolved-long",
          source: "wormhole",
          monitorType: "bridge",
          asset: "USDC",
          route: "Ethereum -> Base",
          chain: "Base",
          severity: "critical",
          status: "resolved",
          reasonCode: "BRIDGE_ROUTE_DELAYED",
          openedAt: "2026-07-12T00:00:00.000Z",
          updatedAt: "2026-07-12T03:00:00.000Z",
          resolvedAt: "2026-07-12T03:00:00.000Z",
        }),
      ],
      "30d",
      new Date("2026-07-14T00:00:00.000Z"),
    );

    expect(summary.medianResolutionTimeMs).toBe(2 * 60 * 60 * 1000);
    expect(summary.medianResolutionTimeLabel).toBe("2h");
  });

  it("renders a safe empty state when duration data cannot be computed", () => {
    const summary = summarizeRadarIntelAggregateHistory(
      [
        makeAlert({
          id: "active-only",
          source: "chainlink",
          asset: "ETH",
          chain: "Ethereum",
          severity: "warning",
          status: "active",
          openedAt: "2026-07-12T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        }),
      ],
      "30d",
      new Date("2026-07-14T00:00:00.000Z"),
    );

    expect(summary.medianResolutionTimeMs).toBeNull();
    expect(summary.medianResolutionTimeLabel).toBe("Not enough resolved data");
  });

  it("bases burden rankings on correlated findings and grouped coverage incidents", () => {
    const alerts = [
      makeAlert({
        id: "oracle-1",
        source: "chainlink",
        asset: "ETH",
        chain: "Ethereum",
        severity: "critical",
        status: "active",
        reasonCode: "ORACLE_STALE",
        openedAt: "2026-07-13T00:00:00.000Z",
        updatedAt: "2026-07-13T00:00:00.000Z",
      }),
      makeAlert({
        id: "oracle-2",
        source: "chainlink",
        asset: "BTC",
        chain: "Ethereum",
        severity: "warning",
        status: "active",
        reasonCode: "ORACLE_STALE",
        openedAt: "2026-07-13T00:30:00.000Z",
        updatedAt: "2026-07-13T00:30:00.000Z",
      }),
      makeAlert({
        id: "lp-1",
        source: "curve",
        monitorType: "lp",
        asset: "USDC/USDT",
        assetPair: "USDC/USDT",
        poolName: "Curve 3pool",
        chain: "Ethereum",
        severity: "warning",
        status: "resolved",
        reasonCode: "LP_POOL_IMBALANCE",
        openedAt: "2026-07-12T00:00:00.000Z",
        updatedAt: "2026-07-12T01:00:00.000Z",
        resolvedAt: "2026-07-12T01:00:00.000Z",
      }),
      makeAlert({
        id: "coverage-1",
        source: "rpc",
        monitorType: "dependency",
        chain: "Base",
        severity: "warning",
        status: "active",
        signalClass: "coverage",
        reasonCode: "OBSERVATION_GAP",
        summary: "source unavailable",
        route: "Base -> Ethereum",
        asset: "USDC",
        openedAt: "2026-07-13T02:00:00.000Z",
        updatedAt: "2026-07-13T02:00:00.000Z",
      }),
      makeAlert({
        id: "coverage-2",
        source: "rpc",
        monitorType: "dependency",
        chain: "Base",
        severity: "warning",
        status: "active",
        signalClass: "coverage",
        reasonCode: "OBSERVATION_GAP",
        summary: "source unavailable",
        route: "Ethereum -> Base",
        asset: "USDC",
        openedAt: "2026-07-13T02:10:00.000Z",
        updatedAt: "2026-07-13T02:10:00.000Z",
      }),
    ];

    const rows = correlateAlerts(alerts);
    const findings = rows.filter((row) => {
      const sample = row.kind === "group" ? row.item.alerts[0] : row.item;
      return sample?.signalClass !== "coverage";
    });
    const coverageAlerts = alerts.filter((alert) => alert.signalClass === "coverage");
    const aggregation = buildIntelBurdenAggregation(
      findings,
      groupCoverageGapAlerts(coverageAlerts),
    );

    expect(aggregation.byType.map((row) => row.label)).toEqual([
      "Coverage incident",
      "Oracle freshness",
      "LP imbalance",
    ]);
    expect(aggregation.byType[0]).toEqual(
      expect.objectContaining({
        label: "Coverage incident",
        totalUnits: 1,
      }),
    );
    expect(aggregation.byType[1]).toEqual(
      expect.objectContaining({
        label: "Oracle freshness",
        totalUnits: 1,
        criticalUnits: 1,
      }),
    );
  });

  it("attributes burden to the reporting provider with readable labels", () => {
    const rows = correlateAlerts([
      makeAlert({
        id: "chainlink-1",
        source: "chainlink",
        asset: "ETH",
        chain: "Ethereum",
        status: "active",
      }),
      makeAlert({
        id: "reference-1",
        source: "oracle_reference",
        reasonCode: "ORACLE_REFERENCE_DEVIATION",
        asset: "FRAX",
        chain: "Ethereum",
        status: "resolved",
      }),
    ]);
    const aggregation = buildIntelBurdenAggregation(rows, []);

    expect(aggregation.byProvider.map((row) => row.label)).toEqual(
      expect.arrayContaining(["Chainlink", "Oracle Reference"]),
    );
  });
});

describe("aggregate history findings timeline", () => {
  it("buckets findings by day and severity within the window", () => {
    const findings = correlatedFindings([
      makeAlert({
        id: "critical-jul13",
        source: "chainlink",
        asset: "ETH",
        chain: "Ethereum",
        severity: "critical",
        status: "active",
        openedAt: "2026-07-13T12:00:00.000Z",
      }),
      makeAlert({
        id: "warning-jul13",
        source: "curve",
        monitorType: "lp",
        poolName: "Curve 3pool",
        chain: "Ethereum",
        severity: "warning",
        status: "active",
        reasonCode: "LP_POOL_IMBALANCE",
        openedAt: "2026-07-13T09:00:00.000Z",
      }),
      makeAlert({
        id: "watch-jul12",
        source: "pyth",
        asset: "SOL",
        chain: "Solana",
        severity: "watch",
        status: "active",
        openedAt: "2026-07-12T06:00:00.000Z",
      }),
    ]);

    const timeline = buildIntelFindingsTimeline(
      findings,
      [],
      "7d",
      new Date("2026-07-14T00:00:00.000Z"),
    );

    expect(timeline.granularity).toBe("day");
    expect(timeline.buckets).toHaveLength(7);

    const jul13 = timeline.buckets.find((bucket) => bucket.key === "2026-07-13");
    const jul12 = timeline.buckets.find((bucket) => bucket.key === "2026-07-12");
    expect(jul13).toMatchObject({ critical: 1, warning: 1, watch: 0, total: 2 });
    expect(jul12).toMatchObject({ watch: 1, total: 1 });
    expect(timeline.maxTotal).toBe(2);
  });

  it("uses hourly buckets for the 24h window", () => {
    const timeline = buildIntelFindingsTimeline(
      [],
      [],
      "24h",
      new Date("2026-07-14T00:00:00.000Z"),
    );
    expect(timeline.granularity).toBe("hour");
    expect(timeline.buckets).toHaveLength(24);
  });
});

describe("aggregate history resolution distribution", () => {
  it("buckets genuine resolutions and excludes superseded or quarantined records", () => {
    const findings = correlatedFindings([
      makeAlert({
        id: "fast-resolve",
        source: "chainlink",
        asset: "ETH",
        chain: "Ethereum",
        status: "resolved",
        openedAt: "2026-07-11T00:00:00.000Z",
        resolvedAt: "2026-07-11T00:03:00.000Z",
      }),
      makeAlert({
        id: "hour-resolve",
        source: "curve",
        monitorType: "lp",
        poolName: "Curve 3pool",
        chain: "Ethereum",
        reasonCode: "LP_POOL_IMBALANCE",
        status: "resolved",
        openedAt: "2026-07-11T00:00:00.000Z",
        resolvedAt: "2026-07-11T01:00:00.000Z",
      }),
      makeAlert({
        id: "superseded",
        source: "chainlink",
        asset: "USDT",
        chain: "Ethereum",
        status: "resolved",
        summary: "Superseded after heartbeat verification: Chainlink USDT/USD was below threshold.",
        openedAt: "2026-07-08T00:00:00.000Z",
        resolvedAt: "2026-07-09T20:00:00.000Z",
      }),
      makeAlert({
        id: "still-open",
        source: "pyth",
        asset: "SOL",
        chain: "Solana",
        status: "active",
        openedAt: "2026-07-13T00:00:00.000Z",
      }),
    ]);

    const distribution = buildIntelResolutionDistribution(findings);

    expect(distribution.resolvedCount).toBe(2);
    expect(distribution.ongoingCount).toBe(1);
    expect(distribution.reconciledCount).toBe(1);

    const countFor = (key: string) =>
      distribution.buckets.find((bucket) => bucket.key === key)?.count ?? 0;
    expect(countFor("lt5m")).toBe(1);
    expect(countFor("30m-2h")).toBe(1);
    expect(distribution.maxCount).toBe(1);
  });
});

describe("signal mix donut segments", () => {
  const row = (label: string, totalUnits: number) => ({
    label,
    totalUnits,
    activeUnits: 0,
    resolvedUnits: totalUnits,
    criticalUnits: 0,
    latestAt: null,
  });

  it("keeps the top 5 categories and folds the rest into Other", () => {
    const segments = categoryDonutSegments([
      row("LP liquidity drop", 116),
      row("Oracle reference deviation", 101),
      row("Oracle freshness", 38),
      row("Coverage incident", 16),
      row("LP imbalance", 13),
      row("Bridge latency", 7),
      row("Governance", 3),
    ]);

    expect(segments.map((s) => s.label)).toEqual([
      "LP liquidity drop",
      "Oracle reference deviation",
      "Oracle freshness",
      "Coverage incident",
      "LP imbalance",
      "Other",
    ]);
    expect(segments[5]).toMatchObject({ label: "Other", value: 10, cssVar: "--cat-6" });
    expect(segments[0]).toMatchObject({ value: 116, cssVar: "--cat-1" });
  });

  it("omits Other when five or fewer categories exist", () => {
    const segments = categoryDonutSegments([row("Oracle freshness", 5), row("LP imbalance", 2)]);
    expect(segments.map((s) => s.label)).toEqual(["Oracle freshness", "LP imbalance"]);
  });
});

describe("aggregate history evidence quality", () => {
  it("classifies findings into verification tiers and folds coverage into diagnostic", () => {
    const findings = correlatedFindings([
      makeAlert({
        id: "public-verified",
        source: "chainlink",
        asset: "ETH",
        chain: "Ethereum",
        objectId: "oracle-feed:chainlink:ethereum:eth-usd",
        openedAt: "2026-07-13T00:00:00.000Z",
        publicVerificationState: "verified_public_alert",
        evidenceState: "complete_observed_evidence",
      }),
      makeAlert({
        id: "lp-config",
        source: "curve",
        monitorType: "lp",
        poolName: "Curve 3pool",
        chain: "Ethereum",
        objectId: "lp:curve:3pool:ethereum",
        openedAt: "2026-07-12T00:00:00.000Z",
        reasonCode: "LP_POOL_IMBALANCE",
        evidenceExplanation:
          "Evidence shows imbalance 32.3%, warning threshold 25.0%, and calibration status baseline_configured.",
      }),
      makeAlert({
        id: "oracle-pending",
        source: "chainlink",
        asset: "USDe",
        chain: "Base",
        objectId: "oracle-feed:chainlink:base:usde-usd",
        openedAt: "2026-07-11T00:00:00.000Z",
        evidenceExplanation:
          "Observed evidence: feed age 22h. Evidence state: inferred. Public verification: internal_finding.",
      }),
      makeAlert({
        id: "quarantined",
        source: "oracle_reference",
        reasonCode: "ORACLE_REFERENCE_DEVIATION",
        asset: "FRAX",
        chain: "Ethereum",
        summary: "Superseded after reference sanity check: FRAX/USD was quarantined as invalid evidence.",
      }),
    ]);

    // A coverage incident (diagnostic bridge route error).
    const coverageGroups = groupCoverageGapAlerts([
      makeAlert({
        id: "bridge-diag",
        source: "across",
        monitorType: "bridge",
        signalClass: "diagnostic",
        reasonCode: "BRIDGE_ROUTE_ERROR",
        chain: "Ethereum",
        route: "Ethereum -> Arbitrum",
        summary: "Bridge route check error: status source unavailable.",
      }),
    ]);

    const quality = buildIntelEvidenceQuality(findings, coverageGroups);
    const countFor = (key: string) =>
      quality.tiers.find((tier) => tier.key === key)?.count ?? 0;

    expect(countFor("verified_public")).toBe(1);
    expect(countFor("config_verified")).toBe(1);
    expect(countFor("pending")).toBe(1);
    expect(countFor("quarantined")).toBe(1);
    expect(countFor("diagnostic")).toBe(1);
    expect(quality.total).toBe(5);
    // Tiers are ordered most-trusted first.
    expect(quality.tiers.map((tier) => tier.key)).toEqual([
      "verified_public",
      "config_verified",
      "pending",
      "quarantined",
      "diagnostic",
    ]);
  });
});
