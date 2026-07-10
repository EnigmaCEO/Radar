import { describe, expect, it } from "vitest";
import type { RadarAlert } from "./api-types";
import { correlateAlerts } from "./alert-correlation";

function makeAlert(overrides: Partial<RadarAlert> = {}): RadarAlert {
  return {
    id: "alert-1",
    dedupeKey: "dedupe-1",
    monitorType: "oracle",
    source: "chainlink",
    severity: "warning",
    status: "active",
    confidence: 1,
    summary: "Alert summary",
    reasonCode: "ORACLE_STALE",
    visibility: "private",
    provenance: "live",
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z",
    openedAt: "2026-07-10T08:00:00.000Z",
    chain: "Ethereum",
    ...overrides,
  };
}

describe("correlateAlerts", () => {
  it("collapses adjacent stale oracle alerts into one provider-chain freshness row", () => {
    const rows = correlateAlerts([
      makeAlert({ id: "a1", asset: "USDT", createdAt: "2026-07-10T08:00:00.000Z", openedAt: "2026-07-10T08:00:00.000Z" }),
      makeAlert({ id: "a2", asset: "GHO", createdAt: "2026-07-10T09:00:00.000Z", openedAt: "2026-07-10T09:00:00.000Z" }),
      makeAlert({ id: "a3", asset: "sUSDe", createdAt: "2026-07-10T09:00:00.000Z", openedAt: "2026-07-10T09:00:00.000Z" }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "group",
      item: {
        title: "Chainlink Ethereum feed freshness",
        alertCount: 3,
      },
    });
  });

  it("collapses same-minute LP imbalance alerts that share a token", () => {
    const rows = correlateAlerts([
      makeAlert({
        id: "lp-1",
        dedupeKey: "dedupe-lp-1",
        monitorType: "lp",
        source: "curve",
        reasonCode: "LP_POOL_IMBALANCE",
        assetPair: "FRAX/USDC",
        poolName: "Curve FRAX/USDC",
        createdAt: "2026-07-08T17:45:00.000Z",
        openedAt: "2026-07-08T17:45:00.000Z",
      }),
      makeAlert({
        id: "lp-2",
        dedupeKey: "dedupe-lp-2",
        monitorType: "lp",
        source: "curve",
        reasonCode: "LP_POOL_IMBALANCE",
        assetPair: "USDC/USDT",
        poolName: "Curve 3pool",
        createdAt: "2026-07-08T17:45:00.000Z",
        openedAt: "2026-07-08T17:45:00.000Z",
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "group",
      item: {
        title: "Curve USDC concentration",
        alertCount: 2,
      },
    });
  });

  it("does not merge LP imbalance alerts that do not share a token", () => {
    const rows = correlateAlerts([
      makeAlert({
        id: "lp-1",
        dedupeKey: "dedupe-lp-1",
        monitorType: "lp",
        source: "curve",
        reasonCode: "LP_POOL_IMBALANCE",
        assetPair: "FRAX/USDC",
        createdAt: "2026-07-08T17:45:00.000Z",
        openedAt: "2026-07-08T17:45:00.000Z",
      }),
      makeAlert({
        id: "lp-2",
        dedupeKey: "dedupe-lp-2",
        monitorType: "lp",
        source: "curve",
        reasonCode: "LP_POOL_IMBALANCE",
        assetPair: "WBTC/ETH",
        createdAt: "2026-07-08T17:45:00.000Z",
        openedAt: "2026-07-08T17:45:00.000Z",
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.kind === "alert")).toBe(true);
  });

  it("never groups coverage gaps into correlated finding rows", () => {
    const rows = correlateAlerts([
      makeAlert({
        id: "coverage-1",
        dedupeKey: "dedupe-coverage-1",
        monitorType: "bridge",
        source: "across",
        signalClass: "coverage",
        reasonCode: "BRIDGE_ROUTE_CHECK_ERROR",
        summary: "Across USDC Arbitrum -> Base status source unavailable.",
        createdAt: "2026-07-10T05:05:00.000Z",
        openedAt: "2026-07-10T05:05:00.000Z",
        asset: "USDC",
        route: "Arbitrum -> Base",
      }),
      makeAlert({
        id: "coverage-2",
        dedupeKey: "dedupe-coverage-2",
        monitorType: "bridge",
        source: "across",
        signalClass: "coverage",
        reasonCode: "BRIDGE_ROUTE_CHECK_ERROR",
        summary: "Across ETH Arbitrum -> Base status source unavailable.",
        createdAt: "2026-07-10T05:10:00.000Z",
        openedAt: "2026-07-10T05:10:00.000Z",
        asset: "ETH",
        route: "Arbitrum -> Base",
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.kind === "alert")).toBe(true);
  });
});
