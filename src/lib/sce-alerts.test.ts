import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSceAlertLedger } from "./sce-alerts";

const ORIGINAL_ENV = { ...process.env };

describe("fetchSceAlertLedger", () => {
  beforeEach(() => {
    process.env.SCE_ADMIN_API_KEY = "super-secret-admin-key";
    process.env.NEXT_PUBLIC_API_URL = "https://sce.example.test";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("calls /alert-ledger with since/until and sends the admin key server-side", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchSceAlertLedger({
      since: "2026-07-05T00:00:00.000Z",
      until: "2026-07-05T01:00:00.000Z",
      limit: 50,
      status: "active",
      signalClass: "coverage",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sce.example.test/v1/sce/radar/alert-ledger?since=2026-07-05T00%3A00%3A00.000Z&until=2026-07-05T01%3A00%3A00.000Z&limit=50&status=active&signalClass=coverage",
      expect.objectContaining({
        headers: { "X-SCE-Admin-Key": "super-secret-admin-key" },
        cache: "no-store",
      }),
    );
  });

  it("normalizes ledger response fields including explicit signalClass exactly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            alertId: "alert_1",
            eventId: "event_1",
            cursor: "cursor_1",
            eventType: "alert_updated",
            monitorType: "oracle",
            provider: "Chainlink",
            chain: "Base",
            asset: "USDC",
            assetPair: "USDC/USD",
            route: null,
            poolName: null,
            objectId: "oracle-feed:1",
            objectType: "oracle_feed",
            severity: "warning",
            signalClass: "coverage",
            status: "active",
            reasonCode: "ORACLE_STALE",
            summary: "Oracle event summary",
            publicSummary: "Public oracle summary",
            createdAt: "2026-07-05T00:30:00.000Z",
            updatedAt: "2026-07-05T00:31:00.000Z",
            sourceAlertCreatedAt: "2026-07-05T00:00:00.000Z",
            sourceAlertUpdatedAt: "2026-07-05T00:31:00.000Z",
            openedAt: "2026-07-05T00:00:00.000Z",
            resolvedAt: null,
            evidenceSummary: "Evidence summary",
            severityExplanation: "Warning: feed freshness is delayed.",
            thresholdExplanation: "Threshold exceeded for heartbeat delay.",
            humanRiskSummary: "Protocols may rely on aging values.",
            whatHappened: "Several feeds are refreshing late.",
            whyItMatters: "Late feed refreshes can leave dependent systems on older values.",
            radarStatus: "Monitoring freshness recovery.",
            nextWatch: "Watch for fresh on-chain updates.",
            evidenceExplanation: "Observed heartbeat delay is above normal.",
            thresholdName: "warning_after_seconds",
            observedValueLabel: "420s",
            thresholdValueLabel: "300s",
            declaredHeartbeatSeconds: 240,
            appliedThresholdSeconds: 300,
            appliedThresholdKind: "warning_after_seconds",
            thresholdSourceLabel: "chainlink docs",
            evidenceState: "complete_observed_evidence",
            publicVerificationState: "verified_public_alert",
            lastSuccessfulObservationAt: "2026-07-05T00:15:00.000Z",
            lastObservationAttemptAt: "2026-07-05T00:31:00.000Z",
            consecutiveFailedCycles: 3,
            objectState: "unknown",
            failureCause: "status_source_unavailable",
            coverageTier: "coverage_warning",
            tags: ["tag_1"],
            purpose: "sagitta_dependency",
          },
        ],
      }),
    );

    const events = await fetchSceAlertLedger({
      since: "2026-07-05T00:00:00.000Z",
      until: "2026-07-05T01:00:00.000Z",
    });

    expect(events).toEqual([
      expect.objectContaining({
        alertId: "alert_1",
        eventId: "event_1",
        cursor: "cursor_1",
        signalClass: "coverage",
        publicSummary: "Public oracle summary",
        evidenceSummary: "Evidence summary",
        severityExplanation: "Warning: feed freshness is delayed.",
        thresholdExplanation: "Threshold exceeded for heartbeat delay.",
        humanRiskSummary: "Protocols may rely on aging values.",
        whatHappened: "Several feeds are refreshing late.",
        whyItMatters: "Late feed refreshes can leave dependent systems on older values.",
        radarStatus: "Monitoring freshness recovery.",
        nextWatch: "Watch for fresh on-chain updates.",
        evidenceExplanation: "Observed heartbeat delay is above normal.",
        thresholdName: "warning_after_seconds",
        observedValueLabel: "420s",
        thresholdValueLabel: "300s",
        declaredHeartbeatSeconds: 240,
        appliedThresholdSeconds: 300,
        appliedThresholdKind: "warning_after_seconds",
        thresholdSourceLabel: "chainlink docs",
        evidenceState: "complete_observed_evidence",
        publicVerificationState: "verified_public_alert",
        lastSuccessfulObservationAt: "2026-07-05T00:15:00.000Z",
        lastObservationAttemptAt: "2026-07-05T00:31:00.000Z",
        consecutiveFailedCycles: 3,
        objectState: "unknown",
        failureCause: "status_source_unavailable",
        coverageTier: "coverage_warning",
      }),
    ]);
  });

  it("parses the live ledger envelope shape with alerts and count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          generatedAt: "2026-07-05T09:14:55.116614Z",
          mode: "window",
          count: 1,
          alerts: [
            {
              alertId: "alert_2",
              eventId: "event_2",
              cursor: "cursor_2",
              eventType: "alert_opened",
              monitorType: "oracle",
              provider: "chainlink",
              chain: "Ethereum",
              asset: "USDC",
              assetPair: "USDC/USD",
              severity: "critical",
              signalClass: "alert",
              status: "active",
              reasonCode: "ORACLE_STALE",
              summary: "summary",
              publicSummary: "public summary",
              createdAt: "2026-07-05T00:30:00.000Z",
              updatedAt: "2026-07-05T00:31:00.000Z",
              sourceAlertCreatedAt: "2026-07-05T00:00:00.000Z",
              sourceAlertUpdatedAt: "2026-07-05T00:31:00.000Z",
              openedAt: "2026-07-05T00:00:00.000Z",
              resolvedAt: null,
              evidenceSummary: {
                thresholdName: "critical_after_seconds",
                observedValueLabel: "1200s",
              },
              tags: ["oracle"],
              purpose: "commercial_priority",
            },
          ],
        }),
      }),
    );

    const events = await fetchSceAlertLedger({
      since: "2026-07-05T00:00:00.000Z",
      until: "2026-07-05T01:00:00.000Z",
    });

    expect(events).toEqual([
      expect.objectContaining({
        alertId: "alert_2",
        eventId: "event_2",
        cursor: "cursor_2",
        eventType: "alert_opened",
        signalClass: "alert",
        thresholdName: "critical_after_seconds",
        observedValueLabel: "1200s",
      }),
    ]);
  });

  it("parses the current ledger events envelope even when createdAt is omitted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 1,
          alerts: [],
          events: [
            {
              alertId: "alert_3",
              eventId: "event_3",
              cursor: "cursor_3",
              eventType: "alert_opened",
              monitorType: "oracle",
              provider: "chainlink",
              chain: "Ethereum",
              asset: "USDC",
              assetPair: "USDC/USD",
              severity: "warning",
              signalClass: "alert",
              status: "active",
              reasonCode: "ORACLE_STALE",
              summary: "summary",
              publicSummary: "public summary",
              updatedAt: "2026-07-05T08:28:27.233336Z",
              sourceAlertCreatedAt: "2026-07-05T08:28:27.233336Z",
              sourceAlertUpdatedAt: "2026-07-05T09:01:32.466577Z",
              openedAt: "2026-07-05T08:28:27.233336Z",
              resolvedAt: null,
              tags: ["oracle"],
              purpose: "commercial_priority",
            },
          ],
        }),
      }),
    );

    const events = await fetchSceAlertLedger({
      since: "2026-07-05T00:00:00.000Z",
      until: "2026-07-05T01:00:00.000Z",
    });

    expect(events).toEqual([
      expect.objectContaining({
        alertId: "alert_3",
        eventId: "event_3",
        eventType: "alert_opened",
        createdAt: "2026-07-05T08:28:27.233Z",
        updatedAt: "2026-07-05T08:28:27.233Z",
      }),
    ]);
  });

  it("never returns the admin key in normalized ledger responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            alertId: "alert_1",
            eventId: "event_1",
            eventType: "alert_updated",
            monitorType: "oracle",
            severity: "warning",
            status: "active",
            summary: "summary",
            createdAt: "2026-07-05T00:30:00.000Z",
          },
        ],
      }),
    );

    const events = await fetchSceAlertLedger({
      since: "2026-07-05T00:00:00.000Z",
      until: "2026-07-05T01:00:00.000Z",
    });

    expect(JSON.stringify(events)).not.toContain("super-secret-admin-key");
  });
});
