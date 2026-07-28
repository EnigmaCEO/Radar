import { describe, expect, it } from "vitest";
import type { RadarAlert } from "./api-types";
import {
  buildIntelAlertsAggregation,
  buildInfrastructureHealthSummary,
  buildIntelReportWindows,
  buildProviderReliabilityRows,
  buildProviderReliabilityRowsWithOptions,
} from "./intel-analytics";

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
    reasonCode: overrides.reasonCode ?? "HEARTBEAT_MISSED",
    visibility: overrides.visibility ?? "private",
    provenance: overrides.provenance ?? "live",
    createdAt: overrides.createdAt ?? "2026-07-10T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

function buildProviderRows(alerts: RadarAlert[]) {
  return buildProviderReliabilityRowsWithOptions(alerts, {
    now: new Date("2026-07-14T00:00:00.000Z"),
    scoringWindowLabel: "30d history window",
  });
}

function rowFor(rows: ReturnType<typeof buildProviderRows>, provider: string) {
  const row = rows.find((entry) => entry.provider === provider);
  expect(row).toBeDefined();
  return row!;
}

function makeVerifiedProviderFinding(
  id: string,
  provider: string,
  overrides: Partial<RadarAlert> = {},
): RadarAlert {
  return makeAlert({
    id,
    source: provider,
    publicVerificationState: "verified_public_alert",
    evidenceState: "complete_observed_evidence",
    reasonCode: overrides.reasonCode ?? "ORACLE_STALE",
    openedAt: overrides.openedAt ?? "2026-07-12T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-12T00:00:00.000Z",
    ...overrides,
  });
}

describe("intel-analytics", () => {
  it("resolved short warnings settle to stable current conditions with a clean pattern", () => {
    const row = rowFor(
      buildProviderRows([
        ...Array.from({ length: 4 }, (_, index) =>
          makeVerifiedProviderFinding(`curve-${index + 1}`, "curve", {
            monitorType: "lp",
            reasonCode: "LP_POOL_IMBALANCE",
            severity: "warning",
            status: "resolved",
            openedAt: `2026-07-12T0${index}:00:00.000Z`,
            resolvedAt: `2026-07-12T0${index}:20:00.000Z`,
            updatedAt: `2026-07-12T0${index}:20:00.000Z`,
            poolName: `Curve pool ${index + 1}`,
            objectId: `curve-pool-${index + 1}`,
          }),
        ),
      ]),
      "curve",
    );

    expect(row.currentCondition).toBe("Stable");
    expect(row.patternLabel).toBe("Clean");
    expect(row.activeIncidents).toBe(0);
    expect(row.criticalFindings).toBe(0);
    expect(row.recoveryRate).toBe(100);
    expect(row.longestDurationHours).toBeLessThan(1);
  });

  it("coverage incidents reduce observability score, not condition labels", () => {
    const providerHistory = [
      makeVerifiedProviderFinding("chainlink-1", "chainlink", {
        severity: "critical",
        status: "active",
      }),
      makeVerifiedProviderFinding("chainlink-2", "chainlink", {
        severity: "warning",
        status: "resolved",
        resolvedAt: "2026-07-12T04:00:00.000Z",
      }),
      makeVerifiedProviderFinding("chainlink-3", "chainlink", {
        severity: "watch",
        status: "resolved",
        resolvedAt: "2026-07-12T01:00:00.000Z",
      }),
    ];

    const baseRow = rowFor(buildProviderRows(providerHistory), "chainlink");
    const coverageRow = rowFor(
      buildProviderRows([
        ...providerHistory,
        makeAlert({
          id: "chainlink-coverage",
          source: "chainlink",
          monitorType: "dependency",
          signalClass: "coverage",
          reasonCode: "OBSERVATION_GAP",
          severity: "warning",
          status: "active",
          summary: "source unavailable",
          failureCause: "status_source_unavailable",
          openedAt: "2026-07-13T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        }),
      ]),
      "chainlink",
    );

    expect(baseRow.currentCondition).toBe("Critical");
    expect(coverageRow.currentCondition).toBe(baseRow.currentCondition);
    expect(coverageRow.patternLabel).toBe(baseRow.patternLabel);
    expect(coverageRow.observabilityScore).toBeLessThan(baseRow.observabilityScore);
    expect(coverageRow.coverageIncidents).toBe(1);
  });

  it("long active critical findings create substantially greater burden and a persistent pattern", () => {
    const shortResolved = rowFor(
      buildProviderRows([
        makeVerifiedProviderFinding("short-1", "chainlink", {
          severity: "warning",
          status: "resolved",
          openedAt: "2026-07-12T00:00:00.000Z",
          resolvedAt: "2026-07-12T00:20:00.000Z",
          updatedAt: "2026-07-12T00:20:00.000Z",
          objectId: "feed-1",
        }),
        makeVerifiedProviderFinding("short-2", "chainlink", {
          severity: "warning",
          status: "resolved",
          openedAt: "2026-07-12T01:00:00.000Z",
          resolvedAt: "2026-07-12T01:20:00.000Z",
          updatedAt: "2026-07-12T01:20:00.000Z",
          objectId: "feed-2",
        }),
        makeVerifiedProviderFinding("short-3", "chainlink", {
          severity: "warning",
          status: "resolved",
          openedAt: "2026-07-12T02:00:00.000Z",
          resolvedAt: "2026-07-12T02:20:00.000Z",
          updatedAt: "2026-07-12T02:20:00.000Z",
          objectId: "feed-3",
        }),
      ]),
      "chainlink",
    );
    const longActive = rowFor(
      buildProviderRows([
        makeVerifiedProviderFinding("long-1", "pyth", {
          severity: "critical",
          status: "active",
          openedAt: "2026-07-09T00:00:00.000Z",
          updatedAt: "2026-07-14T00:00:00.000Z",
          objectId: "feed-a",
        }),
        makeVerifiedProviderFinding("long-2", "pyth", {
          severity: "warning",
          status: "resolved",
          openedAt: "2026-07-12T01:00:00.000Z",
          resolvedAt: "2026-07-12T01:30:00.000Z",
          updatedAt: "2026-07-12T01:30:00.000Z",
          objectId: "feed-b",
        }),
        makeVerifiedProviderFinding("long-3", "pyth", {
          severity: "watch",
          status: "resolved",
          openedAt: "2026-07-12T02:00:00.000Z",
          resolvedAt: "2026-07-12T02:20:00.000Z",
          updatedAt: "2026-07-12T02:20:00.000Z",
          objectId: "feed-c",
        }),
      ]),
      "pyth",
    );

    expect(longActive.totalBurden).toBeGreaterThan(shortResolved.totalBurden);
    expect(longActive.durationBurden).toBeGreaterThan(shortResolved.durationBurden);
    expect(longActive.currentCondition).toBe("Critical");
    expect(longActive.patternLabel).toBe("Persistent");
    expect(shortResolved.patternLabel).toBe("Clean");
  });

  it("resolved repeat incidents classify as recurring instead of persistent", () => {
    const row = rowFor(
      buildProviderRows([
        ...Array.from({ length: 4 }, (_, index) =>
          makeVerifiedProviderFinding(`curve-recurring-${index + 1}`, "curve", {
            monitorType: "lp",
            reasonCode: "LP_POOL_IMBALANCE",
            severity: "warning",
            status: "resolved",
            openedAt: `2026-07-12T0${index}:00:00.000Z`,
            resolvedAt: `2026-07-12T0${index}:25:00.000Z`,
            updatedAt: `2026-07-12T0${index}:25:00.000Z`,
            poolName: "Curve 3pool",
            objectId: "curve-3pool",
          }),
        ),
      ]),
      "curve",
    );

    expect(row.activeIncidents).toBe(0);
    expect(row.recoveryRate).toBe(100);
    expect(row.recurrenceRate).toBe(100);
    expect(row.patternLabel).toBe("Recurring");
  });

  it("missing adapters do not count as provider failure", () => {
    const providerHistory = [
      makeVerifiedProviderFinding("across-1", "across", {
        monitorType: "bridge",
        reasonCode: "BRIDGE_ROUTE_DELAYED",
        severity: "warning",
        status: "resolved",
        resolvedAt: "2026-07-12T02:00:00.000Z",
      }),
      makeVerifiedProviderFinding("across-2", "across", {
        monitorType: "bridge",
        reasonCode: "BRIDGE_ROUTE_DELAYED",
        severity: "warning",
        status: "resolved",
        resolvedAt: "2026-07-12T03:00:00.000Z",
      }),
      makeVerifiedProviderFinding("across-3", "across", {
        monitorType: "bridge",
        reasonCode: "BRIDGE_ROUTE_DELAYED",
        severity: "critical",
        status: "active",
      }),
    ];

    const baseRow = rowFor(buildProviderRows(providerHistory), "across");
    const withMissingAdapter = rowFor(
      buildProviderRows([
        ...providerHistory,
        makeAlert({
          id: "across-missing-adapter",
          source: "across",
          monitorType: "dependency",
          signalClass: "diagnostic",
          severity: "warning",
          status: "active",
          reasonCode: "ADAPTER_READ_ERROR",
          summary: "Radar adapter missing for provider route.",
          failureCause: "missing_adapter",
          openedAt: "2026-07-13T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        }),
      ]),
      "across",
    );

    expect(withMissingAdapter.currentCondition).toBe(baseRow.currentCondition);
    expect(withMissingAdapter.patternLabel).toBe(baseRow.patternLabel);
    expect(withMissingAdapter.observabilityScore).toBeLessThan(baseRow.observabilityScore);
    expect(withMissingAdapter.conditionFactors).toEqual(baseRow.conditionFactors);
  });

  it("verified provider-side incidents drive current condition and historical pattern labels", () => {
    const row = rowFor(
      buildProviderRows([
        makeVerifiedProviderFinding("chainlink-1", "chainlink", {
          severity: "critical",
          status: "active",
        }),
        makeVerifiedProviderFinding("chainlink-2", "chainlink", {
          severity: "warning",
          status: "resolved",
          resolvedAt: "2026-07-12T03:00:00.000Z",
        }),
        makeVerifiedProviderFinding("chainlink-3", "chainlink", {
          severity: "watch",
          status: "resolved",
          resolvedAt: "2026-07-12T01:00:00.000Z",
        }),
      ]),
      "chainlink",
    );

    expect(row.findingsEvaluated).toBe(3);
    expect(row.currentCondition).toBe("Critical");
    expect(row.patternLabel).toBe("Persistent");
    expect(row.activeIncidents).toBe(1);
    expect(row.criticalFindings).toBe(1);
  });

  it("raw finding volume is normalized by observation volume", () => {
    const small = rowFor(
      buildProviderRows([
        makeVerifiedProviderFinding("small-1", "small-provider", {
          severity: "warning",
          status: "resolved",
          openedAt: "2026-07-12T00:00:00.000Z",
          resolvedAt: "2026-07-12T00:20:00.000Z",
          updatedAt: "2026-07-12T00:20:00.000Z",
          objectId: "obj-1",
        }),
        makeVerifiedProviderFinding("small-2", "small-provider", {
          severity: "warning",
          status: "resolved",
          openedAt: "2026-07-12T01:00:00.000Z",
          resolvedAt: "2026-07-12T01:20:00.000Z",
          updatedAt: "2026-07-12T01:20:00.000Z",
          objectId: "obj-2",
        }),
        makeVerifiedProviderFinding("small-3", "small-provider", {
          severity: "warning",
          status: "resolved",
          openedAt: "2026-07-12T02:00:00.000Z",
          resolvedAt: "2026-07-12T02:20:00.000Z",
          updatedAt: "2026-07-12T02:20:00.000Z",
          objectId: "obj-3",
        }),
      ]),
      "small-provider",
    );
    const large = rowFor(
      buildProviderRows([
        ...Array.from({ length: 12 }, (_, index) =>
          makeVerifiedProviderFinding(`large-${index + 1}`, "large-provider", {
            severity: "warning",
            status: "resolved",
            openedAt: `2026-07-12T${String(index % 10).padStart(2, "0")}:00:00.000Z`,
            resolvedAt: `2026-07-12T${String(index % 10).padStart(2, "0")}:20:00.000Z`,
            updatedAt: `2026-07-12T${String(index % 10).padStart(2, "0")}:20:00.000Z`,
            objectId: `obj-${index + 1}`,
          }),
        ),
      ]),
      "large-provider",
    );

    expect(Math.abs(small.totalBurden - large.totalBurden)).toBeLessThanOrEqual(0.5);
    expect(small.patternLabel).toBe("Clean");
    expect(large.patternLabel).toBe("Clean");
  });

  it("quarantined findings are excluded from condition scoring", () => {
    const row = rowFor(
      buildProviderRows([
        makeVerifiedProviderFinding("chainlink-1", "chainlink"),
        makeVerifiedProviderFinding("chainlink-2", "chainlink", {
          severity: "warning",
          status: "resolved",
          resolvedAt: "2026-07-12T02:00:00.000Z",
        }),
        makeAlert({
          id: "chainlink-quarantined",
          source: "chainlink",
          severity: "critical",
          status: "resolved",
          summary:
            "Superseded after reference sanity check: Chainlink FRAX/USD was quarantined as invalid evidence.",
          reasonCode: "ORACLE_REFERENCE_DEVIATION",
        }),
      ]),
      "chainlink",
    );

    expect(row.findingsEvaluated).toBe(2);
    expect(row.patternLabel).toBe("Insufficient evidence");
  });

  it("does not render oracle_reference as a provider", () => {
    const rows = buildProviderRows([
      makeAlert({
        id: "reference-without-attribution",
        source: "oracle_reference",
        reasonCode: "ORACLE_REFERENCE_DEVIATION",
        publicVerificationState: "verified_public_alert",
        evidenceState: "complete_observed_evidence",
      }),
    ]);

    expect(rows).toEqual([]);
  });

  it("attributes trusted reference-deviation findings to the actual providers", () => {
    const rows = buildProviderRows([
      makeAlert({
        id: "reference-attributed",
        source: "oracle_reference",
        reasonCode: "ORACLE_REFERENCE_DEVIATION",
        publicVerificationState: "verified_public_alert",
        evidenceState: "complete_observed_evidence",
        tags: ["providers:chainlink,pyth"],
      }),
    ]);

    expect(rows.map((row) => row.provider)).toEqual(["chainlink", "pyth"]);
    expect(rows.every((row) => row.findingsEvaluated === 1)).toBe(true);
  });

  it("returns insufficient evidence for small condition samples", () => {
    const row = rowFor(
      buildProviderRows([
        makeVerifiedProviderFinding("pyth-1", "pyth"),
        makeVerifiedProviderFinding("pyth-2", "pyth", {
          severity: "warning",
          status: "resolved",
          resolvedAt: "2026-07-12T02:00:00.000Z",
        }),
      ]),
      "pyth",
    );

    expect(row.patternLabel).toBe("Insufficient evidence");
    expect(row.confidence).toBe("low");
  });

  it("100% failed observations produce very low observability", () => {
    const row = rowFor(
      buildProviderRows([
        ...Array.from({ length: 6 }, (_, index) =>
          makeAlert({
            id: `across-failure-${index + 1}`,
            source: "across",
            monitorType: "dependency",
            signalClass: "coverage",
            reasonCode: "OBSERVATION_GAP",
            severity: "warning",
            status: "active",
            summary: "source unavailable",
            failureCause: "status_source_unavailable",
            objectId: `route-${index + 1}`,
          }),
        ),
      ]),
      "across",
    );

    expect(row.successfulObservations).toBe(0);
    expect(row.failedObservations).toBe(6);
    expect(row.observabilityScore).toBe(0);
  });

  it("100% successful observations produce high observability", () => {
    const row = rowFor(
      buildProviderRows([
        ...Array.from({ length: 4 }, (_, index) =>
          makeVerifiedProviderFinding(`success-${index + 1}`, "wormhole", {
            monitorType: "bridge",
            reasonCode: "BRIDGE_ROUTE_DELAYED",
            severity: "warning",
            status: "resolved",
            resolvedAt: `2026-07-12T0${index}:20:00.000Z`,
            updatedAt: `2026-07-12T0${index}:20:00.000Z`,
            objectId: `route-${index + 1}`,
          }),
        ),
      ]),
      "wormhole",
    );

    expect(row.failedObservations).toBe(0);
    expect(row.successfulObservations).toBe(4);
    expect(row.observabilityScore).toBe(100);
  });

  it("increases confidence deterministically with evidence volume", () => {
    const low = rowFor(
      buildProviderRows([
        makeVerifiedProviderFinding("low-1", "low-provider"),
        makeVerifiedProviderFinding("low-2", "low-provider", {
          severity: "warning",
          status: "resolved",
          resolvedAt: "2026-07-12T01:00:00.000Z",
        }),
        makeVerifiedProviderFinding("low-3", "low-provider", {
          severity: "watch",
          status: "resolved",
          resolvedAt: "2026-07-12T02:00:00.000Z",
        }),
      ]),
      "low-provider",
    );
    const medium = rowFor(
      buildProviderRows([
        makeVerifiedProviderFinding("medium-1", "medium-provider"),
        makeVerifiedProviderFinding("medium-2", "medium-provider", {
          severity: "warning",
          status: "resolved",
          resolvedAt: "2026-07-12T01:00:00.000Z",
        }),
        makeVerifiedProviderFinding("medium-3", "medium-provider", {
          severity: "watch",
          status: "resolved",
          resolvedAt: "2026-07-12T02:00:00.000Z",
        }),
        makeVerifiedProviderFinding("medium-4", "medium-provider", {
          severity: "warning",
          status: "active",
          updatedAt: "2026-07-13T00:00:00.000Z",
        }),
        makeAlert({
          id: "medium-coverage-1",
          source: "medium-provider",
          monitorType: "dependency",
          signalClass: "coverage",
          reasonCode: "OBSERVATION_GAP",
          severity: "warning",
          status: "active",
          summary: "source unavailable",
        }),
        makeAlert({
          id: "medium-coverage-2",
          source: "medium-provider",
          monitorType: "dependency",
          signalClass: "diagnostic",
          reasonCode: "API_READ_ERROR",
          severity: "warning",
          status: "resolved",
          summary: "API read failure.",
        }),
      ]),
      "medium-provider",
    );
    const high = rowFor(
      buildProviderRows([
        ...Array.from({ length: 8 }, (_, index) =>
          makeVerifiedProviderFinding(`high-${index + 1}`, "high-provider", {
            severity: index % 3 === 0 ? "critical" : index % 3 === 1 ? "warning" : "watch",
            status: index % 2 === 0 ? "resolved" : "active",
            updatedAt: `2026-07-1${(index % 4) + 1}T00:00:00.000Z`,
            resolvedAt:
              index % 2 === 0 ? `2026-07-1${(index % 4) + 1}T02:00:00.000Z` : undefined,
          }),
        ),
        ...Array.from({ length: 4 }, (_, index) =>
          makeAlert({
            id: `high-observability-${index + 1}`,
            source: "high-provider",
            monitorType: "dependency",
            signalClass: index % 2 === 0 ? "coverage" : "diagnostic",
            reasonCode: index % 2 === 0 ? "OBSERVATION_GAP" : "RPC_READ_ERROR",
            severity: "warning",
            status: index % 2 === 0 ? "active" : "resolved",
            summary: index % 2 === 0 ? "source unavailable" : "RPC read failure.",
          }),
        ),
      ]),
      "high-provider",
    );

    expect(low.confidence).toBe("low");
    expect(medium.confidence).toBe("medium");
    expect(high.confidence).toBe("high");
  });

  it("excludes quarantined and diagnostic records from condition scoring", () => {
    const row = rowFor(
      buildProviderRows([
        makeVerifiedProviderFinding("base-1", "chainlink", { objectId: "one" }),
        makeVerifiedProviderFinding("base-2", "chainlink", {
          severity: "warning",
          status: "resolved",
          resolvedAt: "2026-07-12T02:00:00.000Z",
          objectId: "two",
        }),
        makeVerifiedProviderFinding("base-3", "chainlink", {
          severity: "watch",
          status: "resolved",
          resolvedAt: "2026-07-12T03:00:00.000Z",
          objectId: "three",
        }),
        makeAlert({
          id: "diag-1",
          source: "chainlink",
          signalClass: "diagnostic",
          reasonCode: "RPC_READ_ERROR",
          summary: "RPC read failure.",
          status: "active",
          objectId: "diag",
        }),
        makeAlert({
          id: "quarantined-1",
          source: "oracle_reference",
          reasonCode: "ORACLE_REFERENCE_DEVIATION",
          summary: "Superseded after reference sanity check: quarantined.",
          status: "resolved",
          objectId: "quarantine",
          tags: ["providers:chainlink"],
        }),
      ]),
      "chainlink",
    );

    expect(row.findingsEvaluated).toBe(3);
    expect(row.excludedRecords).toBe(2);
    expect(row.patternLabel).toBe("Persistent");
  });

  it("keeps labels deterministic and observability bounded from 0 to 100", () => {
    const rows = buildProviderRows([
      makeVerifiedProviderFinding("bound-1", "provider-a", {
        severity: "critical",
        status: "active",
        openedAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-07-14T00:00:00.000Z",
        objectId: "a-1",
      }),
      makeVerifiedProviderFinding("bound-2", "provider-a", {
        severity: "warning",
        status: "resolved",
        resolvedAt: "2026-07-12T02:00:00.000Z",
        objectId: "a-2",
      }),
      makeVerifiedProviderFinding("bound-3", "provider-a", {
        severity: "watch",
        status: "resolved",
        resolvedAt: "2026-07-12T03:00:00.000Z",
        objectId: "a-3",
      }),
      makeAlert({
        id: "bound-fail",
        source: "provider-a",
        signalClass: "coverage",
        reasonCode: "OBSERVATION_GAP",
        summary: "source unavailable",
        objectId: "a-4",
      }),
      makeVerifiedProviderFinding("bound-4", "provider-b", {
        severity: "warning",
        status: "resolved",
        resolvedAt: "2026-07-12T01:00:00.000Z",
        objectId: "b-1",
      }),
      makeVerifiedProviderFinding("bound-5", "provider-b", {
        severity: "warning",
        status: "resolved",
        resolvedAt: "2026-07-12T02:00:00.000Z",
        objectId: "b-2",
      }),
      makeVerifiedProviderFinding("bound-6", "provider-b", {
        severity: "warning",
        status: "resolved",
        resolvedAt: "2026-07-12T03:00:00.000Z",
        objectId: "b-3",
      }),
    ]);

    const rerun = buildProviderRows([
      makeVerifiedProviderFinding("bound-1", "provider-a", {
        severity: "critical",
        status: "active",
        openedAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-07-14T00:00:00.000Z",
        objectId: "a-1",
      }),
      makeVerifiedProviderFinding("bound-2", "provider-a", {
        severity: "warning",
        status: "resolved",
        resolvedAt: "2026-07-12T02:00:00.000Z",
        objectId: "a-2",
      }),
      makeVerifiedProviderFinding("bound-3", "provider-a", {
        severity: "watch",
        status: "resolved",
        resolvedAt: "2026-07-12T03:00:00.000Z",
        objectId: "a-3",
      }),
      makeAlert({
        id: "bound-fail",
        source: "provider-a",
        signalClass: "coverage",
        reasonCode: "OBSERVATION_GAP",
        summary: "source unavailable",
        objectId: "a-4",
      }),
      makeVerifiedProviderFinding("bound-4", "provider-b", {
        severity: "warning",
        status: "resolved",
        resolvedAt: "2026-07-12T01:00:00.000Z",
        objectId: "b-1",
      }),
      makeVerifiedProviderFinding("bound-5", "provider-b", {
        severity: "warning",
        status: "resolved",
        resolvedAt: "2026-07-12T02:00:00.000Z",
        objectId: "b-2",
      }),
      makeVerifiedProviderFinding("bound-6", "provider-b", {
        severity: "warning",
        status: "resolved",
        resolvedAt: "2026-07-12T03:00:00.000Z",
        objectId: "b-3",
      }),
    ]);

    expect(rows).toEqual(rerun);
    for (const row of rows) {
      expect(["Stable", "Degraded", "Critical", "No active issues"]).toContain(
        row.currentCondition,
      );
      expect(["Clean", "Recurring", "Persistent", "Insufficient evidence"]).toContain(
        row.patternLabel,
      );
      expect(row.observabilityScore).toBeGreaterThanOrEqual(0);
      expect(row.observabilityScore).toBeLessThanOrEqual(100);
    }
  });

  it("builds weekly and monthly report summaries from visible alerts", () => {
    const windows = buildIntelReportWindows(
      [
        makeAlert({
          id: "recent-active",
          source: "chainlink",
          severity: "critical",
          status: "active",
          createdAt: "2026-07-13T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        }),
        makeAlert({
          id: "recent-resolved",
          source: "wormhole",
          severity: "warning",
          status: "resolved",
          createdAt: "2026-07-12T00:00:00.000Z",
          updatedAt: "2026-07-12T00:00:00.000Z",
          resolvedAt: "2026-07-12T00:00:00.000Z",
        }),
        makeAlert({
          id: "older-resolved",
          source: "pyth",
          severity: "watch",
          status: "resolved",
          createdAt: "2026-06-25T00:00:00.000Z",
          updatedAt: "2026-06-25T00:00:00.000Z",
          resolvedAt: "2026-06-25T00:00:00.000Z",
        }),
      ],
      new Date("2026-07-14T00:00:00.000Z"),
    );

    expect(windows).toHaveLength(2);
    expect(windows[0]).toEqual(
      expect.objectContaining({
        title: "Weekly report",
        summary: expect.objectContaining({
          totalAlerts: 2,
          activeAlerts: 1,
          providersTracked: 2,
        }),
      }),
    );
    expect(windows[1]?.summary.totalAlerts).toBe(3);
  });

  it("builds Intel alert aggregations per object, chain, and type", () => {
    const aggregation = buildIntelAlertsAggregation([
      makeAlert({
        id: "eth-object-1",
        source: "chainlink",
        monitorType: "oracle",
        asset: "ETH",
        chain: "Ethereum",
        severity: "critical",
        status: "active",
        summary: "ETH feed stale",
        updatedAt: "2026-07-14T00:00:00.000Z",
      }),
      makeAlert({
        id: "eth-object-2",
        source: "chainlink",
        monitorType: "oracle",
        asset: "ETH",
        chain: "Ethereum",
        severity: "warning",
        status: "resolved",
        summary: "ETH feed recovered",
        updatedAt: "2026-07-13T00:00:00.000Z",
        resolvedAt: "2026-07-13T00:00:00.000Z",
      }),
      makeAlert({
        id: "base-coverage",
        source: "rpc",
        monitorType: "bridge",
        route: "USDC -> ETH",
        chain: "Base",
        signalClass: "coverage",
        reasonCode: "OBSERVATION_GAP",
        severity: "warning",
        status: "active",
        summary: "source unavailable",
        updatedAt: "2026-07-14T01:00:00.000Z",
      }),
    ]);

    expect(aggregation.byObject[0]).toEqual(
      expect.objectContaining({
        label: "ETH · Ethereum",
        totalAlerts: 2,
        activeAlerts: 1,
        resolvedAlerts: 1,
        criticalAlerts: 1,
      }),
    );
    expect(aggregation.byChain[0]).toEqual(
      expect.objectContaining({
        label: "Ethereum",
        totalAlerts: 2,
      }),
    );
    expect(aggregation.byType.map((row) => row.label)).toEqual(["oracle", "coverage"]);
  });

  it("buckets infrastructure openings and recoveries by day", () => {
    const summary = buildInfrastructureHealthSummary(
      [
        makeAlert({
          id: "coverage-open",
          signalClass: "coverage",
          reasonCode: "OBSERVATION_GAP",
          status: "active",
          severity: "warning",
          openedAt: "2026-07-13T12:00:00.000Z",
          createdAt: "2026-07-13T12:00:00.000Z",
          updatedAt: "2026-07-13T12:00:00.000Z",
        }),
        makeAlert({
          id: "resolved-critical",
          severity: "critical",
          status: "resolved",
          source: "wormhole",
          chain: "Ethereum",
          openedAt: "2026-07-12T12:00:00.000Z",
          createdAt: "2026-07-12T12:00:00.000Z",
          updatedAt: "2026-07-13T12:00:00.000Z",
          resolvedAt: "2026-07-13T12:00:00.000Z",
        }),
      ],
      3,
      new Date("2026-07-14T00:00:00.000Z"),
    );

    const jul12 = summary.timeline.find((point) => point.dateKey === "2026-07-12");
    const jul13 = summary.timeline.find((point) => point.dateKey === "2026-07-13");
    const jul14 = summary.timeline.find((point) => point.dateKey === "2026-07-14");

    expect(jul12).toEqual(
      expect.objectContaining({
        totalFindingsOpened: 1,
        criticalOpened: 1,
        totalTimelineActivity: 1,
        backlogFindings: 1,
      }),
    );
    expect(jul13).toEqual(
      expect.objectContaining({
        totalFindingsOpened: 0,
        resolvedFindings: 1,
        coverageOpened: 1,
        totalTimelineActivity: 1,
        backlogFindings: 0,
      }),
    );
    expect(jul14).toEqual(expect.objectContaining({ backlogFindings: 0 }));
    expect(summary.firstRecordedDateKey).toBe("2026-07-12");
    expect(summary.recordedActivityTotal).toBe(2);
    expect(summary.findingsOpenedTotal).toBe(1);
    expect(summary.resolvedFindingsTotal).toBe(1);
    expect(summary.coverageIncidentsTotal).toBe(1);
    expect(summary.activeBacklogTotal).toBe(0);
    expect(summary.historyByMonitor).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "coverage", count: 1 }),
        expect.objectContaining({ label: "oracle", count: 1 }),
      ]),
    );
    expect(summary.historyByChain[0]).toEqual(
      expect.objectContaining({ label: "Ethereum", count: 1 }),
    );
  });
});
