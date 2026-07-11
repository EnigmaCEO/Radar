import { describe, expect, it } from "vitest";
import type { RadarAlert } from "./api-types";
import { groupCoverageGapAlerts } from "./coverage-gap-grouping";

function makeAlert(overrides: Partial<RadarAlert> = {}): RadarAlert {
  return {
    id: "alert-1",
    dedupeKey: "dedupe-1",
    monitorType: "bridge",
    source: "across",
    severity: "warning",
    status: "resolved",
    confidence: 1,
    summary: "Across USDC status source unavailable.",
    reasonCode: "BRIDGE_ROUTE_CHECK_ERROR",
    visibility: "private",
    provenance: "live",
    signalClass: "coverage",
    createdAt: "2026-07-09T02:00:00.000Z",
    updatedAt: "2026-07-09T03:00:00.000Z",
    openedAt: "2026-07-09T02:00:00.000Z",
    resolvedAt: "2026-07-09T03:00:00.000Z",
    bridge: "across",
    asset: "USDC",
    failureCause: "status_source_unavailable",
    objectState: "unknown",
    ...overrides,
  };
}

describe("groupCoverageGapAlerts", () => {
  it("collapses same-cause route matrices into one coverage incident", () => {
    const groups = groupCoverageGapAlerts([
      makeAlert({ id: "a1", route: "Base -> Ethereum" }),
      makeAlert({ id: "a2", route: "Ethereum -> Base", openedAt: "2026-07-09T02:10:00.000Z" }),
      makeAlert({ id: "a3", route: "Arbitrum -> Base", openedAt: "2026-07-09T02:15:00.000Z" }),
      makeAlert({ id: "a4", route: "Base -> Arbitrum", openedAt: "2026-07-09T02:20:00.000Z" }),
      makeAlert({ id: "a5", route: "Optimism -> Ethereum", openedAt: "2026-07-09T02:25:00.000Z" }),
      makeAlert({ id: "a6", route: "Ethereum -> Optimism", openedAt: "2026-07-09T02:30:00.000Z" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      title: "Across USDC — status source unavailable",
      routeCount: 6,
      status: "resolved",
    });
    expect(groups[0]?.routes).toEqual([
      "Arbitrum↔Base",
      "Base↔Ethereum",
      "Optimism↔Ethereum",
    ]);
  });

  it("splits distinct incidents when the same provider/cause reoccurs outside the incident window", () => {
    const groups = groupCoverageGapAlerts([
      makeAlert({ id: "a1", route: "Base -> Ethereum", openedAt: "2026-07-09T02:00:00.000Z" }),
      makeAlert({ id: "a2", route: "Base -> Ethereum", openedAt: "2026-07-09T08:30:00.000Z" }),
    ]);

    expect(groups).toHaveLength(2);
  });
});
