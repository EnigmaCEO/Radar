import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/sce-alerts", () => ({
  SceAlertsError: class SceAlertsError extends Error {},
  fetchSceAlerts: vi.fn(),
}));
vi.mock("@/lib/radar-api-backend", () => ({
  bootstrapRadarAccount: vi.fn(),
}));

import { auth0 } from "@/lib/auth0";
import { bootstrapRadarAccount } from "@/lib/radar-api-backend";
import { fetchSceAlerts } from "@/lib/sce-alerts";
import { GET } from "./route";

describe("alerts route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized without a session", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/alerts"));

    expect(response.status).toBe(401);
  });

  it("preserves lifecycle and object fields from the SCE payload", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(bootstrapRadarAccount).mockResolvedValue({ plan: "radar_signal", isAdmin: false } as never);
    vi.mocked(fetchSceAlerts).mockResolvedValue([
      {
        id: "alert-1",
        monitorType: "lp",
        provider: "curve",
        signalClass: "coverage",
        chain: "Ethereum",
        asset: "USDC/USDT",
        assetPair: "USDC/USDT",
        route: null,
        poolName: "Curve 3pool",
        objectId: "pool-1",
        purpose: "public",
        severity: "warning",
        status: "resolved",
        reasonCode: "LP_POOL_IMBALANCE",
        summary: "summary",
        publicSummary: "public summary",
        whatHappened: "Radar could not read pool status.",
        radarStatus: "Object state unknown while coverage is degraded.",
        lastSuccessfulObservationAt: "2026-07-10T14:05:00.000Z",
        lastObservationAttemptAt: "2026-07-10T15:05:00.000Z",
        consecutiveFailedCycles: 3,
        objectState: "unknown",
        failureCause: "status_source_unavailable",
        coverageTier: "coverage_warning",
        createdAt: "2026-07-08T17:45:00.000Z",
        updatedAt: "2026-07-10T09:00:00.000Z",
        openedAt: "2026-07-08T17:45:00.000Z",
        resolvedAt: "2026-07-10T09:00:00.000Z",
        thresholdName: "warning threshold",
        observedValueLabel: "Observed imbalance: 41.0%",
        thresholdValueLabel: "Threshold: 25.0%",
        declaredHeartbeatSeconds: 1800,
        appliedThresholdSeconds: 2250,
        appliedThresholdKind: "warning_after_seconds",
        thresholdSourceLabel: "chainlink docs",
        evidenceState: "complete_observed_evidence",
        publicVerificationState: "verified_public_alert",
      },
    ] as never);

    const response = await GET(new NextRequest("http://localhost/api/alerts"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        id: "alert-1",
        summary: "public summary",
        signalClass: "coverage",
        asset: "USDC/USDT",
        assetPair: "USDC/USDT",
        poolName: "Curve 3pool",
        objectId: "pool-1",
        whatHappened: "Radar could not read pool status.",
        radarStatus: "Object state unknown while coverage is degraded.",
        lastSuccessfulObservationAt: "2026-07-10T14:05:00.000Z",
        lastObservationAttemptAt: "2026-07-10T15:05:00.000Z",
        consecutiveFailedCycles: 3,
        objectState: "unknown",
        failureCause: "status_source_unavailable",
        coverageTier: "coverage_warning",
        openedAt: "2026-07-08T17:45:00.000Z",
        resolvedAt: "2026-07-10T09:00:00.000Z",
        observedValueLabel: "Observed imbalance: 41.0%",
        thresholdValueLabel: "Threshold: 25.0%",
        declaredHeartbeatSeconds: 1800,
        appliedThresholdSeconds: 2250,
        appliedThresholdKind: "warning_after_seconds",
        thresholdSourceLabel: "chainlink docs",
        evidenceState: "complete_observed_evidence",
        publicVerificationState: "verified_public_alert",
      }),
    ]);
  });

  it("rejects private alert history for Public Record accounts", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(bootstrapRadarAccount).mockResolvedValue({ plan: "free", isAdmin: false } as never);

    const response = await GET(new NextRequest("http://localhost/api/alerts"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Private alert history requires a Watch, Signal, or Desk plan.",
    });
  });
});
